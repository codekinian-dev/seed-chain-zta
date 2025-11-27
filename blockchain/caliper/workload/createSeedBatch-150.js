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
        this.datasetOffset = 20000; // 150 TPS round: BATCH-20000 to BATCH-28999
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
        // Formula ensures continuous, unique batch IDs across all workers and rounds
        // Worker distribution: Worker 0 -> 0,5,10,15... | Worker 1 -> 1,6,11,16...
        // datasetOffset = 20000: This round uses BATCH-20000 to BATCH-28999
        const dataIndex = (this.datasetOffset + this.workerIndex + ((this.txIndex - 1) * this.totalWorkers)) % dataset.length;
        const data = dataset[dataIndex];

        // console.log(`[Worker ${this.workerIndex}] Round ${this.roundIndex}, Tx ${this.txIndex}: Using ${data.batchId} (index ${dataIndex})`);

        const request = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'createSeedBatch',
            contractArguments: [
                data.batchId,           // id
                data.variety,           // varietyName
                data.commodity,         // commodity
                data.harvestDate,       // harvestDate
                data.seedSourceNumber,  // seedSourceNumber
                data.origin,            // origin
                data.iupNumber,         // iupNumber
                data.seedClass,         // seedClass
                data.producerUUID,      // producerUUID
                data.seedSourceDocName, // seedSourceDocName
                data.seedSourceIpfsCid  // seedSourceIpfsCid
            ],
            readOnly: false,
            invokerIdentity: 'appUser'  // Single appUser with role_producer attribute
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
