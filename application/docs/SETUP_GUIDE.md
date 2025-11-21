# Setup and Testing Guide

## Prerequisites Checklist

Before starting the application, ensure the following services are running:

- ✓ **Hyperledger Fabric Network** (blockchain/network)
  - Orderer running on port 7050
  - BPSBP peers running on ports 7051, 9051
  - Chaincode `benih-certification` deployed on channel `benihchannel`

- ✓ **Keycloak Identity Provider** (idp_keycloak)
  - Running on http://localhost:8080
  - Realm: `SeedCertificationRealm`
  - Client configured: `seed-api-gateway` (confidential)
  - Roles created: `role_producer`, `role_pbt_field`, `role_pbt_chief`, `role_lsm_head`, `role_public`

- ✓ **IPFS Cluster**
  - API running on http://localhost:9094
  - Ready to accept file uploads

- ✓ **Redis** (for Bull queue)
  - Running on localhost:6379
  - No authentication required (default config)

## Installation Steps

### 1. Install Dependencies

```bash
cd application
npm install
```

### 2. Copy Wallet from Blockchain Network

```bash
npm run setup:wallet
```

This will copy the `appUser` wallet from the blockchain network to `application/wallet/`.

Expected output:
```
✓ Created wallet directory
✓ Copied certificate
✓ Copied private key
✓ Copied CA certificate
✓ Wallet setup completed successfully
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
nano .env  # or use your preferred editor
```

**Important configurations to set:**

```env
# Keycloak
KEYCLOAK_CLIENT_SECRET=<your-client-secret-from-keycloak>

# Session (generate a strong random secret)
SESSION_SECRET=<generate-strong-random-secret>

# CORS (set your frontend URL in production)
CORS_ORIGIN=http://localhost:3000

# Environment
NODE_ENV=development
```

**How to get Keycloak Client Secret:**

1. Login to Keycloak Admin Console: http://localhost:8080
2. Navigate to: Clients → seed-api-gateway → Credentials
3. Copy the "Secret" value
4. Paste into `.env` as `KEYCLOAK_CLIENT_SECRET`

### 4. Verify Services

Before starting the application, verify all services are accessible:

```bash
# Check Fabric orderer
curl -k https://localhost:7050

# Check IPFS
curl http://localhost:9094/version

# Check Keycloak
curl http://localhost:8080/realms/SeedCertificationRealm

# Check Redis
redis-cli ping
# Expected: PONG
```

## Running the Application

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

Expected startup output:
```
[Server] Initializing services...
[Server] Connecting to Fabric network...
[Server] ✓ Fabric Gateway connected
[Server] Starting cleanup service...
[Server] ✓ Cleanup service started
[Server] All services initialized successfully
[Server] ========================================
[Server] Seed Certification API Gateway
[Server] Environment: development
[Server] Port: 3001
[Server] Health Check: http://localhost:3001/api/health
[Server] ========================================
```

## Testing the API

### 1. Health Check

```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "responseTime": "150ms",
  "services": {
    "blockchain": {
      "status": "up",
      "message": "Connected to Fabric network"
    },
    "ipfs": {
      "status": "up",
      "message": "Connected to IPFS cluster"
    },
    "queue": {
      "status": "up",
      "message": "Redis queue operational",
      "stats": {
        "waiting": 0,
        "active": 0,
        "completed": 0,
        "failed": 0,
        "delayed": 0
      }
    }
  }
}
```

### 2. Get Access Token from Keycloak

First, create a test user in Keycloak with `role_producer` role, then:

```bash
# Get access token
curl -X POST 'http://localhost:8080/realms/SeedCertificationRealm/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=password' \
  -d 'client_id=seed-api-gateway' \
  -d 'client_secret=YOUR_CLIENT_SECRET' \
  -d 'username=test_producer' \
  -d 'password=your_password'
```

Expected response:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 300,
  "refresh_expires_in": 1800,
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer"
}
```

Save the `access_token` for subsequent requests.

### 3. Create Seed Batch (Protected Endpoint)

```bash
# Create a test document
echo "Seed Source Document Content" > test_document.pdf

# Create seed batch with file upload
curl -X POST 'http://localhost:3001/api/seed-batches' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -F 'document=@test_document.pdf' \
  -F 'varietyName=Padi Inpari 32' \
  -F 'commodity=Rice' \
  -F 'harvestDate=2024-01-15' \
  -F 'seedSourceNumber=SRC-2024-001' \
  -F 'origin=West Java' \
  -F 'iupNumber=IUP-2024-001' \
  -F 'seedClass=Breeder Seed'
