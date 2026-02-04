'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

/**
 * Workload module for submitCertification transaction
 */
class SubmitCertificationWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.batchIds = [];
        this.txIndex = 0;
    }

    /**
     * Initialize the workload module
     */
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        // Query batches with REGISTERED status
        const queryRequest = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'querySeedBatchesByStatus',
            contractArguments: ['REGISTERED'],
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
            console.warn('Could not fetch REGISTERED batches');
        }
    }

    /**
     * Submit certification transaction
     */
    async submitTransaction() {
        if (this.batchIds.length === 0) {
            console.warn('No REGISTERED batches available for certification submission');
            return;
        }

        this.txIndex++;

        // Select a batch ID
        const batchId = this.batchIds[Math.floor(Math.random() * this.batchIds.length)];

        // Generate mock IPFS CID and document hash
        const ipfsCid = `Qm${this.generateRandomHash(44)}`;
        const documentName = `Dokumen Permohonan Sertifikasi ${this.txIndex}`;
        const testedSampleQty = (100 + Math.floor(Math.random() * 900)).toString(); // 100-1000 samples
        const docHash = this.generateSHA256Hash(); // SHA256 hash (64 hex chars)

        const request = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'submitCertification',
            contractArguments: [
                batchId,
                documentName,
                ipfsCid,
                testedSampleQty,
                docHash
            ],
            readOnly: false,
            invokerIdentity: 'appUser'
        };

        await this.sutAdapter.sendRequests(request);
    }

    /**
     * Generate random hash for IPFS CID simulation
     */
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

/**
 * Create a new instance of the workload module
 */
function createWorkloadModule() {
    return new SubmitCertificationWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
