# Zero Trust Architecture for Blockchain-Based Seed Certification System

A comprehensive seed certification system implementing Zero Trust Architecture (ZTA) principles with Hyperledger Fabric blockchain, Keycloak identity provider, and IPFS distributed storage.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the System](#running-the-system)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Security](#security)
- [Performance](#performance)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

This project implements a **Zero Trust Architecture** for a blockchain-based seed certification system, ensuring secure and traceable management of seed batches from production to distribution. The system leverages:

- **Hyperledger Fabric 2.2.20** for immutable transaction records
- **Keycloak** for centralized identity and access management
- **IPFS** for distributed document storage
- **In-process Policy Engine** for fine-grained access control (RBAC + ABAC)
- **Express.js API Gateway** with comprehensive security middleware

### Key Principles

✅ **Never Trust, Always Verify** - Every request is authenticated and authorized  
✅ **Least Privilege Access** - Users have minimal necessary permissions  
✅ **Assume Breach** - Defense in depth with multiple security layers  
✅ **Continuous Verification** - Policy evaluation on every API call  
✅ **Blockchain Traceability** - Immutable audit trail with block metadata

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Applications                       │
│                    (Frontend / Mobile Apps)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS + Bearer Token
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway (Express.js)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ Rate Limiter │→ │ Keycloak Auth│→ │ Policy Engine (ZTA)│   │
│  └──────────────┘  └──────────────┘  └────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────┼────────┐
                    │        │        │
                    ▼        ▼        ▼
         ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
         │  Hyperledger │ │   Keycloak   │ │     IPFS     │
         │    Fabric    │ │     IDP      │ │   Cluster    │
         │              │ │              │ │              │
         │  • Chaincode │ │  • OAuth2.0  │ │  • Documents │
         │  • Ledger    │ │  • OIDC      │ │  • Files     │
         │  • Peers     │ │  • Roles     │ │  • CIDs      │
         └──────────────┘ └──────────────┘ └──────────────┘
```

### Zero Trust Policy Engine

```javascript
Request → Authentication → Policy Evaluation → Resource Access
                              ↓
                    ┌─────────────────────┐
                    │   Policy Decision   │
                    │                     │
                    │ • Role Check        │
                    │ • Attribute Check   │
                    │ • Time Restriction  │
                    │ • Resource Ownership│
                    └─────────────────────┘
                              ↓
                    Allow (200/201) or Deny (403)
```

## ✨ Features

### Security Features

- **🔐 Zero Trust Architecture**
  - In-process policy engine (< 1ms latency)
  - Role-Based Access Control (RBAC)
  - Attribute-Based Access Control (ABAC)
  - Time-based access restrictions (22:00-06:00 denied)
  - Default deny policy

- **🛡️ Authentication & Authorization**
  - Keycloak OAuth 2.0 / OpenID Connect
  - Bearer token authentication
  - Role mapping: `role_producer`, `role_inspector`, `role_evaluator`, `role_admin`
  - Session management with Redis/Memory store

- **🔒 API Security**
  - Rate limiting (1000 req/15min)
  - CORS protection
  - Input validation (Joi schemas)
  - SQL injection prevention
  - XSS protection

### Blockchain Features

- **📦 Seed Batch Management**
  - Create, read, update seed batches
  - Immutable transaction history
  - Block metadata (block number, previous hash, data hash)
  - IPFS document linking

- **📜 Certification Workflow**
  - Certification request submission
  - Multi-stage inspection
  - Quality evaluation
  - Certificate issuance/revocation

- **🔍 Traceability**
  - Complete audit trail with timestamps
  - Blockchain transaction IDs
  - Block chain integrity (previous block hash)
  - IPFS content addressing

### Performance Features

- **⚡ Optimized Operations**
  - Policy evaluation < 1ms
  - Blockchain transaction p95 < 3s
  - Concurrent user support (tested up to 25 VUs)
  - Connection pooling

- **📊 Monitoring**
  - Request logging (Winston)
  - Error tracking
  - Performance metrics
  - Health check endpoints

## 🛠️ Technology Stack

### Backend
- **Node.js** 18+ - Runtime environment
- **Express.js** 4.18+ - Web framework
- **Hyperledger Fabric** 2.2.20 - Blockchain platform
- **Fabric SDK** - Blockchain integration

### Security
- **Keycloak** 26.2.4 - Identity & Access Management
- **Keycloak Connect** - Node.js adapter
- **Custom Policy Engine** - Zero Trust enforcement

### Storage
- **IPFS** - Distributed file storage
- **PostgreSQL** 16 - Keycloak database
- **Redis** - Session store (optional)

### Testing & Monitoring
- **Jest** - Unit & integration testing
- **K6** - Load testing
- **Winston** - Logging
- **Morgan** - HTTP request logging

### DevOps
- **Docker** & **Docker Compose** - Containerization
- **Git** - Version control

## 📋 Prerequisites

### Required Software

- **Node.js** >= 18.0.0
- **Docker** >= 24.0.0
- **Docker Compose** >= 2.0.0
- **Git**
- **jq** (for setup scripts)

### System Requirements

- **RAM**: Minimum 8GB (16GB recommended)
- **Disk**: 20GB free space
- **CPU**: 4 cores recommended
- **OS**: Linux, macOS, or Windows with WSL2

## 🚀 Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd seed-chain-zta
```

### 2. Install Dependencies

```bash
# Install application dependencies
cd application
npm install

# Install Keycloak test dependencies (optional)
cd ../idp_keycloak/tests
npm install

cd ../..
```

### 3. Setup Environment Variables

#### Application (.env)

```bash
cd application
cp .env.example .env
# Edit .env with your configuration
```

**Key variables:**
```env
# Server
PORT=3001
NODE_ENV=development

# Keycloak
KEYCLOAK_URL=http://localhost:6080
KEYCLOAK_REALM=SeedCertificationRealm
KEYCLOAK_CLIENT_ID=seed-api-gateway
KEYCLOAK_CLIENT_SECRET=your-client-secret

# Hyperledger Fabric
CHANNEL_NAME=benihchannel
CHAINCODE_NAME=benih-certification
ORG_NAME=BPSBP
ORG_MSP_ID=BPSBPMSP

# IPFS
IPFS_API_URL=http://localhost:5001

# Security
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=1000
```

#### Keycloak (.env)

```bash
cd ../idp_keycloak
cp .env.example .env
# Edit .env with secure credentials
```

**Key variables:**
```env
POSTGRES_PASSWORD=your-secure-password
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=your-admin-password
```

### 4. Start Infrastructure

#### Start Keycloak

```bash
cd idp_keycloak
docker-compose up -d
```

Wait for Keycloak to be ready (http://localhost:6080)

#### Start Hyperledger Fabric Network

```bash
cd ../blockchain
./fabric.sh up
```

This will:
- Generate crypto materials
- Start CA, peers, orderers
- Create channel
- Deploy chaincode

#### Start IPFS Cluster (Optional)

```bash
cd ../ipfs_cluster
docker-compose up -d
```

### 5. Setup Keycloak Realm

Import realm configuration:

```bash
cd ../idp_keycloak
# Realm is auto-imported from volume/import/realm-config.json
```

Create test users:

```bash
cd ../k6_test
./setup-test-users.sh
```

This creates:
- `producer_test` to `producer_test5` (password: `Test123!`)
- All with `role_producer` assigned

### 6. Setup Fabric Wallet

```bash
cd ../application
npm run setup:wallet
```

## ⚙️ Configuration

### Policy Engine Configuration

Edit `application/src/policies/policyEngine.js`:

```javascript
// Time restrictions (24-hour format)
const RESTRICTED_START_HOUR = 22; // 10 PM
const RESTRICTED_END_HOUR = 6;    // 6 AM

// Role-based permissions
const POLICY_RULES = {
    seed_batch: {
        create: ['role_producer'],
        read: ['role_producer', 'role_inspector', 'role_evaluator'],
        update: ['role_producer'],
        delete: ['role_admin']
    },
    // ... more resources
};
```

### Rate Limiting

Edit `application/src/server.js`:

```javascript
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,                 // 1000 requests per window
    message: 'Too many requests from this IP'
});
```

## 🏃 Running the System

### Start API Gateway

```bash
cd application
npm start
# or for development with auto-reload:
npm run dev
```

Server runs on http://localhost:3001

### Health Check

```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-21T...",
  "uptime": 123.45,
  "services": {
    "fabric": "connected",
    "keycloak": "configured"
  }
}
```

### API Documentation

Swagger UI: http://localhost:3001/api-docs

## 🧪 Testing

### Unit Tests

```bash
cd application
npm test
```

Runs:
- Policy engine tests (17 test cases)
- Controller tests
- Service tests
- Middleware tests

### Integration Tests

```bash
cd idp_keycloak/tests
npm test
```

Tests:
- Keycloak authentication
- Token validation
- JWKS endpoint
- Brute force protection

### Load Testing (K6)

#### Smoke Test (Quick validation)

```bash
cd k6_test
./run-test.sh
# Select option 1: Smoke Test
```

#### Load Test (10 concurrent users)

```bash
./run-test.sh
# Select option 2: Load Test
```

Or directly:

```bash
k6 run loadtest.js
```

**Test Configuration:**
- Ramp-up: 30s → 5 VUs → 60s → 10 VUs
- Duration: 60s at peak
- Thresholds:
  - p95 response time < 3s
  - Error rate < 10%

**Expected Results:**
- ✅ Authentication success > 90%
- ✅ Seed batch creation success > 90%
- ✅ p95 response time: 1.5-2.5s
- ✅ Throughput: 4-8 req/s

## 📚 API Documentation

### Authentication

All endpoints require Bearer token:

```bash
# Get token
curl -X POST "http://localhost:6080/realms/SeedCertificationRealm/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=seed-cert-frontend" \
  -d "username=producer_test" \
  -d "password=Test123!"
```

### Core Endpoints

#### Create Seed Batch

```bash
POST /api/seed-batches
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "varietyName": "Varietas Unggul",
  "commodity": "Karet",
  "harvestDate": "2025-11-20",
  "seedSourceNumber": "SRC-001",
  "origin": "Jawa Barat",
  "iupNumber": "IUP-12345",
  "seedClass": "BS",
  "document": <file>
}
```

Response:
```json
{
  "success": true,
  "message": "Seed batch created successfully",
  "data": {
    "batchId": "BATCH-1732185600-abc123",
    "ipfsCid": "QmYwAPJzv5CZsnA636s8bwWU...",
    "transactionId": "e8f7d6c5b4a39281...",
    "timestamp": "2025-11-21T10:00:00.000Z"
  }
}
```

#### Get Seed Batch

```bash
GET /api/seed-batches/:batchId
Authorization: Bearer <token>
```

#### Get Seed Batch History

```bash
GET /api/seed-batches/:batchId/history
Authorization: Bearer <token>
```

Response includes blockchain metadata:
```json
{
  "success": true,
  "data": [
    {
      "txId": "e8f7d6c5...",
      "timestamp": "2025-11-21T10:00:00.000Z",
      "isDelete": false,
      "value": {...},
      "blockInfo": {
        "blockNumber": 15,
        "previousBlockHash": "a1b2c3d4e5f6...",
        "blockDataHash": "f6e5d4c3b2a1..."
      }
    }
  ]
}
```

### Policy Enforcement

All endpoints are protected by Zero Trust policy:

- **Authentication**: Valid bearer token required
- **Authorization**: Role and attribute checks
- **Time Restriction**: 22:00-06:00 denied
- **Resource Ownership**: Users can only modify their own resources

### Error Responses

**401 Unauthorized**
```json
{
  "error": "Unauthorized",
  "message": "Access token is missing or invalid"
}
```

**403 Forbidden**
```json
{
  "error": "Forbidden",
  "message": "User lacks required role. Required: [role_producer], User has: [...]",
  "resource": "seed_batch",
  "action": "create"
}
```

**429 Too Many Requests**
```json
{
  "error": "Too many requests from this IP, please try again later"
}
```

## 📁 Project Structure

```
seed-chain-zta/
├── application/              # API Gateway (Express.js)
│   ├── src/
│   │   ├── controllers/      # Request handlers
│   │   ├── middleware/       # Auth, validation, policy
│   │   ├── policies/         # Zero Trust policy engine
│   │   ├── routes/           # API routes
│   │   ├── services/         # Business logic (Fabric, IPFS)
│   │   └── server.js         # Application entry point
│   ├── tests/                # Unit & integration tests
│   ├── wallet/               # Fabric user identities
│   ├── uploads/              # Temporary file uploads
│   └── package.json
│
├── blockchain/               # Hyperledger Fabric Network
│   ├── chaincode/            # Smart contracts
│   │   └── lib/
│   │       ├── seedBatchContract.js       # Main chaincode
│   │       └── seedBatchContractZTA.js    # ZTA version
│   ├── network/              # Network configuration
│   │   ├── configtx.yaml     # Channel & genesis config
│   │   ├── docker-compose.yaml
│   │   └── organizations/    # MSP, certificates
│   ├── scripts/              # Setup & deployment scripts
│   └── fabric.sh             # Network management script
│
├── idp_keycloak/             # Identity Provider
│   ├── docker-compose.yml
│   ├── volume/
│   │   ├── import/           # Realm configuration
│   │   ├── data/             # PostgreSQL data (ignored)
│   │   └── themes/           # Custom themes
│   ├── tests/                # Keycloak integration tests
│   └── .env.example          # Configuration template
│
├── ipfs_cluster/             # IPFS Distributed Storage
│   ├── docker-compose.yml
│   └── .env
│
├── k6_test/                  # Load Testing
│   ├── loadtest.js           # Main load test
│   ├── smoke-test.js         # Quick validation
│   ├── run-test.sh           # Interactive test runner
│   └── setup-test-users.sh   # Create Keycloak test users
│
├── .gitignore                # Git ignore rules
└── README.md                 # This file
```

## 🔒 Security

### Zero Trust Implementation

1. **Authentication Layer**
   - Keycloak OAuth 2.0 / OpenID Connect
   - Bearer token validation on every request
   - Token expiration: 5 minutes (configurable)

2. **Authorization Layer**
   - Custom policy engine (in-process)
   - RBAC: 4 roles (producer, inspector, evaluator, admin)
   - ABAC: Attribute-based rules (ownership, time)
   - Default deny policy

3. **Network Security**
   - CORS with whitelist
   - Rate limiting (1000 req/15min)
   - Input validation (Joi schemas)
   - SQL injection prevention (parameterized queries)

4. **Data Security**
   - Blockchain immutability
   - IPFS content addressing
   - Environment variable protection (.env)
   - Sensitive data excluded from git

### Security Best Practices

✅ **Never commit credentials** - Use `.env` files  
✅ **Rotate secrets regularly** - Change passwords periodically  
✅ **Use HTTPS in production** - TLS/SSL certificates  
✅ **Enable audit logging** - Track all access attempts  
✅ **Update dependencies** - Run `npm audit` regularly  
✅ **Backup blockchain data** - Ledger snapshots  

### Known Limitations

⚠️ **Development Mode**: Current setup uses `start-dev` for Keycloak  
⚠️ **HTTP Only**: Production should use HTTPS/TLS  
⚠️ **Memory Store**: Use Redis for production sessions  
⚠️ **Single Peer**: Production needs multi-peer deployment  

## ⚡ Performance

### Benchmarks

**Policy Engine** (17 test cases):
- Average evaluation: < 1ms
- RBAC check: 0.3ms
- ABAC check: 0.8ms
- Time restriction: 0.2ms

**API Gateway** (K6 Load Test - 10 VUs):
- p50 response time: ~120ms
- p95 response time: ~2s
- p99 response time: ~2.5s
- Throughput: 4-8 req/s
- Error rate: < 10%

**Blockchain Transactions**:
- Invoke (create/update): 1-3s
- Query (read): 50-200ms
- History query: 200-500ms

### Optimization Tips

1. **Enable Redis** for session storage:
   ```bash
   docker run -d -p 6379:6379 redis:alpine
   ```

2. **Increase rate limits** for load testing:
   ```env
   RATE_LIMIT_MAX=5000
   ```

3. **Use connection pooling** (already implemented in Fabric SDK)

4. **Cache policy decisions** (optional for high-throughput scenarios)

## 🤝 Contributing

### Development Workflow

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and test: `npm test`
3. Run load test: `cd k6_test && ./run-test.sh`
4. Commit: `git commit -m "Add my feature"`
5. Push: `git push origin feature/my-feature`
6. Create Pull Request

### Code Style

- Follow ESLint rules: `npm run lint`
- Use meaningful variable names
- Add JSDoc comments for functions
- Write unit tests for new features

### Testing Checklist

- [ ] Unit tests pass (`npm test`)
- [ ] Integration tests pass
- [ ] Load test meets thresholds (p95 < 3s, error < 10%)
- [ ] Policy engine tests pass (17/17)
- [ ] No security vulnerabilities (`npm audit`)

## 📄 License

This project is part of a thesis research on Zero Trust Architecture for Blockchain-Based Systems.

**Author**: Rangga Djatikusuma Lukman 
**Year**: 2025

---

## 📞 Support

For issues, questions, or contributions:

- **GitHub Issues**: [Repository Issues]
- **Email**: djatikusuma.data@gmail.com
- **Documentation**: See `/docs` folder (if available)

## 🎓 Research Context

This implementation is part of research investigating the application of Zero Trust Architecture principles in blockchain-based systems, specifically for agricultural seed certification in Indonesia.

**Key Research Questions:**
1. How can ZTA principles enhance security in blockchain applications?
2. What is the performance impact of in-process policy enforcement?
3. How does fine-grained access control affect system usability?

**Findings:**
- ✅ ZTA adds < 1ms latency per request
- ✅ Default-deny policy prevents unauthorized access
- ✅ RBAC + ABAC provides flexible yet secure access control
- ✅ Blockchain provides immutable audit trail for compliance

---

**Built with ❤️ for Secure & Transparent Seed Certification**
