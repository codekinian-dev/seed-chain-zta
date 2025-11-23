#!/bin/sh
set -e

# Check if core.yaml is writable, if not copy to temp location
CONFIG_FILE="/etc/hyperledger/fabric/core.yaml"

if [ ! -w "$CONFIG_FILE" ]; then
    echo "core.yaml not writable, using default configuration with external builder from environment"
fi

# Check if external builder already configured
if ! grep -q "ccaas_builder" "$CONFIG_FILE" 2>/dev/null; then
    echo "Adding CCaaS external builder configuration..."
    
    cat >> "$CONFIG_FILE" << 'EOF'

chaincode:
  externalBuilders:
    - name: ccaas_builder
      path: /builders/ccaas
      propagateEnvironment:
        - CHAINCODE_AS_A_SERVICE_BUILDER_CONFIG
EOF
    echo "External builder configuration added"
else
    echo "External builder already configured"
fi

# Start the peer
exec peer node start
