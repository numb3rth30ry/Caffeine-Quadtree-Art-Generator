import React, { useState, useCallback, useRef } from 'react';
import { Upload, Download, Loader2, Settings, Palette, Sparkles, FileImage } from 'lucide-react';
import { useFileUpload } from '../blob-storage/FileStorage';
import { generateQuadtreeArt, generateQuadtreeSVG, QuadtreeOptions } from '../utils/quadtree';

interface ConversionResult {
  originalUrl: string;
  quadtreeUrl: string;
  originalPath: string;
  quadtreePath: string;
  quadtreeCanvas?: HTMLCanvasElement;
}

export const ImageConverter: React.FC = () => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useFileUpload();

  // Quadtree options state
  const [quadtreeOptions, setQuadtreeOptions] = useState<QuadtreeOptions>({
    cellShape: 'square',
    textureStyle: 'filled',
    showEdges: true,
    maxDepth: 6,
    minSize: 8
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelection(files[0]);
    }
  }, []);

  const handleFileSelection = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setResult(null);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelection(files[0]);
    }
  }, [handleFileSelection]);

  const processImage = useCallback(async (uploadToStorage: boolean = true) => {
    if (!selectedFile || !previewUrl) return;

    setIsProcessing(true);
    try {
      // Generate quadtree art with current options
      const quadtreeCanvas = await generateQuadtreeArt(previewUrl, quadtreeOptions);
      
      // Convert canvas to blob, then to File
      const quadtreeBlob = await new Promise<Blob>((resolve) => {
        quadtreeCanvas.toBlob((blob) => resolve(blob!), 'image/png', 1.0);
      });

      if (uploadToStorage) {
        // Convert blob to File for upload
        const quadtreeFile = new File([quadtreeBlob], 'quadtree_art.png', { type: 'image/png' });

        // Upload original image
        const originalPath = `originals/${Date.now()}_${selectedFile.name}`;
        const originalResult = await uploadFile(originalPath, selectedFile);

        // Upload quadtree art
        const quadtreePath = `quadtree/${Date.now()}_quadtree.png`;
        const quadtreeResult = await uploadFile(quadtreePath, quadtreeFile);

        setResult({
          originalUrl: originalResult.url,
          quadtreeUrl: quadtreeResult.url,
          originalPath: originalResult.path,
          quadtreePath: quadtreeResult.path,
          quadtreeCanvas
        });
      } else {
        // Just update the quadtree art without uploading
        const quadtreeUrl = URL.createObjectURL(quadtreeBlob);
        setResult(prev => prev ? {
          ...prev,
          quadtreeUrl,
          quadtreeCanvas
        } : null);
      }
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, previewUrl, uploadFile, quadtreeOptions]);

  const regenerateArt = useCallback(() => {
    processImage(false);
  }, [processImage]);

  const downloadImage = useCallback((url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const downloadSVG = useCallback(async () => {
    if (!previewUrl) return;
    
    try {
      const svgContent = await generateQuadtreeSVG(previewUrl, quadtreeOptions);
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'quadtree_art.svg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating SVG:', error);
      alert('Error generating SVG. Please try again.');
    }
  }, [previewUrl, quadtreeOptions]);

  const reset = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const updateOption = useCallback(<K extends keyof QuadtreeOptions>(
    key: K,
    value: QuadtreeOptions[K]
  ) => {
    setQuadtreeOptions(prev => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      {!result ? (
        <div className="space-y-8">
          {/* Upload Area */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
              dragActive
                ? 'border-purple-400 bg-gray-800/50 shadow-lg'
                : 'border-gray-600 hover:border-purple-500 bg-gray-800/30 backdrop-blur-sm'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            <div className="space-y-4">
              <div className="mx-auto h-16 w-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                <Upload className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-xl font-semibold text-gray-100 mb-2">
                  Drop your image here
                </p>
                <p className="text-purple-400 font-medium">or click to browse</p>
              </div>
              <p className="text-sm text-gray-400">
                Supports JPEG, PNG and other common image formats
              </p>
            </div>
          </div>

          {/* Settings Panel */}
          {previewUrl && (
            <div className="bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-xl border border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Palette className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-100">Customization Options</h3>
                </div>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-purple-300 rounded-lg hover:bg-gray-600 transition-all duration-200 border border-gray-600"
                >
                  <Settings className="h-4 w-4" />
                  {showSettings ? 'Hide Settings' : 'Show Settings'}
                </button>
              </div>

              {showSettings && (
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  {/* Cell Shape */}
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-200">
                      Cell Shape
                    </label>
                    <div className="flex gap-3">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="cellShape"
                          value="square"
                          checked={quadtreeOptions.cellShape === 'square'}
                          onChange={(e) => updateOption('cellShape', e.target.value as 'square' | 'rectangle')}
                          className="mr-2 text-purple-500 focus:ring-purple-400 bg-gray-700 border-gray-600"
                        />
                        <span className="text-gray-300">Squares</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="cellShape"
                          value="rectangle"
                          checked={quadtreeOptions.cellShape === 'rectangle'}
                          onChange={(e) => updateOption('cellShape', e.target.value as 'square' | 'rectangle')}
                          className="mr-2 text-purple-500 focus:ring-purple-400 bg-gray-700 border-gray-600"
                        />
                        <span className="text-gray-300">Rectangles</span>
                      </label>
                    </div>
                  </div>

                  {/* Texture Style */}
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-200">
                      Texture Style
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="textureStyle"
                          value="filled"
                          checked={quadtreeOptions.textureStyle === 'filled'}
                          onChange={(e) => updateOption('textureStyle', e.target.value as any)}
                          className="mr-2 text-purple-500 focus:ring-purple-400 bg-gray-700 border-gray-600"
                        />
                        <span className="text-gray-300 text-sm">Filled</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="textureStyle"
                          value="circle"
                          checked={quadtreeOptions.textureStyle === 'circle'}
                          onChange={(e) => updateOption('textureStyle', e.target.value as any)}
                          className="mr-2 text-purple-500 focus:ring-purple-400 bg-gray-700 border-gray-600"
                        />
                        <span className="text-gray-300 text-sm">Circles</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="textureStyle"
                          value="diagonal"
                          checked={quadtreeOptions.textureStyle === 'diagonal'}
                          onChange={(e) => updateOption('textureStyle', e.target.value as any)}
                          className="mr-2 text-purple-500 focus:ring-purple-400 bg-gray-700 border-gray-600"
                        />
                        <span className="text-gray-300 text-sm">Diagonal</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="textureStyle"
                          value="crosshatch"
                          checked={quadtreeOptions.textureStyle === 'crosshatch'}
                          onChange={(e) => updateOption('textureStyle', e.target.value as any)}
                          className="mr-2 text-purple-500 focus:ring-purple-400 bg-gray-700 border-gray-600"
                        />
                        <span className="text-gray-300 text-sm">Crosshatch</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="textureStyle"
                          value="hexagons"
                          checked={quadtreeOptions.textureStyle === 'hexagons'}
                          onChange={(e) => updateOption('textureStyle', e.target.value as any)}
                          className="mr-2 text-purple-500 focus:ring-purple-400 bg-gray-700 border-gray-600"
                        />
                        <span className="text-gray-300 text-sm">Hexagons</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="textureStyle"
                          value="triangles"
                          checked={quadtreeOptions.textureStyle === 'triangles'}
                          onChange={(e) => updateOption('textureStyle', e.target.value as any)}
                          className="mr-2 text-purple-500 focus:ring-purple-400 bg-gray-700 border-gray-600"
                        />
                        <span className="text-gray-300 text-sm">Triangles</span>
                      </label>
                    </div>
                  </div>

                  {/* Show Edges */}
                  <div className="space-y-3">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={quadtreeOptions.showEdges}
                        onChange={(e) => updateOption('showEdges', e.target.checked)}
                        className="mr-2 text-purple-500 focus:ring-purple-400 rounded bg-gray-700 border-gray-600"
                      />
                      <span className="text-sm font-semibold text-gray-200">
                        Show Cell Edges
                      </span>
                    </label>
                    <p className="text-xs text-gray-400">
                      Display thin borders around each quadtree cell
                    </p>
                  </div>

                  {/* Max Depth */}
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-200">
                      Recursion Depth: {quadtreeOptions.maxDepth}
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="15"
                      value={quadtreeOptions.maxDepth}
                      onChange={(e) => updateOption('maxDepth', parseInt(e.target.value))}
                      className="w-full h-2 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg appearance-none cursor-pointer slider-thumb"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Low Detail</span>
                      <span>High Detail</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col lg:flex-row gap-6 items-center">
                <div className="flex-1">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full max-w-md mx-auto rounded-lg shadow-lg border border-gray-600"
                  />
                </div>
                <div className="flex-1 text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Sparkles className="h-6 w-6 text-purple-400" />
                    <h3 className="text-xl font-semibold text-gray-100">
                      Ready to Convert
                    </h3>
                  </div>
                  <p className="text-gray-300">
                    Your image is ready to be transformed into quadtree art with your custom settings. 
                    Click the button below to start the conversion process.
                  </p>
                  <div className="space-y-3">
                    <button
                      onClick={() => processImage(true)}
                      disabled={isProcessing || isUploading}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
                    >
                      {isProcessing || isUploading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          {isUploading ? 'Uploading...' : 'Processing...'}
                        </>
                      ) : (
                        'Convert to Quadtree Art'
                      )}
                    </button>
                    <button
                      onClick={reset}
                      className="w-full bg-gray-700 text-gray-200 px-6 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-all duration-200"
                    >
                      Choose Different Image
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Results Display */
        <div className="bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-xl border border-gray-700 p-6">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="h-8 w-8 text-purple-400" />
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                Conversion Complete!
              </h2>
            </div>
            <p className="text-gray-300">
              Your image has been transformed into beautiful quadtree art
            </p>
          </div>

          {/* Settings Panel for Regeneration */}
          <div className="mb-8 bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-100">Adjust Settings & Regenerate</h3>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 px-3 py-1 bg-gray-600 text-purple-300 rounded-lg hover:bg-gray-500 transition-colors text-sm border border-gray-500"
              >
                <Settings className="h-4 w-4" />
                {showSettings ? 'Hide' : 'Show'}
              </button>
            </div>

            {showSettings && (
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                {/* Cell Shape */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-200">Cell Shape</label>
                  <div className="flex gap-3">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="cellShape"
                        value="square"
                        checked={quadtreeOptions.cellShape === 'square'}
                        onChange={(e) => updateOption('cellShape', e.target.value as 'square' | 'rectangle')}
                        className="mr-2 text-purple-500 focus:ring-purple-400 bg-gray-700 border-gray-600"
                      />
                      <span className="text-gray-300 text-sm">Squares</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="cellShape"
                        value="rectangle"
                        checked={quadtreeOptions.cellShape === 'rectangle'}
                        onChange={(e) => updateOption('cellShape', e.target.value as 'square' | 'rectangle')}
                        className="mr-2 text-purple-500 focus:ring-purple-400 bg-gray-700 border-gray-600"
                      />
                      <span className="text-gray-300 text-sm">Rectangles</span>
                    </label>
                  </div>
                </div>

                {/* Texture Style */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-200">Texture Style</label>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { value: 'filled', label: 'Filled' },
                      { value: 'circle', label: 'Circles' },
                      { value: 'diagonal', label: 'Diagonal' },
                      { value: 'crosshatch', label: 'Crosshatch' },
                      { value: 'hexagons', label: 'Hexagons' },
                      { value: 'triangles', label: 'Triangles' }
                    ].map(({ value, label }) => (
                      <label key={value} className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="textureStyle"
                          value={value}
                          checked={quadtreeOptions.textureStyle === value}
                          onChange={(e) => updateOption('textureStyle', e.target.value as any)}
                          className="mr-1 text-purple-500 focus:ring-purple-400 bg-gray-700 border-gray-600"
                        />
                        <span className="text-gray-300 text-xs">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Show Edges */}
                <div className="space-y-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quadtreeOptions.showEdges}
                      onChange={(e) => updateOption('showEdges', e.target.checked)}
                      className="mr-2 text-purple-500 focus:ring-purple-400 rounded bg-gray-700 border-gray-600"
                    />
                    <span className="text-sm font-semibold text-gray-200">Show Cell Edges</span>
                  </label>
                </div>

                {/* Max Depth */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-200">
                    Recursion Depth: {quadtreeOptions.maxDepth}
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="15"
                    value={quadtreeOptions.maxDepth}
                    onChange={(e) => updateOption('maxDepth', parseInt(e.target.value))}
                    className="w-full h-2 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}

            <button
              onClick={regenerateArt}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-4 py-2 rounded-lg font-medium hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Regenerate Art
                </>
              )}
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Original Image */}
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-100 mb-2">
                  Original Image
                </h3>
                <div className="relative group">
                  <img
                    src={result.originalUrl}
                    alt="Original"
                    className="w-full rounded-lg shadow-lg border border-gray-600"
                  />
                  <button
                    onClick={() => downloadImage(result.originalUrl, 'original.jpg')}
                    className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-opacity-70"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quadtree Art */}
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-100 mb-2">
                  Quadtree Art
                </h3>
                <div className="relative group">
                  <img
                    src={result.quadtreeUrl}
                    alt="Quadtree Art"
                    className="w-full rounded-lg shadow-lg border border-gray-600"
                  />
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => downloadImage(result.quadtreeUrl, 'quadtree_art.png')}
                      className="bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70 transition-colors"
                      title="Download PNG"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={downloadSVG}
                      className="bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70 transition-colors"
                      title="Download SVG"
                    >
                      <FileImage className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 justify-center">
                  <button
                    onClick={() => downloadImage(result.quadtreeUrl, 'quadtree_art.png')}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 text-sm"
                  >
                    <Download className="h-4 w-4" />
                    Download PNG
                  </button>
                  <button
                    onClick={downloadSVG}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 text-sm"
                  >
                    <FileImage className="h-4 w-4" />
                    Download SVG
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <button
              onClick={reset}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg"
            >
              Convert Another Image
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
