import Registry "blob-storage/registry";
import Text "mo:base/Text";

persistent actor {
    // ...

    let registry = Registry.new();

    // All the following functions are required to be added, keep the name as showed here
    // Do not modify these functions, as they are required by the frontend to operate.

    public func registerFileReference(path : Text, hash: Text) : async () {
        Registry.add(registry, path, hash);
    };

    public query func getFileReference(path: Text) : async Registry.FileReference {
        Registry.get(registry, path);
    };

    public query func listFileReferences(): async [Registry.FileReference] {
        Registry.list(registry);
    };

    public func dropFileReference(path : Text) : async () {
        Registry.remove(registry, path);
    };
};

