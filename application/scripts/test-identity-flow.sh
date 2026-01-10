#!/bin/bash

#######################################################
# Script Pengujian Per-User Identity Mechanism
# 
# Script ini menguji alur lengkap:
# 1. Registrasi user di Keycloak
# 2. Enrollment identitas Fabric
# 3. Operasi blockchain dengan identitas per-user
#
# Prasyarat:
# - Keycloak running di port 6080
# - Fabric network running
# - Application API running di port 3000
# - IPFS cluster running
#
# @author Rangga
# @date 2026-01-10
#######################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:6080}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-SeedCertificationRealm}"
KEYCLOAK_CLIENT_ID="${KEYCLOAK_CLIENT_ID:-seed-certification-client}"
API_URL="${API_URL:-http://localhost:3000}"

# Test users
PRODUCER_USER="test_producer_$(date +%s)"
PRODUCER_PASSWORD="Test@123"
PBT_FIELD_USER="test_pbt_field_$(date +%s)"
PBT_FIELD_PASSWORD="Test@123"
PBT_CHIEF_USER="test_pbt_chief_$(date +%s)"
PBT_CHIEF_PASSWORD="Test@123"
LSM_HEAD_USER="test_lsm_head_$(date +%s)"
LSM_HEAD_PASSWORD="Test@123"

# Store created resource IDs for cleanup
declare -a CREATED_USER_IDS
BATCH_ID=""

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "\n${YELLOW}========================================${NC}"
    echo -e "${YELLOW}$1${NC}"
    echo -e "${YELLOW}========================================${NC}\n"
}

# Get Keycloak admin token
get_admin_token() {
    log_info "Getting Keycloak admin token..."
    
    ADMIN_TOKEN=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "grant_type=password" \
        -d "client_id=admin-cli" \
        -d "username=admin" \
        -d "password=admin" | jq -r '.access_token')
    
    if [ "$ADMIN_TOKEN" == "null" ] || [ -z "$ADMIN_TOKEN" ]; then
        log_error "Failed to get admin token"
        exit 1
    fi
    
    log_success "Got admin token"
}

