import http.server
import socketserver
import os
import sys
import time
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Configuration
PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# HTML for the live reload script to inject
RELOAD_SCRIPT = """
<script>
(function() {
    const socket = new WebSocket('ws://' + location.host.split(':')[0] + ':35729/livereload');
    
    socket.onopen = function() {
        console.log('Live reload connected');
    };
    
    socket.onmessage = function(event) {
        if (event.data === 'reload') {
            console.log('Reloading page...');
            window.location.reload();
        }
    };
    
    socket.onclose = function() {
        console.log('Live reload disconnected');
        // Try to reconnect after a delay
        setTimeout(function() {
            console.log('Attempting to reconnect...');
            window.location.reload();
        }, 2000);
    };
})();
</script>
"""

# Custom request handler that injects the live reload script
class LiveReloadHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()
    
    def do_GET(self):
        if self.path.endswith('.html'):
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            
            # Read the original HTML file
            with open(os.path.join(DIRECTORY, self.path[1:]), 'rb') as file:
                content = file.read().decode('utf-8')
            
            # Inject the reload script before the closing </body> tag
            if '</body>' in content:
                modified_content = content.replace('</body>', f'{RELOAD_SCRIPT}</body>')
            else:
                modified_content = content + RELOAD_SCRIPT
            
            self.wfile.write(modified_content.encode('utf-8'))
        else:
            super().do_GET()

# WebSocket server for live reload notifications
import asyncio
import websockets

connected_clients = set()

async def register(websocket):
    connected_clients.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        connected_clients.remove(websocket)

async def notify_clients():
    if connected_clients:
        await asyncio.gather(
            *[client.send('reload') for client in connected_clients]
        )

# File watcher to detect changes
class ChangeHandler(FileSystemEventHandler):
    def __init__(self):
        self.last_modified = time.time()
    
    def on_modified(self, event):
        if event.is_directory:
            return
        
        # Avoid duplicate events by checking time
        current_time = time.time()
        if current_time - self.last_modified < 0.5:
            return
        self.last_modified = current_time
        
        # Only reload for relevant file types
        if event.src_path.endswith(('.html', '.js', '.css')):
            print(f"File changed: {event.src_path}")
            asyncio.run(notify_clients())

# Start the HTTP server
def start_http_server():
    with socketserver.TCPServer(("", PORT), LiveReloadHandler) as httpd:
        print(f"HTTP Server running at http://localhost:{PORT}")
        httpd.serve_forever()

# Start the WebSocket server
async def start_websocket_server():
    async with websockets.serve(register, "localhost", 35729):
        print("WebSocket server running on ws://localhost:35729")
        await asyncio.Future()  # Run forever

# Main function
def main():
    # Start HTTP server in a separate thread
    http_thread = threading.Thread(target=start_http_server)
    http_thread.daemon = True
    http_thread.start()
    
    # Set up file watcher
    event_handler = ChangeHandler()
    observer = Observer()
    observer.schedule(event_handler, DIRECTORY, recursive=True)
    observer.start()
    
    try:
        # Start WebSocket server in the main thread
        asyncio.run(start_websocket_server())
    except KeyboardInterrupt:
        observer.stop()
    
    observer.join()

if __name__ == "__main__":
    print("Starting development server with live reload...")
    main() 