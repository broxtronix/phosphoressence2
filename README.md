# WebGL Video Feedback

A WebGL application that creates video feedback effects with a 3D cube.

## Setup and Running

### Prerequisites

- Python 3.6 or higher
- pip (Python package installer)

### Installation

1. Install the required Python packages:

```bash
pip install -r requirements.txt
```

### Running the Development Server

1. Start the development server with live reload:

```bash
python server.py
```

2. Open your browser and navigate to:

```
http://localhost:8000
```

3. The server will automatically reload the page when you make changes to any HTML, CSS, or JavaScript files.

## Controls

- **Zoom**: Controls the zoom level of the feedback effect
- **Rotation**: Controls the rotation of the feedback effect
- **Gain**: Controls the attenuation of the feedback loop
- **Cube Rotation Speed**: Controls how fast the cube rotates
- **Color Change Speed**: Controls how fast the colors change

## Development

The development server uses:
- Python's built-in HTTP server to serve the files
- WebSockets for live reload functionality
- Watchdog for file system monitoring

When you make changes to any HTML, JS, or CSS file, the page will automatically reload to reflect those changes.

## Technical Details

This application uses:
- WebGL for rendering
- Framebuffer objects for capturing rendered frames
- Ping-pong rendering technique to avoid reading from and writing to the same texture
- Matrix transformations for 3D rendering

## Requirements

- A web browser with WebGL support
- No additional libraries or dependencies are needed 