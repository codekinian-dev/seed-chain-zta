#!/usr/bin/env node
/**
 * Sync wallet from remote server and extract credentials for Caliper
 * 
 * Usage:
 *   node sync-server-wallet.js                     # Use local wallet
 *   node sync-server-wallet.js --remote user@host # Sync from remote server
 *   node sync-server-wallet.js --remote user@host --remote-path /path/to/wallet
 * 
 * Environment Variables:
 *   REMOTE_HOST: SSH host (user@hostname)
 *   REMOTE_WALLET_PATH: Path to wallet on remote server
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse arguments
const args = process.argv.slice(2);
const remoteIndex = args.indexOf('--remote');
const remotePathIndex = args.indexOf('--remote-path');

const remoteHost = remoteIndex !== -1 ? args[remoteIndex + 1] : process.env.REMOTE_HOST;
const remoteWalletPath = remotePathIndex !== -1
    ? args[remotePathIndex + 1]
    : process.env.REMOTE_WALLET_PATH || '/home/ubuntu/tesis_bismillah/application/wallet';

// Paths
const localWalletDir = path.join(__dirname, '../../../application/wallet');
const caliperWalletDir = path.join(__dirname, '../wallet-sync');
const outputDir = path.join(__dirname, '../credentials');

// Determine which wallet to use
let walletDir = localWalletDir;

if (remoteHost) {
    console.log('🔄 Syncing wallet from remote server...');
    console.log(`   Host: ${remoteHost}`);
    console.log(`   Remote path: ${remoteWalletPath}`);

    // Create sync directory
    if (!fs.existsSync(caliperWalletDir)) {
        fs.mkdirSync(caliperWalletDir, { recursive: true });
    }

    try {
        // Sync using rsync (preserves timestamps, efficient)
        const rsyncCmd = `rsync -avz --delete ${remoteHost}:${remoteWalletPath}/ ${caliperWalletDir}/`;
        console.log(`   Running: ${rsyncCmd}\n`);
        execSync(rsyncCmd, { stdio: 'inherit' });
        walletDir = caliperWalletDir;
        console.log('\n✅ Wallet synced successfully!\n');
    } catch (error) {
        console.error(`❌ Failed to sync wallet: ${error.message}`);
        console.log('   Falling back to local wallet...\n');
        walletDir = localWalletDir;
    }
} else {
    console.log('📁 Using local wallet (no --remote specified)\n');
}

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Get all .id files from wallet
const walletFiles = fs.readdirSync(walletDir).filter(f => f.endsWith('.id'));

console.log(`📁 Found ${walletFiles.length} identity files in wallet\n`);

if (walletFiles.length === 0) {
    console.error('❌ No wallet files found!');
    process.exit(1);
}

const extractedUsers = [];
const usersByRole = {};

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

        console.log(`✅ ${username.padEnd(20)} [${role.padEnd(20)}] → extracted`);

        const userInfo = {
            username,
            role,
            mspId,
            certPath: `./credentials/${username}/cert.pem`,
            keyPath: `./credentials/${username}/key.pem`
        };

        extractedUsers.push(userInfo);

        // Group by role
        if (!usersByRole[role]) usersByRole[role] = [];
        usersByRole[role].push(username);

    } catch (error) {
        console.error(`❌ Error processing ${file}: ${error.message}`);
    }
});

// Generate summary file for Caliper config
const summaryPath = path.join(outputDir, 'users-summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(extractedUsers, null, 2));

// Generate networkConfig identities section
const identitiesConfig = extractedUsers.map(u => `        - name: ${u.username}
          clientSignedCert:
            path: ${u.certPath}
          clientPrivateKey:
            path: ${u.keyPath}`).join('\n');

const configPath = path.join(outputDir, 'caliper-identities.yaml');
fs.writeFileSync(configPath, `# Auto-generated Caliper identities config
# Copy this section to your networkConfig.yaml under organizations[0].identities.certificates

${identitiesConfig}
`);

console.log(`\n${'═'.repeat(60)}`);
console.log(`🎉 Extracted ${extractedUsers.length} identities successfully!`);
console.log(`${'═'.repeat(60)}`);

console.log('\n📊 Users by Role:');
Object.entries(usersByRole).sort().forEach(([role, users]) => {
    console.log(`   ${role.padEnd(25)}: ${users.length} users`);
    if (users.length <= 5) {
        console.log(`      └─ ${users.join(', ')}`);
    } else {
        console.log(`      └─ ${users.slice(0, 3).join(', ')} ... and ${users.length - 3} more`);
    }
});

console.log('\n📁 Output files:');
console.log(`   ${summaryPath}`);
console.log(`   ${configPath}`);

// Suggest which user to use for each operation
console.log('\n💡 Suggested users for Caliper workloads:');
const roleMapping = {
    'role_producer': 'createSeedBatch, distributeSeed',
    'role_inspector_field': 'submitCertification, recordInspection',
    'role_inspector_chief': 'evaluateInspection',
    'role_issuer': 'issueCertificate',
    'role_admin': 'administrative operations'
};

Object.entries(roleMapping).forEach(([role, ops]) => {
    const users = usersByRole[role];
    if (users && users.length > 0) {
        console.log(`   ${role}: ${users[0]} → ${ops}`);
    } else {
        console.log(`   ${role}: ⚠️  No user found! (needed for: ${ops})`);
    }
});

console.log('\n✨ Done! Run this script again with --remote to sync from server.');
