# 🐳 Docker Deployment - Seed Certification API Gateway

Dokumentasi lengkap untuk deploy aplikasi menggunakan Docker dan Docker Compose.

## 📋 Prerequisites

### 1. Install Docker & Docker Compose

**Ubuntu/Debian:**
```bash
# Update packages
sudo apt update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose

# Verify installation
docker --version
docker-compose --version
```

**macOS:**
```bash
# Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop

# Verify installation
docker --version
docker-compose --version
```

### 2. Services yang Harus Running di Host

Pastikan services berikut running di host machine:

- **Hyperledger Fabric Network**
  - Channel: `benihchannel`
  - Chaincode: `benih-certification`
  - Ports: 7050, 7051, 9051

- **Keycloak**
  - URL: http://localhost:8080
  - Realm: `SeedCertificationRealm`
  - Client: `seed-api-gateway`

- **IPFS Cluster**
  - API: http://localhost:9094

## 🚀 Quick Start

### 1. Clone & Navigate

```bash
cd application
```

### 2. Setup dengan Script Otomatis

```bash
# Jalankan setup (wallet + environment)
./deploy.sh setup

# Edit .env.docker.local dengan Keycloak client secret
nano .env.docker.local

# Build dan start services
./deploy.sh start
```

### 3. Verifikasi

```bash
# Check health
curl http://localhost:3001/api/health

# View logs
./deploy.sh logs

# Check status
./deploy.sh status
```

## 📝 Manual Setup (Step by Step)

### Step 1: Setup Wallet

```bash
# Setup wallet dari blockchain network (menggunakan Node.js script)
npm run setup:wallet

# Atau jalankan script langsung
node scripts/setup-wallet.js

# Verifikasi wallet berhasil dibuat
ls -la wallet/appUser.id
```

**Output yang diharapkan:**
```
=========================================
Setting up Fabric Wallet
=========================================

📁 MSP Path: ../blockchain/network/organizations/...
💼 Wallet Path: ./wallet
✅ Certificate loaded
✅ Private key loaded
✅ Wallet created at: ./wallet
✅ Identity "appUser" added to wallet
✅ Wallet verification successful
   MSP ID: BPSBPBenihMSP
   Type: X.509

=========================================
✅ Wallet setup complete!
=========================================
```

# Verifikasi wallet
ls -la wallet/appUser/
```

### Step 2: Configure Environment

```bash
# Copy template
cp .env.docker .env.docker.local

# Edit konfigurasi
nano .env.docker.local
```

**Set nilai berikut:**

```env
# Dapatkan dari Keycloak Admin Console → Clients → seed-api-gateway → Credentials
KEYCLOAK_CLIENT_SECRET=your-actual-keycloak-client-secret

# Generate dengan: openssl rand -base64 32
SESSION_SECRET=your-strong-random-session-secret

# URL frontend Anda (atau * untuk development)
CORS_ORIGIN=http://localhost:3000
```

### Step 3: Build Docker Image

```bash
# Build dengan cache
docker-compose build

# Atau build tanpa cache (fresh build)
docker-compose build --no-cache
```

### Step 4: Start Services

```bash
# Start dengan environment file
docker-compose --env-file .env.docker.local up -d

# Lihat logs
docker-compose logs -f api-gateway

# Check status
docker-compose ps
```

### Step 5: Verify Health

```bash
# Wait beberapa detik untuk startup
sleep 15

# Check liveness
curl http://localhost:3001/api/health/liveness

# Check full health
curl http://localhost:3001/api/health | jq .
```

## 🛠️ Deploy Script Commands

Script `deploy.sh` menyediakan commands untuk mengelola deployment:

```bash
# Setup environment dan wallet
./deploy.sh setup

# Build Docker image
./deploy.sh build
./deploy.sh build --no-cache  # Fresh build

# Start semua services
./deploy.sh start

# Stop services
./deploy.sh stop

# Restart services
./deploy.sh restart

