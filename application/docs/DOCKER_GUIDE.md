# Docker Deployment Guide

## Prerequisites

Sebelum menjalankan aplikasi dengan Docker, pastikan:

1. **Docker & Docker Compose terinstall**
   ```bash
   docker --version
   docker-compose --version
   ```

2. **Layanan eksternal berjalan di host machine:**
   - Hyperledger Fabric Network (port 7050, 7051, 9051)
   - Keycloak (port 8080)
   - IPFS Cluster (port 9094)

3. **Wallet sudah di-setup:**
   ```bash
   npm run setup:wallet
   # atau
   ./scripts/copy-wallet.sh
   ```

## Setup Environment Variables

1. **Copy file environment untuk Docker:**
   ```bash
   cp .env.docker .env.docker.local
   ```

2. **Edit `.env.docker.local` dengan konfigurasi Anda:**
   ```bash
   nano .env.docker.local
   ```

3. **Set nilai berikut:**
   ```env
   # Dapatkan dari Keycloak Admin Console
   KEYCLOAK_CLIENT_SECRET=your-actual-client-secret
   
   # Generate secret yang kuat
   SESSION_SECRET=$(openssl rand -base64 32)
   
   # Set CORS origin (URL frontend Anda)
   CORS_ORIGIN=http://localhost:3000
   ```

## Build Docker Image

```bash
# Build image
docker-compose build

# Atau build dengan no-cache untuk rebuild penuh
docker-compose build --no-cache
```

## Run Application

### 1. Start dengan Docker Compose

```bash
# Start semua services (API Gateway + Redis)
docker-compose --env-file .env.docker.local up -d

# Lihat logs
docker-compose logs -f api-gateway

# Lihat status
docker-compose ps
```

### 2. Verifikasi Services Running

```bash
# Check Redis
docker-compose exec redis redis-cli ping
# Expected: PONG

# Check API Gateway health
curl http://localhost:3001/api/health
```

### 3. Stop Services

```bash
# Stop dan remove containers
docker-compose down

# Stop, remove containers dan volumes
docker-compose down -v
```

## Docker Commands

### Service Management

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose stop

# Restart services
docker-compose restart

# View logs
docker-compose logs -f [service-name]

# View logs for specific service
docker-compose logs -f api-gateway
docker-compose logs -f redis
```

### Container Inspection

```bash
# Execute command in container
docker-compose exec api-gateway sh

# Check environment variables
docker-compose exec api-gateway env

# Check files in container
docker-compose exec api-gateway ls -la /app/wallet
```

### Debugging

```bash
# View real-time logs
docker-compose logs -f --tail=100 api-gateway

# Check container health
docker inspect seed-api-gateway --format='{{json .State.Health}}'

# Check resource usage
docker stats seed-api-gateway

# View container processes
docker-compose top api-gateway
```

## Production Deployment

### 1. Update docker-compose.yml untuk Production

Buat `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redis-data:/data
    networks:
      - seed-network

  api-gateway:
    build:
      context: .
      dockerfile: Dockerfile
    restart: always
    env_file:
      - .env.docker.local
    volumes:
      - ./wallet:/app/wallet:ro
      - ./logs:/app/logs
      - ./config/connection-profile.json:/app/config/connection-profile.json:ro
    networks:
      - seed-network
    depends_on:
      - redis

volumes:
  redis-data:

networks:
  seed-network:
```

### 2. Deploy dengan Production Config

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Setup Reverse Proxy (Nginx)

Contoh konfigurasi Nginx:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. Setup SSL/TLS (Let's Encrypt)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

## Troubleshooting

### Issue: Container tidak bisa akses Fabric/Keycloak/IPFS di host

**Solution:**

1. Pastikan menggunakan `host.docker.internal` di environment variables:
   ```env
   KEYCLOAK_URL=http://host.docker.internal:8080
   IPFS_HOST=host.docker.internal
   ```

2. Untuk Linux, tambahkan ke docker-compose.yml:
   ```yaml
   extra_hosts:
     - "host.docker.internal:172.17.0.1"
   ```

3. Atau gunakan IP address host langsung:
   ```bash
   # Get host IP
   ip addr show docker0 | grep inet
   
   # Use in .env
   KEYCLOAK_URL=http://172.17.0.1:8080
   ```

### Issue: Wallet tidak ditemukan

**Solution:**

```bash
# Verify wallet exists on host
ls -la wallet/appUser/

