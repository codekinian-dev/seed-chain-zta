# API Documentation

## Base URL
```
http://localhost:3001/api
```

## Authentication

All protected endpoints require a valid JWT token from Keycloak.

### Get Access Token

**Endpoint:** `POST http://localhost:8080/realms/SeedCertificationRealm/protocol/openid-connect/token`

**Headers:**
```
Content-Type: application/x-www-form-urlencoded
```

**Body:**
```
grant_type=password
client_id=seed-api-gateway
client_secret=YOUR_CLIENT_SECRET
username=your_username
password=your_password
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "expires_in": 300,
  "refresh_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer"
}
```

### Using Token

Include the token in the Authorization header:
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

---

## Endpoints

### Health Checks

#### 1. Overall Health Check
```http
GET /api/health
```

**Access:** Public

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "responseTime": "150ms",
  "services": {
    "blockchain": { "status": "up", "message": "Connected to Fabric network" },
    "ipfs": { "status": "up", "message": "Connected to IPFS cluster" },
    "queue": { 
      "status": "up", 
      "message": "Redis queue operational",
      "stats": { "waiting": 0, "active": 0, "completed": 0, "failed": 0 }
    }
  }
}
```

#### 2. Individual Service Health
```http
GET /api/health/fabric
GET /api/health/ipfs
GET /api/health/queue
```

---

### Seed Batch Management

#### 1. Create Seed Batch

**Endpoint:** `POST /api/seed-batches`

**Access:** Protected - `role_producer`

**Content-Type:** `multipart/form-data`

**Form Data:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| document | File | Yes | Seed source document (PDF/DOC/DOCX, max 10MB) |
| varietyName | String | Yes | Seed variety name (2-100 chars) |
| commodity | String | Yes | Commodity type (2-50 chars) |
| harvestDate | Date | Yes | Harvest date (ISO 8601: YYYY-MM-DD) |
| seedSourceNumber | String | Yes | Seed source number (5-50 chars) |
| origin | String | Yes | Origin location (2-100 chars) |
| iupNumber | String | Yes | IUP number (5-50 chars) |
| seedClass | String | Yes | One of: "Breeder Seed", "Foundation Seed", "Stock Seed", "Extension Seed" |

**Example Request:**
```bash
curl -X POST 'http://localhost:3001/api/seed-batches' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -F 'document=@seed_source.pdf' \
  -F 'varietyName=Padi Inpari 32' \
  -F 'commodity=Rice' \
  -F 'harvestDate=2024-01-15' \
  -F 'seedSourceNumber=SRC-2024-001' \
  -F 'origin=West Java' \
  -F 'iupNumber=IUP-2024-001' \
  -F 'seedClass=Breeder Seed'
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Seed batch created successfully",
  "data": {
    "batchId": "BATCH-1705315800000-abc123xyz",
    "ipfsCid": "QmX7fZ9Y8...",
    "transactionId": "a1b2c3d4e5f6..."
  }
}
```

---

#### 2. Submit Certification Request

**Endpoint:** `POST /api/seed-batches/:id/submit`

**Access:** Protected - `role_producer`

**Content-Type:** `multipart/form-data`

**Form Data:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| document | File | Yes | Certification request document (PDF/DOC/DOCX, max 10MB) |
| estimatedQuantity | Number | Yes | Estimated quantity (positive number) |
| estimatedArea | Number | Yes | Estimated area in hectares (positive number) |
| location | String | Yes | Location (5-200 chars) |

**Example Request:**
```bash
curl -X POST 'http://localhost:3001/api/seed-batches/BATCH-123/submit' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -F 'document=@cert_request.pdf' \
  -F 'estimatedQuantity=1000' \
  -F 'estimatedArea=500' \
  -F 'location=Subang, West Java'
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Certification submitted successfully",
  "data": {
    "batchId": "BATCH-123",
    "ipfsCid": "QmY8fZ9X7...",
    "transactionId": "b2c3d4e5f6g7..."
  }
}
```

---

#### 3. Record Field Inspection

**Endpoint:** `POST /api/seed-batches/:id/inspect`

**Access:** Protected - `role_pbt_field`

**Content-Type:** `multipart/form-data`

**Form Data:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| photo | File | Yes | Inspection photo (JPG/PNG, max 10MB) |
| inspectionDate | Date | Yes | Inspection date (ISO 8601: YYYY-MM-DD) |
| inspector | String | Yes | Inspector name (2-100 chars) |
| findings | String | Yes | Inspection findings (10-2000 chars) |

**Example Request:**
```bash
curl -X POST 'http://localhost:3001/api/seed-batches/BATCH-123/inspect' \
  -H 'Authorization: Bearer INSPECTOR_TOKEN' \
  -F 'photo=@field_photo.jpg' \
  -F 'inspectionDate=2024-01-20' \
  -F 'inspector=John Doe' \
  -F 'findings=Field inspection completed. All criteria met. No disease detected.'
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Inspection recorded successfully",
  "data": {
    "batchId": "BATCH-123",
    "ipfsCid": "QmZ9fY8X7...",
    "transactionId": "c3d4e5f6g7h8..."
  }
}
```

---

#### 4. Evaluate Inspection

**Endpoint:** `POST /api/seed-batches/:id/evaluate`

**Access:** Protected - `role_pbt_chief`

**Content-Type:** `application/json`

**Body:**
```json
{
  "decision": "approved",
  "evaluationNotes": "Inspection results are satisfactory. Approved for certification."
}
```

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| decision | String | Yes | Either "approved" or "rejected" |
| evaluationNotes | String | Yes | Evaluation notes (10-2000 chars) |

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Inspection evaluated successfully",
  "data": {
    "batchId": "BATCH-123",
    "decision": "approved",
    "transactionId": "d4e5f6g7h8i9..."
  }
}
```

