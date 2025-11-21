#!/bin/bash

# Script untuk generate core.yaml konfigurasi Hyperledger Fabric Peer
# Usage: ./generate-core-config.sh [peer_id] [listen_port] [chaincode_port] [operations_port]

set -e

# Default values
PEER_ID=${1:-"peer0"}
LISTEN_PORT=${2:-"${BPSBP_PEER0_PORT}"}
CHAINCODE_PORT=${3:-"7052"}
OPERATIONS_PORT=${4:-"9443"}
NETWORK_ID=${5:-"dev"}

# Fabric version defaults
BASE_VERSION=${BASE_VERSION:-"2.4.7"}
PROJECT_VERSION=${PROJECT_VERSION:-"2.4.7"}
DOCKER_NS=${DOCKER_NS:-"hyperledger"}
BASE_DOCKER_NS=${BASE_DOCKER_NS:-"hyperledger"}

# Output directory
CONFIG_DIR="config"
OUTPUT_FILE="$CONFIG_DIR/core.yaml"

# Create config directory if it doesn't exist
mkdir -p "$CONFIG_DIR"

echo "🔧 Generating Hyperledger Fabric Peer configuration..."
echo "   Peer ID: $PEER_ID"
echo "   Listen Port: $LISTEN_PORT"
echo "   Chaincode Port: $CHAINCODE_PORT"
echo "   Operations Port: $OPERATIONS_PORT"
echo "   Network ID: $NETWORK_ID"

# Generate core.yaml file
cat > "$OUTPUT_FILE" << EOF
#
# Hyperledger Fabric Peer Configuration
# Generated automatically by generate-core-config.sh
# Date: $(date)
#

# Logging Configuration
logging:
    level: info
    peer: info
    cauthdsl: warning
    gossip: warning
    grpc: error
    ledger: info
    msp: warning
    policies: warning

# Peer Configuration
peer:
    id: $PEER_ID
    networkId: $NETWORK_ID
    listenAddress: 0.0.0.0:$LISTEN_PORT
    chaincodeListenAddress: 0.0.0.0:$CHAINCODE_PORT
    chaincodeAddress: 127.0.0.1:$CHAINCODE_PORT
    address: 0.0.0.0:$LISTEN_PORT
    addressAutoDetect: false
    gomaxprocs: -1
    keepalive:
        minInterval: 60s
        client:
            interval: 60s
            timeout: 20s
        server:
            interval: 7200s
            timeout: 20s
    gossip:
        bootstrap: 127.0.0.1:$LISTEN_PORT
        useLeaderElection: false
        orgLeader: true
        membershipTrackerInterval: 5s
        endpoint:
        maxBlockCountToStore: 100
        maxPropagationBurstLatency: 10ms
        maxPropagationBurstSize: 10
        propagateIterations: 1
        propagatePeerNum: 3
        pullInterval: 4s
        pullPeerNum: 3
        requestStateInfoInterval: 4s
        publishStateInfoInterval: 4s
        stateInfoRetentionInterval:
        publishCertPeriod: 10s
        skipBlockVerification: false
        dialTimeout: 3s
        connTimeout: 2s
        recvBuffSize: 20
        sendBuffSize: 200
        digestWaitTime: 1s
        requestWaitTime: 1500ms
        responseWaitTime: 2s
        aliveTimeInterval: 5s
        aliveExpirationTimeout: 25s
        reconnectInterval: 25s
        externalEndpoint:
        election:
            startupGracePeriod: 15s
            membershipSampleInterval: 1s
            leaderAliveThreshold: 10s
            leaderElectionDuration: 5s
        pvtData:
            pullRetryThreshold: 60s
            transientstoreMaxBlockRetention: 1000
            pushAckTimeout: 3s
            btlPullMargin: 10
            reconcileBatchSize: 10
            reconcileSleepInterval: 1m
            reconciliationEnabled: true
            skipPullingInvalidTransactionsDuringCommit: false
            implicitCollectionDisseminationPolicy:
                requiredPeerCount: 0
                maxPeerCount: 1
        state:
            enabled: true
            checkInterval: 10s
            responseTimeout: 3s
            batchSize: 10
            blockBufferSize: 100
            maxRetries: 3

    # TLS Configuration
    tls:
        enabled: false
        clientAuthRequired: false
        cert:
            file:
        key:
            file:
        rootcert:
            file:
        clientRootCAs:
            files:
        clientKey:
            file:
        clientCert:
            file:

    # Authentication
    authentication:
        timewindow: 15m

    # BCCSP (Blockchain Crypto Service Provider)
    BCCSP:
        Default: SW
        SW:
            Hash: SHA2
            Security: 256
            FileKeyStore:
                KeyStore:
        PKCS11:
            Library:
            Label:
            Pin:
            Hash:
            Security:
            FileKeyStore:
                KeyStore:

    # MSP (Membership Service Provider)
    mspConfigPath: msp
    localMspId: SampleOrg
    localMspType: bccsp

    # File System Path Configuration
    fileSystemPath: /var/hyperledger/production

    # Handlers
    handlers:
        authFilters:
          -
            name: DefaultAuth
          -
            name: ExpirationCheck
        decorators:
          -
            name: DefaultDecorator
        endorsers:
          escc:
            name: DefaultEndorsement
            library:
        validators:
          vscc:
            name: DefaultValidation
            library:

    # Validator pool size
    validatorPoolSize:

    # Discovery service
    discovery:
        enabled: true
        authCacheEnabled: true
        authCacheMaxSize: 1000
        authCachePurgeRetentionRatio: 0.75
        orgMembersAllowedAccess: false

    # Limits
    limits:
        concurrency:
            endorserService: 2500
            deliverService: 2500