# Copy wallet if missing
npm run setup:wallet

# Verify mount in container
docker-compose exec api-gateway ls -la /app/wallet/appUser/
```

### Issue: Redis connection failed

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

### Issue: Health check failing

**Solution:**

```bash
# Check application logs
docker-compose logs -f api-gateway

# Check if services are accessible
docker-compose exec api-gateway wget -O- http://localhost:3001/api/health/liveness

# Verify environment variables
docker-compose exec api-gateway env | grep FABRIC
docker-compose exec api-gateway env | grep IPFS
docker-compose exec api-gateway env | grep KEYCLOAK
```

### Issue: Permission denied on logs/uploads

**Solution:**

```bash
# Fix permissions on host
chmod 755 logs uploads
chown -R 1001:1001 logs uploads

# Or in Dockerfile, ensure directories are created with correct permissions
```

## Volume Management

### Backup Volumes

```bash
# Backup Redis data
docker run --rm -v application_redis-data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz -C /data .

# Backup logs
tar czf logs-backup.tar.gz logs/
```

### Restore Volumes

```bash
# Restore Redis data
docker run --rm -v application_redis-data:/data -v $(pwd):/backup alpine tar xzf /backup/redis-backup.tar.gz -C /data
```

### Clean Volumes

```bash
# Remove all volumes
docker-compose down -v

# Remove unused volumes
docker volume prune
```

## Monitoring & Logging

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service with tail
docker-compose logs -f --tail=100 api-gateway

# Export logs to file
docker-compose logs api-gateway > app.log
```

### Monitor Resources

```bash
# Real-time stats
docker stats seed-api-gateway seed-redis

# Container details
docker inspect seed-api-gateway
```

### Log Rotation

Logs dalam container akan di-rotate oleh Winston. Untuk logs Docker:

```bash
# Add to docker-compose.yml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## Performance Tuning

### Limit Resources

```yaml
# Add to docker-compose.yml
services:
  api-gateway:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### Redis Optimization

```yaml
redis:
  command: >
    redis-server
    --maxmemory 256mb
    --maxmemory-policy allkeys-lru
    --appendonly yes
```

## Security Checklist untuk Production

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `SESSION_SECRET`
- [ ] Konfigurasi `CORS_ORIGIN` yang spesifik
- [ ] Enable HTTPS/TLS
- [ ] Update Keycloak client secret secara berkala
- [ ] Limit resource usage (CPU, Memory)
- [ ] Setup log rotation
- [ ] Enable Docker Content Trust
- [ ] Scan images untuk vulnerabilities: `docker scan seed-api-gateway`
- [ ] Run as non-root user (sudah dikonfigurasi)
- [ ] Use secrets management (Docker Secrets atau Kubernetes Secrets)
- [ ] Setup firewall rules
- [ ] Enable audit logging
- [ ] Regular security updates

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Deploy

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build Docker image
        run: docker build -t seed-api-gateway .
      
      - name: Run tests
        run: docker run seed-api-gateway npm test
      
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker tag seed-api-gateway your-registry/seed-api-gateway:latest
          docker push your-registry/seed-api-gateway:latest
```

## Kubernetes Deployment (Future)

Untuk deploy ke Kubernetes, Anda bisa convert docker-compose ke Kubernetes manifests:

```bash
# Install kompose
curl -L https://github.com/kubernetes/kompose/releases/download/v1.28.0/kompose-linux-amd64 -o kompose
chmod +x kompose
sudo mv kompose /usr/local/bin/

# Convert
kompose convert
```

Ini akan generate deployment.yaml, service.yaml, dll.

## Quick Reference

```bash
# Start
docker-compose --env-file .env.docker.local up -d

# Stop
docker-compose down

# Rebuild
docker-compose build --no-cache

# View logs
docker-compose logs -f api-gateway

# Health check
curl http://localhost:3001/api/health

# Shell access
docker-compose exec api-gateway sh

# Clean everything
docker-compose down -v
docker system prune -a
```
