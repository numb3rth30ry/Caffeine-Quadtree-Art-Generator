import { backendInterface, FileReference } from '../backend';

const MAXIMUM_CONCURRENT_UPLOADS = 10;

class YHash {
    public readonly bytes: Uint8Array;

    constructor(bytes: Uint8Array) {
        if (bytes.length !== 32) {
            throw new Error(`YHash must be exactly 32 bytes, got ${bytes.length}`);
        }
        this.bytes = new Uint8Array(bytes);
    }

    public static async fromBytes(data: Uint8Array): Promise<YHash> {
        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        return new YHash(new Uint8Array(hashBuffer));
    }

    public static fromHex(hexString: string): YHash {
        const bytes = new Uint8Array(hexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
        return new YHash(bytes);
    }

    public toShaString(): string {
        return `sha256:${this.toHex()}`;
    }

    public toString(): string {
        throw new Error('toString is not supported for YHash');
    }

    public static fromShaString(hash: string): YHash {
        return YHash.fromHex(hash.replace('sha256:', ''));
    }

    private toHex(): string {
        return Array.from(this.bytes)
            .map((b: number) => b.toString(16).padStart(2, '0'))
            .join('');
    }
}

type TreeNode = {
    hash: YHash;
    left: TreeNode | null;
    right: TreeNode | null;
};

type TreeNodeJSON = {
    hash: string;
    left: TreeNodeJSON | null;
    right: TreeNodeJSON | null;
};

function nodeToJSON(node: TreeNode): TreeNodeJSON {
    return {
        hash: node.hash.toShaString(),
        left: node.left ? nodeToJSON(node.left) : null,
        right: node.right ? nodeToJSON(node.right) : null
    };
}

type BlobHashTreeJSON = {
    tree_type: 'BMT';
    chunk_hashes: string[];
    tree: TreeNodeJSON;
};

class BlobHashTree {
    public tree_type: 'BMT';
    public chunk_hashes: YHash[];
    public tree: TreeNode;

    constructor(tree_type: 'BMT', chunk_hashes: YHash[], tree: TreeNode) {
        this.tree_type = tree_type;
        this.chunk_hashes = chunk_hashes;
        this.tree = tree;
    }

    public static async build(chunkHashes: YHash[]): Promise<BlobHashTree> {
        if (chunkHashes.length === 0) {
            throw new Error('Cannot build hash tree from empty chunks');
        }
        let level: TreeNode[] = chunkHashes.map((hash) => ({
            hash: hash,
            left: null,
            right: null
        }));
        while (level.length > 1) {
            const nextLevel: TreeNode[] = [];
            for (let index = 0; index < level.length; index += 2) {
                const left = level[index];
                const right = index + 1 < level.length ? level[index + 1] : null;
                let rightBytes: Uint8Array;
                if (right === null) {
                    rightBytes = new TextEncoder().encode('UNBALANCED');
                } else {
                    rightBytes = right.hash.bytes;
                }
                const combined = new Uint8Array(left.hash.bytes.length + rightBytes.length);
                combined.set(left.hash.bytes);
                combined.set(rightBytes, left.hash.bytes.length);
                const parentHash = await YHash.fromBytes(combined);
                nextLevel.push({
                    hash: parentHash,
                    left: left,
                    right: right
                });
            }
            level = nextLevel;
        }
        const rootNode = level[0];
        return new BlobHashTree('BMT', chunkHashes, rootNode);
    }

    public toJSON(): BlobHashTreeJSON {
        return {
            tree_type: this.tree_type,
            chunk_hashes: this.chunk_hashes.map((h) => h.toShaString()),
            tree: nodeToJSON(this.tree)
        };
    }
}

class StorageGatewayClient {
    constructor(private readonly storageGatewayUrl: string) {}

    public getStorageGatewayUrl(): string {
        return this.storageGatewayUrl;
    }