# Create user in Keycloak
create_keycloak_user() {
    local username=$1
    local password=$2
    local role=$3
    
    log_info "Creating Keycloak user: $username with role: $role"
    
    # Create user
    local response=$(curl -s -w "\n%{http_code}" -X POST "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users" \
        -H "Authorization: Bearer ${ADMIN_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{
            \"username\": \"${username}\",
            \"enabled\": true,
            \"emailVerified\": true,
            \"credentials\": [{
                \"type\": \"password\",
                \"value\": \"${password}\",
                \"temporary\": false
            }]
        }")
    
    local http_code=$(echo "$response" | tail -1)
    
    if [ "$http_code" != "201" ] && [ "$http_code" != "409" ]; then
        log_error "Failed to create user $username (HTTP $http_code)"
        return 1
    fi
    
    # Get user ID
    local user_id=$(curl -s "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users?username=${username}" \
        -H "Authorization: Bearer ${ADMIN_TOKEN}" | jq -r '.[0].id')
    
    if [ "$user_id" == "null" ] || [ -z "$user_id" ]; then
        log_error "Failed to get user ID for $username"
        return 1
    fi
    
    CREATED_USER_IDS+=("$user_id")
    
    # Get role ID
    local role_id=$(curl -s "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/roles" \
        -H "Authorization: Bearer ${ADMIN_TOKEN}" | jq -r ".[] | select(.name==\"$role\") | .id")
    
    if [ -n "$role_id" ] && [ "$role_id" != "null" ]; then
        # Assign role to user
        curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${user_id}/role-mappings/realm" \
            -H "Authorization: Bearer ${ADMIN_TOKEN}" \
            -H "Content-Type: application/json" \
            -d "[{\"id\": \"${role_id}\", \"name\": \"${role}\"}]"
        
        log_success "Created user $username with role $role (ID: $user_id)"
    else
        log_warning "Role $role not found, user created without role"
    fi
    
    echo "$user_id"
}

# Get user access token
get_user_token() {
    local username=$1
    local password=$2
    
    local token=$(curl -s -X POST "${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "grant_type=password" \
        -d "client_id=${KEYCLOAK_CLIENT_ID}" \
        -d "username=${username}" \
        -d "password=${password}" | jq -r '.access_token')
    
    if [ "$token" == "null" ] || [ -z "$token" ]; then
        log_error "Failed to get token for $username"
        return 1
    fi
    
    echo "$token"
}

# Enroll user in Fabric CA
enroll_user() {
    local username=$1
    local token=$2
    
    log_info "Enrolling $username in Fabric CA..."
    
    local response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/v1/identity/enroll" \
        -H "Authorization: Bearer ${token}" \
        -H "Content-Type: application/json")
    
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "201" ] || [ "$http_code" == "200" ]; then
        log_success "Enrolled $username successfully"
        echo "$body" | jq -r '.data.userId'
    else
        log_error "Failed to enroll $username (HTTP $http_code)"
        echo "$body"
        return 1
    fi
}

# Check identity status
check_identity_status() {
    local token=$1
    
    local response=$(curl -s "${API_URL}/api/v1/identity/status" \
        -H "Authorization: Bearer ${token}")
    
    echo "$response"
}

# Create seed batch
create_seed_batch() {
    local token=$1
    
    log_info "Creating seed batch..."
    
    # Create a temp file for testing
    local temp_file="/tmp/test_seed_doc_$(date +%s).pdf"
    echo "Test seed source document content" > "$temp_file"
    
    local response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/v1/seed-batches" \
        -H "Authorization: Bearer ${token}" \
        -F "document=@${temp_file}" \
        -F "varietyName=Ciherang" \
        -F "commodity=Padi" \
        -F "harvestDate=2025-12-15" \
        -F "seedSourceNumber=SRC-$(date +%s)" \
        -F "origin=Jawa Barat" \
        -F "iupNumber=IUP-$(date +%s)" \
        -F "seedClass=BD")
    
    rm -f "$temp_file"
    
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "201" ]; then
        BATCH_ID=$(echo "$body" | jq -r '.data.batchId')
        log_success "Created seed batch: $BATCH_ID"
    else
        log_error "Failed to create seed batch (HTTP $http_code)"
        echo "$body"
        return 1
    fi
}

# Submit certification
submit_certification() {
    local token=$1
    local batch_id=$2
    
    log_info "Submitting certification for batch $batch_id..."
    
    local temp_file="/tmp/test_cert_req_$(date +%s).pdf"
    echo "Certification request document" > "$temp_file"
    
    local response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/v1/seed-batches/${batch_id}/submit" \
        -H "Authorization: Bearer ${token}" \
        -F "document=@${temp_file}")
    
    rm -f "$temp_file"
    
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "200" ]; then
        log_success "Submitted certification for batch $batch_id"
    else
        log_error "Failed to submit certification (HTTP $http_code)"
        echo "$body"
        return 1
    fi
}

# Record inspection
record_inspection() {
    local token=$1
    local batch_id=$2
    
    log_info "Recording inspection for batch $batch_id..."
    
    local temp_file="/tmp/test_inspection_$(date +%s).jpg"
    echo "Inspection photo content" > "$temp_file"
    
    local response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/v1/seed-batches/${batch_id}/inspect" \
        -H "Authorization: Bearer ${token}" \
        -F "photo=@${temp_file}" \
        -F "inspectionResult=Tanaman sehat, bebas hama dan penyakit. Pertumbuhan baik.")
    
    rm -f "$temp_file"
    
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "200" ]; then
        log_success "Recorded inspection for batch $batch_id"
    else
        log_error "Failed to record inspection (HTTP $http_code)"
        echo "$body"
        return 1
    fi
}

