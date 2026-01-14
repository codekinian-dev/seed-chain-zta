# 🐛 Troubleshooting: npm start Works, Docker Fails

## Masalah yang Ditemukan

File `.env.docker.local` **TIDAK LENGKAP** - missing banyak environment variables yang critical.

## ✅ Perbaikan yang Sudah Dilakukan

1. **Updated `.env.docker.local`** dengan semua environment variables yang diperlukan:
   - `NODE_ENV=production`
   - `PORT=3001`
   - `KEYCLOAK_URL=http://host.docker.internal:6080`
   - `FABRIC_*` variables
   - `REDIS_HOST=redis` (service name, bukan localhost)
   - Semua variables lainnya

## 🔍 Perbedaan Utama Local vs Docker

### Local (`npm start`)
- Menggunakan `.env` file
- `REDIS_HOST=localhost`
- `KEYCLOAK_URL=http://localhost:6080`
- `IPFS_API_URL=http://localhost:9094`

### Docker
- Menggunakan `.env.docker.local` file
- `REDIS_HOST=redis` (nama service)
- `KEYCLOAK_URL=http://host.docker.internal:6080`
- `IPFS_API_URL=http://host.docker.internal:9094`

## 🧪 Testing

### Cara 1: Test dengan Script
```bash
./scripts/test-docker.sh
```

Script ini akan:
1. Check .env.docker.local completeness
2. Stop existing containers
3. Build image
4. Start Redis
5. Start API Gateway dan show logs langsung

### Cara 2: Manual Test
```bash
# 1. Rebuild
docker-compose -f docker-compose.prod.yml build --no-cache

# 2. Start tanpa detach (lihat logs langsung)
docker-compose -f docker-compose.prod.yml up

# 3. Jika ada error, lihat detail:
docker logs seed-api-gateway-prod --tail 100
```

## ⚠️ Kemungkinan Masalah Lain

### 1. Redis Connection
**Symptom:** Container exit saat connect ke Redis

**Check:**
```bash
# Pastikan Redis running
docker ps | grep redis

# Test koneksi dari container
docker exec seed-api-gateway-prod ping -c 3 redis
```

**Fix:** Pastikan `REDIS_HOST=redis` (bukan `localhost`)

### 2. Keycloak Connection
**Symptom:** Error "connect ECONNREFUSED" atau "getaddrinfo ENOTFOUND"

**Check:**
```bash
# Dari host
curl http://localhost:6080

# Dari container
docker exec seed-api-gateway-prod wget -O- http://host.docker.internal:6080
```

**Fix:** 
- Pastikan Keycloak running
- Gunakan `host.docker.internal` bukan `localhost`
- Atau gunakan IP host machine

### 3. Fabric Wallet/Connection
**Symptom:** Error "wallet not found" atau "certificate not valid"

**Check:**
```bash
# Verify wallet mounted
docker exec seed-api-gateway-prod ls -la /app/wallet

# Verify connection profile
docker exec seed-api-gateway-prod cat /app/config/connection-profile.json
```

**Fix:**
```bash
# Fix permissions
chmod -R 755 wallet crypto-config

# Verify mount in docker-compose.prod.yml
# - ./wallet:/app/wallet:ro
```

### 4. Missing Dependencies
**Symptom:** Error "Cannot find module"

**Check Dockerfile:**
```dockerfile
# Make sure npm ci runs successfully
RUN npm ci

# Check if node_modules copied
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
```

**Fix:** Rebuild dengan `--no-cache`

### 5. File Permissions
**Symptom:** Error "EACCES" atau "permission denied"

**Check:**
```bash
docker exec seed-api-gateway-prod ls -la /app/logs
docker exec seed-api-gateway-prod ls -la /app/uploads
```

**Fix:** Directories sudah dibuat di Dockerfile dengan proper ownership

## 🎯 Debugging Steps

### Step 1: Check Environment Variables
```bash
# Inside running container
docker exec seed-api-gateway-prod env | grep -E "KEYCLOAK|REDIS|FABRIC|IPFS"
```

### Step 2: Check Application Startup
```bash
# Run container without restart policy
docker run --rm -it \
  --env-file .env.docker.local \
  -v $(pwd)/wallet:/app/wallet:ro \
  -v $(pwd)/config:/app/config:ro \
  --network seed-network \
  seed-certification-api_api-gateway:latest \
  node src/server.js
```

### Step 3: Interactive Shell
```bash
# Enter container
docker exec -it seed-api-gateway-prod sh

# Inside container, test:
cd /app
ls -la
cat .env.docker.local  # Won't exist - vars loaded from docker-compose
env | grep NODE_ENV
node -e "console.log(process.env.REDIS_HOST)"
```

### Step 4: Check Network
```bash
# List networks
docker network ls

# Inspect network
docker network inspect seed-network

# Test connectivity between containers
docker exec seed-api-gateway-prod ping -c 3 redis
```

## 📋 Checklist

Sebelum start Docker, pastikan:

- [ ] `.env.docker.local` lengkap dengan **semua** variables
- [ ] `REDIS_HOST=redis` (service name)
- [ ] `KEYCLOAK_URL=http://host.docker.internal:6080`
- [ ] `IPFS_API_URL=http://host.docker.internal:9094`
- [ ] Keycloak running dan accessible
- [ ] IPFS running dan accessible
- [ ] Fabric network accessible
- [ ] `wallet/` directory exists dan ada isinya
- [ ] `config/connection-profile.json` exists
- [ ] Port 3001, 6379 tidak bentrok

## 🚀 Quick Fix Commands

```bash
# 1. Stop everything
docker-compose -f docker-compose.prod.yml down

# 2. Clean rebuild
docker-compose -f docker-compose.prod.yml build --no-cache

# 3. Start and watch logs
docker-compose -f docker-compose.prod.yml up

# 4. If still failing, check logs
docker logs seed-api-gateway-prod --tail 100

# 5. Check specific error
docker logs seed-api-gateway-prod 2>&1 | grep -i "error\|fail\|exception"
```

## 💡 Pro Tips

1. **Gunakan `test-docker.sh`** untuk systematic testing
2. **Jangan gunakan `-d`** saat debugging - lihat logs langsung
3. **Check Redis dulu** - pastikan healthy sebelum start api-gateway
4. **Compare .env files** - pastikan variables sama (kecuali host)
5. **Rebuild with --no-cache** jika ada perubahan dependencies

## 📝 Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| `ECONNREFUSED ::1:6379` | Redis host salah | Set `REDIS_HOST=redis` |
| `getaddrinfo ENOTFOUND localhost` | Using localhost di Docker | Ganti dengan `host.docker.internal` |
| `Wallet not found` | Volume mount gagal | Check volume path & permissions |
| `Cannot find module` | Build issue | Rebuild dengan `--no-cache` |
| `Port already in use` | Port conflict | Stop conflicting service |

---

**Next Steps:**
1. Jalankan `./scripts/test-docker.sh`
2. Lihat logs yang muncul
3. Share error message spesifik jika masih gagal
