#!/bin/sh

# IPFS Node Initialization Script for Private Network
# This script configures IPFS nodes for the cluster

NODE_NUM=$1

echo "Initializing IPFS Node ${NODE_NUM} for Private Network..."

# Configure IPFS API and Gateway
ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080

# Enable CORS for API access
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "POST", "GET"]'

# Configure resource limits
ipfs config --json Datastore.StorageMax '"10GB"'

# Enable garbage collection
ipfs config --json Datastore.GCPeriod '"1h"'

# Configure swarm settings
ipfs config --json Swarm.ConnMgr.HighWater 900
ipfs config --json Swarm.ConnMgr.LowWater 600

# Disable resource manager to allow local connections
ipfs config --json Swarm.ResourceMgr.Enabled false

# Remove private network filters to allow Docker network connections
# Clear the filter that blocks 172.16.0.0/12 (which includes our 172.25.0.0/16 Docker network)
ipfs config --json Swarm.AddrFilters '[]'

# Announce addresses for Docker network connectivity
ipfs config --json Addresses.Announce '["/dns4/ipfs-node-'${NODE_NUM}'/tcp/4001"]'

# Enable experimental features
ipfs config --json Experimental.FilestoreEnabled true
ipfs config --json Experimental.UrlstoreEnabled true

# Use UnixFS HAMT Directory threshold (must be string format)
ipfs config Import.UnixFSHAMTDirectorySizeThreshold "256KB"

# Optimize for local network
ipfs config --json Swarm.DisableNatPortMap false

# PRIVATE NETWORK CONFIGURATION
echo "Configuring private network mode..."

# Disable AutoConf for private network
ipfs config --json AutoConf.Enabled false

# Remove all default bootstrap nodes (isolate from public IPFS)
ipfs bootstrap rm --all

# Disable mDNS discovery (we only want manual peering)
ipfs config --json Discovery.MDNS.Enabled false

# Disable public DHT (private network only)
ipfs config Routing.Type dhtclient

# Configure bootstrap nodes (connect nodes to each other)
if [ "$NODE_NUM" = "2" ]; then
  echo "Configuring Node 2 to bootstrap from Node 1..."
  # Wait a bit for Node 1 to be ready
  sleep 5
  
  # Add Node 1 as bootstrap peer (will be updated after first run with actual peer ID)
  # Note: This will be set up via connect script after initial startup
fi

echo "IPFS Node ${NODE_NUM} initialized successfully for private network!"
