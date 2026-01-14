#!/bin/sh
set -e

# Ensure logs directory exists and is writable
# If mounted from host, it may have wrong permissions
if [ ! -w "/app/logs" ]; then
    echo "[entrypoint] Warning: /app/logs is not writable, attempting to fix..."
    # Try to create logs in /tmp as fallback
    if [ ! -d "/tmp/app-logs" ]; then
        mkdir -p /tmp/app-logs
    fi
    # Set environment variable to use fallback location
    export LOG_DIR="/tmp/app-logs"
    echo "[entrypoint] Using fallback log directory: $LOG_DIR"
else
    echo "[entrypoint] Log directory is writable: /app/logs"
fi

# Ensure uploads directory exists
if [ ! -w "/app/uploads" ]; then
    echo "[entrypoint] Warning: /app/uploads is not writable"
    if [ ! -d "/tmp/app-uploads" ]; then
        mkdir -p /tmp/app-uploads
    fi
    export UPLOAD_DIR="/tmp/app-uploads"
fi

# Execute the main command
exec "$@"
