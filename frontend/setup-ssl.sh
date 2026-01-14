#!/bin/bash

# Setup SSL Certificates untuk seed-cert.jabarchain.me
# Script ini akan generate SSL certificates menggunakan Certbot (Let's Encrypt)

DOMAIN="seed-cert.jabarchain.me"
EMAIL="your-email@example.com"  # Ganti dengan email Anda
SSL_DIR="./ssl"

echo "🔐 Setting up SSL for $DOMAIN"

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "❌ Certbot not found. Installing..."
    
    # Install certbot based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install certbot
    elif [[ -f /etc/debian_version ]]; then
        # Debian/Ubuntu
        sudo apt-get update
        sudo apt-get install -y certbot
    elif [[ -f /etc/redhat-release ]]; then
        # CentOS/RHEL
        sudo yum install -y certbot
    else
        echo "❌ Please install certbot manually"
        exit 1
    fi
fi

# Create SSL directory
mkdir -p $SSL_DIR

echo ""
echo "📋 Pilih metode generate SSL certificate:"
echo "1. Certbot Standalone (perlu port 80 available)"
echo "2. Certbot DNS Challenge (manual DNS verification)"
echo "3. Generate Self-Signed Certificate (untuk testing)"
echo ""
read -p "Pilih opsi (1/2/3): " option

case $option in
    1)
        echo "🚀 Running Certbot Standalone..."
        sudo certbot certonly --standalone \
            -d $DOMAIN \
            --email $EMAIL \
            --agree-tos \
            --no-eff-email \
            --force-renewal
        
        # Copy certificates
        sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $SSL_DIR/
        sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $SSL_DIR/
        sudo chmod 644 $SSL_DIR/*.pem
        ;;
    
    2)
        echo "🌐 Running Certbot DNS Challenge..."
        sudo certbot certonly --manual \
            --preferred-challenges dns \
            -d $DOMAIN \
            --email $EMAIL \
            --agree-tos \
            --no-eff-email
        
        # Copy certificates
        sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $SSL_DIR/
        sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $SSL_DIR/
        sudo chmod 644 $SSL_DIR/*.pem
        ;;
    
    3)
        echo "🔧 Generating Self-Signed Certificate..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout $SSL_DIR/privkey.pem \
            -out $SSL_DIR/fullchain.pem \
            -subj "/C=ID/ST=West Java/L=Bandung/O=Seed Certification/CN=$DOMAIN"
        
        chmod 644 $SSL_DIR/*.pem
        echo "⚠️  Self-signed certificate generated (untuk testing only)"
        ;;
    
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

# Verify certificates
if [ -f "$SSL_DIR/fullchain.pem" ] && [ -f "$SSL_DIR/privkey.pem" ]; then
    echo ""
    echo "✅ SSL certificates generated successfully!"
    echo "📁 Certificates location: $SSL_DIR/"
    echo ""
    echo "📝 Certificate info:"
    openssl x509 -in $SSL_DIR/fullchain.pem -text -noout | grep -E "Subject:|Issuer:|Not Before|Not After"
    echo ""
    echo "🚀 Now you can run: docker-compose up -d"
else
    echo "❌ Failed to generate certificates"
    exit 1
fi
