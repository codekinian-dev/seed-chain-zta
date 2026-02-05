#!/bin/bash

# Setup test users for K6 load testing from query_result.csv data
# Uses gateway.jabarchain.me register-and-enroll API

GATEWAY_URL="https://gateway.jabarchain.me"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CSV_FILE="$SCRIPT_DIR/documents/query_result.csv"
PASSWORD="Test123!"

echo "=== Setting up K6 Load Test Users from CSV ==="
echo "Gateway: $GATEWAY_URL"
echo "CSV File: $CSV_FILE"
echo ""

# Check if CSV file exists
if [ ! -f "$CSV_FILE" ]; then
    echo "❌ CSV file not found: $CSV_FILE"
    exit 1
fi

# Function to register and enroll user via gateway API
register_and_enroll_user() {
    local USERNAME=$1
    local NAMA_PEMOHON=$2
    
    echo "Registering user: $USERNAME ($NAMA_PEMOHON)..."
    
    # Extract first and last name from nama_pemohon
    FIRST_NAME=$(echo "$NAMA_PEMOHON" | awk '{print $1}' | tr -d '*')
    LAST_NAME=$(echo "$NAMA_PEMOHON" | awk '{$1=""; print $0}' | xargs | tr -d '*')
    
    # If names are empty, use defaults
    if [ -z "$FIRST_NAME" ]; then
        FIRST_NAME="Test"
    fi
    if [ -z "$LAST_NAME" ]; then
        LAST_NAME="User"
    fi
    
    # Call register-and-enroll API
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$GATEWAY_URL/api/v1/identity/register-and-enroll" \
      -H "Content-Type: application/json" \
      -d "{
        \"username\": \"$USERNAME\",
        \"password\": \"$PASSWORD\",
        \"email\": \"${USERNAME}@test.jabarchain.me\",
        \"firstName\": \"$FIRST_NAME\",
        \"lastName\": \"$LAST_NAME\",
        \"role\": \"role_producer\",
        \"organization\": \"Test Organization\",
        \"phone\": \"081234567890\",
        \"address\": \"Test Address\"
      }")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "201" ]; then
        echo "  ✓ User registered and enrolled successfully"
    elif [ "$HTTP_CODE" == "409" ]; then
        echo "  ⚠️  User already exists"
    elif [ "$HTTP_CODE" == "200" ]; then
        echo "  ✓ User processed (already enrolled)"
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
echo "Found $TOTAL_USERS unique users to register"
echo ""

# Register each unique user
COUNT=0
while IFS='|' read -r username nama_pemohon; do
    COUNT=$((COUNT + 1))
    echo "[$COUNT/$TOTAL_USERS]"
    register_and_enroll_user "$username" "$nama_pemohon"
    
    # Small delay to avoid overwhelming the server
    sleep 0.5
done < "$TEMP_FILE"

# Cleanup
rm -f "$TEMP_FILE"

echo "=== Setup Complete ==="
echo ""
echo "Total users processed: $TOTAL_USERS"
echo "Password for all users: $PASSWORD"
echo ""
echo "Users can now login with their username and password."
echo "You can run K6 load tests with these users."
echo ""
echo "Test users created:"
