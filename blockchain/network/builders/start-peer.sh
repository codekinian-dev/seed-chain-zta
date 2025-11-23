#!/bin/bash

# Script to inject external builder configuration into Fabric peer core.yaml at runtime

set -e

CONFIG_FILE="/etc/hyperledger/fabric/core.yaml"

# Check if external builder already configured
if grep -q "ccaas_builder" "$CONFIG_FILE" 2>/dev/null; then
    echo "External builder already configured"
else
    echo "Adding CCaaS external builder configuration..."
    
    # Find the chaincode section and add external builders
    # This uses a simple append approach
    cat >> "$CONFIG_FILE" << 'EOF'

# External Builders for Chaincode-as-a-Service
chaincode:
  externalBuilders:
    - name: ccaas_builder
      path: /builders/ccaas
      propagateEnvironment:
        - CHAINCODE_AS_A_SERVICE_BUILDER_CONFIG
EOF

    echo "External builder configuration added"
fi

# Start the peer
exec peer node start
