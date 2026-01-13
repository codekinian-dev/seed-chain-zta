# Deployment Aplikasi di Server Terpisah dari Blockchain

Panduan ini menjelaskan cara deploy aplikasi di server yang berbeda dari server blockchain Hyperledger Fabric.

## Arsitektur

```
┌─────────────────────────────────────────────────────────┐
│             Application Server (Server A)               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   NestJS    │  │   Wallet    │  │   TLS Certs     │  │
│  │   Backend   │──│  (Local)    │  │   (Minimal)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │ gRPCs
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Blockchain Server (Server B)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │
│  │  Peer0   │  │  Peer1   │  │ Orderer  │  │   CA    │  │
│  │  :7051   │  │  :8051   │  │  :7050   │  │  :7054  │  │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Apa yang Diperlukan?

### Yang Perlu di-Copy SEKALI (jarang berubah):

| File           | Path                                   | Kapan Berubah         |
| -------------- | -------------------------------------- | --------------------- |
| Orderer TLS CA | `tls-certs/orderer/orderer-tls-ca.crt` | Saat TLS cert renewal |
| Peer TLS CA    | `tls-certs/peers/*.crt`                | Saat TLS cert renewal |
| Fabric CA TLS  | `tls-certs/ca/ca-bpsbp-tls.pem`        | Saat CA TLS renewal   |

### Yang TIDAK Perlu di-Copy:

- ❌ Seluruh `crypto-config/` folder
- ❌ Private keys dari peers/orderer
- ❌ MSP folders
- ❌ User certificates (dibuat via enrollment)

## Setup di Blockchain Server (Sekali)

Jalankan ini di blockchain server untuk menyediakan TLS certificates via HTTP:

```bash
# Di blockchain server
cd /path/to/blockchain

# Setup folder public untuk TLS certs
chmod +x scripts/setup-tls-public.sh
./scripts/setup-tls-public.sh

# Jalankan HTTP server (atau gunakan nginx)
cd /root/fabric-network/tls-public
python3 -m http.server 8443 &

# Atau setup nginx (lebih permanent)
sudo cp config/nginx-tls-certs.conf /etc/nginx/sites-available/fabric-tls
sudo ln -s /etc/nginx/sites-available/fabric-tls /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Pastikan port 8443 terbuka di firewall:

```bash
sudo ufw allow 8443/tcp
```

## Setup di Application Server

### 1. Download TLS Certificates via HTTP (Tanpa SSH!)

```bash
# Set URL blockchain server
export BLOCKCHAIN_TLS_URL=http://206.189.82.125:8443

# Download TLS certificates
chmod +x scripts/download-tls-certs.sh
./scripts/download-tls-certs.sh
```

Atau manual dengan curl:

```bash
mkdir -p tls-certs
cd tls-certs

# Download bundle
curl -O http://206.189.82.125:8443/bundle.tar.gz
tar -xzf bundle.tar.gz
rm bundle.tar.gz
```

### Alternatif: Via SSH (jika perlu)

```bash
# Hanya jika HTTP tidak tersedia
export BLOCKCHAIN_SERVER=206.189.82.125
export BLOCKCHAIN_USER=root
./scripts/sync-tls-certs.sh
```

### 2. Enroll Admin & AppUser

```bash
# Install dependencies
npm install

# Enroll via Fabric CA (certificates disimpan di wallet/ lokal)
node scripts/enroll-remote.js
```

Output:

```
✅ Admin enrolled and added to wallet
✅ appUser enrolled and added to wallet
```

### 3. Jalankan dengan Docker

```bash
# Untuk server terpisah, gunakan docker-compose.remote.yml
docker-compose -f docker-compose.remote.yml up -d
```

## Struktur Folder Minimal

```
application/
├── tls-certs/              # Hanya TLS certs (sync sekali)
│   ├── orderer/
│   │   └── orderer-tls-ca.crt
│   ├── peers/
│   │   ├── pusat-tls-ca.crt
│   │   └── cert-tls-ca.crt
│   └── ca/
│       └── ca-bpsbp-tls.pem
├── wallet/                 # Identities (hasil enrollment)
│   ├── admin.id
│   └── appUser.id
├── config/
│   └── connection-profile-remote.json
└── docker-compose.remote.yml
```

## Kapan Perlu Sync Ulang?

### TLS Certificates (Jarang):

- TLS certificates di-renew (biasanya 1 tahun)
- Peer/Orderer baru ditambahkan
- Certificate revoked

### Wallet Identities (Per Kebutuhan):

- User baru perlu didaftarkan
- Certificate user expired
- User di-revoke

## Troubleshooting

### Error: TLS handshake failed

```
# Pastikan TLS certs sudah di-sync
./scripts/sync-tls-certs.sh

# Verifikasi certificate
openssl x509 -in tls-certs/orderer/orderer-tls-ca.crt -text -noout
```

### Error: Identity not found

```
# Re-enroll admin dan appUser
rm -rf wallet/
node scripts/enroll-remote.js
```

### Error: Connection refused

```
# Pastikan firewall mengizinkan port:
# - 7050 (Orderer)
# - 7051 (Peer pusat)
# - 8051 (Peer cert)
# - 7054 (Fabric CA)
```

## Perbandingan: Crypto-Config vs TLS-Only

| Aspek            | Full Crypto-Config           | TLS-Only (Recommended)      |
| ---------------- | ---------------------------- | --------------------------- |
| Ukuran           | ~50MB                        | ~10KB                       |
| Sync Frequency   | Setiap ada perubahan         | Jarang (TLS renewal)        |
| Security Risk    | Tinggi (berisi private keys) | Rendah (hanya public certs) |
| Setup Complexity | Kompleks                     | Sederhana                   |