    public async uploadChunk(
        blobRootHash: YHash,
        chunkHash: YHash,
        chunkIndex: number,
        chunkData: Uint8Array,
        bucketName: string,
        owner: string
    ): Promise<{ isComplete: boolean }> {
        const url = `${this.storageGatewayUrl}/chunk`;
        const requestBody = {
            blob_hash: blobRootHash.toShaString(),
            chunk_hash: chunkHash.toShaString(),
            chunk_index: chunkIndex,
            chunk_data: Array.from(chunkData),
            bucket_name: bucketName,
            owner: owner
        };
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Failed to upload chunk ${chunkIndex}: ${response.status} ${response.statusText} - ${errorText}`
            );
        }
        const result = (await response.json()) as {
            status: string;
        };
        return {
            isComplete: result.status === 'blob_complete'
        };
    }

    public async uploadBlobTree(
        blobHashTree: BlobHashTree,
        bucketName: string,
        numBlobBytes: number,
        owner: string
    ): Promise<void> {
        const url = `${this.storageGatewayUrl}/blob-tree`;
        const requestBody = {
            blob_tree: blobHashTree.toJSON(),
            bucket_name: bucketName,
            num_blob_bytes: numBlobBytes,
            owner: owner
        };
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to upload blob tree: ${response.status} ${response.statusText} - ${errorText}`);
        }
    }
}

export class StorageClient {
    private readonly storageGatewayClient: StorageGatewayClient;

    public constructor(
        private readonly actor: backendInterface,
        private readonly bucket: string,
        storageGatewayUrl: string,
        private readonly owner: string
    ) {
        this.storageGatewayClient = new StorageGatewayClient(storageGatewayUrl);
    }

    public async putFile(
        path: string,
        file: File,
        onProgress?: (percentage: number) => void
    ): Promise<{
        path: string;
        hash: string;
        url: string;
    }> {
        if (!path) {
            throw new Error('Path is required');
        }
        const { chunks, chunkHashes, blobHashTree } = await this.processFileForUpload(file);
        await this.storageGatewayClient.uploadBlobTree(blobHashTree, this.bucket, file.size, this.owner);
        const blobRootHash = blobHashTree.tree.hash;
        await this.parallelUpload(chunks, chunkHashes, blobRootHash, onProgress);
        const hash = blobRootHash.toShaString();
        await this.actor.registerFileReference(path, hash);
        const url = await this.getDirectURL(path);
        return { path, hash, url };
    }

    public async listObjects(): Promise<FileReference[]> {
        return await this.actor.listFileReferences();
    }

    public async getDirectURL(path: string): Promise<string> {
        if (!path) {
            throw new Error('Path must not be empty');
        }
        const fileReference = await this.actor.getFileReference(path);
        return `${this.storageGatewayClient.getStorageGatewayUrl()}/blob?blob_hash=${encodeURIComponent(fileReference.hash)}&owner_id=${encodeURIComponent(this.owner)}`;
    }

    private async processFileForUpload(file: File): Promise<{
        chunks: Blob[];
        chunkHashes: YHash[];
        blobHashTree: BlobHashTree;
    }> {
        const chunks = this.createFileChunks(file);
        const chunkHashes: YHash[] = [];
        for (let i = 0; i < chunks.length; i++) {
            const chunkData = new Uint8Array(await chunks[i].arrayBuffer());
            const hash = await YHash.fromBytes(chunkData);
            chunkHashes.push(hash);
        }
        const blobHashTree = await BlobHashTree.build(chunkHashes);
        return { chunks, chunkHashes, blobHashTree };
    }

    private async parallelUpload(
        chunks: Blob[],
        chunkHashes: YHash[],
        blobRootHash: YHash,
        onProgress: ((percentage: number) => void) | undefined
    ): Promise<void> {
        let completedChunks = 0;
        const uploadSingleChunk = async (index: number): Promise<void> => {
            const chunkData = new Uint8Array(await chunks[index].arrayBuffer());
            const chunkHash = chunkHashes[index];
            await this.storageGatewayClient.uploadChunk(
                blobRootHash,
                chunkHash,
                index,
                chunkData,
                this.bucket,
                this.owner
            );
            // Use atomic increment to avoid race conditions
            const currentCompleted = ++completedChunks;
            if (onProgress != null) {
                const percentage = chunks.length == 0 ? 100 : Math.round((currentCompleted / chunks.length) * 100);
                onProgress(percentage);
            }
        };
        await Promise.all(
            Array.from({ length: MAXIMUM_CONCURRENT_UPLOADS }, async (_, workerId) => {
                for (let i = workerId; i < chunks.length; i += MAXIMUM_CONCURRENT_UPLOADS) {
                    await uploadSingleChunk(i);
                }
            })
        );
    }

    private createFileChunks(file: File, chunkSize = 1024 * 1024): Blob[] {
        const chunks: Blob[] = [];
        const totalChunks = Math.ceil(file.size / chunkSize);
        for (let index = 0; index < totalChunks; index++) {
            const start = index * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const chunk = file.slice(start, end);
            chunks.push(chunk);
        }
        return chunks;
    }
}