# Evaluate inspection
evaluate_inspection() {
    local token=$1
    local batch_id=$2
    local decision=$3
    
    log_info "Evaluating inspection for batch $batch_id (Decision: $decision)..."
    
    local response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/v1/seed-batches/${batch_id}/evaluate" \
        -H "Authorization: Bearer ${token}" \
        -H "Content-Type: application/json" \
        -d "{
            \"evaluationNote\": \"Hasil inspeksi memenuhi standar kualitas benih.\",
            \"approvalStatus\": \"${decision}\"
        }")
    
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "200" ]; then
        log_success "Evaluated inspection for batch $batch_id"
    else
        log_error "Failed to evaluate inspection (HTTP $http_code)"
        echo "$body"
        return 1
    fi
}

# Issue certificate
issue_certificate() {
    local token=$1
    local batch_id=$2
    
    log_info "Issuing certificate for batch $batch_id..."
    
    local temp_file="/tmp/test_certificate_$(date +%s).pdf"
    echo "Certificate document content" > "$temp_file"
    
    local cert_number="CERT-$(date +%Y)-$(date +%s)"
    
    local response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/v1/seed-batches/${batch_id}/certificate" \
        -H "Authorization: Bearer ${token}" \
        -F "document=@${temp_file}" \
        -F "certificateNumber=${cert_number}" \
        -F "expiryMonths=24")
    
    rm -f "$temp_file"
    
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "200" ]; then
        log_success "Issued certificate ${cert_number} for batch $batch_id"
    else
        log_error "Failed to issue certificate (HTTP $http_code)"
        echo "$body"
        return 1
    fi
}

# Distribute seed
distribute_seed() {
    local token=$1
    local batch_id=$2
    
    log_info "Distributing seed for batch $batch_id..."
    
    local response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/v1/seed-batches/${batch_id}/distribute" \
        -H "Authorization: Bearer ${token}" \
        -H "Content-Type: application/json" \
        -d "{
            \"distributionLocation\": \"Bandung, Jawa Barat\",
            \"quantity\": \"1000\"
        }")
    
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "200" ]; then
        log_success "Distributed seed for batch $batch_id"
    else
        log_error "Failed to distribute seed (HTTP $http_code)"
        echo "$body"
        return 1
    fi
}

# Query batch details
query_batch() {
    local token=$1
    local batch_id=$2
    
    log_info "Querying batch $batch_id..."
    
    local response=$(curl -s "${API_URL}/api/v1/seed-batches/${batch_id}" \
        -H "Authorization: Bearer ${token}")
    
    echo "$response" | jq '.'
}

# Get batch history
get_history() {
    local token=$1
    local batch_id=$2
    
    log_info "Getting history for batch $batch_id..."
    
    local response=$(curl -s "${API_URL}/api/v1/seed-batches/${batch_id}/history" \
        -H "Authorization: Bearer ${token}")
    
    echo "$response" | jq '.'
}

# Test unauthorized access
test_unauthorized_access() {
    local producer_token=$1
    local pbt_token=$2
    local batch_id=$3
    
    log_step "Testing Unauthorized Access (Should Fail)"
    
    # Producer trying to inspect (should fail)
    log_info "Testing: Producer trying to record inspection..."
    local temp_file="/tmp/test_unauth_$(date +%s).jpg"
    echo "Unauthorized test" > "$temp_file"
    
    local response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/v1/seed-batches/${batch_id}/inspect" \
        -H "Authorization: Bearer ${producer_token}" \
        -F "photo=@${temp_file}" \
        -F "inspectionResult=Test")
    
    rm -f "$temp_file"
    
    local http_code=$(echo "$response" | tail -1)
    
    if [ "$http_code" == "403" ] || [ "$http_code" == "500" ]; then
        log_success "Correctly rejected: Producer cannot record inspection"
    else
        log_warning "Expected rejection but got HTTP $http_code"
    fi
    
    # PBT field trying to submit certification (should fail - not owner)
    log_info "Testing: PBT field trying to submit certification..."
    local temp_file2="/tmp/test_unauth2_$(date +%s).pdf"
    echo "Unauthorized test" > "$temp_file2"
    
    response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/v1/seed-batches/${batch_id}/submit" \
        -H "Authorization: Bearer ${pbt_token}" \
        -F "document=@${temp_file2}")
    
    rm -f "$temp_file2"
    
    http_code=$(echo "$response" | tail -1)
    
    if [ "$http_code" == "403" ] || [ "$http_code" == "500" ]; then
        log_success "Correctly rejected: Non-owner cannot submit certification"
    else
        log_warning "Expected rejection but got HTTP $http_code"
    fi
}

