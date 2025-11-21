#!/bin/sh

# Script untuk menambahkan file yang sudah di-pin ke MFS (Mutable File System)
# agar terlihat di IPFS WebUI

echo " Menambahkan File ke MFS (WebUI Files)"
echo "========================================\n"

# Get pinned files
echo " Mencari file yang di-pin..."
PINNED_FILES=$(docker exec ipfs-node-1 ipfs pin ls --type=recursive | grep -v "indirect" | awk '{print $1}')

# Create directories in MFS if needed
echo "\n Membuat folder di MFS..."
docker exec ipfs-node-1 ipfs files mkdir -p /certificates 2>/dev/null || true
docker exec ipfs-node-1 ipfs files mkdir -p /documents 2>/dev/null || true

# Add pinned files to MFS
echo "\n Menambahkan file ke MFS..."
COUNT=0

for CID in $PINNED_FILES; do
    # Get file info
    STAT=$(docker exec ipfs-node-1 ipfs files stat /ipfs/$CID 2>/dev/null)
    
    if echo "$STAT" | grep -q "Type: file"; then
        # It's a file, add to MFS
        FILENAME="document_${COUNT}.txt"
        
        # Check if it's already in MFS
        if ! docker exec ipfs-node-1 ipfs files ls /documents/$FILENAME 2>/dev/null; then
            docker exec ipfs-node-1 ipfs files cp /ipfs/$CID /documents/$FILENAME 2>/dev/null
            echo "    Added: $FILENAME (CID: $CID)"
            COUNT=$((COUNT + 1))
        else
            echo "     Skipped: $FILENAME (already exists)"
        fi
    fi
done

echo "\n Status MFS:"
echo "\n /documents:"
docker exec ipfs-node-1 ipfs files ls -l /documents 2>/dev/null || echo "   (kosong)"

echo "\n /certificates:"
docker exec ipfs-node-1 ipfs files ls -l /certificates 2>/dev/null || echo "   (kosong)"

echo "\n Selesai! File sekarang terlihat di WebUI"
echo "   Buka: http://localhost:5001/webui"
echo "   Pergi ke tab 'Files' untuk melihat file Anda\n"

# Show how to add new files directly to MFS
cat << 'EOF'

 Tips untuk kedepannya:

1. Upload langsung ke MFS (akan terlihat di WebUI):
   docker exec ipfs-node-1 ipfs add --to-files /path/to/file.pdf /documents/file.pdf

2. Upload via Cluster lalu copy ke MFS:
   # Upload
   curl -F file=@doc.pdf http://localhost:9094/add
   
   # Copy ke MFS (ganti CID dengan hasil upload)
   docker exec ipfs-node-1 ipfs files cp /ipfs/QmXXX /documents/doc.pdf

3. Upload via API biasa lalu copy:
   # Upload
   curl -F file=@doc.pdf http://localhost:5001/api/v0/add
   
   # Copy ke MFS
   docker exec ipfs-node-1 ipfs files cp /ipfs/QmXXX /documents/doc.pdf

EOF
