#!/bin/bash

# Enroll existing test users for K6 load testing
# Uses gateway.jabarchain.me login + enroll API
# Prerequisites: Users must already exist in Keycloak

GATEWAY_URL="https://gateway.jabarchain.me"
KEYCLOAK_URL="https://auth.jabarchain.me"
KEYCLOAK_REALM="SeedCertificationRealm"
KEYCLOAK_CLIENT_ID="seed-cert-frontend"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CSV_FILE="$SCRIPT_DIR/documents/query_result.csv"
PASSWORD="Test123!"

echo "=== Enrolling K6 Load Test Users from CSV ==="
echo "Gateway: $GATEWAY_URL"
echo "Keycloak: $KEYCLOAK_URL"
echo "CSV File: $CSV_FILE"
echo ""

# Check if CSV file exists
if [ ! -f "$CSV_FILE" ]; then
    echo "❌ CSV file not found: $CSV_FILE"
    exit 1
fi

# Function to login and get access token
get_access_token() {
    local USERNAME=$1
    
    TOKEN_RESPONSE=$(curl -s -X POST "$KEYCLOAK_URL/realms/$KEYCLOAK_REALM/protocol/openid-connect/token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "grant_type=password" \
      -d "client_id=$KEYCLOAK_CLIENT_ID" \
      -d "username=$USERNAME" \
      -d "password=$PASSWORD")
    
    ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
    
    if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
        echo ""
        return 1
    fi
    
    echo "$ACCESS_TOKEN"
    return 0
}

# Function to enroll user via gateway API
enroll_user() {
    local USERNAME=$1
    local NAMA_PEMOHON=$2
    
    echo "Enrolling user: $USERNAME ($NAMA_PEMOHON)..."
    
    # Step 1: Login to get access token
    ACCESS_TOKEN=$(get_access_token "$USERNAME")
    
    if [ -z "$ACCESS_TOKEN" ]; then
        echo "  ❌ Failed to login - user may not exist in Keycloak"
        return 1
    fi
    
    echo "  ✓ Login successful"
    
    # Step 2: Call enroll API with access token
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$GATEWAY_URL/api/v1/identity/enroll" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "201" ]; then
        echo "  ✓ User enrolled successfully (new identity created)"
    elif [ "$HTTP_CODE" == "200" ]; then
        echo "  ✓ User already enrolled"
    elif [ "$HTTP_CODE" == "401" ]; then
        echo "  ❌ Unauthorized - token may be invalid"
    elif [ "$HTTP_CODE" == "403" ]; then
        echo "  ❌ Forbidden - user may not have required role"
    else
        echo "  ❌ Failed (HTTP $HTTP_CODE)"
        echo "     Response: $BODY"
    fi
    
    echo ""
}

# Create temporary file to store unique users
TEMP_FILE=$(mktemp)

echo "Processing CSV to extract unique users..."

# Extract unique username and nama_pemohon (skip header, get columns 2 and 3)
tail -n +2 "$CSV_FILE" | while IFS=',' read -r id username nama_pemohon rest; do
    # Clean values (remove quotes)
    username=$(echo "$username" | tr -d '"')
    nama_pemohon=$(echo "$nama_pemohon" | tr -d '"')
    
    # Output username|nama_pemohon format
    echo "${username}|${nama_pemohon}"
done | sort -t'|' -k1,1 -u > "$TEMP_FILE"

TOTAL_USERS=$(wc -l < "$TEMP_FILE" | tr -d ' ')
echo "Found $TOTAL_USERS unique users to enroll"
echo ""

# Enroll each unique user
COUNT=0
SUCCESS=0
FAILED=0
while IFS='|' read -r username nama_pemohon; do
    COUNT=$((COUNT + 1))
    echo "[$COUNT/$TOTAL_USERS]"
    if enroll_user "$username" "$nama_pemohon"; then
        SUCCESS=$((SUCCESS + 1))
    else
        FAILED=$((FAILED + 1))
    fi
    
    # Small delay to avoid overwhelming the server
    sleep 0.3
done < "$TEMP_FILE"

# Cleanup
rm -f "$TEMP_FILE"

echo "=== Enrollment Complete ==="
echo ""
echo "Total users processed: $TOTAL_USERS"
echo "Successful: $SUCCESS"
echo "Failed: $FAILED"
echo ""
echo "Password for all users: $PASSWORD"
echo ""
echo "Users can now be used for K6 load tests."
