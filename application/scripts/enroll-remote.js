#!/usr/bin/env node

/**
 * Enroll Admin and Register appUser via Fabric CA
 * Untuk deployment di server terpisah dari blockchain
 * 
 * Script ini menggunakan TLS certificates yang sudah di-sync
 * dari blockchain server (tls-certs/ folder)
 */

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const CA_URL = process.env.FABRIC_CA_URL || 'https://152.42.164.128:7054';
const CA_NAME = process.env.FABRIC_CA_NAME || 'ca-bpsbp';
const MSP_ID = process.env.FABRIC_MSP_ID || 'BPSBPBenihMSP';
const ADMIN_USER = process.env.FABRIC_CA_ADMIN_USER || 'admin';
const ADMIN_SECRET = process.env.FABRIC_CA_ADMIN_SECRET || 'adminpw';

// TLS cert paths - menggunakan struktur tls-certs/ yang lebih sederhana
const TLS_CERT_PATHS = [
    path.join(__dirname, '../tls-certs/ca/ca-bpsbp-tls.pem'),
    // Fallback ke crypto-config jika tls-certs belum di-setup
    path.join(__dirname, '../crypto-config/peerOrganizations/chain-bpsbp.jabarchain.me/ca/ca-cert.pem')
];

async function main() {
    console.log('=========================================');
    console.log('Fabric CA Enrollment Script');
    console.log('(Remote Server Mode)');
    console.log('=========================================\n');

    console.log('Configuration:');
    console.log('  CA URL:', CA_URL);
    console.log('  CA Name:', CA_NAME);
    console.log('  MSP ID:', MSP_ID);
    console.log('  Admin User:', ADMIN_USER);
    console.log('');

    try {
        // Try to load CA TLS cert from available paths
        let caTLSCert = null;
        let usedPath = null;

        for (const certPath of TLS_CERT_PATHS) {
            if (fs.existsSync(certPath)) {
                caTLSCert = fs.readFileSync(certPath, 'utf8');
                usedPath = certPath;
                break;
            }
        }

        if (caTLSCert) {
            console.log('✅ CA TLS certificate loaded from:', usedPath);
        } else {
            console.log('⚠️  CA TLS certificate not found, using insecure connection');
            console.log('   Run scripts/sync-tls-certs.sh to sync TLS certificates');
        }

        // Create CA client
        const caClient = new FabricCAServices(CA_URL, {
            trustedRoots: caTLSCert ? [caTLSCert] : [],
            verify: false // For self-signed certs
        }, CA_NAME);

        console.log('✅ CA client created');

        // Create wallet
        const walletPath = path.join(__dirname, '../wallet');

        // Ensure wallet directory exists
        if (!fs.existsSync(walletPath)) {
            fs.mkdirSync(walletPath, { recursive: true });
        }

        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log('✅ Wallet created at:', walletPath);

        // Check if admin already exists
        const adminIdentity = await wallet.get('admin');
        if (adminIdentity) {
            console.log('ℹ️  Admin identity already exists in wallet');
        } else {
            // Enroll admin
            console.log('\n📝 Enrolling admin...');
            const enrollment = await caClient.enroll({
                enrollmentID: ADMIN_USER,
                enrollmentSecret: ADMIN_SECRET
            });

            const identity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes(),
                },
                mspId: MSP_ID,
                type: 'X.509',
            };

            await wallet.put('admin', identity);
            console.log('✅ Admin enrolled and added to wallet');
        }

        // Get admin identity for registering users
        const adminIdent = await wallet.get('admin');
        const provider = wallet.getProviderRegistry().getProvider(adminIdent.type);
        const adminUser = await provider.getUserContext(adminIdent, 'admin');

        // Check if appUser already exists
        const appUserIdentity = await wallet.get('appUser');
        if (appUserIdentity) {
            console.log('ℹ️  appUser identity already exists in wallet');
        } else {
            // Register and enroll appUser
            console.log('\n📝 Registering appUser...');

            try {
                const secret = await caClient.register({
                    affiliation: '',
                    enrollmentID: 'appUser',
                    role: 'client',
                    attrs: [
                        { name: 'role', value: 'admin', ecert: true }
                    ]
                }, adminUser);

                console.log('✅ appUser registered with secret');

                // Enroll appUser
                console.log('📝 Enrolling appUser...');
                const enrollment = await caClient.enroll({
                    enrollmentID: 'appUser',
                    enrollmentSecret: secret
                });

                const identity = {
                    credentials: {
                        certificate: enrollment.certificate,
                        privateKey: enrollment.key.toBytes(),
                    },
                    mspId: MSP_ID,
                    type: 'X.509',
                };

                await wallet.put('appUser', identity);
                console.log('✅ appUser enrolled and added to wallet');

            } catch (error) {
                if (error.message.includes('is already registered')) {
                    console.log('ℹ️  appUser already registered, trying to enroll with default secret...');

                    // Try enrolling with a common secret pattern
                    try {
                        const enrollment = await caClient.enroll({
                            enrollmentID: 'appUser',
                            enrollmentSecret: 'appUserpw'
                        });

                        const identity = {
                            credentials: {
                                certificate: enrollment.certificate,
                                privateKey: enrollment.key.toBytes(),
                            },
                            mspId: MSP_ID,
                            type: 'X.509',
                        };

                        await wallet.put('appUser', identity);
                        console.log('✅ appUser enrolled and added to wallet');
                    } catch (enrollError) {
                        console.error('❌ Failed to enroll appUser:', enrollError.message);
                        console.log('\nTrying to use Admin identity as appUser...');

                        // Copy admin identity as appUser
                        await wallet.put('appUser', adminIdent);
                        console.log('✅ Using Admin identity as appUser');
                    }
                } else {
                    throw error;
                }
            }
        }

        // Verify wallet
        console.log('\n📋 Wallet contents:');
        const identities = await wallet.list();
        for (const id of identities) {
            const identity = await wallet.get(id);
            console.log(`  - ${id}: MSP=${identity.mspId}, Type=${identity.type}`);
        }

        console.log('\n=========================================');
        console.log('✅ Wallet setup complete!');
        console.log('=========================================\n');
        console.log('Note: Identities disimpan di wallet/ folder.');
        console.log('Tidak perlu sync crypto-config lagi kecuali:');
        console.log('  1. TLS certificates expired/renewed');
        console.log('  2. Perlu mendaftarkan user baru');
        console.log('');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
