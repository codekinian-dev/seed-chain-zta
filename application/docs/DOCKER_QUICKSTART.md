# 🐳 Docker Deployment - Quick Reference

## ✅ Files Created

- `Dockerfile` - Multi-stage production-optimized image
- `docker-compose.yml` - Development deployment
- `docker-compose.prod.yml` - Production deployment dengan resource limits
- `.dockerignore` - Exclude files from build context
- `.env.docker` - Environment variables template
- `deploy.sh` - Automated deployment script
- `nginx.conf` - Nginx reverse proxy configuration
- `DOCKER_README.md` - Complete Docker documentation
- `DOCKER_GUIDE.md` - Detailed deployment guide

## 🚀 Quick Start

```bash
# 1. Setup (wallet + environment)
./deploy.sh setup

# 2. Edit .env.docker.local
nano .env.docker.local
# Set: KEYCLOAK_CLIENT_SECRET, SESSION_SECRET, CORS_ORIGIN

# 3. Start services
./deploy.sh start

# 4. Check health
curl http://localhost:3001/api/health
```

## 📋 Deploy Script Commands

```bash
./deploy.sh setup      # Setup wallet & environment
./deploy.sh build      # Build Docker image
./deploy.sh start      # Start all services
./deploy.sh stop       # Stop services
./deploy.sh restart    # Restart services
./deploy.sh status     # Show status
./deploy.sh logs       # View logs
./deploy.sh health     # Health check
./deploy.sh clean      # Clean up everything
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│           Nginx Reverse Proxy               │
│         (SSL/TLS, Rate Limiting)            │
└────────────────┬────────────────────────────┘
                 │ HTTPS
                 ▼
┌─────────────────────────────────────────────┐
│        API Gateway Container                │
│         (Express.js + Node.js)              │
│    - Keycloak Auth                          │
│    - IPFS Integration                       │
│    - Fabric Gateway                         │
└─────┬──────────────────────┬────────────────┘
      │                      │
      │ Queue Jobs           │ Data
      ▼                      ▼
┌────────────┐         ┌──────────────┐
│   Redis    │         │  Volumes     │
│ Container  │         │ - logs/      │
└────────────┘         │ - wallet/    │
                       └──────────────┘
                              │
                       External Services
                       ├─ Fabric Network (host)
                       ├─ Keycloak (host)
                       └─ IPFS Cluster (host)
```

## 🔧 Docker Compose

### Development

```bash
docker-compose --env-file .env.docker.local up -d
docker-compose logs -f api-gateway
```

### Production

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.docker.local up -d
docker-compose -f docker-compose.prod.yml logs -f
```

## 🌐 Nginx Setup (Production)

```bash
# Copy config
sudo cp nginx.conf /etc/nginx/sites-available/seed-api
sudo ln -s /etc/nginx/sites-available/seed-api /etc/nginx/sites-enabled/

# Edit domain
sudo nano /etc/nginx/sites-enabled/seed-api

# Test & reload
sudo nginx -t
sudo systemctl reload nginx

# SSL with Let's Encrypt
sudo certbot --nginx -d api.yourdomain.com
```

## 📊 Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| API Gateway | http://localhost:3001 | Main application |
| Health Check | http://localhost:3001/api/health | Service status |
| Redis | localhost:6379 | Queue backend |

## 🔐 Environment Variables

Required in `.env.docker.local`:

```env
# Keycloak (dari Admin Console)
KEYCLOAK_CLIENT_SECRET=your-client-secret

# Session (generate: openssl rand -base64 32)
SESSION_SECRET=your-random-secret

# CORS (frontend URL)
CORS_ORIGIN=http://localhost:3000
```

## 📦 Ports

| Port | Service | Bind |
|------|---------|------|
| 3001 | API Gateway | localhost (behind nginx) |
| 6379 | Redis | localhost only |
| 80 | Nginx HTTP | Public (redirect to HTTPS) |
| 443 | Nginx HTTPS | Public |

## 🔍 Troubleshooting

### Cannot connect to host services

```env
# Use host.docker.internal
KEYCLOAK_URL=http://host.docker.internal:8080
IPFS_HOST=host.docker.internal

# Or Linux: use docker bridge IP
KEYCLOAK_URL=http://172.17.0.1:8080
```

### Health check failing

```bash
# Check logs
docker-compose logs -f api-gateway

# Check connectivity
docker-compose exec api-gateway wget -O- http://localhost:3001/api/health/liveness

# Restart
docker-compose restart api-gateway
```

### Redis connection error

```bash
# Check Redis
docker-compose exec redis redis-cli ping

# Check logs
docker-compose logs redis
```

## 🛡️ Security Features

- ✅ Multi-stage build (optimized image size)
- ✅ Non-root user (nodejs:1001)
- ✅ Read-only wallet mount
- ✅ SSL/TLS encryption (Nginx)
- ✅ Rate limiting (Nginx + Express)
- ✅ Security headers (Helmet + Nginx)
- ✅ Health checks
- ✅ Resource limits
- ✅ Log rotation
- ✅ Isolated network

## 📈 Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `SESSION_SECRET`
- [ ] Configure specific `CORS_ORIGIN`
- [ ] Setup Nginx reverse proxy
- [ ] Obtain SSL certificate (Let's Encrypt)
- [ ] Configure firewall (UFW)
- [ ] Setup systemd auto-start
- [ ] Configure log rotation
- [ ] Setup monitoring (Prometheus/Grafana)
- [ ] Configure backups
- [ ] Scan images for vulnerabilities
- [ ] Test failover scenarios

## 🎯 Performance

### Resource Limits (Production)

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '1'
      memory: 1G
```

### Redis Optimization

```yaml
command: >
  redis-server
  --maxmemory 512mb
  --maxmemory-policy allkeys-lru
  --appendonly yes
```

## 📚 Documentation

- **DOCKER_README.md** - Complete deployment guide
- **DOCKER_GUIDE.md** - Troubleshooting & advanced topics
- **nginx.conf** - Reverse proxy configuration
- **deploy.sh** - Automated deployment script

## 🆘 Quick Commands

```bash
# View status
./deploy.sh status

# View logs
./deploy.sh logs

# Health check
curl http://localhost:3001/api/health | jq .

# Shell access
docker-compose exec api-gateway sh

# Check resources
docker stats seed-api-gateway seed-redis

# Backup wallet
tar czf wallet-backup.tar.gz wallet/

# Clean everything
./deploy.sh clean
```

## 🎉 Ready to Deploy!

Aplikasi sudah siap di-deploy dengan Docker. Ikuti Quick Start di atas untuk memulai.

Untuk dokumentasi lengkap, lihat **DOCKER_README.md**.
