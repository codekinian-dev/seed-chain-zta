#!/bin/bash

# Script to create test users in Keycloak for integration tests
# This script uses Keycloak Admin CLI to create users with required attributes

KEYCLOAK_URL="http://localhost:8041"
REALM="SeedCertificationRealm"
ADMIN_USER="admin"
ADMIN_PASS="admin"

echo "Setting up test users for integration tests..."
echo "Keycloak URL: $KEYCLOAK_URL"
echo "Realm: $REALM"
echo ""

# Function to create user via Admin REST API
create_user() {
    local username=$1
    local password=$2
    local role=$3
    local first_name=$4
    local last_name=$5
    shift 5
    local attributes=("$@")
    
    echo "Creating user: $username with role: $role"
    
    # Get admin token
    TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=$ADMIN_USER" \
        -d "password=$ADMIN_PASS" \
        -d "grant_type=password" \
        -d "client_id=admin-cli" | jq -r '.access_token')
    
    if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
        echo "  ✗ Failed to get admin token"
        return 1
    fi
    
    # Build attributes JSON
    ATTR_JSON="{"
    for attr in "${attributes[@]}"; do
        IFS='=' read -r key value <<< "$attr"
        ATTR_JSON="$ATTR_JSON\"$key\":[\"$value\"],"
    done
    ATTR_JSON="${ATTR_JSON%,}}"
    
    # Create user
    USER_JSON=$(cat <<EOF
{
    "username": "$username",
    "enabled": true,
    "emailVerified": true,
    "firstName": "$first_name",
    "lastName": "$last_name",
    "email": "${username}@example.com",
    "credentials": [{
        "type": "password",
        "value": "$password",
        "temporary": false
    }],
    "attributes": $ATTR_JSON
}
EOF
)
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "$USER_JSON")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" == "201" ] || [ "$HTTP_CODE" == "409" ]; then
        if [ "$HTTP_CODE" == "409" ]; then
            echo "  ℹ User already exists, updating..."
        else
            echo "  ✓ User created successfully"
        fi
        
        # Get user ID
        USER_ID=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$username" \
            -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')
        
        # Assign role
        ROLE_ID=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM/roles/$role" \
            -H "Authorization: Bearer $TOKEN" | jq -r '.id')
        
        if [ "$ROLE_ID" != "null" ] && [ -n "$ROLE_ID" ]; then
            curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/role-mappings/realm" \
                -H "Authorization: Bearer $TOKEN" \
                -H "Content-Type: application/json" \
                -d "[{\"id\":\"$ROLE_ID\",\"name\":\"$role\"}]" > /dev/null
            echo "  ✓ Role $role assigned"
        else
            echo "  ✗ Role $role not found"
        fi
    else
        echo "  ✗ Failed to create user (HTTP $HTTP_CODE)"
        echo "$RESPONSE" | head -n-1
    fi
    
    echo ""
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed."
    echo "Install it with: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

# Check if Keycloak is running
if ! curl -s "$KEYCLOAK_URL" > /dev/null; then
    echo "Error: Keycloak is not running at $KEYCLOAK_URL"
    echo "Start it with: ./start-keycloak.sh"
    exit 1
fi

echo "Creating test users..."
echo "====================="
echo ""

# Create producer test user
create_user "producer_test" "Test123!" "role_producer" "Producer" "Test" \
    "iup_number=IUP-2024-001" "company_name=PT Benih Sejahtera"

# Create PBT field test user
create_user "pbt_field_test" "Test123!" "role_pbt_field" "PBT Field" "Test" \
    "nip=198501012010011001" "institution_id=BPSBP-JABAR"

# Create LSM head test user
create_user "lsm_head_test" "Test123!" "role_lsm_head" "LSM Head" "Test" \
    "nip=198601012011011002" "institution_id=LSM-PUSAT"

# Create public test user
create_user "public_test" "Test123!" "role_public" "Public" "Test"

echo "====================="
echo "Test user setup complete!"
echo ""
echo "You can now run the integration tests with: npm test"
