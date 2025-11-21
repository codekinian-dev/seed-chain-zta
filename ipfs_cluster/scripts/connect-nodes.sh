#!/bin/sh

# Helper script to connect IPFS nodes after they are running

echo " Connecting IPFS Nodes..."

# Wait for nodes to be ready
echo " Waiting for nodes to initialize..."
sleep 10

# Get Node 1 Info
echo "\n Node 1 Information:"
NODE1_ID=$(docker exec ipfs-node-1 ipfs id -f='<id>')
echo "Peer ID: $NODE1_ID"

# Get Node 2 Info
echo "\n Node 2 Information:"
NODE2_ID=$(docker exec ipfs-node-2 ipfs id -f='<id>')
echo "Peer ID: $NODE2_ID"

# Connect Node 2 to Node 1
echo "\n Connecting Node 2 to Node 1..."
docker exec ipfs-node-2 ipfs swarm connect /ip4/172.25.0.2/tcp/4001/p2p/$NODE1_ID

# Verify connection
echo "\n Verifying connections..."
echo "\nNode 1 Peers:"
docker exec ipfs-node-1 ipfs swarm peers

echo "\nNode 2 Peers:"
docker exec ipfs-node-2 ipfs swarm peers

echo "\n Connection complete!"
