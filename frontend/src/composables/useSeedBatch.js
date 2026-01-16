/**
 * useSeedBatch Composable
 * Seed batch state management
 */

import { ref, computed } from 'vue'
import { seedBatchService } from '../services/api'

export function useSeedBatch() {
    const batches = ref([])
    const currentBatch = ref(null)
    const batchHistory = ref([])
    const isLoading = ref(false)
    const error = ref(null)

    /**
     * Fetch my batches
     */
    const fetchMyBatches = async () => {
        isLoading.value = true
        error.value = null

        try {
            const response = await seedBatchService.getMyBatches()
            batches.value = response.data || response
            return response
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Fetch all batches
     */
    const fetchAllBatches = async (params = {}) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await seedBatchService.getAllBatches(params)
            batches.value = response.data || response
            return response
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Fetch batch by ID
     */
    const fetchBatchById = async (id) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await seedBatchService.getBatchById(id)
            currentBatch.value = response.data || response
            return response
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Fetch batch history
     */
    const fetchBatchHistory = async (id) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await seedBatchService.getBatchHistory(id)
            batchHistory.value = response.data || response
            return response
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Create batch
     */
    const createBatch = async (batchData) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await seedBatchService.createBatch(batchData)
            return response
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Submit certification request
     */
    const submitCertification = async (id, data) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await seedBatchService.submitCertificationRequest(id, data)
            return response
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Record inspection
     */
    const recordInspection = async (id, inspectionData) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await seedBatchService.recordInspection(id, inspectionData)
            return response
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Evaluate inspection
     */
    const evaluateInspection = async (id, evaluationData) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await seedBatchService.evaluateInspection(id, evaluationData)
            return response
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Issue certificate
     */
    const issueCertificate = async (id, certificateData) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await seedBatchService.issueCertificate(id, certificateData)
            return response
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Record distribution
     */
    const recordDistribution = async (id, distributionData) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await seedBatchService.recordDistribution(id, distributionData)
            return response
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Upload document
     */
    const uploadDocument = async (file) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await seedBatchService.uploadDocument(file)
            return response
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    return {
        // State
        batches: computed(() => batches.value),
        currentBatch: computed(() => currentBatch.value),
        batchHistory: computed(() => batchHistory.value),
        isLoading: computed(() => isLoading.value),
        error: computed(() => error.value),

        // Methods
        fetchMyBatches,
        fetchAllBatches,
        fetchBatchById,
        fetchBatchHistory,
        createBatch,
        submitCertification,
        recordInspection,
        evaluateInspection,
        issueCertificate,
        recordDistribution,
        uploadDocument,
    }
}
