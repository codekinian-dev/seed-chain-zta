# VPS Deployment Guide - Seed API Gateway

## Quick Start

Jika container gateway Anda terus restart di VPS, ikuti langkah-langkah berikut:

### 🚨 Langkah Cepat Troubleshooting

```bash
# 1. Lihat logs untuk menemukan error
docker logs seed-api-gateway-prod --tail 100

# 2. Jalankan diagnostic tool
chmod +x scripts/vps-diagnose.sh
./scripts/vps-diagnose.sh

# 3. Restart dengan logs visible
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up
```

---

## Persiapan VPS

### 1. Instalasi Docker (jika belum)

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout dan login kembali untuk apply group changes
```

### 2. Clone Repository

```bash
cd /home/yourusername
git clone <your-repo-url>
cd application
```

### 3. Setup Environment

**Opsi A: Automatic Setup (Recommended)**
```bash
chmod +x scripts/vps-setup.sh
./scripts/vps-setup.sh
```

**Opsi B: Manual Setup**
```bash
# Copy template
cp .env.docker.template .env.docker.local

# Edit dengan text editor
nano .env.docker.local

# Ganti semua:
# - YOUR_VPS_IP dengan IP VPS Anda
# - REPLACE_WITH_YOUR_KEYCLOAK_CLIENT_SECRET dengan secret Keycloak
# - REPLACE_WITH_YOUR_SESSION_SECRET dengan random string

# Generate secrets:
openssl rand -hex 32  # untuk KEYCLOAK_CLIENT_SECRET
openssl rand -base64 32  # untuk SESSION_SECRET
```

---

## Deployment

### Deploy Aplikasi

```bash
# Build dan start semua services
docker-compose -f docker-compose.prod.yml up -d --build

# Monitor logs
docker-compose -f docker-compose.prod.yml logs -f

# Check status
docker-compose -f docker-compose.prod.yml ps
```

### Verify Deployment

```bash
# Test health endpoint
curl http://localhost:3001/api/health/liveness

# Expected response:
# {"status":"healthy","timestamp":"...","services":{...}}
```

---

## Masalah Umum & Solusi

### 1. Container Terus Restart

**Diagnosis:**
```bash
# Lihat mengapa container exit
docker logs seed-api-gateway-prod --tail 50

# Check exit code
docker inspect seed-api-gateway-prod | grep -A 5 "State"
```

**Kemungkinan Penyebab:**

#### A. Keycloak Tidak Tersedia
```bash
# Test koneksi ke Keycloak
curl http://YOUR_VPS_IP:8080

# Jika gagal, pastikan Keycloak running:
# - Check firewall: sudo ufw allow 8080
# - Check service: sudo systemctl status keycloak
```

**Solusi:** Edit `.env.docker.local`, pastikan `KEYCLOAK_URL` benar

#### B. Fabric Network Tidak Dapat Diakses
```bash
# Check crypto-config
ls -la crypto-config/

# Check wallet
ls -la wallet/

# Check connection profile
cat config/connection-profile.json
```

**Solusi:** Pastikan:
- `FABRIC_AS_LOCALHOST=false` di `.env.docker.local`
- Connection profile menggunakan IP/domain VPS, bukan `localhost`
- TLS certificates valid dan tidak expired

#### C. host.docker.internal Tidak Tersedia
Pada Linux, `host.docker.internal` tidak otomatis tersedia.

**Solusi:** Sudah ditambahkan di `docker-compose.prod.yml`:
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

Atau ganti semua referensi `host.docker.internal` dengan IP VPS aktual.

#### D. Permission Denied
```bash
# Fix permissions
sudo chown -R $USER:$USER wallet crypto-config logs uploads
chmod -R 755 wallet crypto-config
chmod -R 777 logs uploads
```

#### E. Port Conflict
```bash
# Check port yang digunakan
sudo lsof -i :3001
sudo lsof -i :6379

# Jika ada conflict, stop service yang menggunakan port tersebut
```

### 2. Health Check Fail

Jika health check terus gagal, increase timeout:

Edit `docker-compose.prod.yml`:
```yaml
healthcheck:
  start_period: 180s  # Naikkan dari 120s
  retries: 10         # Naikkan dari 5
```

### 3. Memory Issues

```bash
# Check memory usage
docker stats

