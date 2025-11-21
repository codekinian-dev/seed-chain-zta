#!/bin/sh

# Status check script for IPFS Cluster

echo " IPFS Cluster Status"
echo "=====================\n"

# Check if containers are running
echo " Container Status:"
docker-compose ps

echo "\n Node Information:"
echo "\nNode 1:"
docker exec ipfs-node-1 ipfs id -f='  Peer ID: <id>\n  Agent: <agentversion>'

echo "\nNode 2:"
docker exec ipfs-node-2 ipfs id -f='  Peer ID: <id>\n  Agent: <agentversion>'

echo "\n Cluster Connectivity:"
NODE1_PEERS=$(docker exec ipfs-node-1 ipfs swarm peers | grep -c "172.25.0.3")
NODE2_PEERS=$(docker exec ipfs-node-2 ipfs swarm peers | grep -c "172.25.0.2")

if [ "$NODE1_PEERS" -gt 0 ] && [ "$NODE2_PEERS" -gt 0 ]; then
    echo "   Nodes are connected to each other"
else
    echo "   Nodes are NOT connected. Run: ./scripts/connect-nodes.sh"
fi

echo "\n Storage Usage:"
echo "\nNode 1:"
docker exec ipfs-node-1 ipfs repo stat | grep -E "RepoSize|StorageMax"

echo "\nNode 2:"
docker exec ipfs-node-2 ipfs repo stat | grep -E "RepoSize|StorageMax"

echo "\n Network Stats:"
echo "\nNode 1 Total Peers: $(docker exec ipfs-node-1 ipfs swarm peers | wc -l | tr -d ' ')"
echo "Node 2 Total Peers: $(docker exec ipfs-node-2 ipfs swarm peers | wc -l | tr -d ' ')"

echo "\n Status check complete!"
