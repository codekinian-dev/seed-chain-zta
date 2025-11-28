# 🎯 Solusi untuk Docker Gateway yang Restart Terus di VPS

Saya telah membuat beberapa file dan perbaikan untuk mengatasi masalah Docker gateway yang terus restart:

## ✅ Files yang Dibuat

### 📖 Dokumentasi
1. **`TROUBLESHOOTING_VPS.md`** - Panduan lengkap troubleshooting masalah di VPS
2. **`docs/VPS_DEPLOYMENT.md`** - Guide deployment lengkap ke VPS
3. **`VPS_QUICK_REFERENCE.md`** - Quick reference untuk command penting
4. **`.env.docker.template`** - Template environment variables untuk VPS

### 🛠️ Scripts Helper
1. **`scripts/vps-setup.sh`** - Setup otomatis deployment ke VPS
2. **`scripts/vps-diagnose.sh`** - Diagnostic tool untuk cek masalah
3. **`scripts/monitor.sh`** - Monitor health container secara berkala
4. **`scripts/logs.sh`** - Quick log viewer

### 🔧 Perbaikan Konfigurasi
1. **`docker-compose.prod.yml`** - Updated dengan:
   - `restart: unless-stopped` (dari `always`) untuk prevent infinite restart
   - `start_period: 120s` (dari 60s) untuk startup yang lebih lambat
   - Menambahkan volume `uploads-data`
   - Comment yang lebih jelas

## 🚀 Cara Menggunakan di VPS

### Opsi 1: Automatic (Recommended)
```bash
# Copy files ke VPS
scp -r * user@vps_ip:/path/to/app/

# SSH ke VPS
ssh user@vps_ip

# Jalankan setup script
cd /path/to/app
./scripts/vps-setup.sh
```

### Opsi 2: Manual
```bash
# 1. Setup environment
cp .env.docker.template .env.docker.local
nano .env.docker.local  # Edit dengan IP VPS dan secrets

# 2. Deploy
docker-compose -f docker-compose.prod.yml up -d --build

# 3. Monitor
docker logs -f seed-api-gateway-prod
```

## 🔍 Diagnosis Masalah

Jika container masih restart, jalankan:

```bash
# 1. Lihat logs error
docker logs seed-api-gateway-prod --tail 100

# 2. Run diagnostic
./scripts/vps-diagnose.sh

# 3. Check specific issue
./scripts/logs.sh
```

## ⚠️ Masalah Umum yang Sudah Diperbaiki

1. ✅ **`host.docker.internal` tidak tersedia di Linux**
   - Sudah ditambahkan `extra_hosts` di docker-compose

2. ✅ **Restart policy terlalu agresif**
   - Diubah dari `always` ke `unless-stopped`

3. ✅ **Startup time terlalu pendek**
   - Health check `start_period` dinaikkan ke 120s

4. ✅ **Volume uploads tidak ada**
   - Ditambahkan `uploads-data` volume

5. ✅ **crypto-config tidak ter-mount**
   - Ditambahkan mount untuk crypto-config di volume

## 🎯 Kemungkinan Penyebab Restart (Check ini)

1. **Keycloak tidak tersedia**
   ```bash
   curl http://YOUR_VPS_IP:8080
   ```

2. **IPFS tidak running**
   ```bash
   curl http://YOUR_VPS_IP:9094
   ```

3. **Fabric network tidak accessible**
   - Check connection-profile.json menggunakan IP VPS, bukan localhost

4. **Wallet tidak valid**
   ```bash
   ls -la wallet/
   ```

5. **Environment variables salah**
   ```bash
   cat .env.docker.local | grep -v SECRET
   ```

## 📋 Checklist Sebelum Deploy

- [ ] Keycloak running di VPS
- [ ] IPFS running di VPS
- [ ] Fabric network accessible
- [ ] Wallet sudah di-generate
- [ ] `.env.docker.local` sudah dikonfigurasi dengan IP VPS (bukan localhost)
- [ ] crypto-config directory ada (jika pakai TLS)
- [ ] Port 3001, 6379 tidak bentrok

## 💡 Next Steps

Setelah deploy di VPS:

```bash
# 1. Monitor logs
docker-compose -f docker-compose.prod.yml logs -f

# 2. Test health
curl http://localhost:3001/api/health/liveness

# 3. Check status
docker-compose -f docker-compose.prod.yml ps
```

## 📚 Dokumentasi Lengkap

- **Troubleshooting Detail:** `TROUBLESHOOTING_VPS.md`
- **VPS Deployment Guide:** `docs/VPS_DEPLOYMENT.md`
- **Quick Reference:** `VPS_QUICK_REFERENCE.md`

---

**Good luck! 🚀**

Jika masih ada masalah, jalankan `./scripts/vps-diagnose.sh` dan share outputnya.