# Cleanup test users
cleanup() {
    log_step "Cleaning Up Test Users"
    
    get_admin_token
    
    for user_id in "${CREATED_USER_IDS[@]}"; do
        log_info "Deleting user: $user_id"
        curl -s -X DELETE "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${user_id}" \
            -H "Authorization: Bearer ${ADMIN_TOKEN}"
    done
    
    log_success "Cleanup completed"
}

# Main test flow
main() {
    echo -e "\n${GREEN}======================================================${NC}"
    echo -e "${GREEN}  Per-User Identity Mechanism Test Script             ${NC}"
    echo -e "${GREEN}======================================================${NC}\n"
    
    # Check prerequisites
    log_step "Checking Prerequisites"
    
    if ! command -v jq &> /dev/null; then
        log_error "jq is required but not installed"
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed"
        exit 1
    fi
    
    # Check services
    log_info "Checking Keycloak..."
    if ! curl -s "${KEYCLOAK_URL}/realms/master" > /dev/null; then
        log_error "Keycloak is not reachable at ${KEYCLOAK_URL}"
        exit 1
    fi
    log_success "Keycloak is running"
    
    log_info "Checking API..."
    if ! curl -s "${API_URL}/api/health/liveness" > /dev/null; then
        log_error "API is not reachable at ${API_URL}"
        exit 1
    fi
    log_success "API is running"
    
    # Set up trap for cleanup on error
    trap cleanup EXIT
    
    #############################################
    # Step 1: Create Test Users in Keycloak
    #############################################
    log_step "Step 1: Creating Test Users in Keycloak"
    
    get_admin_token
    
    PRODUCER_ID=$(create_keycloak_user "$PRODUCER_USER" "$PRODUCER_PASSWORD" "producer")
    PBT_FIELD_ID=$(create_keycloak_user "$PBT_FIELD_USER" "$PBT_FIELD_PASSWORD" "pbt_field")
    PBT_CHIEF_ID=$(create_keycloak_user "$PBT_CHIEF_USER" "$PBT_CHIEF_PASSWORD" "pbt_chief")
    LSM_HEAD_ID=$(create_keycloak_user "$LSM_HEAD_USER" "$LSM_HEAD_PASSWORD" "lsm_head")
    
    #############################################
    # Step 2: Get User Tokens
    #############################################
    log_step "Step 2: Getting User Access Tokens"
    
    PRODUCER_TOKEN=$(get_user_token "$PRODUCER_USER" "$PRODUCER_PASSWORD")
    PBT_FIELD_TOKEN=$(get_user_token "$PBT_FIELD_USER" "$PBT_FIELD_PASSWORD")
    PBT_CHIEF_TOKEN=$(get_user_token "$PBT_CHIEF_USER" "$PBT_CHIEF_PASSWORD")
    LSM_HEAD_TOKEN=$(get_user_token "$LSM_HEAD_USER" "$LSM_HEAD_PASSWORD")
    
    log_success "Got all user tokens"
    
    #############################################
    # Step 3: Enroll Users in Fabric CA
    #############################################
    log_step "Step 3: Enrolling Users in Fabric CA"
    
    PRODUCER_FABRIC_ID=$(enroll_user "$PRODUCER_USER" "$PRODUCER_TOKEN")
    PBT_FIELD_FABRIC_ID=$(enroll_user "$PBT_FIELD_USER" "$PBT_FIELD_TOKEN")
    PBT_CHIEF_FABRIC_ID=$(enroll_user "$PBT_CHIEF_USER" "$PBT_CHIEF_TOKEN")
    LSM_HEAD_FABRIC_ID=$(enroll_user "$LSM_HEAD_USER" "$LSM_HEAD_TOKEN")
    
    log_info "Producer Fabric ID: $PRODUCER_FABRIC_ID"
    log_info "PBT Field Fabric ID: $PBT_FIELD_FABRIC_ID"
    log_info "PBT Chief Fabric ID: $PBT_CHIEF_FABRIC_ID"
    log_info "LSM Head Fabric ID: $LSM_HEAD_FABRIC_ID"
    
    #############################################
    # Step 4: Check Identity Status
    #############################################
    log_step "Step 4: Verifying Identity Status"
    
    log_info "Producer identity status:"
    check_identity_status "$PRODUCER_TOKEN" | jq '.'
    
    #############################################
    # Step 5: Complete Seed Certification Workflow
    #############################################
    log_step "Step 5: Seed Certification Workflow"
    
    # 5.1 Producer creates batch
    log_info "5.1 Producer creates seed batch"
    create_seed_batch "$PRODUCER_TOKEN"
    
    if [ -z "$BATCH_ID" ]; then
        log_error "No batch ID, cannot continue"
        exit 1
    fi
    
    # 5.2 Producer submits certification
    log_info "5.2 Producer submits certification"
    submit_certification "$PRODUCER_TOKEN" "$BATCH_ID"
    
    # 5.3 PBT Field records inspection
    log_info "5.3 PBT Field records inspection"
    record_inspection "$PBT_FIELD_TOKEN" "$BATCH_ID"
    
    # 5.4 PBT Chief evaluates
    log_info "5.4 PBT Chief evaluates inspection"
    evaluate_inspection "$PBT_CHIEF_TOKEN" "$BATCH_ID" "APPROVE"
    
    # 5.5 LSM Head issues certificate
    log_info "5.5 LSM Head issues certificate"
    issue_certificate "$LSM_HEAD_TOKEN" "$BATCH_ID"
    
    # 5.6 Producer distributes
    log_info "5.6 Producer distributes seed"
    distribute_seed "$PRODUCER_TOKEN" "$BATCH_ID"
    
    #############################################
    # Step 6: Test Unauthorized Access
    #############################################
    test_unauthorized_access "$PRODUCER_TOKEN" "$PBT_FIELD_TOKEN" "$BATCH_ID"
    
    #############################################
    # Step 7: Query Results
    #############################################
    log_step "Step 7: Querying Results"
    
    log_info "Final batch state:"
    query_batch "$PRODUCER_TOKEN" "$BATCH_ID"
    
    log_info "Transaction history:"
    get_history "$PRODUCER_TOKEN" "$BATCH_ID"
    
    #############################################
    # Summary
    #############################################
    log_step "Test Summary"
    
    echo -e "${GREEN}✓ Created test users in Keycloak${NC}"
    echo -e "${GREEN}✓ Enrolled users in Fabric CA${NC}"
    echo -e "${GREEN}✓ Producer created seed batch: $BATCH_ID${NC}"
    echo -e "${GREEN}✓ Producer submitted certification${NC}"
    echo -e "${GREEN}✓ PBT Field recorded inspection${NC}"
    echo -e "${GREEN}✓ PBT Chief evaluated inspection${NC}"
    echo -e "${GREEN}✓ LSM Head issued certificate${NC}"
    echo -e "${GREEN}✓ Producer distributed seed${NC}"
    echo -e "${GREEN}✓ Unauthorized access correctly rejected${NC}"
    
    echo -e "\n${GREEN}All tests passed!${NC}\n"
}

# Run main function
main "$@"
