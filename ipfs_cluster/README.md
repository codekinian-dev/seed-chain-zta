# IPFS Cluster - Sistem Sertifikasi Benih Perkebunan

Implementasi IPFS Cluster dengan 2 node lokal menggunakan Docker untuk mendukung penyimpanan dokumen terdesentralisasi pada sistem sertifikasi benih perkebunan berbasis blockchain.

##  Deskripsi

Sistem ini menyediakan:
- **2 IPFS Node** yang berjalan secara lokal menggunakan Docker
- **Decentralized Storage** untuk dokumen sertifikasi benih
- **Redundansi Data** dengan replikasi antar node
- **API Access** untuk integrasi dengan blockchain

##  Arsitektur

```

         IPFS Cluster Network            
                                         
       
    IPFS Node 1   IPFS Node 2    
                                   
   Port: 4001      Port: 4002      
   API:  5001      API:  5002      
   GW:   8080      GW:   8081      
       
                                         

```

##  Quick Start

### Prasyarat

- Docker >= 20.10
- Docker Compose >= 2.0
- Minimal 2GB RAM
- Minimal 20GB disk space

### 1. Clone & Setup

```bash
cd /Users/rangga/playground/tesis_bismillah/ipfs_cluster
```

### 2. Start IPFS Cluster

```bash
docker-compose up -d
```

### 3. Verifikasi Status

```bash
# Check running containers
docker-compose ps

# Check logs
docker-compose logs -f

# Check Node 1 status
docker exec ipfs-node-1 ipfs id

# Check Node 2 status
docker exec ipfs-node-2 ipfs id
```

### 4. Connect Nodes

Setelah kedua node berjalan, hubungkan mereka:

```bash
# Get Node 1 Peer ID
NODE1_ID=$(docker exec ipfs-node-1 ipfs id -f='<id>')
echo "Node 1 Peer ID: $NODE1_ID"

# Get Node 2 Peer ID
NODE2_ID=$(docker exec ipfs-node-2 ipfs id -f='<id>')
echo "Node 2 Peer ID: $NODE2_ID"

# Connect Node 2 to Node 1
docker exec ipfs-node-2 ipfs swarm connect /ip4/172.25.0.2/tcp/4001/p2p/$NODE1_ID

# Verify connection
docker exec ipfs-node-1 ipfs swarm peers
docker exec ipfs-node-2 ipfs swarm peers
```

##  Penggunaan

### Upload Dokumen

```bash
# Upload file ke Node 1
docker exec ipfs-node-1 ipfs add /path/to/document.pdf

# Atau via API (dari host)
curl -F file=@document.pdf http://localhost:5001/api/v0/add
```

### Download Dokumen

```bash
# Download menggunakan CID
docker exec ipfs-node-1 ipfs cat <CID> > document.pdf

# Atau via Gateway
curl http://localhost:8080/ipfs/<CID> -o document.pdf
```

### Pin Dokumen (Replikasi)

```bash
# Pin file di Node 2 (untuk redundansi)
docker exec ipfs-node-2 ipfs pin add <CID>

# Check pin status
docker exec ipfs-node-2 ipfs pin ls
```

### Interaksi via API

```bash
# Add file via API
curl -X POST -F file=@sertifikat.pdf http://localhost:5001/api/v0/add

# Get file via API
curl "http://localhost:5001/api/v0/cat?arg=<CID>" -o output.pdf

# Get file info
curl "http://localhost:5001/api/v0/object/stat?arg=<CID>"

# Pin file via API
curl -X POST "http://localhost:5002/api/v0/pin/add?arg=<CID>"
```

##  Konfigurasi

### Environment Variables

Edit file `.env` untuk mengubah konfigurasi:

```env
IPFS_VERSION=latest
IPFS_PROFILE=server
STORAGE_MAX=10GB
```

### Port Mapping

| Node | Swarm | API | Gateway |
|------|-------|-----|---------|
| Node 1 | 4001 | 5001 | 8080 |
| Node 2 | 4002 | 5002 | 8081 |

##  Private Network (Opsional)

Untuk membuat IPFS private network:

1. Generate swarm key:

```bash
echo -e "/key/swarm/psk/1.0.0/\n/base16/\n`tr -dc 'a-f0-9' < /dev/urandom | head -c64`" > swarm.key
```

2. Copy ke kedua node:

```bash
cp swarm.key data/ipfs-node-1/
cp swarm.key data/ipfs-node-2/
```

3. Restart cluster:

```bash
docker-compose restart
```

##  Monitoring

### Check Cluster Health

```bash
# Node 1 health
curl http://localhost:5001/api/v0/id

# Node 2 health  
curl http://localhost:5002/api/v0/id

# Network stats
docker exec ipfs-node-1 ipfs stats bw
docker exec ipfs-node-2 ipfs stats bw
```

### View Storage Usage

```bash
docker exec ipfs-node-1 ipfs repo stat
docker exec ipfs-node-2 ipfs repo stat
```

##  Troubleshooting

### Nodes tidak terhubung

```bash
# Check network connectivity
docker exec ipfs-node-1 ping ipfs-node-2

# Manual connect
docker exec ipfs-node-2 ipfs swarm connect /ip4/<node1-ip>/tcp/4001/p2p/<node1-id>
```

### Clear data dan restart

```bash
docker-compose down -v
rm -rf data/
docker-compose up -d
```

### View detailed logs

```bash
docker-compose logs ipfs-node-1
docker-compose logs ipfs-node-2
```

##  Integrasi Blockchain

Untuk mengintegrasikan dengan smart contract:

1. Upload dokumen ke IPFS
2. Dapatkan CID (Content Identifier)
3. Simpan CID di blockchain sebagai hash referensi
4. Retrieve dokumen menggunakan CID dari blockchain

Contoh alur:

```javascript
// 1. Upload ke IPFS
const cid = await ipfs.add(documentBuffer);

// 2. Simpan CID ke blockchain
await contract.registerCertificate(certificateId, cid.toString());

// 3. Retrieve dari blockchain
const cid = await contract.getCertificateCID(certificateId);

// 4. Download dari IPFS
const document = await ipfs.cat(cid);
```

##  Referensi

- [IPFS Documentation](https://docs.ipfs.tech/)
- [Kubo (go-ipfs) GitHub](https://github.com/ipfs/kubo)
- [IPFS HTTP API](https://docs.ipfs.tech/reference/kubo/rpc/)

##  Lisensi

Project ini dibuat untuk keperluan penelitian tesis - Sistem Sertifikasi Benih Perkebunan Berbasis Blockchain.

##  Kontributor

- Rangga - Developer

---

**Status**:  Ready for Development
**Last Updated**: November 2025
