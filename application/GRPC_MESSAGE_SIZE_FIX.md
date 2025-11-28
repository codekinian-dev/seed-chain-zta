# 🔧 Fix: gRPC Message Size Limit Exceeded

## Masalah

Error: `RESOURCE_EXHAUSTED: grpc: trying to send message larger than max (115326077 vs. 104857600)`

**Penyebab:** 
- Response dari `queryAllSeedBatches` terlalu besar (115MB)
- Default gRPC max message size = 100MB
- Fabric peer/orderer menolak message > 100MB

## ✅ Solusi yang Sudah Diimplementasi

### 1. Client-Side: Increase gRPC Limits

**File:** `src/services/fabric.service.js`

```javascript
grpcOptions: {
    'grpc.max_receive_message_length': 200 * 1024 * 1024, // 200MB
    'grpc.max_send_message_length': 200 * 1024 * 1024,    // 200MB
}
```

### 2. Connection Profile: Add gRPC Options

**File:** `config/connection-profile.json`

Ditambahkan ke semua peers dan orderer:
```json
"grpcOptions": {
    "grpc.max_receive_message_length": 209715200,  // 200MB
    "grpc.max_send_message_length": 209715200      // 200MB
}
```

## ⚠️ Server-Side Configuration Required

**PENTING:** Konfigurasi client saja **TIDAK CUKUP**. Anda juga harus update konfigurasi di **Fabric peer dan orderer**.

### Cara Update Fabric Network

#### 1. Update Peer Configuration

Edit `core.yaml` di setiap peer:

```yaml
peer:
  # Maximum message size for sending/receiving
  # Default: 100MB (104857600 bytes)
  # Set to 200MB
  maxRecvMsgSize: 209715200
  maxSendMsgSize: 209715200
```

#### 2. Update Orderer Configuration

Edit `orderer.yaml`:

```yaml
General:
  # Maximum message size
  MaxMessageCount: 500
  AbsoluteMaxBytes: 209715200  # 200MB
  PreferredMaxBytes: 52428800  # 50MB
```

#### 3. Restart Peers dan Orderer

```bash
# Di setiap peer server
docker restart peer0.org1.example.com

# Di orderer server  
docker restart orderer.example.com
```

## 🎯 Solusi Alternative: Implement Pagination

Jika tidak bisa update server config, implement pagination di chaincode dan API:

### Option A: Pagination dengan Bookmark (CouchDB)

**Chaincode Function:**
```javascript
async queryWithPagination(ctx, pageSize, bookmark) {
    const queryString = {
        selector: { docType: 'seedBatch' }
    };
    
    const iterator = await ctx.stub.getQueryResultWithPagination(
        JSON.stringify(queryString),
        parseInt(pageSize),
        bookmark
    );
    
    const results = [];
    let result = await iterator.next();
    
    while (!result.done) {
        results.push(JSON.parse(result.value.value.toString()));
        result = await iterator.next();
    }
    
    const metadata = await iterator.getMetadata();
    
    return {
        records: results,
        bookmark: metadata.bookmark,
        recordCount: metadata.fetched_records_count
    };
}
```

**API Endpoint:**
```javascript
// GET /api/seed-batches?pageSize=50&bookmark=xyz
const queryAllSeedBatches = async (req, res) => {
    const { pageSize = 50, bookmark = '' } = req.query;
    
    const result = await fabricService.queryChaincode(
        'queryWithPagination',
        [pageSize.toString(), bookmark]
    );
    
    res.status(200).json({
        success: true,
        data: result.records,
        pagination: {
            bookmark: result.bookmark,
            count: result.recordCount
        }
    });
};
```

### Option B: Filter by Date Range

**Chaincode Function:**
```javascript
async queryByDateRange(ctx, startDate, endDate) {
    const queryString = {
        selector: {
            docType: 'seedBatch',
            createdAt: {
                $gte: startDate,
                $lte: endDate
            }
        }
    };
    
    // Query logic...
}
```

**API Usage:**
```javascript
// GET /api/seed-batches?startDate=2025-01-01&endDate=2025-01-31
```

## 🧪 Testing

### Test 1: Verify Client Config
```bash
# Restart aplikasi
npm start

# Test query
curl http://localhost:3001/api/seed-batches
```

### Test 2: Check if Server Config Needed
Jika masih error "RESOURCE_EXHAUSTED", berarti **peer/orderer belum dikonfigurasi**.

### Test 3: Verify with Small Query
```bash
# Query specific batch (should work)
curl http://localhost:3001/api/seed-batches/BATCH-001
```

## 📋 Checklist

**Client-Side (Sudah Done):**
- [x] Update `fabric.service.js` dengan gRPC options
- [x] Update `connection-profile.json` dengan max message size
- [x] Restart aplikasi

**Server-Side (Perlu Action):**
- [ ] Update `core.yaml` di semua peers
- [ ] Update `orderer.yaml` di orderer
- [ ] Restart peers
- [ ] Restart orderer
- [ ] Test query ulang

**Alternative (Jika server tidak bisa diupdate):**
- [ ] Implement pagination di chaincode
- [ ] Update API untuk support pagination
- [ ] Deploy chaincode baru
- [ ] Update frontend untuk handle pagination

## 🚀 Quick Test

```bash
# 1. Restart aplikasi dengan config baru
npm start

# 2. Test query
curl http://localhost:3001/api/seed-batches

# Jika masih error:
# - Check logs untuk confirm error message
# - Proceed dengan update server config atau implement pagination
```

## 📊 Message Size Analysis

| Size | Bytes | Notes |
|------|-------|-------|
| Default Max | 104,857,600 | 100MB |
| Your Response | 115,326,077 | 110MB |
| New Limit | 209,715,200 | 200MB |

**Recommendation:** Set limit ke 200MB untuk handle growth.

## 💡 Best Practice

1. **Pagination is Better** - Lebih scalable untuk production
2. **Server Config** - Harus match dengan client config
3. **Monitor Size** - Track response size untuk prevent future issues
4. **Index Queries** - Gunakan CouchDB index untuk faster queries

---

**Status:** Client-side config ✅ | Server-side config ⏳ pending

**Next Action:** Update Fabric network configuration atau implement pagination
