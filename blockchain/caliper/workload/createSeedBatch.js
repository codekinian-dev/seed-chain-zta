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
        const batchId = `BATCH-${this.workerIndex}-${this.roundIndex}-${this.txIndex}-${Date.now()}`;

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

        // Generate seed source document parameters
        const seedSourceDocName = `Dokumen Sumber Benih ${seedSourceNumber}`;
        const seedSourceIpfsCid = `Qm${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

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
                seedSourceIpfsCid   // Seed source IPFS CID
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
    return new CreateSeedBatchWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
