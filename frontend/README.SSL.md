# Setup SSL/HTTPS untuk Frontend

## Prerequisites

- Domain: `seed-cert.jabarchain.me` sudah pointing ke IP server
- Port 80 dan 443 available
- Docker dan Docker Compose installed

## Quick Start - Generate SSL Certificate

### Metode 1: Certbot (Let's Encrypt) - Recommended untuk Production

```bash
cd /Users/rangga/playground/tesis_bismillah/frontend

# Edit email di setup-ssl.sh terlebih dahulu
nano setup-ssl.sh  # Ganti EMAIL="your-email@example.com"

# Run setup script
./setup-ssl.sh
```

Script akan memandu Anda memilih:

1. **Standalone** - Otomatis (perlu port 80 kosong)
2. **DNS Challenge** - Manual DNS verification (jika port 80 dipakai)
3. **Self-Signed** - Untuk testing local

### Metode 2: Manual Certbot

```bash
# Install certbot (jika belum)
brew install certbot  # macOS
# atau
sudo apt-get install certbot  # Ubuntu/Debian

# Generate certificate
sudo certbot certonly --standalone \
  -d seed-cert.jabarchain.me \
  --email your-email@example.com \
  --agree-tos

# Copy certificates
sudo cp /etc/letsencrypt/live/seed-cert.jabarchain.me/fullchain.pem ./ssl/
sudo cp /etc/letsencrypt/live/seed-cert.jabarchain.me/privkey.pem ./ssl/
sudo chmod 644 ./ssl/*.pem
```

### Metode 3: Self-Signed Certificate (Testing Only)

```bash
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/privkey.pem \
  -out ssl/fullchain.pem \
  -subj "/C=ID/ST=West Java/L=Bandung/O=Seed Certification/CN=seed-cert.jabarchain.me"
```

⚠️ **Warning**: Self-signed certificates akan menampilkan warning di browser!

## Jalankan dengan HTTPS

```bash
# Build dan start
docker-compose up -d

# Cek logs
docker-compose logs -f

# Verify SSL
curl -I https://seed-cert.jabarchain.me
```

## Akses Aplikasi

- **HTTPS** (Production): https://seed-cert.jabarchain.me
- **HTTP** (akan redirect ke HTTPS): http://seed-cert.jabarchain.me
- **Localhost** (Testing): http://localhost

## Struktur File SSL

```
frontend/
├── ssl/
│   ├── fullchain.pem    # SSL certificate
│   ├── privkey.pem      # Private key
│   └── .gitkeep
├── nginx.conf           # Config dengan HTTPS enabled
├── docker-compose.yml   # Mount SSL certs
└── setup-ssl.sh         # Helper script
```

## Nginx Configuration

Konfigurasi sudah include:

✅ HTTP → HTTPS redirect  
✅ TLS 1.2 & 1.3  
✅ Strong SSL ciphers  
✅ HSTS header  
✅ Security headers  
✅ Gzip compression  
✅ SPA routing

## Renewal SSL Certificate

Let's Encrypt certificates berlaku 90 hari. Setup auto-renewal:

### Crontab (Recommended)

```bash
# Edit crontab
crontab -e

# Add line untuk check renewal setiap hari jam 2 pagi
0 2 * * * certbot renew --quiet && docker-compose -f /path/to/frontend/docker-compose.yml restart
```

### Manual Renewal

```bash
# Check if renewal needed
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew --force-renewal

# Copy new certs
sudo cp /etc/letsencrypt/live/seed-cert.jabarchain.me/fullchain.pem ./ssl/
sudo cp /etc/letsencrypt/live/seed-cert.jabarchain.me/privkey.pem ./ssl/

# Restart container
docker-compose restart
```

## Troubleshooting

### Port 80/443 already in use

```bash
# Check what's using the ports
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting services
sudo systemctl stop nginx  # if native nginx running
```

### Certificate verification failed

```bash
# Verify certificate validity
openssl x509 -in ssl/fullchain.pem -text -noout

# Check certificate chain
openssl s_client -connect seed-cert.jabarchain.me:443 -showcerts
```

### Browser shows SSL error

Kemungkinan penyebab:

1. Self-signed certificate (normal untuk testing)
2. Domain tidak match dengan certificate
3. Certificate expired
4. Missing intermediate certificates

### DNS not resolving

```bash
# Check DNS
nslookup seed-cert.jabarchain.me
dig seed-cert.jabarchain.me

# Test from server
curl -I https://seed-cert.jabarchain.me
```

## Security Best Practices

1. ✅ Gunakan Let's Encrypt untuk production
2. ✅ Enable HSTS header (sudah di config)
3. ✅ Update certificates sebelum expire
4. ✅ Jangan commit private key ke git (sudah di .gitignore)
5. ✅ Set proper file permissions (644 untuk cert, 600 untuk key)
6. ✅ Monitor certificate expiry
7. ✅ Use strong SSL ciphers (sudah di config)

## Production Deployment Checklist

- [ ] Domain DNS sudah pointing ke server
- [ ] Port 80 dan 443 terbuka di firewall
- [ ] SSL certificate ter-generate (Let's Encrypt)
- [ ] Email untuk renewal notifications
- [ ] Auto-renewal setup (cron)
- [ ] Backup certificates
- [ ] Test HTTPS connection
- [ ] Verify redirect HTTP → HTTPS
- [ ] Check SSL rating: https://www.ssllabs.com/ssltest/

## Monitoring

### Check Certificate Expiry

```bash
# Check expiry date
openssl x509 -in ssl/fullchain.pem -noout -dates

# Check remaining days
openssl x509 -in ssl/fullchain.pem -noout -enddate | cut -d= -f2 | xargs -I {} date -d {} +%s | awk '{print ($1 - systime()) / 86400}'
```

### SSL Health Check

```bash
# Test SSL configuration
curl -vI https://seed-cert.jabarchain.me 2>&1 | grep -i ssl

# Check certificate chain
openssl s_client -connect seed-cert.jabarchain.me:443 -servername seed-cert.jabarchain.me < /dev/null | openssl x509 -noout -dates
```

## Container Logs

```bash
# Watch nginx logs
docker-compose logs -f frontend

# Check access logs
docker exec seed-frontend tail -f /var/log/nginx/access.log

# Check error logs
docker exec seed-frontend tail -f /var/log/nginx/error.log
```

## Support

Untuk pertanyaan atau issue terkait SSL setup, silakan hubungi tim DevOps atau buka issue di repository.
