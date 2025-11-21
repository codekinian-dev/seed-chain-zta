'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

/**
 * Workload module for evaluateInspection transaction
 */
class EvaluateInspectionWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.batchIds = [];
        this.txIndex = 0;
        this.chiefUUID = '750e8400-e29b-41d4-a716-446655440001';
        this.evaluationNotes = [
            'Hasil inspeksi lapangan sudah sesuai standar, disetujui untuk dilanjutkan ke tahap sertifikasi',
            'Laporan inspeksi lengkap dan detail, kualitas benih memenuhi persyaratan',
            'Verifikasi lapangan terkonfirmasi, benih layak untuk disertifikasi',
            'Evaluasi menyeluruh menunjukkan kesesuaian dengan standar mutu benih',
            'Dokumentasi inspeksi lengkap, proses dapat dilanjutkan'
        ];
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        const queryRequest = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'querySeedBatchesByStatus',
            contractArguments: ['INSPECTED'],
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
            console.warn('Could not fetch INSPECTED batches');
        }
    }

    async submitTransaction() {
        if (this.batchIds.length === 0) {
            console.warn('No INSPECTED batches available for evaluation');
            return;
        }

        this.txIndex++;

        const batchId = this.batchIds[Math.floor(Math.random() * this.batchIds.length)];
        const evaluationNote = this.evaluationNotes[Math.floor(Math.random() * this.evaluationNotes.length)];

        // 90% APPROVE, 10% REJECT for realistic testing
        const approvalStatus = Math.random() < 0.9 ? 'APPROVE' : 'REJECT';

        const request = {
            contractId: this.roundArguments.contractId,
            contractFunction: 'evaluateInspection',
            contractArguments: [
                batchId,
                evaluationNote,
                approvalStatus,
                this.chiefUUID  // UUID parameter now required
            ],
            readOnly: false,
            invokerIdentity: 'appUser'  // Single appUser
        };

        await this.sutAdapter.sendRequests(request);
    }
}

function createWorkloadModule() {
    return new EvaluateInspectionWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