# Lihat status
./deploy.sh status

# Lihat logs
./deploy.sh logs              # Default: api-gateway
./deploy.sh logs redis        # Specific service

# Health check
./deploy.sh health

# Clean up (remove containers & volumes)
./deploy.sh clean
```

## 🔧 Docker Compose Commands

### Service Management

```bash
# Start services
docker-compose --env-file .env.docker.local up -d

# Stop services
docker-compose stop

# Restart specific service
docker-compose restart api-gateway

# Remove services
docker-compose down

# Remove with volumes
docker-compose down -v
```

### Logs & Monitoring

```bash
# View all logs
docker-compose logs

# Follow logs (real-time)
docker-compose logs -f api-gateway

# Last 100 lines
docker-compose logs --tail=100 api-gateway

# View resource usage
docker stats seed-api-gateway seed-redis
```

### Container Management

```bash
# List running containers
docker-compose ps

# Execute command in container
docker-compose exec api-gateway sh

# View environment variables
docker-compose exec api-gateway env

# Check files in container
docker-compose exec api-gateway ls -la /app/wallet
```

## 📊 Production Deployment

### 1. Use Production Compose File

```bash
# Deploy dengan production config
docker-compose -f docker-compose.prod.yml --env-file .env.docker.local up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 2. Setup Nginx Reverse Proxy

**Install Nginx:**
```bash
sudo apt update
sudo apt install nginx
```

**Copy configuration:**
```bash
sudo cp nginx.conf /etc/nginx/sites-available/seed-api
sudo ln -s /etc/nginx/sites-available/seed-api /etc/nginx/sites-enabled/

# Edit dengan domain Anda
sudo nano /etc/nginx/sites-enabled/seed-api

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 3. Setup SSL/TLS dengan Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate (ganti dengan domain Anda)
sudo certbot --nginx -d api.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run

# Auto-renewal cron sudah disetup otomatis oleh certbot
```

### 4. Configure Firewall

```bash
# UFW firewall
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable

# Check status
sudo ufw status
```

### 5. Setup systemd untuk Auto-start

Create service file: `/etc/systemd/system/seed-api.service`

```ini
[Unit]
Description=Seed Certification API Gateway
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/path/to/application
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml --env-file .env.docker.local up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Enable dan start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable seed-api
sudo systemctl start seed-api
sudo systemctl status seed-api
```

## 🔍 Troubleshooting

### Container tidak bisa connect ke host services

**Problem:** Container tidak bisa akses Fabric/Keycloak/IPFS di host

**Solution 1 - Gunakan host.docker.internal:**
```env
KEYCLOAK_URL=http://host.docker.internal:8080
IPFS_HOST=host.docker.internal
```

**Solution 2 - Linux: Gunakan Docker bridge IP:**
```bash
# Get Docker bridge IP
ip addr show docker0 | grep inet

# Use in .env (contoh: 172.17.0.1)
KEYCLOAK_URL=http://172.17.0.1:8080
IPFS_HOST=172.17.0.1
```

**Solution 3 - Use host network (not recommended for production):**
```yaml
# docker-compose.yml
services:
  api-gateway:
    network_mode: "host"
```

### Wallet permission denied

**Problem:** Container tidak bisa baca wallet files

**Solution:**
```bash
# Fix permissions
chmod 755 wallet
chmod 755 wallet/appUser
chmod 644 wallet/appUser/*.pem
chmod 600 wallet/appUser/*_sk

# Verify in container
docker-compose exec api-gateway ls -la /app/wallet/appUser/
```

### Health check failing

**Problem:** Health check terus fail

**Solution:**
```bash
# Check logs
docker-compose logs -f api-gateway

# Check if port accessible
docker-compose exec api-gateway wget -O- http://localhost:3001/api/health/liveness

# Check environment variables
docker-compose exec api-gateway env | grep -E "FABRIC|IPFS|KEYCLOAK|REDIS"

# Restart service
docker-compose restart api-gateway
```