---

#### 5. Issue Certificate

**Endpoint:** `POST /api/seed-batches/:id/certificate`

**Access:** Protected - `role_lsm_head`

**Content-Type:** `application/json`

**Body:**
```json
{
  "certificateNumber": "CERT-2024-001",
  "issueDate": "2024-01-25",
  "expiryDate": "2025-01-25"
}
```

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| certificateNumber | String | Yes | Certificate number (5-50 chars) |
| issueDate | Date | Yes | Issue date (ISO 8601: YYYY-MM-DD) |
| expiryDate | Date | Yes | Expiry date (must be after issue date) |

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Certificate issued successfully",
  "data": {
    "batchId": "BATCH-123",
    "certificateNumber": "CERT-2024-001",
    "transactionId": "e5f6g7h8i9j0..."
  }
}
```

---

#### 6. Record Distribution

**Endpoint:** `POST /api/seed-batches/:id/distribute`

**Access:** Protected - `role_producer`

**Content-Type:** `application/json`

**Body:**
```json
{
  "distributionDate": "2024-02-01",
  "quantity": 500,
  "recipient": "PT Agro Indonesia",
  "destination": "Bandung, West Java"
}
```

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| distributionDate | Date | Yes | Distribution date (ISO 8601: YYYY-MM-DD) |
| quantity | Number | Yes | Quantity distributed (positive number) |
| recipient | String | Yes | Recipient name (2-100 chars) |
| destination | String | Yes | Destination location (5-200 chars) |

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Seed distributed successfully",
  "data": {
    "batchId": "BATCH-123",
    "quantity": 500,
    "recipient": "PT Agro Indonesia",
    "transactionId": "f6g7h8i9j0k1..."
  }
}
```

---

#### 7. Query Seed Batch

**Endpoint:** `GET /api/seed-batches/:id`

**Access:** Public

**Example Request:**
```bash
curl http://localhost:3001/api/seed-batches/BATCH-123
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "BATCH-123",
    "varietyName": "Padi Inpari 32",
    "commodity": "Rice",
    "harvestDate": "2024-01-15",
    "seedSourceNumber": "SRC-2024-001",
    "origin": "West Java",
    "iupNumber": "IUP-2024-001",
    "seedClass": "Breeder Seed",
    "status": "CERTIFIED",
    "documents": [
      {
        "name": "seed_source.pdf",
        "cid": "QmX7fZ9Y8...",
        "uploaded_by": "user-uuid",
        "uploaded_at": "2024-01-15T10:30:00.000Z",
        "doc_type": "seed_source"
      }
    ],
    "certification": {
      "estimatedQuantity": 1000,
      "estimatedArea": 500,
      "location": "Subang, West Java",
      "document": {
        "name": "cert_request.pdf",
        "cid": "QmY8fZ9X7..."
      }
    },
    "inspection": {
      "date": "2024-01-20",
      "inspector": "John Doe",
      "findings": "Field inspection completed...",
      "photo": {
        "name": "field_photo.jpg",
        "cid": "QmZ9fY8X7..."
      }
    },
    "evaluation": {
      "decision": "approved",
      "notes": "Inspection results are satisfactory..."
    },
    "certificate": {
      "number": "CERT-2024-001",
      "issueDate": "2024-01-25",
      "expiryDate": "2025-01-25"
    },
    "created_at": "2024-01-15T10:30:00.000Z",
    "created_by": "user-uuid"
  }
}
```

