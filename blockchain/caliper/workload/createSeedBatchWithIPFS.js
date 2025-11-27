'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execAsync = promisify(exec);

/**
 * Workload module for createSeedBatch transaction with real IPFS upload
 */
class CreateSeedBatchWithIPFSWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
        this.varieties = [
            'Kelapa Dalam', 'Kelapa Hibrida', 'Kelapa Sawit Tenera', 'Kelapa Sawit Dura',
            'Karet IRR 118', 'Karet PB 260', 'Kopi Arabika Gayo', 'Kopi Robusta Lampung',
            'Kakao Forastero', 'Kakao Criollo'
        ];

        this.commodities = [
            'Kelapa', 'Kelapa Sawit', 'Karet', 'Kopi Arabika', 'Kopi Robusta',
            'Kakao', 'Teh', 'Tebu', 'Tembakau', 'Cengkeh'
        ];
        this.origins = [
            'Bandung', 'Bogor', 'Cianjur', 'Sukabumi', 'Garut',
            'Tasikmalaya', 'Kuningan', 'Majalengka', 'Sumedang', 'Purwakarta'
        ];
        this.seedClasses = ['BS', 'BD', 'BP', 'BR'];

        // Simulated producer UUIDs
        this.producerUUIDs = [
            '550e8400-e29b-41d4-a716-446655440001',
            '550e8400-e29b-41d4-a716-446655440002',
            '550e8400-e29b-41d4-a716-446655440003',
            '550e8400-e29b-41d4-a716-446655440004',
            '550e8400-e29b-41d4-a716-446655440005'
        ];

        // IPFS configuration
        this.ipfsApiUrl = 'http://localhost:9094/add';
        this.templateFilePath = null;
    }

    /**
     * Upload file to IPFS using curl (with silent mode)
     * @param {string} filePath - Path to the file to upload
     * @returns {Promise<string>} - IPFS CID
     */
    async uploadToIPFS(filePath) {
        try {
            // Use -s (silent) and -S (show errors) to avoid progress output
            const command = `curl -s -S -F file=@"${filePath}" ${this.ipfsApiUrl}`;
            const { stdout, stderr } = await execAsync(command, { timeout: 120000 }); // 2 minute timeout

            if (stderr && !stderr.includes('100')) {
                console.error('IPFS upload stderr:', stderr);
            }

            // Parse response to extract CID
            const response = JSON.parse(stdout);

            if (response.Hash) {
                return response.Hash;
            } else if (response.cid) {
                return response.cid;
            } else {
                throw new Error('No CID found in IPFS response: ' + stdout);
            }
        } catch (error) {
            console.error('Error uploading to IPFS:', error);
            throw new Error(`IPFS upload failed: ${error.message}`);
        }
    }

    /**
     * Initialize the workload module
     * @param {number} workerIndex The worker index
     * @param {number} totalWorkers The total number of workers
     * @param {number} roundIndex The round index
     * @param {object} roundArguments The round arguments
     * @param {object} sutAdapter The SUT adapter
     * @param {object} sutContext The SUT context
     */
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        this.workerIndex = workerIndex;
        this.totalWorkers = totalWorkers;
        this.roundIndex = roundIndex;

        // Set template file path (adjust path as needed)
        const caliperDir = path.resolve(__dirname, '..');
        this.templateFilePath = path.join(caliperDir, 'templates', 'Template SMB.docx');

        // Verify template file exists
        if (!fs.existsSync(this.templateFilePath)) {
            throw new Error(`Template file not found: ${this.templateFilePath}`);
        }

        console.log(`[Worker ${workerIndex}] Initialized with template: ${this.templateFilePath}`);
        console.log(`[Worker ${workerIndex}] IPFS API URL: ${this.ipfsApiUrl}`);
        console.log(`[Worker ${workerIndex}] Ready to upload documents per transaction`);
    }

    /**
     * Submit transaction to create seed batch with real IPFS upload
     */
    async submitTransaction() {
        this.txIndex++;

        // Generate unique ID for seed batch
        // Using timestamp and random suffix to ensure uniqueness across runs
        const uniqueId = `${this.workerIndex}-${this.txIndex}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const batchId = `BATCH-${uniqueId}`;

        // Random selection for variety and data
        const varietyIndex = Math.floor(Math.random() * this.varieties.length);
        const variety = this.varieties[varietyIndex];
        const commodity = this.commodities[Math.min(varietyIndex, this.commodities.length - 1)];
        const origin = this.origins[Math.floor(Math.random() * this.origins.length)];
        const seedClass = this.seedClasses[Math.floor(Math.random() * this.seedClasses.length)];

        // Generate harvest date (random date within last 6 months)
        const harvestDate = new Date();
        harvestDate.setDate(harvestDate.getDate() - Math.floor(Math.random() * 180));

        // Generate seed source number
        const seedSourceNumber = `SSN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        // Generate IUP number
        const iupNumber = `IUP-${Math.floor(Math.random() * 100000)}`;

        // Select random producer UUID
        const producerUUID = this.producerUUIDs[Math.floor(Math.random() * this.producerUUIDs.length)];

        // Upload template file to IPFS for each transaction (real scenario)
        console.log(`[Worker ${this.workerIndex}] Uploading document to IPFS for batch ${batchId}...`);
        const uploadStartTime = Date.now();
        const seedSourceIpfsCid = await this.uploadToIPFS(this.templateFilePath);
        const uploadDuration = Date.now() - uploadStartTime;
        console.log(`[Worker ${this.workerIndex}] Upload complete in ${uploadDuration}ms. CID: ${seedSourceIpfsCid}`);

        // Generate seed source document parameters
        const seedSourceDocName = `Dokumen Sumber Benih ${seedSourceNumber}`;

        const request = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'createSeedBatch',
            contractArguments: [
                batchId,
                variety,
                commodity,
                harvestDate.toISOString(),
                seedSourceNumber,
                origin,
                iupNumber,
                seedClass,
                producerUUID,  // UUID parameter now required
                seedSourceDocName,  // Seed source document name
                seedSourceIpfsCid   // Real IPFS CID from upload
            ],
            readOnly: false,
            invokerIdentity: 'appUser'  // Single appUser with combined roles
        };

        await this.sutAdapter.sendRequests(request);
    }

    /**
     * Cleanup workload module
     */
    async cleanupWorkloadModule() {
        // No cleanup needed
    }
}

/**
 * Create a new instance of the workload module
 * @return {WorkloadModuleInterface}
 */
function createWorkloadModule() {
    return new CreateSeedBatchWithIPFSWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