### Redis connection error

**Problem:** Cannot connect to Redis

**Solution:**
```bash
# Check Redis is running
docker-compose ps redis

# Check Redis logs
docker-compose logs redis

# Test Redis connection
docker-compose exec redis redis-cli ping

# Restart Redis
docker-compose restart redis
```

### High memory usage

**Problem:** Container menggunakan terlalu banyak memory

**Solution:**

Add resource limits to `docker-compose.yml`:
```yaml
services:
  api-gateway:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1'
        reservations:
          memory: 512M
          cpus: '0.5'
```

### Logs menghabiskan disk space

**Problem:** Docker logs terlalu besar

**Solution:**

Add logging limits to `docker-compose.yml`:
```yaml
services:
  api-gateway:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

Atau clean logs:
```bash
# Truncate logs
sudo sh -c "truncate -s 0 /var/lib/docker/containers/*/*-json.log"

# Rotate logs
docker-compose logs --no-log-prefix > backup.log
docker-compose down && docker-compose up -d
```

## 📦 Backup & Restore

### Backup

```bash
# Backup wallet
tar czf wallet-backup-$(date +%Y%m%d).tar.gz wallet/

# Backup logs
tar czf logs-backup-$(date +%Y%m%d).tar.gz logs/

# Backup Redis data
docker run --rm -v application_redis-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/redis-backup-$(date +%Y%m%d).tar.gz -C /data .

# Backup environment
cp .env.docker.local .env.docker.local.backup
```

### Restore

```bash
# Restore wallet
tar xzf wallet-backup-YYYYMMDD.tar.gz

# Restore Redis data
docker run --rm -v application_redis-data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/redis-backup-YYYYMMDD.tar.gz -C /data

# Restore environment
cp .env.docker.local.backup .env.docker.local
```

## 🔐 Security Best Practices

### 1. Environment Variables

```bash
# Generate strong secrets
openssl rand -base64 32  # SESSION_SECRET

# Never commit .env files
echo ".env.docker.local" >> .gitignore

# Use Docker secrets in production (Swarm/Kubernetes)
```

### 2. Network Security

```yaml
# Bind to localhost only
ports:
  - "127.0.0.1:3001:3001"  # Only accessible from host
  - "127.0.0.1:6379:6379"

# Use internal network
networks:
  seed-network:
    internal: true  # No external access
```

### 3. Run as Non-root

Dockerfile sudah dikonfigurasi untuk run as non-root user (`nodejs:1001`).

### 4. Image Scanning

```bash
# Scan for vulnerabilities
docker scan seed-api-gateway

# Use Trivy for scanning
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image seed-api-gateway
```

### 5. Regular Updates

```bash
# Update base images
docker-compose pull

# Rebuild with latest
docker-compose build --no-cache

# Update dependencies
docker-compose exec api-gateway npm audit fix
```

## 📈 Monitoring

### Prometheus & Grafana (Optional)

Create `docker-compose.monitoring.yml`:

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    volumes:
      - grafana-data:/var/lib/grafana
```

### Log Aggregation

Use ELK Stack or Loki for centralized logging.

## 🎯 Performance Tuning

### 1. Redis Optimization

```yaml
redis:
  command: >
    redis-server
    --maxmemory 512mb
    --maxmemory-policy allkeys-lru
    --appendonly yes
    --appendfsync everysec
```

### 2. Node.js Optimization

```dockerfile
# In Dockerfile
ENV NODE_OPTIONS="--max-old-space-size=2048"
```

### 3. Nginx Caching (for static content)

```nginx
# Add to nginx.conf
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g;

location /api/health {
    proxy_cache api_cache;
    proxy_cache_valid 200 1m;
}
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)

## 🆘 Support

Untuk masalah atau pertanyaan:

1. Check logs: `./deploy.sh logs`
2. Check health: `./deploy.sh health`
3. Review troubleshooting section di atas
4. Check Docker logs: `docker logs seed-api-gateway`
