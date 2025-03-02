#!/bin/bash

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install it to continue."
    exit 1
fi

# Check if requirements are installed
if ! python3 -c "import watchdog, websockets" &> /dev/null; then
    echo "Installing required packages..."
    pip3 install -r requirements.txt
fi

# Run the server
echo "Starting development server with live reload..."
python3 server.py 
