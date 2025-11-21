#!/bin/sh
set -e

NODE_NUM=${1:-1}

echo "Starting IPFS Node ${NODE_NUM}..."

# Initialize IPFS if not already initialized
if [ ! -f /data/ipfs/config ]; then
  echo "Initializing IPFS..."
  ipfs init --profile=server
fi

# Run configuration script if exists
if [ -f /scripts/init-ipfs.sh ]; then
  echo "Running initialization script..."
  /bin/sh /scripts/init-ipfs.sh ${NODE_NUM}
fi

# Start IPFS daemon
echo "Starting IPFS daemon..."
exec ipfs daemon --migrate=true --enable-gc
