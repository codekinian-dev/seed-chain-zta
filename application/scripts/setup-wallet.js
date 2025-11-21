#!/usr/bin/env node

/**
 * Setup Fabric Wallet - Convert MSP format to Fabric Network Wallet format
 */

const { Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');
const path = require('path');

async function setupWallet() {
    console.log('=========================================');
    console.log('Setting up Fabric Wallet');
    console.log('=========================================\n');

    try {
        // Paths
        const mspPath = path.resolve(__dirname, '../../blockchain/network/organizations/peerOrganizations/chain-bpsbp.jabarchain.me/users/appUser@chain-bpsbp.jabarchain.me/msp');
        const walletPath = path.resolve(__dirname, '../wallet');

        console.log('📁 MSP Path:', mspPath);
        console.log('💼 Wallet Path:', walletPath);

        // Check if MSP exists
        if (!fs.existsSync(mspPath)) {
            console.error('❌ Error: MSP directory not found at', mspPath);
            console.error('Please ensure the blockchain network is running and appUser is enrolled.');
            process.exit(1);
        }

        // Read certificates and keys
        const certPath = path.join(mspPath, 'signcerts');
        const keyPath = path.join(mspPath, 'keystore');
        const cacertPath = path.join(mspPath, '../../../msp/cacerts');

        // Find certificate file
        const certFiles = fs.readdirSync(certPath);
        if (certFiles.length === 0) {
            throw new Error('No certificate found in signcerts directory');
        }
        const certificate = fs.readFileSync(path.join(certPath, certFiles[0]), 'utf8');
        console.log('✅ Certificate loaded');

        // Find private key file
        const keyFiles = fs.readdirSync(keyPath);
        if (keyFiles.length === 0) {
            throw new Error('No private key found in keystore directory');
        }
        const privateKey = fs.readFileSync(path.join(keyPath, keyFiles[0]), 'utf8');
        console.log('✅ Private key loaded');

        // Create wallet
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log('✅ Wallet created at:', walletPath);

        // Create identity object
        const identity = {
            credentials: {
                certificate: certificate,
                privateKey: privateKey,
            },
            mspId: 'BPSBPBenihMSP',
            type: 'X.509',
        };

        // Put identity in wallet
        await wallet.put('appUser', identity);
        console.log('✅ Identity "appUser" added to wallet');

        // Verify
        const userIdentity = await wallet.get('appUser');
        if (userIdentity) {
            console.log('✅ Wallet verification successful');
            console.log('   MSP ID:', userIdentity.mspId);
            console.log('   Type:', userIdentity.type);
        } else {
            throw new Error('Failed to verify wallet');
        }

        console.log('\n=========================================');
        console.log('✅ Wallet setup complete!');
        console.log('=========================================\n');

    } catch (error) {
        console.error('\n❌ Error setting up wallet:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run setup
setupWallet();
