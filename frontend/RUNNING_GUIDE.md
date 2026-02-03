# 📘 Panduan Lengkap Running Frontend SeedCertify

Dokumentasi lengkap cara menjalankan frontend SeedCertify untuk development dan production.

---

## 📋 Daftar Isi

1. [Prerequisites](#prerequisites)
2. [Quick Start (Lokal)](#quick-start-lokal)
3. [Development dengan Docker](#development-dengan-docker)
4. [Production dengan Docker](#production-dengan-docker)
5. [Setup SSL/HTTPS](#setup-sslhttps)
6. [Konfigurasi Environment](#konfigurasi-environment)
7. [Troubleshooting](#troubleshooting)
8. [Ringkasan Perintah](#ringkasan-perintah)

---

## Prerequisites

### Untuk Development Lokal

- **Node.js** versi 20.x atau lebih baru
- **npm** (terinstall bersama Node.js)

### Untuk Docker

- **Docker** versi 20.x atau lebih baru
- **Docker Compose** versi 2.x atau lebih baru

### Cek Versi

```bash
# Cek Node.js
node --version

# Cek npm
npm --version

# Cek Docker
docker --version

# Cek Docker Compose
docker compose version
```

---

## Quick Start (Lokal)

### Langkah 1: Masuk ke Direktori Frontend

```bash
cd /Users/rangga/playground/tesis_bismillah/frontend
```

### Langkah 2: Install Dependencies

```bash
npm install
```

### Langkah 3: Jalankan Development Server

```bash
npm run dev
```

### Langkah 4: Buka Browser

Buka browser ke URL: **http://localhost:5173**

### ⚡ One-Liner

```bash
cd /Users/rangga/playground/tesis_bismillah/frontend && npm install && npm run dev
```

---

## Development dengan Docker

Development mode menggunakan **hot reload** - perubahan kode otomatis di-refresh di browser.

### Langkah 1: Masuk ke Direktori Frontend

```bash
cd /Users/rangga/playground/tesis_bismillah/frontend
```

### Langkah 2: Build dan Jalankan

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Langkah 3: Lihat Logs (Optional)

```bash
docker compose -f docker-compose.dev.yml logs -f
```

### Langkah 4: Buka Browser

Buka browser ke URL: **http://localhost:5173**

### Langkah 5: Stop Container

```bash
docker compose -f docker-compose.dev.yml down
```

### ⚡ One-Liner Development

```bash
cd /Users/rangga/playground/tesis_bismillah/frontend && docker compose -f docker-compose.dev.yml up -d && docker compose -f docker-compose.dev.yml logs -f
```

---

## Production dengan Docker

Production mode menggunakan **Nginx** sebagai web server untuk performa optimal.

### Langkah 1: Masuk ke Direktori Frontend

```bash
cd /Users/rangga/playground/tesis_bismillah/frontend
```

### Langkah 2: Build dan Jalankan

```bash
docker compose up -d
```

### Langkah 3: Lihat Logs (Optional)

```bash
docker compose logs -f
```

### Langkah 4: Buka Browser

Buka browser ke URL: **http://localhost:3002**

### Langkah 5: Stop Container

```bash
docker compose down
```

### Build Ulang (Jika Ada Perubahan Kode)

```bash
docker compose up -d --build
```

### ⚡ One-Liner Production

```bash
cd /Users/rangga/playground/tesis_bismillah/frontend && docker compose up -d --build && docker compose logs -f
```

---

## Setup SSL/HTTPS

Untuk production dengan HTTPS menggunakan domain `seed-cert.jabarchain.me`:

### Quick Setup dengan Script

```bash
cd /Users/rangga/playground/tesis_bismillah/frontend

# Edit email terlebih dahulu
nano setup-ssl.sh  # Ganti EMAIL="your-email@example.com"

# Jalankan script
./setup-ssl.sh
```

### Manual dengan Let's Encrypt

```bash
# Install certbot
brew install certbot  # macOS
# atau
sudo apt-get install certbot  # Ubuntu/Debian

# Generate certificate
sudo certbot certonly --standalone \
  -d seed-cert.jabarchain.me \
  --email your-email@example.com \
  --agree-tos

# Copy certificates ke folder ssl
mkdir -p ssl
sudo cp /etc/letsencrypt/live/seed-cert.jabarchain.me/fullchain.pem ./ssl/
sudo cp /etc/letsencrypt/live/seed-cert.jabarchain.me/privkey.pem ./ssl/
sudo chmod 644 ./ssl/*.pem
```

### Self-Signed (Testing Only)

```bash
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/privkey.pem \
  -out ssl/fullchain.pem \
  -subj "/C=ID/ST=West Java/L=Bandung/O=Seed Certification/CN=seed-cert.jabarchain.me"
```

---

## Konfigurasi Environment

### Environment Variables

Jika aplikasi memerlukan environment variables, buat file `.env` di root frontend:

```bash
# .env
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=SeedCertify
VITE_APP_VERSION=1.0.0
```

### Menggunakan di Docker

Edit `docker-compose.yml` atau `docker-compose.dev.yml`:

```yaml
environment:
  - VITE_API_URL=http://backend:3000
  - VITE_APP_NAME=SeedCertify
```

---

## Troubleshooting

### ❌ Port Sudah Digunakan

**Error:** `port is already allocated`

**Solusi:**

```bash
# Cek process yang menggunakan port
lsof -i :5173  # Development
lsof -i :3002  # Production

# Kill process (ganti PID)
kill -9 <PID>

# Atau ganti port di docker-compose.yml
```

### ❌ npm install Error

**Solusi:**

```bash
# Hapus node_modules dan package-lock
rm -rf node_modules package-lock.json

# Install ulang
npm install
```

### ❌ Docker Build Error

**Solusi:**

```bash
# Build ulang tanpa cache
docker compose build --no-cache

# Atau hapus semua container dan image
docker compose down --rmi all
docker compose up -d --build
```

### ❌ Permission Denied

**Solusi:**

```bash
# Untuk script
chmod +x setup-ssl.sh

# Untuk file SSL
sudo chmod 644 ssl/*.pem
```

### ❌ Hot Reload Tidak Bekerja (Docker Dev)

**Solusi:**

```bash
# Pastikan volume mount benar
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml up -d --build
```

---

## Ringkasan Perintah

### 🖥️ Development Lokal

| Perintah          | Deskripsi                |
| ----------------- | ------------------------ |
| `npm install`     | Install dependencies     |
| `npm run dev`     | Jalankan dev server      |
| `npm run build`   | Build untuk production   |
| `npm run preview` | Preview build production |

### 🐳 Docker Development

| Perintah                                                 | Deskripsi              |
| -------------------------------------------------------- | ---------------------- |
| `docker compose -f docker-compose.dev.yml up -d`         | Jalankan dev container |
| `docker compose -f docker-compose.dev.yml logs -f`       | Lihat logs             |
| `docker compose -f docker-compose.dev.yml down`          | Stop container         |
| `docker compose -f docker-compose.dev.yml up -d --build` | Rebuild dan jalankan   |

### 🚀 Docker Production

| Perintah                       | Deskripsi                     |
| ------------------------------ | ----------------------------- |
| `docker compose up -d`         | Jalankan production container |
| `docker compose logs -f`       | Lihat logs                    |
| `docker compose down`          | Stop container                |
| `docker compose up -d --build` | Rebuild dan jalankan          |

### 📊 Port Default

| Mode                 | URL                             |
| -------------------- | ------------------------------- |
| Development (Lokal)  | http://localhost:5173           |
| Development (Docker) | http://localhost:5173           |
| Production (Docker)  | http://localhost:3002           |
| Production (HTTPS)   | https://seed-cert.jabarchain.me |

---

## 📁 Struktur File Penting

```
frontend/
├── src/                      # Source code Vue.js
│   ├── components/           # Komponen reusable
│   ├── views/                # Halaman/Views
│   ├── layouts/              # Layout templates
│   ├── router/               # Vue Router config
│   └── services/             # API services
├── public/                   # Static assets
├── ssl/                      # SSL certificates (HTTPS)
├── package.json              # Dependencies & scripts
├── vite.config.js            # Vite configuration
├── tailwind.config.js        # Tailwind CSS config
├── nginx.conf                # Nginx config (production)
├── Dockerfile                # Production Docker image
├── Dockerfile.dev            # Development Docker image
├── docker-compose.yml        # Production compose
├── docker-compose.dev.yml    # Development compose
└── index.html                # Entry HTML file
```

---

## 🛠️ Tech Stack

- **Framework:** Vue 3 + Vite
- **Styling:** Tailwind CSS 4
- **Icons:** Heroicons
- **Router:** Vue Router 4
- **Server:** Nginx (Production)

---

**Terakhir diperbarui:** 3 Februari 2026
