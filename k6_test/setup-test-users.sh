#!/bin/bash

# Setup multiple test users for K6 load testing
# This script creates 5 producer users to avoid concurrent session conflicts

KEYCLOAK_URL="https://auth.jabarchain.me"
REALM="SeedCertificationRealm"
ADMIN_USER="disbun"
ADMIN_PASSWORD="@Keycloak123!"

echo "=== Setting up K6 Load Test Users ==="
echo "Keycloak: $KEYCLOAK_URL"
echo "Realm: $REALM"
echo ""

# Get admin access token
echo "Getting admin access token..."
ADMIN_TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASSWORD" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | jq -r '.access_token')

if [ "$ADMIN_TOKEN" == "null" ] || [ -z "$ADMIN_TOKEN" ]; then
    echo "❌ Failed to get admin token. Check Keycloak credentials."
    exit 1
fi

echo "✓ Admin token obtained"
echo ""

# Function to create user
create_user() {
    local USERNAME=$1
    local PASSWORD=$2
    
    echo "Creating user: $USERNAME..."
    
    # Create user
    CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"username\": \"$USERNAME\",
        \"enabled\": true,
        \"emailVerified\": true,
        \"firstName\": \"Load\",
        \"lastName\": \"Test User\",
        \"email\": \"${USERNAME}@test.com\"
      }")
    
    HTTP_CODE=$(echo "$CREATE_RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" == "201" ] || [ "$HTTP_CODE" == "409" ]; then
        if [ "$HTTP_CODE" == "409" ]; then
            echo "  ⚠️  User already exists"
        else
            echo "  ✓ User created"
        fi
        
        # Get user ID
        USER_ID=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$USERNAME" \
          -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')
        
        # Set password
        curl -s -X PUT "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/reset-password" \
          -H "Authorization: Bearer $ADMIN_TOKEN" \
          -H "Content-Type: application/json" \
          -d "{
            \"type\": \"password\",
            \"value\": \"$PASSWORD\",
            \"temporary\": false
          }" > /dev/null
        
        echo "  ✓ Password set"
        
        # Assign role_producer role (with role_ prefix as required by policy engine)
        # Get role_producer role ID
        PRODUCER_ROLE=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM/roles/role_producer" \
          -H "Authorization: Bearer $ADMIN_TOKEN")
        
        ROLE_ID=$(echo $PRODUCER_ROLE | jq -r '.id')
        ROLE_NAME=$(echo $PRODUCER_ROLE | jq -r '.name')
        
        if [ "$ROLE_ID" != "null" ]; then
            curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/role-mappings/realm" \
              -H "Authorization: Bearer $ADMIN_TOKEN" \
              -H "Content-Type: application/json" \
              -d "[{
                \"id\": \"$ROLE_ID\",
                \"name\": \"$ROLE_NAME\"
              }]" > /dev/null
            
            echo "  ✓ role_producer assigned"
        fi
        
        echo "  ✓ $USERNAME setup complete"
    else
        echo "  ❌ Failed to create user (HTTP $HTTP_CODE)"
    fi
    
    echo ""
}

# Create test users
echo "Creating test users..."
echo ""

create_user "producer_test" "Test123!"
create_user "producer_test2" "Test123!"
create_user "producer_test3" "Test123!"
create_user "producer_test4" "Test123!"
create_user "producer_test5" "Test123!"

echo "=== Setup Complete ==="
echo ""
echo "Test users created:"
echo "  - producer_test (password: Test123!)"
echo "  - producer_test2 (password: Test123!)"
echo "  - producer_test3 (password: Test123!)"
echo "  - producer_test4 (password: Test123!)"
echo "  - producer_test5 (password: Test123!)"
echo ""
echo "All users have 'role_producer' role assigned."
echo "You can now run K6 load tests with up to 50 concurrent VUs."