# Jika memory tinggi, turunkan limit:
# Edit docker-compose.prod.yml
deploy:
  resources:
    limits:
      memory: 1G  # Turunkan dari 2G
```

### 4. Redis Connection Error

```bash
# Check Redis
docker exec -it seed-redis-prod redis-cli ping
# Should return: PONG

# If Redis has issues, restart it
docker-compose -f docker-compose.prod.yml restart redis
```

---

## Monitoring

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker logs -f seed-api-gateway-prod
docker logs -f seed-redis-prod

# Application logs (inside container)
docker exec seed-api-gateway-prod tail -f logs/combined*.log
docker exec seed-api-gateway-prod tail -f logs/error*.log
```

### Check Resource Usage

```bash
# Real-time stats
docker stats

# Disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

### Health Status

```bash
# Container health
docker inspect seed-api-gateway-prod | grep -A 20 '"Health"'

# Service endpoints
curl http://localhost:3001/api/health/liveness
curl http://localhost:3001/api/health/readiness
```

---

## Maintenance

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and redeploy
docker-compose -f docker-compose.prod.yml up -d --build

# Check logs
docker-compose -f docker-compose.prod.yml logs -f api-gateway
```

### Backup Data

```bash
# Backup wallet
tar -czf wallet-backup-$(date +%Y%m%d).tar.gz wallet/

# Backup Redis data
docker exec seed-redis-prod redis-cli save
docker cp seed-redis-prod:/data/dump.rdb redis-backup-$(date +%Y%m%d).rdb

# Backup logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/
```

### Clean Logs

```bash
# Manual cleanup
find logs/ -name "*.log.*" -mtime +7 -delete

# Or use logrotate (recommended)
sudo apt-get install logrotate
# Then configure logrotate for your logs
```

---

## Security Checklist

- [ ] Change default secrets in `.env.docker.local`
- [ ] Use HTTPS in production (setup nginx reverse proxy)
- [ ] Restrict `CORS_ORIGIN` to specific domains
- [ ] Setup firewall rules:
  ```bash
  sudo ufw enable
  sudo ufw allow 22        # SSH
  sudo ufw allow 80        # HTTP
  sudo ufw allow 443       # HTTPS
  sudo ufw allow 3001/tcp  # API (or block if behind nginx)
  ```
- [ ] Enable Docker logging limits (already configured)
- [ ] Regular security updates:
  ```bash
  sudo apt update && sudo apt upgrade -y
  ```
- [ ] Monitor logs for suspicious activity
- [ ] Backup regularly

---

## Nginx Reverse Proxy (Recommended)

Untuk production, gunakan Nginx sebagai reverse proxy:

```nginx
# /etc/nginx/sites-available/seed-api
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable dan restart:
```bash
sudo ln -s /etc/nginx/sites-available/seed-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Performance Tuning

### For High Traffic

Edit `docker-compose.prod.yml`:

```yaml
api-gateway:
  deploy:
    resources:
      limits:
        cpus: '4'
        memory: 4G
      reservations:
        cpus: '2'
        memory: 2G
  environment:
    - RATE_LIMIT_MAX=1000  # Increase if needed
```

### Redis Optimization

```yaml
redis:
  command: >
    redis-server 
    --appendonly yes 
    --maxmemory 1gb 
    --maxmemory-policy allkeys-lru
    --save 900 1
    --save 300 10
```

---

## Troubleshooting Tools

```bash
# Run full diagnostic
./scripts/vps-diagnose.sh

# Interactive shell in container
docker exec -it seed-api-gateway-prod sh

# Check environment variables
docker exec seed-api-gateway-prod env

# Test network from container
docker exec seed-api-gateway-prod ping -c 3 host.docker.internal
docker exec seed-api-gateway-prod wget -O- http://localhost:3001/api/health/liveness

# Check file system
docker exec seed-api-gateway-prod ls -la /app/wallet
docker exec seed-api-gateway-prod ls -la /app/crypto-config
```

---

## Support

Jika masih mengalami masalah, kumpulkan informasi berikut:

```bash
# Generate diagnostic report
./scripts/vps-diagnose.sh

# Collect logs
docker-compose -f docker-compose.prod.yml logs > full-logs.txt

# System info
uname -a > system-info.txt
docker info >> system-info.txt
free -h >> system-info.txt
df -h >> system-info.txt
```

Kemudian share file diagnostic report dan logs untuk analisis lebih lanjut.