# VM Configuration
vm:
    endpoint: unix:///var/run/docker.sock
    docker:
        tls:
            enabled: false
            ca:
                file:
            cert:
                file:
            key:
                file:
        attachStdout: false
        hostConfig:
            NetworkMode: host
            Dns:
            LogConfig:
                Type: json-file
                Config:
                    max-size: "50m"
                    max-file: "5"
            Memory: 2147483648

# Chaincode Configuration
chaincode:
    id:
        path:
        name:
    builder: \${DOCKER_NS}/fabric-ccenv:latest
    pull: false
    golang:
        runtime: \${BASE_DOCKER_NS}/fabric-baseos:\${BASE_VERSION}
        dynamicLink: false
    car:
        runtime: \${BASE_DOCKER_NS}/fabric-baseos:\${BASE_VERSION}
    java:
        runtime: \${BASE_DOCKER_NS}/fabric-javaenv:\${PROJECT_VERSION}
    node:
        runtime: \${BASE_DOCKER_NS}/fabric-nodeenv:\${PROJECT_VERSION}
    startuptimeout: 300s
    executetimeout: 30s
    mode: net
    keepalive: 0
    system:
        _lifecycle: enable
        cscc: enable
        lscc: enable
        escc: enable
        vscc: enable
        qscc: enable

# Ledger Configuration
ledger:
  blockchain:
  state:
    stateDatabase: goleveldb
    totalQueryLimit: 100000
    couchDBConfig:
       couchDBAddress: 127.0.0.1:5984
       username:
       password:
       maxRetries: 3
       maxRetriesOnStartup: 10
       requestTimeout: 35s
       internalQueryLimit: 1000
       maxBatchUpdateSize: 1000
       warmIndexesAfterNBlocks: 1
       createGlobalChangesDB: false
       cacheSize: 64
  history:
    enableHistoryDatabase: true
  pvtdataStore:
    collElgProcMaxDbBatchSize: 5000
    collElgProcDbBatchesInterval: 1000
    deprioritizedDataReconcilerInterval: 60m
    purgeInterval: 100
    purgedKeyAuditLogging: true
  snapshots:
    rootDir: /var/hyperledger/production/snapshots

# Operations Configuration
operations:
    listenAddress: 127.0.0.1:$OPERATIONS_PORT
    tls:
        enabled: false
        cert:
            file:
        key:
            file:
        clientAuthRequired: false
        clientRootCAs:
            files: []

# Metrics Configuration
metrics:
    provider: disabled
    statsd:
        network: udp
        address: 127.0.0.1:8125
        writeInterval: 10s
        prefix:
EOF

echo "✅ Core configuration generated successfully: $OUTPUT_FILE"
echo ""
echo "📋 Configuration Summary:"
echo "   Peer ID: $PEER_ID"
echo "   Listen Address: 0.0.0.0:$LISTEN_PORT"
echo "   Chaincode Address: 0.0.0.0:$CHAINCODE_PORT"
echo "   Operations Address: 127.0.0.1:$OPERATIONS_PORT"
echo "   Network ID: $NETWORK_ID"
echo ""
echo "💡 Usage examples:"
echo "   # Generate with defaults"
echo "   ./scripts/generate-core-config.sh"
echo ""
echo "   # Generate with custom peer ID and ports"
echo "   ./scripts/generate-core-config.sh peer1 ${BPSBP_PEER1_PORT} 8052 9444"
echo ""
echo "   # Generate for specific organization"
echo "   ./scripts/generate-core-config.sh pusat.bpsbp ${BPSBP_PEER0_PORT} 7052 9443 bpsbp"
