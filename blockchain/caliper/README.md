# Hyperledger Caliper - Performance Testing

Setup untuk performance testing Smart Contract Sertifikasi Benih dengan Zero Trust Architecture menggunakan Hyperledger Caliper.

## 📋 Prerequisites

- Node.js v14 atau lebih tinggi
- Hyperledger Fabric network sudah berjalan
- Chaincode `benih-certification` sudah ter-deploy
- Docker dan Docker Compose

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd blockchain/caliper
npm install
npm run bind
```

### 2. Setup Test Identities

Generate user identities dengan role attributes untuk testing:

```bash
npm run setup:identities
```

Script ini akan membuat:
- **BPSBP Org:**
  - User1 dengan role `role_producer`
  - User2 dengan role `role_pbt_field`
- **Disbun Org:**
  - User1 dengan role `role_pbt_chief`
  - User2 dengan role `role_lsm_head`

### 3. Run Performance Test Scenarios

#### **Skenario Testing: 100, 500, 1000 Requests**

Jalankan semua skenario sekaligus:
```bash
./scripts/run-scenarios.sh
```

Atau jalankan skenario individual:

**Scenario 1: 100 Requests**
```bash
npm run test:100
```
- Workers: 5
- TPS: 10
- Total Transactions: 100
- Estimated Duration: ~10 seconds

**Scenario 2: 500 Requests**
```bash
npm run test:500
```
- Workers: 10
- TPS: 20
- Total Transactions: 500
- Estimated Duration: ~25 seconds

**Scenario 3: 1000 Requests**
```bash
npm run test:1000
```
- Workers: 20
- TPS: 30
- Total Transactions: 1000
- Estimated Duration: ~33 seconds

**Run All Scenarios Sequentially**
```bash
npm run test:scenarios
```

### 4. Other Performance Tests

#### Test Create Seed Batch
```bash
npm run test:create
```
- Workers: 5
- TPS: 10
- Total Transactions: 100

#### Test Query Operations
```bash
npm run test:query
```
Testing untuk:
- `querySeedBatch` (200 tx @ 50 TPS)
- `queryAllSeedBatches` (50 tx @ 10 TPS)
- `querySeedBatchesByStatus` (100 tx @ 20 TPS)

#### Test Full Workflow
```bash
npm run test:workflow
```
Testing complete workflow:
1. createSeedBatch (50 tx)
2. submitCertification (50 tx)
3. recordInspection (50 tx)
4. evaluateInspection (50 tx)
5. issueCertificate (50 tx)
6. distributeSeed (50 tx)

#### Run All Tests
```bash
npm run test:all
```

## 📊 Benchmark Configurations

### Load Test Scenarios (Primary)

#### 1. scenario-100.yaml
- **Purpose:** Test dengan 100 requests
- **Workers:** 5
- **Rate Control:** Fixed rate @ 10 TPS
- **Transactions:** 100
- **Identity:** producer_bpsbp
- **Use Case:** Baseline performance testing

#### 2. scenario-500.yaml
- **Purpose:** Medium load test dengan 500 requests
- **Workers:** 10
- **Rate Control:** Fixed rate @ 20 TPS
- **Transactions:** 500
- **Identity:** producer_bpsbp
- **Use Case:** Normal production load simulation

#### 3. scenario-1000.yaml
- **Purpose:** High load test dengan 1000 requests
- **Workers:** 20
- **Rate Control:** Fixed rate @ 30 TPS
- **Transactions:** 1000
- **Identity:** producer_bpsbp
- **Use Case:** Peak load stress testing

### Additional Tests

#### 4. create-seed-batch.yaml
- **Purpose:** Test performance untuk creating seed batches
- **Workers:** 5
- **Rate Control:** Fixed rate @ 10 TPS
- **Transactions:** 100
- **Identity:** producer_bpsbp

#### 5. query-test.yaml
- **Purpose:** Test read performance
- **Workers:** 5
- **Rounds:**
  - Query specific batch: 200 tx @ 50 TPS
  - Query all batches: 50 tx @ 10 TPS
  - Query by status: 100 tx @ 20 TPS

#### 6. full-workflow.yaml
- **Purpose:** Test complete certification workflow
- **Workers:** 3
- **Rate Control:** Fixed rate @ 5 TPS per round
- **Total Transactions:** 300 (6 rounds × 50 tx)

## 🔧 Workload Modules

Setiap workload module di folder `workload/` mengimplementasikan:

1. **createSeedBatch.js** - Generate random seed batch data
2. **querySeedBatch.js** - Query existing batches
3. **queryAllSeedBatches.js** - Query all batches
4. **queryByStatus.js** - Query filtered by status
5. **submitCertification.js** - Submit certification documents
6. **recordInspection.js** - Record field inspection
7. **evaluateInspection.js** - Evaluate inspection results
8. **issueCertificate.js** - Issue certificates
9. **distributeSeed.js** - Distribute certified seeds

## 📁 Directory Structure

```
caliper/
├── benchmarks/          # Benchmark configuration files
│   ├── scenario-100.yaml      # 100 requests test
│   ├── scenario-500.yaml      # 500 requests test
│   ├── scenario-1000.yaml     # 1000 requests test
│   ├── create-seed-batch.yaml
│   ├── query-test.yaml
│   └── full-workflow.yaml
├── networks/            # Network configuration
│   ├── networkConfig.yaml
│   ├── connection-bpsbp.yaml
│   └── connection-disbun.yaml
├── workload/            # Workload modules
│   ├── createSeedBatch.js
│   ├── querySeedBatch.js
│   ├── queryAllSeedBatches.js
│   ├── queryByStatus.js
│   ├── submitCertification.js
│   ├── recordInspection.js
│   ├── evaluateInspection.js
│   ├── issueCertificate.js
│   └── distributeSeed.js
├── scripts/             # Utility scripts
│   ├── setup-identities.sh
│   ├── verify-setup.sh
│   └── run-scenarios.sh
├── reports/             # Generated test reports (created on first run)
├── package.json
└── README.md
```

## 🔐 Zero Trust Architecture Notes

Smart contract ini mengimplementasikan Zero Trust Architecture dengan:

1. **Role-Based Access Control (RBAC)**
   - Setiap fungsi memerlukan role spesifik
   - Validasi identity di setiap transaction

2. **Audit Logging**
   - Semua operasi tercatat di blockchain
   - Security events untuk monitoring

3. **Resource-Level Authorization**
   - Ownership verification
   - Attribute-based access control

4. **Input Validation**
   - UUID validation
   - Date validation
   - IPFS CID validation
   - Input sanitization

## 📊 Monitoring

### Docker Monitoring
Caliper menggunakan Docker monitoring untuk track:
- CPU usage
- Memory usage
- Network I/O
- Disk I/O

### Prometheus (Optional)
Jika Prometheus tersedia, dapat track:
- Container metrics
- Fabric peer metrics
- Orderer metrics
- CouchDB metrics

## 🎯 Performance Metrics

Caliper akan generate report dengan:

1. **Transaction Metrics:**
   - Throughput (TPS)
   - Latency (min, max, avg)
   - Success rate

2. **Resource Metrics:**
   - CPU usage
   - Memory usage
   - Network bandwidth

3. **Custom Metrics:**
   - Audit log overhead
   - ZTA validation time

## 🛠️ Troubleshooting

### Error: No identities found
```bash
# Re-run identity setup
npm run setup:identities
```

### Error: Chaincode not found
```bash
# Verify chaincode is deployed
cd ../
./scripts/deploy-chaincode.sh query-committed
```

### Error: Connection refused
```bash
# Check if network is running
docker ps | grep fabric
```

### Private key not found
```bash
# Check if the priv_sk file exists in keystore
ls -la ../network/organizations/peerOrganizations/*/users/*/msp/keystore/
```

## 📝 Customization

### Modify Transaction Rate
Edit benchmark YAML files:
```yaml
rateControl:
  type: fixed-rate
  opts:
    tps: 10  # Change this value
