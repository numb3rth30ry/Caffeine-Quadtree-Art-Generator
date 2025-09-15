interface QuadNode {
  x: number;
  y: number;
  width: number;
  height: number;
  color: [number, number, number];
  children?: QuadNode[];
}

interface ImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface QuadtreeOptions {
  cellShape: 'square' | 'rectangle';
  textureStyle: 'filled' | 'circle' | 'diagonal' | 'crosshatch' | 'hexagons' | 'triangles';
  showEdges: boolean;
  maxDepth: number;
  minSize: number;
}

export async function generateQuadtreeArt(
  imageUrl: string, 
  options: QuadtreeOptions = {
    cellShape: 'square',
    textureStyle: 'filled',
    showEdges: true,
    maxDepth: 6,
    minSize: 8
  }
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        // Create canvas to get image data
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Set canvas size with higher resolution (increased from 800 to 1600)
        const maxSize = 1600;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        
        // Draw image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Generate quadtree
        const quadtree = buildQuadtree(
          imageData, 
          0, 
          0, 
          canvas.width, 
          canvas.height, 
          options.minSize,
          options.maxDepth,
          0,
          options.cellShape
        );
        
        // Create result canvas with even higher resolution for export
        const resultCanvas = document.createElement('canvas');
        const exportScale = 2; // Double the resolution for export
        resultCanvas.width = canvas.width * exportScale;
        resultCanvas.height = canvas.height * exportScale;
        const resultCtx = resultCanvas.getContext('2d')!;
        
        // Scale the context for higher resolution rendering
        resultCtx.scale(exportScale, exportScale);
        
        // Clear canvas with white background
        resultCtx.fillStyle = 'white';
        resultCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw quadtree
        drawQuadtree(resultCtx, quadtree, options);
        
        resolve(resultCanvas);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}

export async function generateQuadtreeSVG(
  imageUrl: string, 
  options: QuadtreeOptions = {
    cellShape: 'square',
    textureStyle: 'filled',
    showEdges: true,
    maxDepth: 6,
    minSize: 8
  }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        // Create canvas to get image data
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Set canvas size with high resolution
        const maxSize = 1600;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        
        // Draw image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Generate quadtree
        const quadtree = buildQuadtree(
          imageData, 
          0, 
          0, 
          canvas.width, 
          canvas.height, 
          options.minSize,
          options.maxDepth,
          0,
          options.cellShape
        );
        
        // Generate SVG content
        const svgContent = generateSVGFromQuadtree(quadtree, canvas.width, canvas.height, options);
        
        resolve(svgContent);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}

