# Performance Test Scenarios - Quick Guide

## 🎯 Tujuan Testing

Testing dilakukan dengan 3 skenario load berbeda untuk mengukur:
- **Throughput (TPS)** - Transactions Per Second
- **Latency** - Response time
- **Success Rate** - Percentage of successful transactions
- **Resource Usage** - CPU, Memory, Network

## 📊 Skenario Testing

### Scenario 1: 100 Requests (Baseline)
```bash
npm run test:100
```
- **Load:** Light (5 workers, 10 TPS)
- **Purpose:** Baseline performance measurement
- **Expected Duration:** ~10 seconds
- **Use Case:** Low traffic simulation

### Scenario 2: 500 Requests (Normal Load)
```bash
npm run test:500
```
- **Load:** Medium (10 workers, 20 TPS)
- **Purpose:** Normal production load
- **Expected Duration:** ~25 seconds
- **Use Case:** Average daily traffic

### Scenario 3: 1000 Requests (Peak Load)
```bash
npm run test:1000
```
- **Load:** High (20 workers, 30 TPS)
- **Purpose:** Stress testing under peak load
- **Expected Duration:** ~33 seconds
- **Use Case:** Peak hours / high demand

## 🚀 Cara Menjalankan

### Option 1: Run Semua Skenario (Recommended)
```bash
./scripts/run-scenarios.sh
```
Script ini akan:
1. Menjalankan scenario 100, 500, 1000 secara berurutan
2. Memberikan wait time antar scenario
3. Menyimpan semua reports dengan timestamp
4. Generate summary di akhir

### Option 2: Run Individual Scenario
```bash
npm run test:100    # Scenario 100 requests
npm run test:500    # Scenario 500 requests
npm run test:1000   # Scenario 1000 requests
```

### Option 3: Run via npm
```bash
npm run test:scenarios   # Run all scenarios sequentially
```

## 📈 Metrics yang Diukur

### Transaction Metrics
- **Send Rate (TPS):** Target transactions per second
- **Max Latency:** Maximum response time
- **Min Latency:** Minimum response time
- **Avg Latency:** Average response time
- **Throughput:** Actual TPS achieved

### Success Metrics
- **Succ:** Number of successful transactions
- **Fail:** Number of failed transactions
- **Success Rate (%):** Percentage calculation

### Resource Metrics (Docker Monitoring)
- **CPU Usage (%):** Per container
- **Memory Usage (MB):** Per container
- **Network I/O:** Bandwidth usage
- **Disk I/O:** Read/Write operations

## 📁 Reports Location

Reports disimpan di: `blockchain/caliper/reports/`

Format: `report_{100|500|1000}_YYYYMMDD_HHMMSS.html`

Example:
```
reports/
├── report_100_20251119_093045.html
├── report_500_20251119_093120.html
└── report_1000_20251119_093230.html
```

Buka report dengan browser:
```bash
open reports/report_100_*.html
```

## ⚙️ Configuration Details

### Scenario 100
```yaml
workers: 5
txNumber: 100
tps: 10
```

### Scenario 500
```yaml
workers: 10
txNumber: 500
tps: 20
```

### Scenario 1000
```yaml
workers: 20
txNumber: 1000
tps: 30
```

## 🎯 Expected Performance

| Metric | 100 Req | 500 Req | 1000 Req |
|--------|---------|---------|----------|
| Target TPS | 10 | 20 | 30 |
| Actual TPS | 8-12 | 15-25 | 20-35 |
| Avg Latency | 500-1500ms | 600-2000ms | 800-2500ms |
| Success Rate | >95% | >93% | >90% |
| Duration | ~10s | ~25s | ~35s |

## 🔍 Analisis Results

### Good Performance
- TPS mendekati target rate
- Latency konsisten dan low
- Success rate >90%
- Resource usage stabil

### Poor Performance
- TPS jauh di bawah target
- Latency tinggi dan tidak stabil
- Success rate <80%
- Resource usage spike

### Bottleneck Indicators
- **High CPU:** Chaincode computation intensive
- **High Memory:** Large data structures
- **High Latency:** Network or endorsement delays
- **Low Success Rate:** Endorsement policy issues

## ⚠️ Best Practices

1. **Warm-up:** Jalankan scenario kecil dulu (100) sebelum yang besar
2. **Wait Time:** Beri jeda antar scenario untuk stabilisasi
3. **Monitor:** Watch Docker stats selama test
4. **Clean Up:** Clear old test data jika perlu
5. **Baseline:** Selalu compare dengan baseline (scenario 100)

## 🛠️ Troubleshooting

### Low TPS
- Check network connectivity
- Verify endorsement policy
- Monitor peer resources

### High Failure Rate
- Check chaincode logs
- Verify identity/role attributes
- Check endorsement policy satisfaction

### Resource Issues
- Increase Docker resources
- Optimize chaincode logic
- Scale peers horizontally

## 📝 Notes

- Test menggunakan `createSeedBatch` function dengan role `role_producer`
- Data generated randomly untuk setiap transaction
- Setiap worker independent dan parallel
- Rate control menggunakan fixed-rate strategy
