# Image to Quadtree Art Generator

## Overview
A web application that converts uploaded portrait images into stylized quadtree art approximations with customizable rendering options, featuring a modern dark-themed design.

## Core Features

### Image Upload
- Users can upload portrait images from their device
- Supported image formats: common web formats (JPEG, PNG)
- Once uploaded, users can adjust settings and regenerate art without reuploading

### Quadtree Art Generation
- The application processes the uploaded portrait image
- Generates a stylized quadtree art version that approximates the original image
- Quadtree algorithm recursively subdivides the image based on color similarity
- Users can freely adjust settings and regenerate art from the same source image

### Customization Options
- **Cell Shape**: Users can choose between squares or rectangles for quadtree subdivision
- **Texture Style**: Users can select how each quadtree cell is rendered:
  - Filled square/rectangle (solid color fill)
  - Inscribed color-filled circle/oval within each cell that is exactly tangent to the cell edges (diameter equals cell width for squares, major/minor axes equal cell width/height for rectangles)
  - Diagonal hatching pattern
  - Crosshatch pattern
  - Hexagons: filled hexagon in each cell that completely fills the cell with vertices or edges exactly touching the cell boundaries and no visible gap, using the smaller of width or height in rectangle mode to avoid overlap
  - Triangles: filled triangle in each cell that completely fills the cell with vertices or edges exactly touching the cell boundaries and no visible gap, using the smaller of width or height in rectangle mode to avoid overlap
- **Edge Visualization**: Toggle option to show or hide quadtree cell boundaries with thin black borders
- **Recursion Depth**: User-adjustable control for maximum depth of recursion up to 15 levels to control the fidelity of the quadtree approximation

### Image Display
- After processing, display both images side by side on the same page:
  - Original uploaded portrait on one side
  - Generated quadtree art version on the other side

### Export Options
- Download generated quadtree art as high-resolution PNG file with increased size and quality
- Download generated quadtree art as SVG file for vector-based output

## Design Requirements

### Visual Theme
- Modern dark-themed design with black background color (HSV: 0, 0, 0.1)
- Aesthetically pleasing interface with contemporary styling
- Dark color palette used throughout the application interface

## Technical Requirements

### Frontend Processing
- Image upload handling and preview
- Quadtree art generation algorithm runs in the frontend with customizable parameters
- Interactive controls for shape selection, texture options (including hexagons and triangles), edge visualization, and recursion depth
- Real-time regeneration of quadtree art when settings are adjusted
- Side-by-side image display interface
- High-resolution PNG and SVG export functionality
- Hexagon and triangle rendering ensures shapes completely fill their cells with no gaps

### Backend Storage
- Store uploaded original images
- Store generated quadtree art images with their associated settings
- Each image pair is associated with a unique session or identifier

## User Interface
- Simple upload interface for selecting portrait images
- Customization panel with controls for all rendering options including texture styles (hexagons and triangles)
- Clear side-by-side comparison view of original and quadtree versions
- Export buttons for PNG and SVG download options
- Dark-themed modern design with black background
- Application content displayed in English
