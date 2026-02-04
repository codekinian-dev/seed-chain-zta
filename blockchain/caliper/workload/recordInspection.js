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
                this.batchIds = batches.map(b => b.Key);
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
        const testedSampleQty = (50 + Math.floor(Math.random() * 450)).toString(); // 50-500 samples
        const certifiedQty = (1000 + Math.floor(Math.random() * 99000)).toString(); // 1000-100000 units
        const docHash = this.generateSHA256Hash(); // SHA256 hash (64 hex chars)

        const request = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'recordInspection',
            contractArguments: [
                batchId,
                inspectionResult,
                ipfsPhotoCid,
                this.inspectorUUID,  // inspectorFieldUUID
                testedSampleQty,
                certifiedQty,
                docHash
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

    /**
     * Generate SHA256 hash (64 hex characters)
     */
    generateSHA256Hash() {
        const hexChars = '0123456789abcdef';
        let result = '';
        for (let i = 0; i < 64; i++) {
            result += hexChars.charAt(Math.floor(Math.random() * hexChars.length));
        }
        return result;
    }
}

function createWorkloadModule() {
    return new RecordInspectionWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
