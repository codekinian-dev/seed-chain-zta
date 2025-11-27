'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { v4: uuidv4 } = require('uuid');

/**
 * Workload module for createSeedBatch transaction
 */
class CreateSeedBatchWorkload extends WorkloadModuleBase {
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
    }

    /**
     * Submit transaction to create seed batch
     */
    async submitTransaction() {
        this.txIndex++;

        // Generate unique ID for seed batch
        // Simplified deterministic ID: BATCH-{WorkerIndex*10000 + TxIndex}
        // Example: Worker 0 -> BATCH-1, BATCH-2... | Worker 1 -> BATCH-10001...
        // NOTE: Restart network between runs to avoid 'Asset already exists' errors
        const uniqueNum = (this.workerIndex * 10000) + this.txIndex;
        const batchId = `BATCH-${uniqueNum}`;

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

        // Generate seed source document parameters with valid IPFS CID format
        const seedSourceDocName = `Dokumen Sumber Benih ${seedSourceNumber}`;

        // Generate valid 46-character IPFS CIDv0 (Qm + 44 base58 characters)
        const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        let seedSourceIpfsCid = 'Qm';
        for (let i = 0; i < 44; i++) {
            seedSourceIpfsCid += base58Chars.charAt(Math.floor(Math.random() * base58Chars.length));
        }

        const request = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'createSeedBatch',
            contractArguments: [
                batchId,                // id
                variety,                // varietyName
                commodity,              // commodity
                harvestDate.toISOString().split('T')[0],  // harvestDate (YYYY-MM-DD)
                seedSourceNumber,       // seedSourceNumber
                origin,                 // origin
                iupNumber,              // iupNumber
                seedClass,              // seedClass (BS, BD, BP, BR)
                producerUUID,           // producerUUID (UUID format)
                seedSourceDocName,      // seedSourceDocName
                seedSourceIpfsCid       // seedSourceIpfsCid (valid 46-char CIDv0)
            ],
            readOnly: false,
            invokerIdentity: 'appUser'  // Single appUser with role_producer attribute
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
    return new CreateSeedBatchWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
