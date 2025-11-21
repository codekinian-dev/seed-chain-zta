# K6 Load Testing - Seed Certification API

Skrip load testing untuk menguji performa endpoint `/api/seed-batches` menggunakan K6.

## Prerequisites

1. **Install K6**
   ```bash
   # macOS
   brew install k6
   
   # Linux
   sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   ```

2. **Services Running**
   - Keycloak: `http://localhost:8080`
   - API Gateway: `http://localhost:3000`
   - Blockchain Network: Running
   - IPFS: Running (optional for metadata-only test)

3. **Test User Setup**
   - Username: `producer_test`
   - Password: `Test123!`
   - Role: `role_producer`

## Configuration

Edit `loadtest.js` untuk mengubah konfigurasi:

```javascript
// Keycloak settings
const KEYCLOAK_URL = 'http://localhost:8080';
const KEYCLOAK_CLIENT_SECRET = 'your-client-secret-here';

// Load test parameters
export const options = {
    stages: [
        { duration: '10s', target: 10 },  // Ramp up
        { duration: '30s', target: 50 },  // Peak load
        { duration: '10s', target: 0 },   // Ramp down
    ],
};
```

## Running the Test

### Basic Run
```bash
cd k6_test
k6 run loadtest.js
```

### With Environment Variables
```bash
export KEYCLOAK_CLIENT_SECRET="your-secret-here"
k6 run loadtest.js
```

### With Custom VUs and Duration
```bash
k6 run --vus 100 --duration 60s loadtest.js
```

### Output to HTML Report
```bash
k6 run --out json=results.json loadtest.js
```

## Test Scenarios

### Default Scenario
- **Ramp-up**: 10 seconds → 10 VUs
- **Peak**: 30 seconds → 50 VUs
- **Ramp-down**: 10 seconds → 0 VUs

### Performance Thresholds
- ✅ **95% requests** < 500ms
- ✅ **Error rate** < 1%
- ✅ **HTTP failures** < 1%

## What the Test Does

1. **Login to Keycloak**
   - Authenticates as `producer_test`
   - Retrieves JWT access token

2. **Create Seed Batch**
   - Sends POST request to `/api/seed-batches`
   - Includes Bearer token in Authorization header
   - Sends dummy seed batch metadata (JSON)

3. **Validation**
   - Checks response status (200/201)
   - Validates response structure
   - Measures response time

## Sample Output

```
     ✓ Keycloak login successful
     ✓ Access token received
     ✓ Create seed batch - status 200 or 201
     ✓ Create seed batch - has success field
     ✓ Create seed batch - response time < 500ms

     checks.........................: 100.00% ✓ 2500 ✗ 0
     data_received..................: 2.5 MB  50 kB/s
     data_sent......................: 1.2 MB  24 kB/s
     http_req_duration..............: avg=245ms  min=102ms med=220ms max=489ms p(95)=420ms
     http_reqs......................: 2500    50/s
     iteration_duration.............: avg=2.5s   min=1.2s  med=2.4s  max=3.8s
     iterations.....................: 500     10/s
     vus............................: 50      min=0  max=50
```

## Troubleshooting

### Connection Refused
- Pastikan Keycloak dan API Gateway running
- Periksa port yang digunakan (8080, 3000)

### Authentication Failed
- Verifikasi user `producer_test` exists di Keycloak
- Periksa password benar: `Test123!`
- Pastikan user memiliki role `role_producer`

### High Error Rate
- Periksa log API Gateway
- Verifikasi blockchain network running
- Reduce VU count jika server overload

### Response Time > 500ms
- Blockchain network mungkin lambat
- Consider optimizing endorsement policy
- Check IPFS performance

## Advanced Usage

### Smoke Test (Quick Validation)
```bash
k6 run --vus 1 --duration 10s loadtest.js
```

### Stress Test (Find Breaking Point)
```bash
k6 run --vus 200 --duration 120s loadtest.js
```

### Spike Test (Sudden Load)
```bash
# Edit options.stages in loadtest.js:
stages: [
    { duration: '10s', target: 100 },  // Spike!
    { duration: '30s', target: 100 },  // Hold
    { duration: '10s', target: 0 },    // Drop
]
```

## Notes

### File Upload Limitation
K6 tidak dapat mengirim `multipart/form-data` dengan file binary secara efisien. 
Untuk load testing ini, skrip mengirim **metadata JSON saja**.

Jika ingin test dengan actual file upload:
1. Modify controller untuk accept JSON-only mode
2. Mock IPFS upload untuk return dummy CID
3. Atau gunakan tools lain seperti Artillery/JMeter untuk file upload testing

### Performance Baseline
Target performa yang wajar untuk blockchain-based API:
- **Average response time**: 200-400ms
- **P95 response time**: < 500ms
- **Throughput**: 20-50 req/s (tergantung endorsement policy)
- **Error rate**: < 1%

## License
MIT
