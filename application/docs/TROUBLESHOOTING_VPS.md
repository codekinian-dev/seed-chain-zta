# Troubleshooting: Docker Gateway Restart di VPS

## Masalah Umum & Solusi

### 1. **host.docker.internal Tidak Tersedia di Linux VPS**

**Masalah:** `host.docker.internal` adalah fitur khusus Docker Desktop (Mac/Windows). Di Linux VPS, ini tidak otomatis tersedia dan menyebabkan koneksi gagal.

**Solusi:**

Tambahkan `extra_hosts` di `docker-compose.yml`:

```yaml
api-gateway:
  extra_hosts:
    - "host.docker.internal:host-gateway"
```

Atau gunakan IP internal network atau nama service jika Fabric juga di-dockerize.

---

### 2. **Koneksi ke Fabric Network Gagal**

**Cek logs container:**
```bash
docker logs seed-api-gateway
# atau untuk follow logs
docker logs -f seed-api-gateway
```

**Kemungkinan penyebab:**
- Fabric network belum running di VPS
- TLS certificates tidak valid/expired
- Wallet tidak ter-mount dengan benar
- Connection profile salah (gunakan IP VPS, bukan localhost)

**Solusi untuk VPS:**
Edit `docker-compose.prod.yml` untuk menggunakan IP VPS atau domain:

```yaml
environment:
  - FABRIC_AS_LOCALHOST=false
  
  # Ganti dengan IP/domain VPS
  - KEYCLOAK_URL=http://VPS_IP:8080
  - IPFS_HOST=VPS_IP
```

---

### 3. **Keycloak Tidak Tersedia**

**Masalah:** Aplikasi tidak bisa connect ke Keycloak saat startup.

**Cek Keycloak:**
```bash
# Pastikan Keycloak running
curl http://localhost:8080
```

**Solusi:**
- Pastikan Keycloak sudah running sebelum start api-gateway
- Atau tambahkan restart policy dan delay:

```yaml
api-gateway:
  restart: on-failure:5  # Restart max 5x
  depends_on:
    redis:
      condition: service_healthy
```

---

### 4. **Redis Connection Error**

**Cek Redis:**
```bash
docker exec -it seed-redis redis-cli ping
# Harus return: PONG
```

**Solusi:**
Pastikan Redis healthy sebelum start api-gateway (sudah ada di config).

---

### 5. **Wallet/Crypto-config Tidak Ditemukan**

**Masalah:** Volume mount tidak ada atau permission denied.

**Solusi:**
```bash
# Pastikan directory ada di VPS
ls -la wallet/
ls -la crypto-config/

# Fix permissions jika perlu
chmod -R 755 wallet crypto-config
```

---

### 6. **Environment Variables Tidak Lengkap**

**Solusi:**
Buat file `.env.docker.local` di VPS dengan semua variabel:

```bash
# Server
PORT=3001
NODE_ENV=production

# Keycloak (ganti dengan IP/domain VPS)
KEYCLOAK_URL=http://VPS_IP:8080
KEYCLOAK_REALM=SeedCertificationRealm
KEYCLOAK_CLIENT_ID=seed-api-gateway
KEYCLOAK_CLIENT_SECRET=your-secret-here

# Session
SESSION_SECRET=your-random-secret-here

# Fabric
FABRIC_CHANNEL=benihchannel
FABRIC_CONTRACT=benih-certification
FABRIC_WALLET_PATH=/app/wallet
FABRIC_USER=appUser
FABRIC_ORG_MSP=BPSBPMSP
FABRIC_AS_LOCALHOST=false

# IPFS (ganti dengan IP/domain VPS)
IPFS_HOST=VPS_IP
IPFS_PORT=9094
IPFS_PROTOCOL=http

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
QUEUE_NAME=ipfs-upload-queue

# File Upload
MAX_FILE_SIZE=10485760

# Security
CORS_ORIGIN=*
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Cleanup
CLEANUP_INTERVAL=30
CLEANUP_MAX_AGE=60
```

---

## Langkah Diagnosis

### 1. Cek Status Container
```bash
docker ps -a
```

### 2. Cek Logs Detail
```bash
# Lihat error saat startup
docker logs seed-api-gateway --tail 100

# Follow logs real-time
docker logs -f seed-api-gateway
```

### 3. Cek Resource Usage
```bash
docker stats
```

### 4. Cek Network
```bash
docker network inspect seed-network
```

### 5. Cek Health Check
```bash
docker inspect seed-api-gateway | grep -A 20 Health
```

---

## Solusi Quick Fix

### Opsi 1: Manual Start (Debugging)
```bash
# Stop semua container
docker-compose -f docker-compose.prod.yml down

# Start redis dulu
docker-compose -f docker-compose.prod.yml up -d redis

# Tunggu redis ready
docker logs seed-redis-prod

# Start api-gateway
docker-compose -f docker-compose.prod.yml up api-gateway
# (tanpa -d untuk lihat logs langsung)
```

### Opsi 2: Increase Start Period
Edit `docker-compose.prod.yml`:
```yaml
healthcheck:
  start_period: 120s  # Naikkan dari 60s ke 120s
  retries: 10
```

### Opsi 3: Disable Dependencies Sementara
Test tanpa dependency ke service external:
```yaml
api-gateway:
  # Comment sementara untuk testing
  # depends_on:
  #   redis:
  #     condition: service_healthy
```

---

## Monitoring Berkelanjutan

### Setup Log Viewer
```bash
# Install jika belum ada
sudo apt-get install logrotate

# Monitor logs
tail -f logs/combined-*.log
tail -f logs/error-*.log
```

### Auto-restart Script
Buat file `monitor.sh`:
```bash
#!/bin/bash
while true; do
  if ! docker ps | grep -q seed-api-gateway-prod; then
    echo "$(date): Container stopped, restarting..."
    docker-compose -f docker-compose.prod.yml up -d api-gateway
  fi
  sleep 30
done
```

---

## Checklist Pre-Deploy ke VPS

- [ ] Keycloak running dan accessible
- [ ] IPFS running dan accessible  
- [ ] Fabric network running (peers, orderers)
- [ ] Wallet sudah di-generate dengan identitas yang benar
- [ ] Crypto-config/TLS certificates tersedia
- [ ] Connection profile menggunakan hostname/IP VPS (bukan localhost)
- [ ] `.env.docker.local` sudah dibuat dengan nilai yang benar
- [ ] Port 3001, 6379, 8080, 7050 tidak bentrok
- [ ] Firewall allow port yang diperlukan
- [ ] Disk space cukup (minimal 5GB free)
- [ ] Memory minimal 2GB available

---

## Contact Support

Jika masih gagal, share output dari:
```bash
docker-compose -f docker-compose.prod.yml logs --tail 200 > debug.log
docker inspect seed-api-gateway-prod > inspect.log
cat .env.docker.local | grep -v SECRET > env-sanitized.log
```
