#!/usr/bin/env node
/**
 * Extract credentials from Fabric wallet .id files to PEM files
 * for use with Hyperledger Caliper
 * 
 * Supports:
 * - Named identities (appUser.id, admin.id)
 * - UUID-based real users (91fcb9a4-xxxx.id with metadata)
 */

const fs = require('fs');
const path = require('path');

// Paths
const walletDir = path.join(__dirname, '../../../application/wallet');
const outputDir = path.join(__dirname, '../credentials');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Get all .id files from wallet
const walletFiles = fs.readdirSync(walletDir).filter(f => f.endsWith('.id'));

console.log(`📁 Found ${walletFiles.length} identity files in wallet\n`);

const extractedUsers = [];

walletFiles.forEach(file => {
    const idFile = path.join(walletDir, file);
    const baseName = file.replace('.id', '');

    try {
        const idContent = JSON.parse(fs.readFileSync(idFile, 'utf8'));
        const { certificate, privateKey } = idContent.credentials;
        const mspId = idContent.mspId;

        // Check for metadata file (for UUID-based users)
        let username = baseName;
        let role = 'unknown';
        let metadata = { mspId, identity: baseName };

        const metadataFile = path.join(walletDir, `${baseName}.metadata.json`);
        if (fs.existsSync(metadataFile)) {
            const metaContent = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
            username = metaContent.username || baseName;
            role = metaContent.role || metaContent.fabricRole || 'unknown';
            metadata = {
                ...metadata,
                userId: metaContent.userId,
                username: username,
                role: role,
                fabricRole: metaContent.fabricRole,
                attributes: metaContent.attributes
            };
        }

        // Create identity directory using username (more readable)
        const identityDir = path.join(outputDir, username);
        if (!fs.existsSync(identityDir)) {
            fs.mkdirSync(identityDir, { recursive: true });
        }

        // Write certificate
        const certPath = path.join(identityDir, 'cert.pem');
        fs.writeFileSync(certPath, certificate);

        // Write private key (normalize line endings)
        const keyPath = path.join(identityDir, 'key.pem');
        const normalizedKey = privateKey.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        fs.writeFileSync(keyPath, normalizedKey);

        // Write metadata
        const metaPath = path.join(identityDir, 'metadata.json');
        fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

        console.log(`✅ ${username.padEnd(15)} [${role.padEnd(15)}] → ${identityDir}`);

        extractedUsers.push({
            username,
            role,
            mspId,
            certPath: `./credentials/${username}/cert.pem`,
            keyPath: `./credentials/${username}/key.pem`
        });

    } catch (error) {
        console.error(`❌ Error processing ${file}: ${error.message}`);
    }
});

// Generate summary file for Caliper config
const summaryPath = path.join(outputDir, 'users-summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(extractedUsers, null, 2));

console.log(`\n🎉 Extracted ${extractedUsers.length} identities successfully!`);
console.log(`📁 Output directory: ${outputDir}`);
console.log(`📋 Summary file: ${summaryPath}`);

// Group by role for reference
const byRole = extractedUsers.reduce((acc, u) => {
    if (!acc[u.role]) acc[u.role] = [];
    acc[u.role].push(u.username);
    return acc;
}, {});

console.log('\n📊 Users by Role:');
Object.entries(byRole).forEach(([role, users]) => {
    console.log(`   ${role}: ${users.join(', ')}`);
});

console.log('\n🎉 Credentials extracted successfully!');
console.log(`📁 Output directory: ${outputDir}`);