function generateSVGFromQuadtree(node: QuadNode, width: number, height: number, options: QuadtreeOptions): string {
  let svgElements: string[] = [];
  
  function traverseNode(node: QuadNode, depth: number = 0) {
    if (node.children) {
      // Traverse children
      for (const child of node.children) {
        traverseNode(child, depth + 1);
      }
    } else {
      // Generate SVG element for leaf node
      const color = `rgb(${Math.round(node.color[0])}, ${Math.round(node.color[1])}, ${Math.round(node.color[2])})`;
      
      switch (options.textureStyle) {
        case 'filled':
          svgElements.push(`<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="${color}" ${options.showEdges ? 'stroke="rgba(0,0,0,0.3)" stroke-width="0.5"' : ''}/>`);
          break;
          
        case 'circle':
          const centerX = node.x + node.width / 2;
          const centerY = node.y + node.height / 2;
          const radiusX = node.width / 2;
          const radiusY = node.height / 2;
          svgElements.push(`<ellipse cx="${centerX}" cy="${centerY}" rx="${radiusX}" ry="${radiusY}" fill="${color}" ${options.showEdges ? 'stroke="rgba(0,0,0,0.3)" stroke-width="0.5"' : ''}/>`);
          break;
          
        case 'diagonal':
          const spacing = Math.max(2, Math.min(node.width, node.height) / 8);
          let pathData = '';
          for (let i = -node.height; i < node.width; i += spacing) {
            pathData += `M${node.x + i},${node.y} L${node.x + i + node.height},${node.y + node.height} `;
          }
          svgElements.push(`<path d="${pathData}" stroke="${color}" stroke-width="1" fill="none"/>`);
          if (options.showEdges) {
            svgElements.push(`<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="0.5"/>`);
          }
          break;
          
        case 'crosshatch':
          const crossSpacing = Math.max(2, Math.min(node.width, node.height) / 6);
          let crossPathData = '';
          // Diagonal lines from top-left to bottom-right
          for (let i = -node.height; i < node.width; i += crossSpacing) {
            crossPathData += `M${node.x + i},${node.y} L${node.x + i + node.height},${node.y + node.height} `;
          }
          // Diagonal lines from top-right to bottom-left
          for (let i = 0; i < node.width + node.height; i += crossSpacing) {
            crossPathData += `M${node.x + i},${node.y} L${node.x + i - node.height},${node.y + node.height} `;
          }
          svgElements.push(`<path d="${crossPathData}" stroke="${color}" stroke-width="1" fill="none"/>`);
          if (options.showEdges) {
            svgElements.push(`<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="0.5"/>`);
          }
          break;
          
        case 'hexagons':
          const hexCenterX = node.x + node.width / 2;
          const hexCenterY = node.y + node.height / 2;
          const hexPoints = generateHexagonPointsForCell(node.x, node.y, node.width, node.height);
          svgElements.push(`<polygon points="${hexPoints}" fill="${color}" ${options.showEdges ? 'stroke="rgba(0,0,0,0.3)" stroke-width="0.5"' : ''}/>`);
          break;
          
        case 'triangles':
          const triPoints = generateTrianglePointsForCell(node.x, node.y, node.width, node.height, depth % 2 === 0);
          svgElements.push(`<polygon points="${triPoints}" fill="${color}" ${options.showEdges ? 'stroke="rgba(0,0,0,0.3)" stroke-width="0.5"' : ''}/>`);
          break;
      }
    }
  }
  
  traverseNode(node);
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  ${svgElements.join('\n  ')}
</svg>`;
}

function generateHexagonPointsForCell(x: number, y: number, width: number, height: number): string {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  
  // Use the smaller dimension to ensure the hexagon fits completely within the cell
  const size = Math.min(width, height);
  
  // For a regular hexagon to fill the cell completely, we need to scale it properly
  // The hexagon should touch the cell boundaries
  const radius = size / 2;
  
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3; // 60 degrees in radians
    const px = centerX + radius * Math.cos(angle);
    const py = centerY + radius * Math.sin(angle);
    points.push(`${px},${py}`);
  }
  return points.join(' ');
}

function generateTrianglePointsForCell(x: number, y: number, width: number, height: number, pointUp: boolean): string {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  
  // Use the smaller dimension to ensure the triangle fits completely within the cell
  const size = Math.min(width, height);
  
  // For an equilateral triangle to fill the cell completely
  const halfBase = size / 2;
  const triangleHeight = (size * Math.sqrt(3)) / 2;
  const halfHeight = triangleHeight / 2;
  
  if (pointUp) {
    // Triangle pointing up - vertices touch cell boundaries
    const top = `${centerX},${centerY - halfHeight}`;
    const bottomLeft = `${centerX - halfBase},${centerY + halfHeight}`;
    const bottomRight = `${centerX + halfBase},${centerY + halfHeight}`;
    return `${top} ${bottomLeft} ${bottomRight}`;
  } else {
    // Triangle pointing down - vertices touch cell boundaries
    const bottom = `${centerX},${centerY + halfHeight}`;
    const topLeft = `${centerX - halfBase},${centerY - halfHeight}`;
    const topRight = `${centerX + halfBase},${centerY - halfHeight}`;
    return `${bottom} ${topLeft} ${topRight}`;
  }
}

function buildQuadtree(
  imageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number,
  minSize: number,
  maxDepth: number,
  currentDepth: number,
  cellShape: 'square' | 'rectangle'
): QuadNode {
  const avgColor = getAverageColor(imageData, x, y, width, height);
  const variance = getColorVariance(imageData, x, y, width, height, avgColor);
  
  // If we've reached max depth, the region is small enough, or has low variance, make it a leaf
  if (currentDepth >= maxDepth || width <= minSize || height <= minSize || variance < 1000) {
    return {
      x,
      y,
      width,
      height,
      color: avgColor
    };
  }
  
  // Subdivide based on cell shape preference
  let children: QuadNode[];
  
  if (cellShape === 'square') {
    // Traditional quadtree subdivision (4 squares)
    const halfWidth = Math.floor(width / 2);
    const halfHeight = Math.floor(height / 2);
    
    children = [
      buildQuadtree(imageData, x, y, halfWidth, halfHeight, minSize, maxDepth, currentDepth + 1, cellShape),
      buildQuadtree(imageData, x + halfWidth, y, width - halfWidth, halfHeight, minSize, maxDepth, currentDepth + 1, cellShape),
      buildQuadtree(imageData, x, y + halfHeight, halfWidth, height - halfHeight, minSize, maxDepth, currentDepth + 1, cellShape),
      buildQuadtree(imageData, x + halfWidth, y + halfHeight, width - halfWidth, height - halfHeight, minSize, maxDepth, currentDepth + 1, cellShape)
    ];
  } else {
    // Rectangle subdivision - alternate between horizontal and vertical splits
    const splitHorizontally = (currentDepth % 2 === 0);
    
    if (splitHorizontally && height > minSize * 2) {
      const halfHeight = Math.floor(height / 2);
      children = [
        buildQuadtree(imageData, x, y, width, halfHeight, minSize, maxDepth, currentDepth + 1, cellShape),
        buildQuadtree(imageData, x, y + halfHeight, width, height - halfHeight, minSize, maxDepth, currentDepth + 1, cellShape)
      ];
    } else if (!splitHorizontally && width > minSize * 2) {
      const halfWidth = Math.floor(width / 2);
      children = [
        buildQuadtree(imageData, x, y, halfWidth, height, minSize, maxDepth, currentDepth + 1, cellShape),
        buildQuadtree(imageData, x + halfWidth, y, width - halfWidth, height, minSize, maxDepth, currentDepth + 1, cellShape)
      ];
    } else {
      // Fallback to leaf node if we can't split further
      return {
        x,
        y,
        width,
        height,
        color: avgColor
      };
    }
  }
  
  return {
    x,
    y,
    width,
    height,
    color: avgColor,
    children
  };
}

function getAverageColor(
  imageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number
): [number, number, number] {
  let r = 0, g = 0, b = 0;
  let count = 0;
  
  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) {
      if (px >= 0 && px < imageData.width && py >= 0 && py < imageData.height) {
        const index = (py * imageData.width + px) * 4;
        r += imageData.data[index];
        g += imageData.data[index + 1];
        b += imageData.data[index + 2];
        count++;
      }
    }
  }
  
  return count > 0 ? [r / count, g / count, b / count] : [0, 0, 0];
}

function getColorVariance(
  imageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number,
  avgColor: [number, number, number]
): number {
  let variance = 0;
  let count = 0;
  
  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) {
      if (px >= 0 && px < imageData.width && py >= 0 && py < imageData.height) {
        const index = (py * imageData.width + px) * 4;
        const r = imageData.data[index];
        const g = imageData.data[index + 1];
        const b = imageData.data[index + 2];
        
        const dr = r - avgColor[0];
        const dg = g - avgColor[1];
        const db = b - avgColor[2];
        
        variance += dr * dr + dg * dg + db * db;
        count++;
      }
    }
  }
  
  return count > 0 ? variance / count : 0;
}

function drawQuadtree(ctx: CanvasRenderingContext2D, node: QuadNode, options: QuadtreeOptions): void {
  function drawNode(node: QuadNode, depth: number = 0) {
    if (node.children) {
      // Draw children
      for (const child of node.children) {
        drawNode(child, depth + 1);
      }
    } else {
      // Draw leaf node
      const color = `rgb(${Math.round(node.color[0])}, ${Math.round(node.color[1])}, ${Math.round(node.color[2])})`;
      
      switch (options.textureStyle) {
        case 'filled':
          // Draw filled rectangle/square
          ctx.fillStyle = color;
          ctx.fillRect(node.x, node.y, node.width, node.height);
          break;
          
        case 'circle':
          // Draw inscribed circle/oval that is exactly tangent to cell edges
          ctx.fillStyle = color;
          ctx.beginPath();
          
          const centerX = node.x + node.width / 2;
          const centerY = node.y + node.height / 2;
          const radiusX = node.width / 2; // Full radius to make diameter equal to cell width
          const radiusY = node.height / 2; // Full radius to make diameter equal to cell height
          
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
          ctx.fill();
          break;
          
        case 'diagonal':
          // Draw diagonal hatching
          drawDiagonalHatching(ctx, node, color);
          break;
          
        case 'crosshatch':
          // Draw crosshatch pattern
          drawCrosshatch(ctx, node, color);
          break;
          
        case 'hexagons':
          // Draw hexagon that fills the cell completely
          drawHexagonForCell(ctx, node, color);
          break;
          
        case 'triangles':
          // Draw triangle that fills the cell completely
          const pointUp = depth % 2 === 0;
          drawTriangleForCell(ctx, node, color, pointUp);
          break;
      }
      
      // Draw border if enabled
      if (options.showEdges) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(node.x, node.y, node.width, node.height);
      }
    }
  }
  
  drawNode(node);
}

function drawDiagonalHatching(ctx: CanvasRenderingContext2D, node: QuadNode, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  
  const spacing = Math.max(2, Math.min(node.width, node.height) / 8);
  
  ctx.beginPath();
  
  // Draw diagonal lines from top-left to bottom-right
  for (let i = -node.height; i < node.width; i += spacing) {
    ctx.moveTo(node.x + i, node.y);
    ctx.lineTo(node.x + i + node.height, node.y + node.height);
  }
  
  ctx.stroke();
}

function drawCrosshatch(ctx: CanvasRenderingContext2D, node: QuadNode, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  
  const spacing = Math.max(2, Math.min(node.width, node.height) / 6);
  
  ctx.beginPath();
  
  // Draw diagonal lines from top-left to bottom-right
  for (let i = -node.height; i < node.width; i += spacing) {
    ctx.moveTo(node.x + i, node.y);
    ctx.lineTo(node.x + i + node.height, node.y + node.height);
  }
  
  // Draw diagonal lines from top-right to bottom-left
  for (let i = 0; i < node.width + node.height; i += spacing) {
    ctx.moveTo(node.x + i, node.y);
    ctx.lineTo(node.x + i - node.height, node.y + node.height);
  }
  
  ctx.stroke();
}

function drawHexagonForCell(ctx: CanvasRenderingContext2D, node: QuadNode, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  
  // Use the smaller dimension to ensure the hexagon fits completely within the cell
  const size = Math.min(node.width, node.height);
  const radius = size / 2;
  
  // Create hexagon with vertex pointing vertically (flat sides on left/right)
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3; // 60 degrees in radians
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  
  ctx.closePath();
  ctx.fill();
}

function drawTriangleForCell(ctx: CanvasRenderingContext2D, node: QuadNode, color: string, pointUp: boolean): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  
  // Use the smaller dimension to ensure the triangle fits completely within the cell
  const size = Math.min(node.width, node.height);
  const halfBase = size / 2;
  const triangleHeight = (size * Math.sqrt(3)) / 2;
  const halfHeight = triangleHeight / 2;
  
  if (pointUp) {
    // Triangle pointing up - vertices touch cell boundaries
    ctx.moveTo(centerX, centerY - halfHeight); // Top vertex
    ctx.lineTo(centerX - halfBase, centerY + halfHeight); // Bottom left
    ctx.lineTo(centerX + halfBase, centerY + halfHeight); // Bottom right
  } else {
    // Triangle pointing down - vertices touch cell boundaries
    ctx.moveTo(centerX, centerY + halfHeight); // Bottom vertex
    ctx.lineTo(centerX - halfBase, centerY - halfHeight); // Top left
    ctx.lineTo(centerX + halfBase, centerY - halfHeight); // Top right
  }
  
  ctx.closePath();
  ctx.fill();
}
