# Seed Certification API

API Gateway for Seed Certification System with Zero Trust Architecture, integrating Keycloak, IPFS Cluster, and Hyperledger Fabric.

## Features

- 🔐 Zero Trust Architecture dengan Keycloak JWT validation
- 📦 IPFS Cluster integration untuk document storage
- ⛓️ Hyperledger Fabric blockchain untuk immutable ledger
- 🔄 Retry mechanism untuk IPFS uploads
- 📋 Queue system untuk menghindari IPFS overload
- 🗑️ Auto-cleanup temporary files
- 📊 Comprehensive audit logging
- 🛡️ Role-based access control (RBAC)

## Prerequisites

- Node.js >= 16.0.0
- Keycloak server (port 8080)
- IPFS Cluster (port 9094)
- Hyperledger Fabric network running
- Redis (for Bull queue)

## Installation

```bash
# Install dependencies
npm install

# Setup wallet from blockchain network (Node.js script)
npm run setup:wallet

# Copy .env.example to .env and configure
cp .env.example .env

# Edit .env with your configuration
nano .env
```

**Note:** Wallet setup menggunakan Node.js script yang mengkonversi MSP format ke Fabric Network Wallet format (JSON).

## Configuration

Edit `.env` file:

- **Keycloak**: Set KEYCLOAK_URL, KEYCLOAK_REALM
- **IPFS**: Set IPFS_API_URL
- **Fabric**: Ensure FABRIC_WALLET_PATH points to copied wallet
- **Redis**: Configure for Bull queue

## Running

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### Seed Batch Management

- `POST /api/seed-batches` - Create seed batch (role_producer)
- `POST /api/seed-batches/:id/submit` - Submit certification (role_producer)
- `POST /api/seed-batches/:id/inspect` - Record inspection (role_pbt_field)
- `POST /api/seed-batches/:id/evaluate` - Evaluate inspection (role_pbt_chief)
- `POST /api/seed-batches/:id/certificate` - Issue certificate (role_lsm_head)
- `POST /api/seed-batches/:id/distribute` - Distribute seed (role_producer)
- `GET /api/seed-batches/:id` - Get seed batch details (public)
- `GET /api/seed-batches` - Query seed batches (public)
- `GET /api/seed-batches/:id/history` - Get batch history (public)

### Health Check

- `GET /health` - Service health status

## Architecture

```
┌─────────────┐
│   Client    │
│  (Vue.js)   │
└──────┬──────┘
       │
       ↓ JWT Token
┌─────────────────────────────────┐
│     API Gateway (Express)        │
│  ┌──────────────────────────┐   │
│  │  Keycloak Middleware     │   │
│  │  (Token Validation)      │   │
│  └────────────┬─────────────┘   │
│               ↓                  │
│  ┌──────────────────────────┐   │
│  │  IPFS Service            │   │
│  │  (Document Upload)       │   │
│  └────────────┬─────────────┘   │
│               ↓                  │
│  ┌──────────────────────────┐   │
│  │  Fabric Gateway          │   │
│  │  (Blockchain Ledger)     │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
```

## Workflow: Upload-First Strategy

1. Client sends request with file + metadata
2. API validates JWT token & role
3. Upload file to IPFS → get CID
4. Submit transaction to Fabric with CID
5. If Fabric fails → log for rollback
6. Return response to client
7. Auto-cleanup temporary file after 1 hour

## License

Apache-2.0
