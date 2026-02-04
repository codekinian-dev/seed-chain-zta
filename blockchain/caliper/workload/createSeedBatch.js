'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { v4: uuidv4 } = require('uuid');
const dataset = require('./seed-batch-dataset.json');

/**
 * Workload module for createSeedBatch transaction
 */
class CreateSeedBatchWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
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

        // DO NOT reset txIndex - let it accumulate across rounds
        // This ensures continuous, non-overlapping dataset access
        console.log(`[Worker ${workerIndex}] Initialized for Round ${roundIndex}. Current txIndex: ${this.txIndex}`);
    }

    /**
     * Submit transaction to create seed batch
     */
    async submitTransaction() {
        this.txIndex++;

        // Calculate index to pick from dataset based on worker and transaction index
        const dataIndex = (this.workerIndex + ((this.txIndex - 1) * this.totalWorkers)) % dataset.length;
        const data = dataset[dataIndex];

        const request = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'createSeedBatch',
            contractArguments: [
                data.variety,              // varietyName
                data.commodity,            // commodity
                data.harvestDate,          // harvestDate
                data.seedSourceNumber,     // seedSourceNumber
                data.origin,               // origin
                data.iupbNumber,           // iupbNumber
                data.seedClass,            // seedClass
                data.producerUUID,         // producerUUID
                data.seedSourceDocName,    // seedSourceDocName
                data.seedSourceIpfsCid,    // seedSourceIpfsCid
                data.declaredQuantity.toString(),  // declaredQuantity
                data.seedSourceDocHash     // seedSourceDocHash (SHA256 64 hex chars)
            ],
            readOnly: false,
            invokerIdentity: 'farmer1'  // farmer1 has role_producer
        };

        try {
            await this.sutAdapter.sendRequests(request);
        } catch (error) {
            // Ignore "already exists" errors to allow re-running tests without reset
            if (error.message && (error.message.includes('sudah ada') || error.message.includes('already exists'))) {
                // console.log(`Batch ${data.batchId} already exists, skipping...`);
                return;
            }
            throw error;
        }
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