---

#### 8. Query All Seed Batches

**Endpoint:** `GET /api/seed-batches`

**Access:** Public

**Example Request:**
```bash
curl http://localhost:3001/api/seed-batches
```

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "BATCH-123",
      "varietyName": "Padi Inpari 32",
      "status": "CERTIFIED",
      "created_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "BATCH-124",
      "varietyName": "Jagung Hibrida",
      "status": "PENDING_INSPECTION",
      "created_at": "2024-01-16T09:00:00.000Z"
    }
  ]
}
```

---

#### 9. Get Seed Batch History

**Endpoint:** `GET /api/seed-batches/:id/history`

**Access:** Public

**Example Request:**
```bash
curl http://localhost:3001/api/seed-batches/BATCH-123/history
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "txId": "a1b2c3d4...",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "isDelete": false,
      "value": {
        "id": "BATCH-123",
        "status": "CREATED",
        "varietyName": "Padi Inpari 32"
      }
    },
    {
      "txId": "b2c3d4e5...",
      "timestamp": "2024-01-18T14:20:00.000Z",
      "isDelete": false,
      "value": {
        "id": "BATCH-123",
        "status": "CERTIFICATION_SUBMITTED",
        "varietyName": "Padi Inpari 32"
      }
    }
  ]
}
```

---

## Error Responses

### Validation Error (400)
```json
{
  "error": "Validation Error",
  "message": "Request validation failed",
  "details": [
    {
      "field": "estimatedQuantity",
      "message": "Estimated quantity must be a positive number"
    }
  ]
}
```

### Unauthorized (401)
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### Forbidden (403)
```json
{
  "error": "Forbidden",
  "message": "Access denied. Required role(s): role_producer"
}
```

### Not Found (404)
```json
{
  "error": "Route not found: /api/invalid-endpoint",
  "statusCode": 404
}
```

### Server Error (500)
```json
{
  "error": "Failed to create seed batch",
  "statusCode": 500,
  "details": "IPFS connection timeout"
}
```

---

## Role-Based Access Control

| Endpoint | Allowed Roles |
|----------|--------------|
| POST /seed-batches | role_producer |
| POST /seed-batches/:id/submit | role_producer |
| POST /seed-batches/:id/inspect | role_pbt_field |
| POST /seed-batches/:id/evaluate | role_pbt_chief |
| POST /seed-batches/:id/certificate | role_lsm_head |
| POST /seed-batches/:id/distribute | role_producer |
| GET /seed-batches/:id | Public |
| GET /seed-batches | Public |
| GET /seed-batches/:id/history | Public |

---

## Rate Limiting

- **Window:** 15 minutes
- **Max Requests:** 100 per IP
- **Response Header:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`

Exceeded rate limit response:
```json
{
  "error": "Too many requests from this IP, please try again later"
}
```

---

## File Upload Constraints

### Allowed File Types

**Documents:** PDF, DOC, DOCX
**Images:** JPG, JPEG, PNG

### Size Limits

- Maximum file size: 10MB (configurable via `MAX_FILE_SIZE` env variable)

### Cleanup Policy

Uploaded files are automatically deleted after 1 hour from the `uploads/` directory.

---

## Workflow Example

### Complete Seed Certification Workflow

1. **Producer creates seed batch** (with seed source document)
   ```
   POST /api/seed-batches
   Role: role_producer
   ```

2. **Producer submits certification request** (with certification document)
   ```
   POST /api/seed-batches/:id/submit
   Role: role_producer
   ```

3. **Field inspector records inspection** (with photo)
   ```
   POST /api/seed-batches/:id/inspect
   Role: role_pbt_field
   ```

4. **Chief inspector evaluates inspection**
   ```
   POST /api/seed-batches/:id/evaluate
   Role: role_pbt_chief
   ```

5. **LSM head issues certificate**
   ```
   POST /api/seed-batches/:id/certificate
   Role: role_lsm_head
   ```

6. **Producer distributes certified seeds**
   ```
   POST /api/seed-batches/:id/distribute
   Role: role_producer
   ```

7. **Public can verify the certification**
   ```
   GET /api/seed-batches/:id
   Public access
   ```

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- All file uploads use `multipart/form-data`
- All non-file data uses `application/json`
- IPFS CIDs are permanently stored on blockchain
- Transaction IDs can be used to trace blockchain operations
- Upload-first strategy: Files are uploaded to IPFS before blockchain submission
- Failed blockchain transactions trigger automatic IPFS unpinning (rollback)
