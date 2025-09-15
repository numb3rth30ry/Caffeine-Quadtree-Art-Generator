import React from 'react';
import { ImageConverter } from './components/ImageConverter';

function App() {
  return (
    <div className="min-h-screen bg-gray-900" style={{ backgroundColor: 'hsl(0, 0%, 10%)' }}>
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent mb-4">
            Image to Quadtree Art Generator
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Transform your images into stunning quadtree art. Upload an image and watch as our algorithm 
            creates a unique artistic interpretation using recursive subdivisions with creative textures.
          </p>
        </header>
        
        <ImageConverter />
        
        <footer className="mt-16 text-center text-gray-400 text-sm">
          © 2025. Built with <span className="text-purple-400">♥</span> using{' '}
          <a 
            href="https://caffeine.ai" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            caffeine.ai
          </a>
        </footer>
      </div>
    </div>
  );
}

export default App;
