# Deploy Frontend ke VPS dengan Nginx Native + Docker

## Arsitektur Setup

```
Internet → Nginx Native (Port 80/443) → Docker Container (Port 3002)
                ↓
            SSL/HTTPS
         (Certbot/Let's Encrypt)
```

Nginx native menangani:

- ✅ SSL/HTTPS termination
- ✅ Reverse proxy ke container
- ✅ Routing multi domain/subdomain
- ✅ SSL certificate management (Certbot)

Docker container menangani:

- ✅ Serve static files Vue.js
- ✅ SPA routing
- ✅ HTTP only (internal)

## Prerequisites

- VPS dengan Ubuntu/Debian
- Docker & Docker Compose installed
- Nginx installed (`sudo apt install nginx`)
- Domain DNS sudah pointing: `seed-cert.jabarchain.me` → IP VPS
- Port 80 dan 443 terbuka di firewall

## Step-by-Step Deployment

### 1. Setup Nginx Native Configuration

```bash
# Di VPS, buat konfigurasi Nginx untuk frontend
sudo nano /etc/nginx/sites-available/seed-cert
```

Copy isi dari file `nginx-seed-cert.conf` di repository ini, atau:

```nginx
server {
    listen 80;
    server_name seed-cert.jabarchain.me;

    location / {
        proxy_pass http://localhost:3002;
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

Enable konfigurasi:

```bash
# Symlink ke sites-enabled
sudo ln -s /etc/nginx/sites-available/seed-cert /etc/nginx/sites-enabled/

# Test konfigurasi
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 2. Setup SSL dengan Certbot

```bash
# Install Certbot (jika belum)
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# Generate SSL certificate untuk seed-cert.jabarchain.me
sudo certbot --nginx -d seed-cert.jabarchain.me

# Follow prompts:
# - Enter email untuk renewal notifications
# - Agree to terms
# - Choose option 2: Redirect HTTP to HTTPS
```

Certbot akan otomatis:

- Generate SSL certificate dari Let's Encrypt
- Update Nginx config dengan HTTPS
- Setup auto-renewal

### 3. Deploy Docker Container

```bash
# Clone repository atau upload files ke VPS
cd /root/tesis_bismillah/frontend  # atau path lain

# Build dan start container
docker-compose up -d

# Verify container running
docker ps | grep seed-frontend

# Check logs
docker-compose logs -f
```

### 4. Verify Deployment

```bash
# Test dari VPS
curl -I http://localhost:3002  # Should return 200 OK
curl -I https://seed-cert.jabarchain.me  # Should return 200 OK

# Test dari browser
# https://seed-cert.jabarchain.me
```

## Struktur File di VPS

```
/root/tesis_bismillah/frontend/
├── docker-compose.yml       # Container config (port 3002)
├── Dockerfile              # Build image
├── nginx.conf              # Nginx di dalam container
├── package.json
├── src/
└── public/

/etc/nginx/
├── sites-available/
│   ├── jabarchain          # Existing: gateway, auth, ipfs, blockchain-tls
│   └── seed-cert           # New: frontend
└── sites-enabled/
    ├── jabarchain → ../sites-available/jabarchain
    └── seed-cert → ../sites-available/seed-cert
```

## Update/Rebuild Application

```bash
cd /root/tesis_bismillah/frontend

# Pull latest code
git pull origin main

# Rebuild container
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check logs
docker-compose logs -f
```

## SSL Certificate Renewal

Certbot auto-renewal sudah di-setup. Verify:

```bash
# Check renewal timer
sudo systemctl status certbot.timer

# Test renewal (dry-run)
sudo certbot renew --dry-run

# Manual renewal (jika diperlukan)
sudo certbot renew
sudo systemctl reload nginx
```

Certificate akan auto-renew sebelum expire (90 hari).

## Monitoring & Logs

### Nginx Logs

```bash
# Access log
sudo tail -f /var/log/nginx/access.log

# Error log
sudo tail -f /var/log/nginx/error.log
```

### Docker Container Logs

```bash
# Frontend container
docker-compose logs -f frontend

# Exec into container
docker exec -it seed-frontend sh

# Check Nginx inside container
docker exec seed-frontend nginx -t
```

## Troubleshooting

### Port 3002 sudah dipakai

```bash
# Check what's using port 3002
sudo lsof -i :3002

# Change port di docker-compose.yml jika perlu
ports:
  - "3003:80"  # Ubah ke port lain

# Update juga di /etc/nginx/sites-available/seed-cert
proxy_pass http://localhost:3003;
```

### Container tidak start

```bash
# Check logs
docker-compose logs

# Rebuild
docker-compose build --no-cache
docker-compose up -d
```

### 502 Bad Gateway

Kemungkinan:

1. Container tidak running: `docker ps`
2. Port mismatch antara Nginx config dan docker-compose
3. Firewall blocking internal port

```bash
# Verify container
docker ps | grep seed-frontend

# Test internal port
curl http://localhost:3002

# Check Nginx config
sudo nginx -t
```

### SSL Certificate Error

```bash
# Check certificate
sudo certbot certificates

# Renew certificate
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

## Multiple Domain/Subdomain

Untuk menambah domain lain, tambahkan di Nginx config:

```nginx
server {
    listen 80;
    server_name seed-cert.jabarchain.me www.seed-cert.jabarchain.me;
    # ...
}
```

Kemudian generate SSL untuk multiple domains:

```bash
sudo certbot --nginx -d seed-cert.jabarchain.me -d www.seed-cert.jabarchain.me
```

## Integrasi dengan Backend

Jika backend sudah ada, update di container atau Nginx:

**Opsi 1: Proxy dari Nginx native**

```nginx
# Di /etc/nginx/sites-available/seed-cert
location /api {
    proxy_pass http://localhost:3001;  # Backend port
    # ... proxy headers
}

location / {
    proxy_pass http://localhost:3002;  # Frontend port
    # ... proxy headers
}
```

**Opsi 2: CORS di backend**

Frontend call langsung ke `https://gateway.jabarchain.me/api/...`

## Security Checklist

- [x] SSL/HTTPS enabled
- [x] Auto-renewal setup
- [x] Firewall configured (UFW/iptables)
- [x] Nginx security headers
- [x] Docker container non-root user
- [x] Regular updates (apt update, docker images)
- [ ] Backup strategy
- [ ] Monitoring setup
- [ ] Log rotation configured

## Performance Optimization

### Nginx Caching

```nginx
# Add to /etc/nginx/sites-available/seed-cert
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    proxy_pass http://localhost:3002;
    proxy_cache_valid 200 1d;
    expires 1d;
    add_header Cache-Control "public";
}
```

### Gzip Compression

Already enabled in container Nginx config.

### CDN (Optional)

Consider using Cloudflare for:

- Global CDN
- DDoS protection
- Additional SSL
- Caching

## Backup & Recovery

```bash
# Backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
tar -czf frontend-backup-$DATE.tar.gz /root/tesis_bismillah/frontend
# Upload to S3, Google Drive, etc
```

## Support

Untuk issue atau pertanyaan, hubungi:

- DevOps team
- Repository issues

---

**Last Updated**: 14 Januari 2026
