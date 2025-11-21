'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

/**
 * Workload module for recordInspection transaction
 */
class RecordInspectionWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.batchIds = [];
        this.txIndex = 0;
        this.inspectorUUID = '650e8400-e29b-41d4-a716-446655440001';
        this.inspectionResults = [
            'Tanaman sehat, bebas hama dan penyakit',
            'Pertumbuhan seragam, kondisi baik',
            'Memenuhi standar mutu benih',
            'Tanaman vigor, produktivitas tinggi',
            'Isolasi jarak terpenuhi, kondisi optimal'
        ];
    }

    /**
     * Initialize the workload module
     */
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        // Query batches with SUBMITTED status
        const queryRequest = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'querySeedBatchesByStatus',
            contractArguments: ['SUBMITTED'],
            readOnly: true,
            invokerIdentity: 'appUser'
        };

        try {
            const result = await this.sutAdapter.sendRequests(queryRequest);
            if (result && result.status === 'success') {
                const batches = JSON.parse(result.result.toString());
                this.batchIds = batches.map(b => b.id);
            }
        } catch (error) {
            console.warn('Could not fetch SUBMITTED batches');
        }
    }

    /**
     * Submit inspection transaction
     */
    async submitTransaction() {
        if (this.batchIds.length === 0) {
            console.warn('No SUBMITTED batches available for inspection');
            return;
        }

        this.txIndex++;

        const batchId = this.batchIds[Math.floor(Math.random() * this.batchIds.length)];
        const inspectionResult = this.inspectionResults[Math.floor(Math.random() * this.inspectionResults.length)];
        const ipfsPhotoCid = `Qm${this.generateRandomHash(44)}`;

        const request = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'recordInspection',
            contractArguments: [
                batchId,
                inspectionResult,
                ipfsPhotoCid,
                this.inspectorUUID  // UUID parameter now required
            ],
            readOnly: false,
            invokerIdentity: 'appUser'  // Single appUser
        };

        await this.sutAdapter.sendRequests(request);
    }

    generateRandomHash(length) {
        const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}

function createWorkloadModule() {
    return new RecordInspectionWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
