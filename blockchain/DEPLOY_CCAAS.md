# Chaincode Deployment - CCaaS Mode

## Apa itu Chaincode-as-a-Service (CCaaS)?

CCaaS adalah metode deployment chaincode yang lebih modern dan fleksibel di Hyperledger Fabric 2.4+. Berbeda dengan metode tradisional yang mengharuskan peer membangun Docker image chaincode (memerlukan Docker-in-Docker), CCaaS menjalankan chaincode sebagai service eksternal yang terhubung ke peer.

### Keuntungan CCaaS:

✅ **Tidak perlu Docker-in-Docker** - Peer tidak perlu akses ke Docker daemon host  
✅ **Deployment lebih cepat** - Tidak ada build time untuk Docker image di peer  
✅ **Mudah di-debug** - Chaincode berjalan sebagai container terpisah  
✅ **Fleksibel** - Chaincode bisa di-restart tanpa re-install  
✅ **Cocok untuk production** - Lebih mudah untuk scaling dan monitoring  

## Struktur File CCaaS

```
blockchain/
├── chaincode/
│   ├── chaincode-ccaas/              # Direktori CCaaS
│   │   ├── Dockerfile                # Docker image untuk chaincode
│   │   ├── server.js                 # Server chaincode (gRPC)
│   │   ├── package.json              # Dependencies
│   │   ├── connection.json           # Konfigurasi koneksi peer
│   │   ├── metadata.json             # Metadata CCaaS
│   │   ├── lib/                      # (akan di-copy saat build)
│   │   └── index.js                  # (akan di-copy saat build)
│   ├── lib/
│   │   ├── seedBatchContract.js
│   │   └── seedBatchContractZTA.js
│   └── index.js
├── network/
│   └── docker-compose.yaml           # Tambah service seedbatch.ccaas
└── scripts/
    └── deploy-chaincode-ccaas.sh     # Script deployment CCaaS
```

## Cara Menggunakan

### 1. Full Deployment (Semua Step Sekaligus)

```bash
cd blockchain
./scripts/deploy-chaincode-ccaas.sh deploy
```

Atau dengan version dan sequence custom:
```bash
./scripts/deploy-chaincode-ccaas.sh deploy 2.0 2
```

### 2. Step-by-Step Deployment

Jika ingin kontrol lebih detail:

```bash
cd blockchain

# Step 1: Build Docker image chaincode
./scripts/deploy-chaincode-ccaas.sh build

# Step 2: Create CCaaS package
./scripts/deploy-chaincode-ccaas.sh package

# Step 3: Install ke semua peer
./scripts/deploy-chaincode-ccaas.sh install

# Step 4: Query package ID
./scripts/deploy-chaincode-ccaas.sh query

# Step 5: Start CCaaS container
./scripts/deploy-chaincode-ccaas.sh start

# Step 6: Approve untuk semua org
./scripts/deploy-chaincode-ccaas.sh approve

# Step 7: Check commit readiness
./scripts/deploy-chaincode-ccaas.sh check

# Step 8: Commit chaincode
./scripts/deploy-chaincode-ccaas.sh commit

# Step 9: Query committed
./scripts/deploy-chaincode-ccaas.sh deployed
```

## Troubleshooting

### Chaincode Container Tidak Start

```bash
# Check logs container
docker logs seedbatch.ccaas

# Restart container
docker restart seedbatch.ccaas

# Rebuild image
cd blockchain
./scripts/deploy-chaincode-ccaas.sh build
docker-compose -f network/docker-compose.yaml up -d seedbatch.ccaas
```

### Error "Package ID not found"

```bash
# Query ulang installed chaincode
./scripts/deploy-chaincode-ccaas.sh query

# Check file package_id.txt
cat network/package_id.txt
```

### Update Chaincode Logic

Jika ada perubahan di `lib/seedBatchContractZTA.js`:

```bash
# 1. Update version dan sequence
./scripts/deploy-chaincode-ccaas.sh deploy 1.1 2

# Atau manual:
# 1. Rebuild image dengan code baru
./scripts/deploy-chaincode-ccaas.sh build

# 2. Restart CCaaS container
docker restart seedbatch.ccaas

# 3. Deploy dengan sequence baru
./scripts/deploy-chaincode-ccaas.sh deploy 1.1 2
```

### Check Chaincode Status

```bash
# Check container running
docker ps | grep seedbatch.ccaas

# Check chaincode logs
docker logs -f seedbatch.ccaas

# Query committed version
./scripts/deploy-chaincode-ccaas.sh deployed
```

## Perbedaan dengan Metode Lama

| Aspek | Metode Lama | CCaaS |
|-------|-------------|-------|
| Docker Socket | ❌ Perlu mount `/var/run/docker.sock` | ✅ Tidak perlu |
| Build Time | ❌ Lama (build di setiap peer) | ✅ Cepat (build sekali) |
| Debugging | ❌ Sulit (chaincode di dalam peer) | ✅ Mudah (container terpisah) |
| Restart | ❌ Harus re-install | ✅ Cukup restart container |
| Production Ready | ⚠️ Kompleks | ✅ Lebih mudah |

## Technical Details

### Connection Configuration

File `connection.json` memberitahu peer dimana chaincode server berjalan:

```json
{
  "address": "seedbatch.ccaas:9999",
  "dial_timeout": "10s",
  "tls_required": false
}
```

### Metadata

File `metadata.json` menandai package sebagai CCaaS:

```json
{
  "type": "ccaas",
  "label": "seedbatch_1.0"
}
```

### Chaincode Server

`server.js` menjalankan chaincode sebagai gRPC server:

```javascript
const server = shim.server(new SeedBatchContractZTA(), {
    ccid: process.env.CHAINCODE_ID || 'seedbatch:1.0',
    address: process.env.CHAINCODE_ADDRESS || '0.0.0.0:9999'
});
```

## Deploy ke Server Production

Di server, pastikan:

1. ✅ Docker dan Docker Compose terinstall
2. ✅ Fabric network sudah running
3. ✅ Tidak perlu Docker socket mount (ini keuntungan CCaaS!)

```bash
# Di server
cd blockchain
./scripts/deploy-chaincode-ccaas.sh deploy
```

Jika ada error, check dengan:

```bash
# Check network
docker network ls | grep fabric_benih

# Check peers running
docker ps | grep peer

# Check CCaaS container
docker ps | grep seedbatch.ccaas
docker logs seedbatch.ccaas
```

## Referensi

- [Fabric CCaaS Documentation](https://hyperledger-fabric.readthedocs.io/en/latest/cc_service.html)
- [Chaincode as External Service](https://hyperledger-fabric.readthedocs.io/en/latest/cc_launcher.html)