```

Expected response:
```json
{
  "success": true,
  "message": "Seed batch created successfully",
  "data": {
    "batchId": "BATCH-1705315800000-abc123xyz",
    "ipfsCid": "QmX7fZ9...",
    "transactionId": "a1b2c3d4e5f6..."
  }
}
```

### 4. Query Seed Batch (Public Endpoint)

```bash
curl http://localhost:3001/api/seed-batches/BATCH-1705315800000-abc123xyz
```

Expected response:
```json
{
  "success": true,
  "data": {
    "id": "BATCH-1705315800000-abc123xyz",
    "varietyName": "Padi Inpari 32",
    "commodity": "Rice",
    "status": "CREATED",
    "documents": [
      {
        "name": "test_document.pdf",
        "cid": "QmX7fZ9...",
        "uploaded_by": "user-uuid",
        "uploaded_at": "2024-01-15T10:30:00.000Z",
        "doc_type": "seed_source"
      }
    ],
    "created_at": "2024-01-15T10:30:00.000Z",
    "created_by": "user-uuid"
  }
}
```

### 5. Query All Seed Batches

```bash
curl http://localhost:3001/api/seed-batches
```

### 6. Submit Certification (Producer Role)

```bash
curl -X POST 'http://localhost:3001/api/seed-batches/BATCH-1705315800000-abc123xyz/submit' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -F 'document=@certification_request.pdf' \
  -F 'estimatedQuantity=1000' \
  -F 'estimatedArea=500' \
  -F 'location=Subang, West Java'
```

### 7. Record Inspection (Field Inspector Role)

Get token for user with `role_pbt_field`, then:

```bash
curl -X POST 'http://localhost:3001/api/seed-batches/BATCH-1705315800000-abc123xyz/inspect' \
  -H 'Authorization: Bearer FIELD_INSPECTOR_TOKEN' \
  -F 'photo=@inspection_photo.jpg' \
  -F 'inspectionDate=2024-01-20' \
  -F 'inspector=John Doe' \
  -F 'findings=Field inspection completed. All criteria met.'
```

## Common Issues and Solutions

### Issue: "Failed to connect to Fabric network"

**Solution:**
1. Check if Fabric network is running:
   ```bash
   cd ../blockchain
   ./fabric.sh status
   ```
2. Verify wallet exists:
   ```bash
   ls -la wallet/appUser/
   ```
3. Re-run wallet setup:
   ```bash
   npm run setup:wallet
   ```

### Issue: "IPFS service unavailable"

**Solution:**
1. Check IPFS Cluster is running:
   ```bash
   curl http://localhost:9094/version
   ```
2. Restart IPFS Cluster if needed

### Issue: "Redis connection failed"

**Solution:**
1. Check Redis is running:
   ```bash
   redis-cli ping
   ```
2. Start Redis:
   ```bash
   # macOS with Homebrew
   brew services start redis
   
   # Linux
   sudo systemctl start redis
   ```

### Issue: "Keycloak authentication failed"

**Solution:**
1. Verify client secret in `.env` matches Keycloak
2. Check user has correct role assigned in Keycloak
3. Token might be expired - request new token

### Issue: "File upload too large"

**Solution:**
1. Check `MAX_FILE_SIZE` in `.env` (default 10MB)
2. Increase if needed:
   ```env
   MAX_FILE_SIZE=20971520  # 20MB
   ```

## Monitoring and Logs

### View Application Logs

```bash
# Real-time logs
tail -f logs/combined.log

# Error logs only
tail -f logs/error.log

# Audit logs
tail -f logs/audit.log
```

### Check Queue Status

```bash
curl http://localhost:3001/api/health/queue
```

### Monitor File Cleanup

The cleanup service runs every 30 minutes and deletes files older than 1 hour from `uploads/` directory. Check logs:

```bash
grep "Cleanup" logs/combined.log
```

## Stopping the Application

Graceful shutdown:
```bash
# Press Ctrl+C in the terminal running the application
# OR
kill -SIGTERM <process-id>
```

The application will:
1. Stop accepting new requests
2. Stop cleanup service
3. Disconnect from Fabric Gateway
4. Exit cleanly

## Production Deployment Checklist

- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Generate strong `SESSION_SECRET`
- [ ] Configure proper `CORS_ORIGIN` (frontend URL)
- [ ] Set appropriate `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW`
- [ ] Enable HTTPS/TLS for all services
- [ ] Set up log rotation and monitoring
- [ ] Configure Keycloak with proper security settings
- [ ] Use process manager (PM2, systemd)
- [ ] Set up reverse proxy (Nginx, Traefik)
- [ ] Configure firewall rules
- [ ] Enable Fabric TLS/mutual TLS
- [ ] Backup wallet files securely

## Next Steps

1. **API Documentation**: Generate OpenAPI/Swagger documentation
2. **Testing**: Write unit and integration tests
3. **Monitoring**: Set up Prometheus metrics and Grafana dashboards
4. **CI/CD**: Automate deployment pipeline
5. **Security Audit**: Perform penetration testing
6. **Performance Testing**: Run load tests with Caliper

## Support

For issues or questions:
1. Check logs in `logs/` directory
2. Verify health check endpoint
3. Review this setup guide
4. Check chaincode deployment status
