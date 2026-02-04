'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

/**
 * Workload module for querySeedBatch transaction - 100 TPS Round
 * Updated for seedBatchContractZTA chaincode:
 * - Batch IDs are auto-generated (BATCH-YYYYMMDD-NNNN format)
 * - Fetches existing batch IDs from ledger, then queries randomly
 */
class QuerySeedBatchWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
        this.batchIds = [];
    }

    /**
     * Initialize the workload module
     */
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.totalWorkers = totalWorkers;

        // Fetch existing batch IDs from ledger
        const statuses = ['REGISTERED', 'SUBMITTED', 'CERTIFIED'];

        for (const status of statuses) {
            try {
                const queryRequest = {
                    contractId: this.roundArguments.contractId,
                    contractFunction: 'querySeedBatchesByStatus',
                    contractArguments: [status],
                    readOnly: true,
                    invokerIdentity: 'appUser'
                };

                const result = await this.sutAdapter.sendRequests(queryRequest);
                if (result && result.status === 'success' && result.result) {
                    const batches = JSON.parse(result.result.toString());
                    const ids = batches.map(b => b.Key || b.batch_id);
                    this.batchIds.push(...ids);
                }
            } catch (error) {
                console.warn(`Could not fetch ${status} batches: ${error.message}`);
            }
        }

        this.batchIds = [...new Set(this.batchIds)];

        if (this.batchIds.length === 0) {
            console.warn('[QuerySeedBatch-100] No existing batches found. Using fallback.');
            const today = new Date();
            const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
            for (let i = 1; i <= 100; i++) {
                this.batchIds.push(`BATCH-${dateStr}-${String(i).padStart(4, '0')}`);
            }
        }

        console.log(`[Worker ${workerIndex}] Found ${this.batchIds.length} batch IDs for 100 TPS query round`);
    }

    /**
     * Submit transaction to query seed batch
     */
    async submitTransaction() {
        this.txIndex++;

        const randomIndex = Math.floor(Math.random() * this.batchIds.length);
        const batchId = this.batchIds[randomIndex];

        const request = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'querySeedBatch',
            contractArguments: [batchId],
            readOnly: true,
            invokerIdentity: 'appUser'
        };

        try {
            await this.sutAdapter.sendRequests(request);
        } catch (error) {
            if (error.message && error.message.includes('tidak ditemukan')) {
                return;
            }
            throw error;
        }
    }
}

/**
 * Create a new instance of the workload module
 */
function createWorkloadModule() {
    return new QuerySeedBatchWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
