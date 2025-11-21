#!/bin/bash
#
# Script untuk setup Certificate Authority dan generate certificates
# Sistem Sertifikasi Benih Perkebunan - v2.4.7
#

set -e

# Load environment variables
source "$(dirname "$0")/../.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_message() {
    echo -e "${GREEN}$1${NC}"
}

print_error() {
    echo -e "${RED}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$SCRIPT_DIR/../network"

print_message "🔧 Setting up Certificate Authority for Hyperledger Fabric..."

cd "$NETWORK_DIR"

# Clean previous setup
print_message "Cleaning previous setup..."
docker compose down -v 2>/dev/null || true
sudo rm -rf organizations/peerOrganizations 2>/dev/null || true
sudo rm -rf organizations/ordererOrganizations 2>/dev/null || true
sudo rm -rf organizations/fabric-ca 2>/dev/null || true
sudo rm -rf system-genesis-block/* 2>/dev/null || true
sudo rm -rf channel-artifacts/* 2>/dev/null || true

# Create directory structure using existing folders
print_message "Creating directory structure..."
mkdir -p organizations/fabric-ca/bpsbp/msp
mkdir -p organizations/fabric-ca/disbun/msp
mkdir -p organizations/fabric-ca/ordererOrg/msp
mkdir -p organizations/peerOrganizations
mkdir -p organizations/ordererOrganizations
mkdir -p system-genesis-block
mkdir -p channel-artifacts
# mkdir -p scripts

# Start CA containers
print_message "Starting Certificate Authority containers..."
docker compose up -d ca_bpsbp ca_disbun ca_orderer

# Wait for CAs to start
print_message "Waiting for CAs to initialize..."
sleep 10

# Function to wait for CA to be ready
wait_for_ca() {
    local ca_name=$1
    local ca_port=$2
    local max_attempts=30
    local attempt=1
    
    print_message "Waiting for $ca_name to be ready..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s -k https://${IP_CA}:$ca_port/cainfo > /dev/null 2>&1; then
            print_message "$ca_name is ready!"
            break
        fi
        print_warning "Attempt $attempt/$max_attempts: $ca_name not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        print_error "$ca_name failed to start properly"
        return 1
    fi
}

# Wait for all CAs
wait_for_ca "BPSBP CA" ${BPSBP_CA_PORT}
wait_for_ca "Disbun CA" ${DISBUN_CA_PORT}
wait_for_ca "Orderer CA" ${ORDERER_CA_PORT}

# Copy TLS certificates from CA containers to host
print_message "Copying TLS certificates from CA containers..."
docker cp ca_bpsbp:/etc/hyperledger/fabric-ca-server/tls-cert.pem "organizations/fabric-ca/bpsbp/tls-cert.pem"
docker cp ca_disbun:/etc/hyperledger/fabric-ca-server/tls-cert.pem "organizations/fabric-ca/disbun/tls-cert.pem"
docker cp ca_orderer:/etc/hyperledger/fabric-ca-server/tls-cert.pem "organizations/fabric-ca/ordererOrg/tls-cert.pem"

# Copy CA certificates as well
docker cp ca_bpsbp:/etc/hyperledger/fabric-ca-server/ca-cert.pem "organizations/fabric-ca/bpsbp/ca-cert.pem"
docker cp ca_disbun:/etc/hyperledger/fabric-ca-server/ca-cert.pem "organizations/fabric-ca/disbun/ca-cert.pem"
docker cp ca_orderer:/etc/hyperledger/fabric-ca-server/ca-cert.pem "organizations/fabric-ca/ordererOrg/ca-cert.pem"

# Copy MSP config files (create if not exist)
mkdir -p organizations/fabric-ca/bpsbp/msp
mkdir -p organizations/fabric-ca/disbun/msp 
mkdir -p organizations/fabric-ca/ordererOrg/msp

# Create basic config.yaml files
cat > organizations/fabric-ca/bpsbp/msp/config.yaml << EOF
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/ca.crt
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/ca.crt
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/ca.crt
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/ca.crt
    OrganizationalUnitIdentifier: orderer
EOF

cat > organizations/fabric-ca/disbun/msp/config.yaml << EOF
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/ca.crt
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/ca.crt
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/ca.crt
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/ca.crt
    OrganizationalUnitIdentifier: orderer
EOF

cat > organizations/fabric-ca/ordererOrg/msp/config.yaml << EOF
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/ca.crt
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/ca.crt
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/ca.crt
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/ca.crt
    OrganizationalUnitIdentifier: orderer
EOF

# Set environment variables for fabric-ca-client
export FABRIC_CA_CLIENT_HOME=$NETWORK_DIR/organizations/fabric-ca/bpsbp

print_message "🔐 Enrolling CA Admin users..."

# Enroll BPSBP CA Admin
print_message "Enrolling BPSBP CA Admin..."
fabric-ca-client enroll -u https://admin:adminpw@${IP_CA}:${BPSBP_CA_PORT} --caname ca-bpsbp --tls.certfiles "$NETWORK_DIR/organizations/fabric-ca/bpsbp/tls-cert.pem"

# Register and enroll BPSBP users
print_message "Registering BPSBP users..."
fabric-ca-client register --caname ca-bpsbp --id.name pusat --id.secret pusatpw --id.type peer --tls.certfiles "$NETWORK_DIR/organizations/fabric-ca/bpsbp/tls-cert.pem"
fabric-ca-client register --caname ca-bpsbp --id.name cert --id.secret certpw --id.type peer --tls.certfiles "$NETWORK_DIR/organizations/fabric-ca/bpsbp/tls-cert.pem"
fabric-ca-client register --caname ca-bpsbp --id.name user1 --id.secret user1pw --id.type client --tls.certfiles "$NETWORK_DIR/organizations/fabric-ca/bpsbp/tls-cert.pem"
fabric-ca-client register --caname ca-bpsbp --id.name bpsbpadmin --id.secret bpsbpadminpw --id.type admin --tls.certfiles "$NETWORK_DIR/organizations/fabric-ca/bpsbp/tls-cert.pem"

# Create BPSBP MSP structure
print_message "Creating BPSBP MSP structure..."
mkdir -p organizations/peerOrganizations/${BPSBP_DOMAIN}/

# Enroll BPSBP Admin
export FABRIC_CA_CLIENT_HOME=$NETWORK_DIR/organizations/peerOrganizations/${BPSBP_DOMAIN}/
fabric-ca-client enroll -u https://bpsbpadmin:bpsbpadminpw@${IP_CA}:${BPSBP_CA_PORT} --caname ca-bpsbp -M "$NETWORK_DIR/organizations/peerOrganizations/${BPSBP_DOMAIN}/users/Admin@${BPSBP_DOMAIN}/msp" --tls.certfiles "$NETWORK_DIR/organizations/fabric-ca/bpsbp/tls-cert.pem"

# Copy the NodeOU configuration
cp "$NETWORK_DIR/organizations/fabric-ca/bpsbp/msp/config.yaml" "$NETWORK_DIR/organizations/peerOrganizations/${BPSBP_DOMAIN}/users/Admin@${BPSBP_DOMAIN}/msp/config.yaml"

# Enroll BPSBP Peers
print_message "Enrolling BPSBP peers..."

# Pusat (${BPSBP_DOMAIN})
fabric-ca-client enroll -u https://pusat:pusatpw@${IP_CA}:${BPSBP_CA_PORT} --caname ca-bpsbp -M "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/msp" --csr.hosts pusat.${BPSBP_DOMAIN} --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/bpsbp/tls-cert.pem"

# Cert
fabric-ca-client enroll -u https://cert:certpw@${IP_CA}:${BPSBP_CA_PORT} --caname ca-bpsbp -M "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/cert.${BPSBP_DOMAIN}/msp" --csr.hosts cert.${BPSBP_DOMAIN} --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/bpsbp/tls-cert.pem"

# Generate TLS certificates for BPSBP peers
print_message "Generating TLS certificates for BPSBP peers..."

# Pusat TLS (${BPSBP_DOMAIN})
fabric-ca-client enroll -u https://pusat:pusatpw@${IP_CA}:${BPSBP_CA_PORT} --caname ca-bpsbp -M "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/tls" --enrollment.profile tls --csr.hosts pusat.${BPSBP_DOMAIN} --csr.hosts localhost --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/bpsbp/tls-cert.pem"

# Cert TLS
fabric-ca-client enroll -u https://cert:certpw@${IP_CA}:${BPSBP_CA_PORT} --caname ca-bpsbp -M "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/cert.${BPSBP_DOMAIN}/tls" --enrollment.profile tls --csr.hosts cert.${BPSBP_DOMAIN} --csr.hosts localhost --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/bpsbp/tls-cert.pem"

# Setup Disbun organization
print_message "Setting up Disbun organization..."
export FABRIC_CA_CLIENT_HOME=$NETWORK_DIR/organizations/fabric-ca/disbun

# Enroll Disbun CA Admin
fabric-ca-client enroll -u https://admin:adminpw@${IP_CA}:${DISBUN_CA_PORT} --caname ca-disbun --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/disbun/tls-cert.pem"

# Register Disbun users
fabric-ca-client register --caname ca-disbun --id.name pusat --id.secret pusatpw --id.type peer --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/disbun/tls-cert.pem"
fabric-ca-client register --caname ca-disbun --id.name bpsbp --id.secret bpsbppw --id.type peer --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/disbun/tls-cert.pem"
fabric-ca-client register --caname ca-disbun --id.name user1 --id.secret user1pw --id.type client --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/disbun/tls-cert.pem"
fabric-ca-client register --caname ca-disbun --id.name disbunadmin --id.secret disbunadminpw --id.type admin --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/disbun/tls-cert.pem"

# Create Disbun MSP structure
mkdir -p organizations/peerOrganizations/${DISBUN_DOMAIN}/

# Enroll Disbun Admin
export FABRIC_CA_CLIENT_HOME=$NETWORK_DIR/organizations/peerOrganizations/${DISBUN_DOMAIN}/
fabric-ca-client enroll -u https://disbunadmin:disbunadminpw@${IP_CA}:${DISBUN_CA_PORT} --caname ca-disbun -M "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/users/Admin@${DISBUN_DOMAIN}/msp" --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/disbun/tls-cert.pem"

# Copy NodeOU configuration
cp "${NETWORK_DIR}/organizations/fabric-ca/disbun/msp/config.yaml" "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/users/Admin@${DISBUN_DOMAIN}/msp/config.yaml"

# Enroll Disbun Peers
print_message "Enrolling Disbun peers..."

# Pusat (${DISBUN_DOMAIN})
fabric-ca-client enroll -u https://pusat:pusatpw@${IP_CA}:${DISBUN_CA_PORT} --caname ca-disbun -M "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/msp" --csr.hosts sekretariat.${DISBUN_DOMAIN} --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/disbun/tls-cert.pem"

# Digital (ubah dari bpsbp ke digital)
fabric-ca-client enroll -u https://bpsbp:bpsbppw@${IP_CA}:${DISBUN_CA_PORT} --caname ca-disbun -M "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/digital.${DISBUN_DOMAIN}/msp" --csr.hosts digital.${DISBUN_DOMAIN} --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/disbun/tls-cert.pem"

# Generate TLS certificates for Disbun peers
print_message "Generating TLS certificates for Disbun peers..."

# Pusat TLS (${DISBUN_DOMAIN})
fabric-ca-client enroll -u https://pusat:pusatpw@${IP_CA}:${DISBUN_CA_PORT} --caname ca-disbun -M "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/tls" --enrollment.profile tls --csr.hosts sekretariat.${DISBUN_DOMAIN} --csr.hosts localhost --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/disbun/tls-cert.pem"

# Digital TLS
fabric-ca-client enroll -u https://bpsbp:bpsbppw@${IP_CA}:${DISBUN_CA_PORT} --caname ca-disbun -M "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/digital.${DISBUN_DOMAIN}/tls" --enrollment.profile tls --csr.hosts digital.${DISBUN_DOMAIN} --csr.hosts localhost --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/disbun/tls-cert.pem"

# Setup Orderer organization
print_message "Setting up Orderer organization..."
export FABRIC_CA_CLIENT_HOME=$NETWORK_DIR/organizations/fabric-ca/ordererOrg

# Enroll Orderer CA Admin
fabric-ca-client enroll -u https://admin:adminpw@${IP_CA}:${ORDERER_CA_PORT} --caname ca-orderer --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/tls-cert.pem"

# Register Orderer users
fabric-ca-client register --caname ca-orderer --id.name orderer --id.secret ordererpw --id.type orderer --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/tls-cert.pem"
fabric-ca-client register --caname ca-orderer --id.name orderer2 --id.secret orderer2pw --id.type orderer --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/tls-cert.pem"
fabric-ca-client register --caname ca-orderer --id.name orderer3 --id.secret orderer3pw --id.type orderer --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/tls-cert.pem"
fabric-ca-client register --caname ca-orderer --id.name ordererAdmin --id.secret ordererAdminpw --id.type admin --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/tls-cert.pem"

# Create Orderer MSP structure
mkdir -p organizations/ordererOrganizations/${DOMAIN_SUFFIX}

# Enroll Orderer Admin
export FABRIC_CA_CLIENT_HOME=$NETWORK_DIR/organizations/ordererOrganizations/${DOMAIN_SUFFIX}
fabric-ca-client enroll -u https://ordererAdmin:ordererAdminpw@${IP_CA}:${ORDERER_CA_PORT} --caname ca-orderer -M "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/users/Admin@${DOMAIN_SUFFIX}/msp" --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/tls-cert.pem"

# Copy NodeOU configuration
cp "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/msp/config.yaml" "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/users/Admin@${DOMAIN_SUFFIX}/msp/config.yaml"

# Enroll Orderer
fabric-ca-client enroll -u https://orderer:ordererpw@${IP_CA}:${ORDERER_CA_PORT} --caname ca-orderer -M "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/msp" --csr.hosts ${ORDERER_DOMAIN} --csr.hosts localhost --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/tls-cert.pem"

# Enroll Orderer2
fabric-ca-client enroll -u https://orderer2:orderer2pw@${IP_CA}:${ORDERER_CA_PORT} --caname ca-orderer -M "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer2.${DOMAIN_SUFFIX}/msp" --csr.hosts chain-orderer2.${DOMAIN_SUFFIX} --csr.hosts localhost --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/tls-cert.pem"

# Enroll Orderer3
fabric-ca-client enroll -u https://orderer3:orderer3pw@${IP_CA}:${ORDERER_CA_PORT} --caname ca-orderer -M "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer3.${DOMAIN_SUFFIX}/msp" --csr.hosts chain-orderer3.${DOMAIN_SUFFIX} --csr.hosts localhost --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/tls-cert.pem"

# Copy NodeOU configuration for all orderers
cp "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/msp/config.yaml" "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/msp/config.yaml"
cp "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/msp/config.yaml" "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer2.${DOMAIN_SUFFIX}/msp/config.yaml"
cp "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/msp/config.yaml" "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer3.${DOMAIN_SUFFIX}/msp/config.yaml"

# Generate TLS certificates for Orderer
print_message "Generating TLS certificates for all Orderers..."
fabric-ca-client enroll -u https://orderer:ordererpw@${IP_CA}:${ORDERER_CA_PORT} --caname ca-orderer -M "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls" --enrollment.profile tls --csr.hosts ${ORDERER_DOMAIN} --csr.hosts localhost --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/tls-cert.pem"

fabric-ca-client enroll -u https://orderer2:orderer2pw@${IP_CA}:${ORDERER_CA_PORT} --caname ca-orderer -M "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer2.${DOMAIN_SUFFIX}/tls" --enrollment.profile tls --csr.hosts chain-orderer2.${DOMAIN_SUFFIX} --csr.hosts localhost --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/tls-cert.pem"

fabric-ca-client enroll -u https://orderer3:orderer3pw@${IP_CA}:${ORDERER_CA_PORT} --caname ca-orderer -M "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer3.${DOMAIN_SUFFIX}/tls" --enrollment.profile tls --csr.hosts chain-orderer3.${DOMAIN_SUFFIX} --csr.hosts localhost --tls.certfiles "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/tls-cert.pem"

# Create MSP directories and copy certificates
print_message "Setting up MSP structure..."

# Setup Orderer MSP
mkdir -p "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/msp/cacerts"
mkdir -p "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/msp/tlscacerts"
mkdir -p "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/msp/admincerts"
cp "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/ca-cert.pem" "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/msp/cacerts/ca.crt"
cp "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/tls-cert.pem" "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/msp/tlscacerts/ca.crt"
# Copy admin cert to MSP admincerts folder
cp "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/users/Admin@${DOMAIN_SUFFIX}/msp/signcerts/"* "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/msp/admincerts/"
cp "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/msp/config.yaml" "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/msp/config.yaml"

# Setup Peer Organization MSP structures
mkdir -p "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/msp/cacerts"
mkdir -p "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/msp/tlscacerts"
mkdir -p "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/msp/admincerts"
cp "${NETWORK_DIR}/organizations/fabric-ca/bpsbp/ca-cert.pem" "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/msp/cacerts/ca.crt"
cp "${NETWORK_DIR}/organizations/fabric-ca/bpsbp/tls-cert.pem" "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/msp/tlscacerts/ca.crt"
# Copy admin cert to MSP admincerts folder
cp "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/users/Admin@${BPSBP_DOMAIN}/msp/signcerts/"* "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/msp/admincerts/"
cp "${NETWORK_DIR}/organizations/fabric-ca/bpsbp/msp/config.yaml" "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/msp/config.yaml"

mkdir -p "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/msp/cacerts"
mkdir -p "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/msp/tlscacerts"
mkdir -p "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/msp/admincerts"
cp "${NETWORK_DIR}/organizations/fabric-ca/disbun/ca-cert.pem" "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/msp/cacerts/ca.crt"
cp "${NETWORK_DIR}/organizations/fabric-ca/disbun/tls-cert.pem" "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/msp/tlscacerts/ca.crt"
# Copy admin cert to MSP admincerts folder
cp "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/users/Admin@${DISBUN_DOMAIN}/msp/signcerts/"* "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/msp/admincerts/"
cp "${NETWORK_DIR}/organizations/fabric-ca/disbun/msp/config.yaml" "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/msp/config.yaml"

# Fix TLS certificate naming
print_message "Fixing TLS certificate structure..."

# BPSBP Pusat (${BPSBP_DOMAIN})
mkdir -p "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/tls"
cp "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/tls/tlscacerts/"* "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/tls/ca.crt"
cp "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/tls/signcerts/"* "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/tls/server.crt"
cp "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/tls/keystore/"* "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/tls/server.key"

# BPSBP Cert
mkdir -p "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/cert.${BPSBP_DOMAIN}/tls"
cp "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/cert.${BPSBP_DOMAIN}/tls/tlscacerts/"* "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/cert.${BPSBP_DOMAIN}/tls/ca.crt"
cp "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/cert.${BPSBP_DOMAIN}/tls/signcerts/"* "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/cert.${BPSBP_DOMAIN}/tls/server.crt"
cp "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/cert.${BPSBP_DOMAIN}/tls/keystore/"* "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/cert.${BPSBP_DOMAIN}/tls/server.key"

# Disbun Pusat (${DISBUN_DOMAIN})
mkdir -p "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/tls"
cp "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/tls/tlscacerts/"* "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/tls/ca.crt"
cp "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/tls/signcerts/"* "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/tls/server.crt"
cp "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/tls/keystore/"* "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/tls/server.key"

# Disbun Digital
mkdir -p "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/digital.${DISBUN_DOMAIN}/tls"
cp "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/digital.${DISBUN_DOMAIN}/tls/tlscacerts/"* "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/digital.${DISBUN_DOMAIN}/tls/ca.crt"
cp "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/digital.${DISBUN_DOMAIN}/tls/signcerts/"* "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/digital.${DISBUN_DOMAIN}/tls/server.crt"
cp "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/digital.${DISBUN_DOMAIN}/tls/keystore/"* "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/digital.${DISBUN_DOMAIN}/tls/server.key"

# Orderer 1
mkdir -p "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls"
cp "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls/tlscacerts/"* "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls/ca.crt"
cp "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls/signcerts/"* "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls/server.crt"
cp "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls/keystore/"* "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls/server.key"

# Orderer 2
mkdir -p "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer2.${DOMAIN_SUFFIX}/tls"
cp "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer2.${DOMAIN_SUFFIX}/tls/tlscacerts/"* "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer2.${DOMAIN_SUFFIX}/tls/ca.crt"
cp "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer2.${DOMAIN_SUFFIX}/tls/signcerts/"* "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer2.${DOMAIN_SUFFIX}/tls/server.crt"
cp "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer2.${DOMAIN_SUFFIX}/tls/keystore/"* "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer2.${DOMAIN_SUFFIX}/tls/server.key"

# Orderer 3
mkdir -p "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer3.${DOMAIN_SUFFIX}/tls"
cp "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer3.${DOMAIN_SUFFIX}/tls/tlscacerts/"* "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer3.${DOMAIN_SUFFIX}/tls/ca.crt"
cp "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer3.${DOMAIN_SUFFIX}/tls/signcerts/"* "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer3.${DOMAIN_SUFFIX}/tls/server.crt"
cp "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer3.${DOMAIN_SUFFIX}/tls/keystore/"* "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer3.${DOMAIN_SUFFIX}/tls/server.key"

print_message "🔧 Fixing CA certificate issues for MSP compatibility..."

# Fix CA certificates in individual peer/orderer MSPs (needed for docker volume mounts)
print_message "Copying actual CA certificates to individual MSP folders..."

# Copy CA certificates to orderer MSPs
cp "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/ca-cert.pem" "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/msp/cacerts/ca.crt"
cp "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/ca-cert.pem" "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer2.${DOMAIN_SUFFIX}/msp/cacerts/ca.crt"
cp "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/ca-cert.pem" "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer3.${DOMAIN_SUFFIX}/msp/cacerts/ca.crt"
cp "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/msp/config.yaml" "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/msp/config.yaml"
cp "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/msp/config.yaml" "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer2.${DOMAIN_SUFFIX}/msp/config.yaml"
cp "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/msp/config.yaml" "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/chain-orderer3.${DOMAIN_SUFFIX}/msp/config.yaml"

# Copy CA certificates to all peer MSPs
cp "${NETWORK_DIR}/organizations/fabric-ca/bpsbp/ca-cert.pem" "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/msp/cacerts/ca.crt"
cp "${NETWORK_DIR}/organizations/fabric-ca/bpsbp/ca-cert.pem" "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/cert.${BPSBP_DOMAIN}/msp/cacerts/ca.crt"
cp "${NETWORK_DIR}/organizations/fabric-ca/disbun/ca-cert.pem" "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/msp/cacerts/ca.crt"
cp "${NETWORK_DIR}/organizations/fabric-ca/disbun/ca-cert.pem" "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/digital.${DISBUN_DOMAIN}/msp/cacerts/ca.crt"

# Copy CA certificates to admin user MSPs for channel operations
cp "${NETWORK_DIR}/organizations/fabric-ca/bpsbp/ca-cert.pem" "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/users/Admin@${BPSBP_DOMAIN}/msp/cacerts/ca.crt"
cp "${NETWORK_DIR}/organizations/fabric-ca/disbun/ca-cert.pem" "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/users/Admin@${DISBUN_DOMAIN}/msp/cacerts/ca.crt"

# Copy config.yaml to all peer MSPs
cp "${NETWORK_DIR}/organizations/fabric-ca/bpsbp/msp/config.yaml" "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/msp/config.yaml"
cp "${NETWORK_DIR}/organizations/fabric-ca/bpsbp/msp/config.yaml" "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/cert.${BPSBP_DOMAIN}/msp/config.yaml"
cp "${NETWORK_DIR}/organizations/fabric-ca/disbun/msp/config.yaml" "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/msp/config.yaml"
cp "${NETWORK_DIR}/organizations/fabric-ca/disbun/msp/config.yaml" "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/digital.${DISBUN_DOMAIN}/msp/config.yaml"

# Copy config.yaml to admin user MSPs
cp "${NETWORK_DIR}/organizations/fabric-ca/bpsbp/msp/config.yaml" "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/users/Admin@${BPSBP_DOMAIN}/msp/config.yaml"
cp "${NETWORK_DIR}/organizations/fabric-ca/disbun/msp/config.yaml" "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/users/Admin@${DISBUN_DOMAIN}/msp/config.yaml"

print_message "🔒 Fixing TLS CA certificates for consensus compatibility..."

# Fix TLS CA certificates - Replace TLS certs with actual CA certs in MSP tlscacerts folders
# This fixes the "CA Certificate did not have the CA attribute" error
cp "${NETWORK_DIR}/organizations/fabric-ca/bpsbp/ca-cert.pem" "${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/msp/tlscacerts/ca.crt"
cp "${NETWORK_DIR}/organizations/fabric-ca/disbun/ca-cert.pem" "${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/msp/tlscacerts/ca.crt"
cp "${NETWORK_DIR}/organizations/fabric-ca/ordererOrg/ca-cert.pem" "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/msp/tlscacerts/ca.crt"

print_message "✅ All certificate issues fixed!"
print_message "✅ Certificate Authority setup completed!"
print_message "📁 Generated organizations:"
print_message "   - organizations/peerOrganizations/${BPSBP_DOMAIN}/"
print_message "   - organizations/peerOrganizations/${DISBUN_DOMAIN}/"
print_message "   - organizations/ordererOrganizations/${DOMAIN_SUFFIX}/"
print_message ""
print_message "Next steps:"
print_message "   1. Generate channel artifacts with configtxgen"
print_message "   2. Start the peer and orderer containers"
print_message "   3. Create and join channel"
print_message "   4. Deploy chaincode"


# Lokasi script
SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
PROJECT_ROOT="$(realpath "$SCRIPT_DIR/..")"

# Path file
ENV_FILE="$PROJECT_ROOT/.env"
NETWORK_DIR="$PROJECT_ROOT/network"
TEMPLATE="$NETWORK_DIR/configtx-template.yaml"
OUTPUT="$NETWORK_DIR/configtx.yaml"

# Pastikan .env ada
if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ .env tidak ditemukan di $ENV_FILE"
  exit 1
fi

# Pastikan template ada
if [[ ! -f "$TEMPLATE" ]]; then
  echo "❌ Template configtx tidak ditemukan di $TEMPLATE"
  exit 1
fi

# Load variabel dari .env (tanpa perlu export di file)
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Pastikan envsubst tersedia
command -v envsubst >/dev/null || {
  echo "❌ 'envsubst' tidak ada. Install: sudo apt-get install gettext-base"
  exit 1
}

# Generate configtx.yaml
echo "🔧 Menggunakan .env dari $ENV_FILE"
echo "🧩 Render: $TEMPLATE → $OUTPUT"
envsubst < "$TEMPLATE" > "$OUTPUT"
echo "✅ Selesai, hasil tersimpan di $OUTPUT" # load .env ke environment
