# Docker Setup untuk Frontend

## Prerequisites

- Docker
- Docker Compose

## Production Build

### Build dan Run dengan Docker Compose

```bash
# Build dan jalankan
docker-compose up -d

# Lihat logs
docker-compose logs -f

# Stop
docker-compose down
```

### Build dan Run dengan Docker (tanpa compose)

```bash
# Build image
docker build -t seed-frontend .

# Run container
docker run -d -p 3001:80 --name seed-frontend seed-frontend

# Lihat logs
docker logs -f seed-frontend

# Stop dan hapus container
docker stop seed-frontend
docker rm seed-frontend
```

Aplikasi akan berjalan di: http://localhost:3001

## Development Mode dengan Hot Reload

### Build dan Run Development

```bash
# Build dan jalankan
docker-compose -f docker-compose.dev.yml up -d

# Lihat logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop
docker-compose -f docker-compose.dev.yml down
```

Aplikasi development akan berjalan di: http://localhost:5173

## Struktur File Docker

- `Dockerfile` - Multi-stage build untuk production dengan Nginx
- `Dockerfile.dev` - Development mode dengan hot reload
- `docker-compose.yml` - Production setup
- `docker-compose.dev.yml` - Development setup
- `nginx.conf` - Konfigurasi Nginx untuk SPA routing
- `.dockerignore` - File yang diabaikan saat build

## Konfigurasi

### Port

- **Production**: 3001:80
- **Development**: 5173:5173

Anda bisa mengubah port di file `docker-compose.yml` atau `docker-compose.dev.yml`

### Network

Semua service menggunakan network `seed-network`. Jika ingin connect dengan backend atau service lain, pastikan menggunakan network yang sama.

### Environment Variables

Jika aplikasi memerlukan environment variables (seperti API URL), tambahkan di:

1. File `.env` di root project
2. Section `environment` di docker-compose.yml

Contoh:

```yaml
environment:
  - VITE_API_URL=http://backend:3000
  - VITE_APP_NAME=Seed Management
```

### Integrasi dengan Backend

Jika backend sudah ada di Docker, edit `docker-compose.yml` dan uncomment bagian:

- `depends_on` untuk menunggu backend start
- API proxy di `nginx.conf` untuk routing API

## Troubleshooting

### Container tidak start

```bash
# Cek logs
docker-compose logs

# Rebuild image
docker-compose build --no-cache
docker-compose up -d
```

### Port sudah digunakan

Ubah port di `docker-compose.yml`:

```yaml
ports:
  - "8080:80" # Ganti 3001 dengan port lain
```

### Changes tidak ter-reload di dev mode

Pastikan volume mapping sudah benar di `docker-compose.dev.yml`

## Clean Up

```bash
# Stop dan hapus containers
docker-compose down

# Hapus juga volumes (hati-hati!)
docker-compose down -v

# Hapus images
docker rmi seed-frontend
```

## Production Deployment

Untuk production deployment, pertimbangkan:

1. Menggunakan environment variables untuk konfigurasi
2. Setup SSL/TLS dengan reverse proxy (Nginx, Traefik, dll)
3. Implement proper logging dan monitoring
4. Setup health checks
5. Configure proper resource limits

Contoh dengan resource limits:

```yaml
services:
  frontend:
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 256M
```