```

### Modify Number of Workers
```yaml
workers:
  number: 5  # Change this value
```

### Modify Transaction Count
```yaml
txNumber: 100  # Change this value
```

## 📈 Expected Results

### Load Test Scenarios

#### Scenario 100 Requests
- **Expected TPS:** 8-12 TPS
- **Latency:** 500-1500ms
- **Success Rate:** >95%
- **Duration:** ~10 seconds
- **Resource Usage:** Low-Medium

#### Scenario 500 Requests
- **Expected TPS:** 15-25 TPS
- **Latency:** 600-2000ms
- **Success Rate:** >93%
- **Duration:** ~25 seconds
- **Resource Usage:** Medium

#### Scenario 1000 Requests
- **Expected TPS:** 20-35 TPS
- **Latency:** 800-2500ms
- **Success Rate:** >90%
- **Duration:** ~35 seconds
- **Resource Usage:** High

### Other Tests

#### createSeedBatch
- **Expected TPS:** 8-12 TPS
- **Latency:** 500-1500ms
- **Success Rate:** >95%

### Query Operations
- **Expected TPS:** 40-60 TPS (read)
- **Latency:** 50-200ms
- **Success Rate:** >99%

### Full Workflow
- **Expected TPS:** 4-6 TPS per round
- **Total Duration:** ~2-3 minutes
- **Success Rate:** >90%

## ⚠️ Important Notes

1. **Role Attributes Required:**
   - Identities must have correct role attributes
   - Use setup-identities.sh untuk generate proper certificates

2. **Sequential Workflow:**
   - Full workflow test requires sequential execution
   - Status transitions must be in order

3. **Network Load:**
   - Start with lower TPS untuk warm-up
   - Monitor resource usage selama testing

4. **Data Cleanup:**
   - Large tests akan mengisi ledger
   - Consider cleanup between major test runs

## 📚 References

- [Hyperledger Caliper Documentation](https://hyperledger.github.io/caliper/)
- [Fabric Performance Testing](https://hyperledger-fabric.readthedocs.io/en/latest/test_network.html)
- [Zero Trust Architecture Guide](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-207.pdf)

## 📄 License

Apache-2.0
