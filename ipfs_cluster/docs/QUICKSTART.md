# Quick Start Guide - IPFS Cluster

##  Setup dalam 3 Langkah

### 1. Start Cluster
```bash
docker-compose up -d
```

### 2. Connect Nodes
```bash
./scripts/connect-nodes.sh
```

### 3. Verify Status
```bash
./scripts/status.sh
```

##  Contoh Penggunaan

### Upload Dokumen Sertifikat

```bash
# Upload file ke Node 1
docker exec -i ipfs-node-1 ipfs add /path/to/sertifikat.pdf

# Atau via API
curl -F file=@sertifikat.pdf http://localhost:5001/api/v0/add
```

**Output:** 
```json
{
  "Hash": "QmXxx...",
  "Name": "sertifikat.pdf",
  "Size": "12345"
}
```

### Download Dokumen

```bash
# Via IPFS command
docker exec ipfs-node-1 ipfs cat <CID> > downloaded.pdf

# Via HTTP Gateway
curl http://localhost:8080/ipfs/<CID> -o downloaded.pdf

# Via API
curl http://localhost:5001/api/v0/cat?arg=<CID> -o downloaded.pdf
```

### Replikasi ke Node 2

```bash
# Pin file di Node 2 untuk redundansi
docker exec ipfs-node-2 ipfs pin add <CID>

# Verify replication
docker exec ipfs-node-2 ipfs pin ls | grep <CID>
```

##  Useful Commands

### Check Connection
```bash
# See Node 1 peers
docker exec ipfs-node-1 ipfs swarm peers

# See Node 2 peers
docker exec ipfs-node-2 ipfs swarm peers
```

### List All Files
```bash
# List pinned files on Node 1
docker exec ipfs-node-1 ipfs pin ls

# List pinned files on Node 2
docker exec ipfs-node-2 ipfs pin ls
```

### Storage Stats
```bash
# Node 1 storage
docker exec ipfs-node-1 ipfs repo stat

# Node 2 storage
docker exec ipfs-node-2 ipfs repo stat
```

### View Logs
```bash
# All logs
docker-compose logs -f

# Node 1 only
docker-compose logs -f ipfs-node-1

# Node 2 only
docker-compose logs -f ipfs-node-2
```

##  Test Cluster

Run the automated test:
```bash
./scripts/test-cluster.sh
```

##  Stop Cluster

```bash
# Stop containers (keep data)
docker-compose down

# Stop and remove data
docker-compose down -v
rm -rf data/
```

##  API Endpoints

| Node | API | Gateway |
|------|-----|---------|
| Node 1 | http://localhost:5001 | http://localhost:8080 |
| Node 2 | http://localhost:5002 | http://localhost:8081 |

### WebUI Access

- Node 1: http://localhost:5001/webui
- Node 2: http://localhost:5002/webui

##  Tips

1. **Always connect nodes after restart:**
   ```bash
   docker-compose restart && sleep 10 && ./scripts/connect-nodes.sh
   ```

2. **Check if nodes are connected:**
   ```bash
   docker exec ipfs-node-1 ipfs swarm peers | grep 172.25.0.3
   docker exec ipfs-node-2 ipfs swarm peers | grep 172.25.0.2
   ```

3. **Pin important files on both nodes for redundancy**

4. **Monitor storage usage regularly**

##  Integration dengan Blockchain

```javascript
// 1. Upload ke IPFS
const cid = await uploadToIPFS(file);
console.log('CID:', cid); // QmXxx...

// 2. Store CID di blockchain smart contract
await contract.saveCertificate(certId, cid);

// 3. Retrieve dari blockchain
const storedCid = await contract.getCertificate(certId);

// 4. Download dari IPFS
const file = await fetchFromIPFS(storedCid);
```

##  Troubleshooting

**Nodes tidak connect?**
```bash
./scripts/connect-nodes.sh
```

**Container error?**
```bash
docker-compose down && docker-compose up -d
```

**Clear semua data?**
```bash
docker-compose down -v && rm -rf data/
```
