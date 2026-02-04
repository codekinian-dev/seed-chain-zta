<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  DocumentTextIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  ClockIcon,
  PaperClipIcon,
  ArrowLeftIcon,
  DocumentCheckIcon,
  UserGroupIcon,
  TruckIcon,
} from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'
import TimelineView from '../../components/batches/TimelineView.vue'
import ActorsView from '../../components/batches/ActorsView.vue'
import DocumentsView from '../../components/batches/DocumentsView.vue'
import { seedBatchService } from '../../services/api'
import { formatDate } from '../../utils/date-formatter'

const router = useRouter()
const route = useRoute()
const batchId = route.params.id

const batch = ref(null)
const loading = ref(false)
const error = ref(null)
const submitting = ref(false)
const submitSuccess = ref(null)
const submitError = ref(null)

// Files for different actions
const certFile = ref(null)
const inspectionFile = ref(null)
const certificateFile = ref(null)

// Form data for inspection
const inspectionForm = ref({
  inspectionResult: '',
  testedSampleQty: null,
  certifiedQty: null
})

// Form data for evaluation
const evaluationForm = ref({
  approvalStatus: 'APPROVE',
  evaluationNote: ''
})

// Form data for certificate
const certificateForm = ref({
  certNumber: '',
  expiryMonths: 12,
  certifiedQuantity: null
})

// Form data for distribution
const distributionForm = ref({
  destinationType: 'distributor',
  destinationName: '',
  destinationAddress: '',
  quantity: null
})

// Distribution evidence file (optional)
const distributionEvidence = ref(null)

const statusToneClass = (status) => {
  const statusMap = {
    'REGISTERED': 'warning',
    'SUBMITTED': 'warning',
    'INSPECTED': 'warning',
    'EVALUATED': 'success',
    'CERTIFIED': 'success',
    'DISTRIBUTED': 'info',
    'REVOKED': 'error',
  }
  
  const tone = statusMap[status] || 'default'
  
  const map = {
    success: 'bg-primary/10 text-primary',
    warning: 'bg-sunshine/10 text-sunshine',
    info: 'bg-ocean/10 text-ocean',
    error: 'bg-red-100 text-red-700',
    default: 'bg-ink/10 text-ink/70'
  }
  return map[tone]
}

const formatStatus = (status) => {
  const statusLabels = {
    'REGISTERED': 'Registered',
    'SUBMITTED': 'Submitted',
    'INSPECTED': 'Inspected',
    'EVALUATED': 'Evaluated',
    'CERTIFIED': 'Certified',
    'DISTRIBUTED': 'Distributed',
    'REVOKED': 'Revoked',
  }
  return statusLabels[status] || status
}

// Computed: check if batch has nested structure
const hasNestedData = computed(() => {
  return batch.value && (
    batch.value.actors || 
    batch.value.events || 
    batch.value.certification
  )
})

const canSubmitCertification = () => {
  return batch.value && batch.value.current_status === 'REGISTERED' && hasRole('role_producer')
}

const canUploadInspection = () => {
  return batch.value && batch.value.current_status === 'SUBMITTED' && hasRole('role_pbt_field')
}

const canEvaluate = () => {
  return batch.value && batch.value.current_status === 'INSPECTED' && hasRole('role_pbt_chief')
}

const canIssueCertificate = () => {
  return batch.value && batch.value.current_status === 'EVALUATED' && hasRole('role_lsm_head')
}

const canDistribute = () => {
  return batch.value && batch.value.current_status === 'CERTIFIED' && hasRole('role_producer')
}

const hasRole = (roleName) => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const roles = user.roles || []
    return roles.includes(roleName)
  } catch (e) {
    console.error('Error checking role:', e)
    return false
  }
}

const handleFileChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      submitError.value = 'File size must be less than 10MB'
      return
    }
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowedTypes.includes(file.type)) {
      submitError.value = 'File must be PDF or Word document'
      return
    }
    
    certFile.value = file
    submitError.value = null
  }
}

const handleSubmitCertification = async () => {
  if (!certFile.value) {
    submitError.value = 'Please upload a certification document'
    return
  }

  submitting.value = true
  submitError.value = null
  submitSuccess.value = null

  try {
    const data = new FormData()
    data.append('document', certFile.value)

    await seedBatchService.submitCertificationRequest(batchId, data)
    
    submitSuccess.value = 'Certification request submitted successfully!'
    
    // Reload batch data
    await loadBatch()
    
    // Clear form
    certFile.value = null
  } catch (err) {
    submitError.value = err.message || 'Failed to submit certification request'
    console.error('Error submitting certification:', err)
  } finally {
    submitting.value = false
  }
}

const handleUploadInspection = async () => {
  if (!inspectionFile.value) {
    submitError.value = 'Please upload an inspection report'
    return
  }

  if (!inspectionForm.value.inspectionResult || inspectionForm.value.inspectionResult.length < 10) {
    submitError.value = 'Inspection result is required (min 10 characters)'
    return
  }

  if (inspectionForm.value.testedSampleQty === null || inspectionForm.value.testedSampleQty < 0) {
    submitError.value = 'Tested sample quantity is required and must be >= 0'
    return
  }

  if (!inspectionForm.value.certifiedQty || inspectionForm.value.certifiedQty <= 0) {
    submitError.value = 'Certified quantity is required and must be > 0'
    return
  }

  submitting.value = true
  submitError.value = null
  submitSuccess.value = null

  try {
    const data = new FormData()
    data.append('photo', inspectionFile.value)
    data.append('inspectionResult', inspectionForm.value.inspectionResult)
    data.append('testedSampleQty', inspectionForm.value.testedSampleQty.toString())
    data.append('certifiedQty', inspectionForm.value.certifiedQty.toString())

    await seedBatchService.recordInspection(batchId, data)
    
    submitSuccess.value = 'Inspection report uploaded successfully!'
    
    // Reload batch data
    await loadBatch()
    
    // Clear form
    inspectionFile.value = null
    inspectionForm.value.inspectionResult = ''
    inspectionForm.value.testedSampleQty = null
    inspectionForm.value.certifiedQty = null
  } catch (err) {
    submitError.value = err.message || 'Failed to upload inspection report'
    console.error('Error uploading inspection:', err)
  } finally {
    submitting.value = false
  }
}

const handleEvaluate = async () => {
  if (!evaluationForm.value.evaluationNote || evaluationForm.value.evaluationNote.length < 10) {
    submitError.value = 'Evaluation note must be at least 10 characters'
    return
  }

  submitting.value = true
  submitError.value = null
  submitSuccess.value = null

  try {
    await seedBatchService.evaluateInspection(batchId, evaluationForm.value)
    
    submitSuccess.value = `Batch ${evaluationForm.value.approvalStatus === 'APPROVE' ? 'approved' : 'rejected'} successfully!`
    
    // Reload batch data
    await loadBatch()
    
    // Clear form
    evaluationForm.value = { approvalStatus: 'APPROVE', evaluationNote: '' }
  } catch (err) {
    submitError.value = err.message || 'Failed to evaluate batch'
    console.error('Error evaluating batch:', err)
  } finally {
    submitting.value = false
  }
}

const handleIssueCertificate = async () => {
  if (!certificateForm.value.certNumber || certificateForm.value.certNumber.length < 5) {
    submitError.value = 'Certificate number is required (min 5 characters)'
    return
  }

  if (certificateForm.value.expiryMonths < 1 || certificateForm.value.expiryMonths > 120) {
    submitError.value = 'Expiry months must be between 1 and 120'
    return
  }

  if (!certificateForm.value.certifiedQuantity || certificateForm.value.certifiedQuantity <= 0) {
    submitError.value = 'Certified quantity is required and must be > 0'
    return
  }

  if (!certificateFile.value) {
    submitError.value = 'Please upload certificate document'
    return
  }

  submitting.value = true
  submitError.value = null
  submitSuccess.value = null

  try {
    const data = new FormData()
    data.append('certNumber', certificateForm.value.certNumber)
    data.append('expiryMonths', certificateForm.value.expiryMonths.toString())
    data.append('certifiedQuantity', certificateForm.value.certifiedQuantity.toString())
    data.append('certificate', certificateFile.value)

    await seedBatchService.issueCertificate(batchId, data)
    
    submitSuccess.value = 'Certificate issued successfully!'
    
    // Reload batch data
    await loadBatch()
    
    // Clear form
    certificateForm.value = { certNumber: '', expiryMonths: 12, certifiedQuantity: null }
    certificateFile.value = null
  } catch (err) {
    submitError.value = err.message || 'Failed to issue certificate'
    console.error('Error issuing certificate:', err)
  } finally {
    submitting.value = false
  }
}

const handleDistribute = async () => {
  if (!distributionForm.value.destinationName || distributionForm.value.destinationName.length < 3) {
    submitError.value = 'Destination name is required (min 3 characters)'
    return
  }

  if (!distributionForm.value.destinationAddress || distributionForm.value.destinationAddress.length < 5) {
    submitError.value = 'Destination address is required (min 5 characters)'
    return
  }

  if (!distributionForm.value.quantity || distributionForm.value.quantity <= 0) {
    submitError.value = 'Quantity must be greater than 0'
    return
  }

  submitting.value = true
  submitError.value = null
  submitSuccess.value = null

  try {
    const data = new FormData()
    data.append('destinationType', distributionForm.value.destinationType)
    data.append('destinationName', distributionForm.value.destinationName)
    data.append('destinationAddress', distributionForm.value.destinationAddress)
    data.append('quantity', distributionForm.value.quantity.toString())
    
    // Add evidence file if provided (optional)
    if (distributionEvidence.value) {
      data.append('evidence', distributionEvidence.value)
    }

    await seedBatchService.recordDistribution(batchId, data)
    
    submitSuccess.value = 'Distribution recorded successfully!'
    
    // Reload batch data
    await loadBatch()
    
    // Clear form
    distributionForm.value = { destinationType: 'distributor', destinationName: '', destinationAddress: '', quantity: null }
    distributionEvidence.value = null
  } catch (err) {
    submitError.value = err.message || 'Failed to record distribution'
    console.error('Error recording distribution:', err)
  } finally {
    submitting.value = false
  }
}

const handleInspectionFileChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    if (file.size > 10 * 1024 * 1024) {
      submitError.value = 'File size must be less than 10MB'
      return
    }
    
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowedTypes.includes(file.type)) {
      submitError.value = 'File must be PDF or Word document'
      return
    }
    
    inspectionFile.value = file
    submitError.value = null
  }
}

const handleCertificateFileChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    if (file.size > 10 * 1024 * 1024) {
      submitError.value = 'File size must be less than 10MB'
      return
    }
    
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowedTypes.includes(file.type)) {
      submitError.value = 'File must be PDF or Word document'
      return
    }
    
    certificateFile.value = file
    submitError.value = null
  }
}

const handleDistributionEvidenceChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    if (file.size > 10 * 1024 * 1024) {
      submitError.value = 'File size must be less than 10MB'
      return
    }
    
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']
    if (!allowedTypes.includes(file.type)) {
      submitError.value = 'File must be PDF, Word document, or image (JPEG, PNG)'
      return
    }
    
    distributionEvidence.value = file
    submitError.value = null
  }
}

const loadBatch = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await seedBatchService.getBatchById(batchId)
    
    // Backend sudah return nested structure + flattened fields
    const data = response.data
    
    // Store full batch data (backend transformer already handles this)
    batch.value = data
    
    console.log('Loaded batch detail:', batch.value)
    console.log('Certificate info:', {
      cert_number: batch.value?.cert_number,
      cert_issue_date: batch.value?.cert_issue_date,
      cert_expiry_date: batch.value?.cert_expiry_date,
      cert_issued_at: batch.value?.cert_issued_at,
      cert_expires_at: batch.value?.cert_expires_at,
      certification: batch.value?.certification
    })
    console.log('Distributions:', batch.value?.distributions)
    console.log('Quantity:', batch.value?.quantity)
  } catch (err) {
    error.value = err.message || 'Failed to load seed batch'
    console.error('Error loading batch:', err)
  } finally {
    loading.value = false
  }
}

const goBack = () => router.push('/seed-batches')

onMounted(() => {
  loadBatch()
})
</script>

<template>
  <DashboardLayout
    page-title="Seed Batch Detail"
    page-subtitle="View batch information and submit certification request."
  >
    <template #header-actions>
      <button class="secondary-button" @click="goBack">
        <ArrowLeftIcon class="w-5 h-5" />
        Back to list
      </button>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="text-center">
        <div class="inline-block w-8 h-8 border-4 rounded-full border-t-transparent border-primary animate-spin"></div>
        <p class="mt-2 text-sm text-ink/60">Loading batch details...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="p-4 text-sm text-red-700 bg-red-100 rounded-lg">
      {{ error }}
    </div>

    <!-- Content -->
    <div v-else-if="batch" class="grid gap-6 lg:grid-cols-[2fr,1fr] lg:items-start">
      <div class="space-y-6">
        <!-- Batch Information -->
        <section class="p-6 panel-card">
          <div class="flex items-center justify-between gap-3 mb-6">
            <div class="flex items-center gap-3">
              <DocumentTextIcon class="w-6 h-6 text-primary" />
              <div>
                <h3 class="text-lg font-semibold text-ink">Batch Information</h3>
                <p class="text-sm text-ink/60">Seed batch details and status.</p>
              </div>
            </div>
            <span :class="['status-pill', statusToneClass(batch.current_status)]">
              {{ formatStatus(batch.current_status) }}
            </span>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs font-semibold text-ink/60">Batch ID</label>
              <p class="mt-1 text-sm font-semibold text-ink">{{ batch.id }}</p>
            </div>
            <div>
              <label class="text-xs font-semibold text-ink/60">Variety Name</label>
              <p class="mt-1 text-sm text-ink">{{ batch.variety_name }}</p>
            </div>
            <div>
              <label class="text-xs font-semibold text-ink/60">Commodity</label>
              <p class="mt-1 text-sm text-ink">{{ batch.commodity }}</p>
            </div>
            <div>
              <label class="text-xs font-semibold text-ink/60">Harvest Date</label>
              <p class="mt-1 text-sm text-ink">{{ batch.harvest_date }}</p>
            </div>
            <div>
              <label class="text-xs font-semibold text-ink/60">Seed Source Number</label>
              <p class="mt-1 text-sm text-ink">{{ batch.seed_source_number }}</p>
            </div>
            <div>
              <label class="text-xs font-semibold text-ink/60">Origin</label>
              <p class="mt-1 text-sm text-ink">{{ batch.origin }}</p>
            </div>
            <div>
              <label class="text-xs font-semibold text-ink/60">IUP Number</label>
              <p class="mt-1 text-sm text-ink">{{ batch.iup_number }}</p>
            </div>
            <div>
              <label class="text-xs font-semibold text-ink/60">Seed Class</label>
              <p class="mt-1 text-sm text-ink">{{ batch.seed_class }}</p>
            </div>
            <div>
              <label class="text-xs font-semibold text-ink/60">Label Color</label>
              <p class="mt-1 text-sm text-ink">{{ batch.label_color }}</p>
            </div>
            <div>
              <label class="text-xs font-semibold text-ink/60">Created By</label>
              <p class="mt-1 text-sm text-ink">{{ batch.created_by }}</p>
            </div>
            <div class="md:col-span-2">
              <label class="text-xs font-semibold text-ink/60">Created At</label>
              <p class="mt-1 text-sm text-ink">{{ formatDate(batch.created_at) }}</p>
            </div>
            
            <!-- Certificate info (if certified) -->
            <div v-if="batch.cert_number" class="md:col-span-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div class="grid gap-3 md:grid-cols-3">
                <div>
                  <label class="text-xs font-semibold text-primary">Certificate Number</label>
                  <p class="mt-1 text-sm font-semibold text-ink">{{ batch.cert_number }}</p>
                </div>
                <div>
                  <label class="text-xs font-semibold text-primary">Issue Date</label>
                  <p class="mt-1 text-sm text-ink">{{ formatDate(batch.cert_issue_date || batch.cert_issued_at || batch.certification?.issued_at) }}</p>
                </div>
                <div>
                  <label class="text-xs font-semibold text-primary">Expiry Date</label>
                  <p class="mt-1 text-sm text-ink">{{ formatDate(batch.cert_expiry_date || batch.cert_expires_at || batch.certification?.expires_at) }}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Actors Section (if nested data available) -->
        <section v-if="hasNestedData && batch.actors" class="p-6 panel-card">
          <div class="flex items-center gap-3 mb-6">
            <UserGroupIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Actors</h3>
              <p class="text-sm text-ink/60">Users involved in this batch lifecycle.</p>
            </div>
          </div>
          <ActorsView :batch="batch" />
        </section>

        <!-- Timeline Section (if nested data available) -->
        <section v-if="hasNestedData && batch.events" class="p-6 panel-card">
          <div class="flex items-center gap-3 mb-6">
            <ClockIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Event Timeline</h3>
              <p class="text-sm text-ink/60">Chronological history of batch events.</p>
            </div>
          </div>
          <TimelineView :batch="batch" />
        </section>

        <!-- Documents Section -->
        <section v-if="batch.documents && batch.documents.length > 0" class="p-6 panel-card">
          <div class="flex items-center gap-3 mb-6">
            <DocumentTextIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Documents</h3>
              <p class="text-sm text-ink/60">Files uploaded during certification process.</p>
            </div>
          </div>
          <DocumentsView :batch="batch" />
        </section>

        <!-- Distributions Section - Show if batch has distributions OR if status is CERTIFIED/DISTRIBUTED -->
        <section v-if="(batch.distributions && batch.distributions.length > 0) || ['CERTIFIED', 'DISTRIBUTED'].includes(batch.current_status)" class="p-6 panel-card">
          <div class="flex items-center gap-3 mb-6">
            <TruckIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Seed Distributions</h3>
              <p class="text-sm text-ink/60">Records of seed distribution to various destinations.</p>
            </div>
          </div>
          
          <div class="space-y-4">
            <!-- No distributions yet message -->
            <div v-if="!batch.distributions || batch.distributions.length === 0" class="p-4 text-center text-ink/60 bg-ink/5 rounded-lg">
              <p class="text-sm">No distributions recorded yet.</p>
            </div>
            
            <!-- Distribution list -->
            <div v-for="(dist, index) in batch.distributions" :key="dist.dist_id || index" class="p-4 bg-ink/5 rounded-lg border border-ink/10">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">{{ dist.dist_id }}</span>
                    <span class="text-xs text-ink/60">{{ formatDate(dist.distributed_at) }}</span>
                  </div>
                  <div class="grid gap-3 md:grid-cols-2">
                    <div>
                      <label class="text-xs font-semibold text-ink/60">Destination</label>
                      <p class="text-sm text-ink">{{ dist.to?.name || '-' }}</p>
                    </div>
                    <div>
                      <label class="text-xs font-semibold text-ink/60">Type</label>
                      <p class="text-sm text-ink">{{ dist.to?.destination_type || '-' }}</p>
                    </div>
                    <div>
                      <label class="text-xs font-semibold text-ink/60">Address</label>
                      <p class="text-sm text-ink">{{ dist.to?.address || '-' }}</p>
                    </div>
                    <div>
                      <label class="text-xs font-semibold text-ink/60">Quantity</label>
                      <p class="text-sm font-semibold text-ink">{{ dist.qty }} {{ batch.quantity?.qty_base_unit || 'kg' }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Distribution Summary -->
            <div v-if="batch.quantity" class="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <h4 class="text-sm font-semibold text-primary mb-3">Distribution Summary</h4>
              <div class="grid gap-3 md:grid-cols-4">
                <div>
                  <label class="text-xs font-semibold text-ink/60">Certified</label>
                  <p class="text-sm font-semibold text-ink">{{ batch.quantity.certified || 0 }} {{ batch.quantity.qty_base_unit || 'kg' }}</p>
                </div>
                <div>
                  <label class="text-xs font-semibold text-ink/60">Distributed</label>
                  <p class="text-sm font-semibold text-ink">{{ batch.quantity.distributed_total || 0 }} {{ batch.quantity.qty_base_unit || 'kg' }}</p>
                </div>
                <div>
                  <label class="text-xs font-semibold text-ink/60">Remaining</label>
                  <p class="text-sm font-semibold text-primary">{{ batch.quantity.remaining || 0 }} {{ batch.quantity.qty_base_unit || 'kg' }}</p>
                </div>
                <div>
                  <label class="text-xs font-semibold text-ink/60">Total Distributions</label>
                  <p class="text-sm font-semibold text-ink">{{ batch.distributions?.length || 0 }}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Submit Certification (REGISTERED - role_producer) -->
        <section v-if="canSubmitCertification()" class="p-6 panel-card">
          <div class="flex items-center gap-3 mb-6">
            <DocumentCheckIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Submit Certification Request</h3>
              <p class="text-sm text-ink/60">Upload certification documents to proceed.</p>
            </div>
          </div>

          <!-- Success Message -->
          <div v-if="submitSuccess" class="p-4 mb-4 text-sm text-green-700 bg-green-100 rounded-lg">
            {{ submitSuccess }}
          </div>

          <!-- Error Message -->
          <div v-if="submitError" class="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
            {{ submitError }}
          </div>

          <div class="flex flex-col items-center gap-4 p-6 transition border-2 border-dashed rounded-lg border-ink/10 hover:border-primary/30 bg-ink/5">
            <CloudArrowUpIcon class="w-12 h-12 text-ink/30" />
            <p class="text-sm text-ink/70">
              <label for="cert-file" class="font-semibold cursor-pointer text-primary hover:text-primary-dark">
                Choose certification document
                <input 
                  id="cert-file" 
                  type="file" 
                  accept=".pdf,.doc,.docx"
                  class="hidden" 
                  @change="handleFileChange"
                  :disabled="submitting"
                />
              </label>
              or drag and drop
            </p>
            <p class="mt-1 text-xs text-ink/60">PDF, DOC, DOCX • max 10MB</p>
            
            <div v-if="certFile" class="flex items-center justify-center gap-2 px-4 py-2 mt-4 bg-white border rounded-lg border-ink/10">
              <PaperClipIcon class="w-5 h-5 text-primary" />
              <span class="text-sm text-ink">{{ certFile.name }}</span>
              <button 
                @click="certFile = null" 
                class="ml-2 text-xs text-red-600 hover:text-red-800"
                :disabled="submitting"
              >
                Remove
              </button>
            </div>

            <button 
              v-if="certFile"
              @click="handleSubmitCertification"
              class="mx-auto mt-4 primary-button"
              :disabled="submitting"
            >
              <span v-if="submitting">Submitting...</span>
              <span v-else>Submit Certification Request</span>
            </button>
          </div>
        </section>

        <!-- Upload Inspection (SUBMITTED - role_pbt_field) -->
        <section v-else-if="canUploadInspection()" class="p-6 panel-card">
          <div class="flex items-center gap-3 mb-6">
            <DocumentTextIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Field Inspection</h3>
              <p class="text-sm text-ink/60">Upload inspection report for this batch.</p>
            </div>
          </div>

          <!-- Success/Error Messages -->
          <div v-if="submitSuccess" class="p-4 mb-4 text-sm text-green-700 bg-green-100 rounded-lg">
            {{ submitSuccess }}
          </div>
          <div v-if="submitError" class="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
            {{ submitError }}
          </div>

          <div class="space-y-4">
            <!-- Inspection Result Text -->
            <div>
              <label class="block mb-2 text-sm font-semibold text-ink">Inspection Result *</label>
              <textarea 
                v-model="inspectionForm.inspectionResult"
                rows="6"
                class="w-full px-4 py-2 border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Enter detailed inspection findings, observations, and assessment results (min 10 characters)..."
                :disabled="submitting"
              ></textarea>
              <p class="mt-1 text-xs text-ink/60">Minimum 10 characters, maximum 2000 characters</p>
            </div>

            <!-- Quantity Fields -->
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="block mb-2 text-sm font-semibold text-ink">Tested Sample Quantity (kg) *</label>
                <input 
                  v-model.number="inspectionForm.testedSampleQty"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full px-4 py-2 border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g., 100"
                  :disabled="submitting"
                />
                <p class="mt-1 text-xs text-ink/60">Quantity of seeds sampled for testing (can be 0)</p>
              </div>
              <div>
                <label class="block mb-2 text-sm font-semibold text-ink">Certified Quantity (kg) *</label>
                <input 
                  v-model.number="inspectionForm.certifiedQty"
                  type="number"
                  min="0.01"
                  step="0.01"
                  class="w-full px-4 py-2 border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g., 900"
                  :disabled="submitting"
                />
                <p class="mt-1 text-xs text-ink/60">Quantity eligible for certification (must be &lt;= declared)</p>
              </div>
            </div>

            <!-- File Upload -->
            <div class="flex flex-col items-center gap-4 p-6 transition border-2 border-dashed rounded-lg border-ink/10 hover:border-primary/30 bg-ink/5">
              <CloudArrowUpIcon class="w-12 h-12 text-ink/30" />
              <p class="text-sm text-ink/70">
                <label for="inspection-file" class="font-semibold cursor-pointer text-primary hover:text-primary-dark">
                  Choose inspection report
                  <input 
                    id="inspection-file" 
                    type="file" 
                    accept=".pdf,.doc,.docx"
                    class="hidden" 
                    @change="handleInspectionFileChange"
                    :disabled="submitting"
                  />
                </label>
                or drag and drop
              </p>
              <p class="mt-1 text-xs text-ink/60">PDF, DOC, DOCX • max 10MB</p>
              
              <div v-if="inspectionFile" class="flex items-center justify-center gap-2 px-4 py-2 mt-4 bg-white border rounded-lg border-ink/10">
                <PaperClipIcon class="w-5 h-5 text-primary" />
                <span class="text-sm text-ink">{{ inspectionFile.name }}</span>
                <button 
                  @click="inspectionFile = null" 
                  class="ml-2 text-xs text-red-600 hover:text-red-800"
                  :disabled="submitting"
                >
                  Remove
                </button>
              </div>
            </div>

            <button 
              @click="handleUploadInspection"
              class="w-full primary-button"
              :disabled="submitting || !inspectionFile || !inspectionForm.inspectionResult || inspectionForm.testedSampleQty === null || !inspectionForm.certifiedQty"
            >
              <span v-if="submitting">Uploading...</span>
              <span v-else>Upload Inspection Report</span>
            </button>
          </div>
        </section>

        <!-- Evaluation (INSPECTED - role_pbt_chief) -->
        <section v-else-if="canEvaluate()" class="p-6 panel-card">
          <div class="flex items-center gap-3 mb-6">
            <CheckCircleIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Evaluation</h3>
              <p class="text-sm text-ink/60">Evaluate inspection results and approve or reject.</p>
            </div>
          </div>

          <!-- Success/Error Messages -->
          <div v-if="submitSuccess" class="p-4 mb-4 text-sm text-green-700 bg-green-100 rounded-lg">
            {{ submitSuccess }}
          </div>
          <div v-if="submitError" class="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
            {{ submitError }}
          </div>

          <div class="space-y-4">
            <div>
              <label class="block mb-2 text-sm font-semibold text-ink">Approval Status</label>
              <select 
                v-model="evaluationForm.approvalStatus"
                class="w-full px-4 py-2 border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
                :disabled="submitting"
              >
                <option value="APPROVE">Approve</option>
                <option value="REJECT">Reject</option>
              </select>
            </div>

            <div>
              <label class="block mb-2 text-sm font-semibold text-ink">Evaluation Note *</label>
              <textarea 
                v-model="evaluationForm.evaluationNote"
                rows="4"
                class="w-full px-4 py-2 border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Enter evaluation notes (min 10 characters)..."
                :disabled="submitting"
              ></textarea>
              <p class="mt-1 text-xs text-ink/60">Minimum 10 characters</p>
            </div>

            <button 
              @click="handleEvaluate"
              class="w-full primary-button"
              :disabled="submitting"
            >
              <span v-if="submitting">Submitting...</span>
              <span v-else>Submit Evaluation</span>
            </button>
          </div>
        </section>

        <!-- Issue Certificate (EVALUATED - role_lsm_head) -->
        <section v-else-if="canIssueCertificate()" class="p-6 panel-card">
          <div class="flex items-center gap-3 mb-6">
            <DocumentCheckIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Issue Certificate</h3>
              <p class="text-sm text-ink/60">Generate and issue certification for this batch.</p>
            </div>
          </div>

          <!-- Success/Error Messages -->
          <div v-if="submitSuccess" class="p-4 mb-4 text-sm text-green-700 bg-green-100 rounded-lg">
            {{ submitSuccess }}
          </div>
          <div v-if="submitError" class="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
            {{ submitError }}
          </div>

          <div class="space-y-4">
            <div>
              <label class="block mb-2 text-sm font-semibold text-ink">Certificate Number *</label>
              <input 
                v-model="certificateForm.certNumber"
                type="text"
                class="w-full px-4 py-2 border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="e.g., CERT-2026-001"
                :disabled="submitting"
              />
              <p class="mt-1 text-xs text-ink/60">Minimum 5 characters, maximum 50 characters</p>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="block mb-2 text-sm font-semibold text-ink">Expiry Period (Months) *</label>
                <input 
                  v-model.number="certificateForm.expiryMonths"
                  type="number"
                  min="1"
                  max="120"
                  class="w-full px-4 py-2 border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  :disabled="submitting"
                />
                <p class="mt-1 text-xs text-ink/60">Between 1 and 120 months</p>
              </div>
              <div>
                <label class="block mb-2 text-sm font-semibold text-ink">Certified Quantity (kg) *</label>
                <input 
                  v-model.number="certificateForm.certifiedQuantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  class="w-full px-4 py-2 border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g., 900"
                  :disabled="submitting"
                />
                <p class="mt-1 text-xs text-ink/60">Total quantity to be certified</p>
              </div>
            </div>

            <!-- Certificate Document Upload -->
            <div>
              <label class="block mb-2 text-sm font-semibold text-ink">Certificate Document *</label>
              <div class="flex flex-col items-center gap-4 p-6 transition border-2 border-dashed rounded-lg border-ink/10 hover:border-primary/30 bg-ink/5">
                <CloudArrowUpIcon class="w-12 h-12 text-ink/30" />
                <p class="text-sm text-ink/70">
                  <label for="certificate-file" class="font-semibold cursor-pointer text-primary hover:text-primary-dark">
                    Choose certificate document
                    <input 
                      id="certificate-file" 
                      type="file" 
                      accept=".pdf,.doc,.docx"
                      class="hidden" 
                      @change="handleCertificateFileChange"
                      :disabled="submitting"
                    />
                  </label>
                  or drag and drop
                </p>
                <p class="mt-1 text-xs text-ink/60">PDF, DOC, DOCX • max 10MB</p>
                
                <div v-if="certificateFile" class="flex items-center justify-center gap-2 px-4 py-2 mt-4 bg-white border rounded-lg border-ink/10">
                  <PaperClipIcon class="w-5 h-5 text-primary" />
                  <span class="text-sm text-ink">{{ certificateFile.name }}</span>
                  <button 
                    @click="certificateFile = null" 
                    class="ml-2 text-xs text-red-600 hover:text-red-800"
                    :disabled="submitting"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>

            <button 
              @click="handleIssueCertificate"
              class="w-full primary-button"
              :disabled="submitting || !certificateFile || !certificateForm.certNumber || !certificateForm.certifiedQuantity"
            >
              <span v-if="submitting">Issuing...</span>
              <span v-else>Issue Certificate</span>
            </button>
          </div>
        </section>

        <!-- Distribution (CERTIFIED - role_producer) -->
        <section v-else-if="canDistribute()" class="p-6 panel-card">
          <div class="flex items-center gap-3 mb-6">
            <CloudArrowUpIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Distribution</h3>
              <p class="text-sm text-ink/60">Record distribution information for certified batch.</p>
            </div>
          </div>

          <!-- Success/Error Messages -->
          <div v-if="submitSuccess" class="p-4 mb-4 text-sm text-green-700 bg-green-100 rounded-lg">
            {{ submitSuccess }}
          </div>
          <div v-if="submitError" class="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
            {{ submitError }}
          </div>

          <div class="space-y-4">
            <div>
              <label class="block mb-2 text-sm font-semibold text-ink">Destination Type *</label>
              <select 
                v-model="distributionForm.destinationType"
                class="w-full px-4 py-2 border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
                :disabled="submitting"
              >
                <option value="distributor">Distributor</option>
                <option value="retailer">Retailer</option>
                <option value="farmer">Farmer</option>
                <option value="cooperative">Cooperative</option>
                <option value="government">Government Agency</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label class="block mb-2 text-sm font-semibold text-ink">Destination Name *</label>
              <input 
                v-model="distributionForm.destinationName"
                type="text"
                class="w-full px-4 py-2 border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="e.g., PT Pertani, Koperasi Tani Jaya"
                :disabled="submitting"
              />
              <p class="mt-1 text-xs text-ink/60">Minimum 3 characters</p>
            </div>

            <div>
              <label class="block mb-2 text-sm font-semibold text-ink">Destination Address *</label>
              <textarea 
                v-model="distributionForm.destinationAddress"
                rows="3"
                class="w-full px-4 py-2 border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="e.g., Jl. Raya Bogor No. 123, Jakarta"
                :disabled="submitting"
              ></textarea>
              <p class="mt-1 text-xs text-ink/60">Minimum 5 characters</p>
            </div>

            <div>
              <label class="block mb-2 text-sm font-semibold text-ink">Quantity (kg) *</label>
              <input 
                v-model.number="distributionForm.quantity"
                type="number"
                min="0.01"
                step="0.01"
                class="w-full px-4 py-2 border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="e.g., 1000"
                :disabled="submitting"
              />
              <p class="mt-1 text-xs text-ink/60">Must be greater than 0</p>
            </div>

            <!-- Evidence Upload (Optional) -->
            <div>
              <label class="block mb-2 text-sm font-semibold text-ink">Evidence Document (Optional)</label>
              <div class="flex flex-col items-center gap-4 p-6 transition border-2 border-dashed rounded-lg border-ink/10 hover:border-primary/30 bg-ink/5">
                <CloudArrowUpIcon class="w-12 h-12 text-ink/30" />
                <p class="text-sm text-ink/70">
                  <label for="evidence-file" class="font-semibold cursor-pointer text-primary hover:text-primary-dark">
                    Choose evidence document
                    <input 
                      id="evidence-file" 
                      type="file" 
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      class="hidden" 
                      @change="handleDistributionEvidenceChange"
                      :disabled="submitting"
                    />
                  </label>
                  or drag and drop
                </p>
                <p class="mt-1 text-xs text-ink/60">PDF, DOC, DOCX, JPEG, PNG • max 10MB</p>
                
                <div v-if="distributionEvidence" class="flex items-center justify-center gap-2 px-4 py-2 mt-4 bg-white border rounded-lg border-ink/10">
                  <PaperClipIcon class="w-5 h-5 text-primary" />
                  <span class="text-sm text-ink">{{ distributionEvidence.name }}</span>
                  <button 
                    @click="distributionEvidence = null" 
                    class="ml-2 text-xs text-red-600 hover:text-red-800"
                    :disabled="submitting"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>

            <button 
              @click="handleDistribute"
              class="w-full primary-button"
              :disabled="submitting || !distributionForm.destinationName || !distributionForm.destinationAddress || !distributionForm.quantity"
            >
              <span v-if="submitting">Recording...</span>
              <span v-else>Record Distribution</span>
            </button>
          </div>
        </section>

        <!-- Status Info (No Action Available) -->
        <section v-else class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <CheckCircleIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Batch Status</h3>
              <p class="text-sm text-ink/60">
                <span v-if="batch.current_status === 'REGISTERED'">Waiting for producer to submit certification request.</span>
                <span v-else-if="batch.current_status === 'SUBMITTED'">Waiting for field inspection by PBT Field.</span>
                <span v-else-if="batch.current_status === 'INSPECTED'">Waiting for evaluation by PBT Chief.</span>
                <span v-else-if="batch.current_status === 'EVALUATED'">Waiting for certificate issuance by LSM Head.</span>
                <span v-else-if="batch.current_status === 'CERTIFIED'">Certified. Ready for distribution by producer.</span>
                <span v-else-if="batch.current_status === 'DISTRIBUTED'">Batch has been distributed.</span>
                <span v-else-if="batch.current_status === 'REVOKED'">Certificate has been revoked.</span>
                <span v-else>Status: {{ batch.current_status }}</span>
              </p>
            </div>
          </div>
        </section>
      </div>

      <!-- Sidebar -->
      <aside class="space-y-6 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
        <div class="p-6 panel-card">
          <h3 class="text-lg font-semibold text-ink">Current Status</h3>
          <div class="mt-4">
            <span :class="['status-pill text-base', statusToneClass(batch.current_status)]">
              {{ formatStatus(batch.current_status) }}
            </span>
            <p class="mt-3 text-sm text-ink/60">
              Last updated: {{ formatDate(batch.updated_at || batch.created_at) }}
            </p>
          </div>
        </div>

        <div class="p-6 space-y-4 panel-card">
          <h3 class="text-lg font-semibold text-ink">Next Steps</h3>
          <ul class="space-y-3 text-sm text-ink/70">
            <!-- REGISTERED: Need to submit certification -->
            <li v-if="batch.current_status === 'REGISTERED'" class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-sunshine flex-shrink-0" />
              <span><strong>Producer:</strong> Submit certification request with documents</span>
            </li>
            
            <!-- SUBMITTED: Wait for field inspection -->
            <li v-else-if="batch.current_status === 'SUBMITTED'" class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
              <span>Certification submitted</span>
            </li>
            <li v-if="batch.current_status === 'SUBMITTED'" class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-sunshine flex-shrink-0" />
              <span><strong>PBT Field:</strong> Upload inspection report and findings</span>
            </li>
            
            <!-- INSPECTED: Wait for evaluation -->
            <li v-else-if="batch.current_status === 'INSPECTED'" class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
              <span>Field inspection completed</span>
            </li>
            <li v-if="batch.current_status === 'INSPECTED'" class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-sunshine flex-shrink-0" />
              <span><strong>PBT Chief:</strong> Evaluate inspection results and approve/reject</span>
            </li>
            
            <!-- EVALUATED: Wait for certificate -->
            <li v-else-if="batch.current_status === 'EVALUATED'" class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
              <span>Evaluation completed and approved</span>
            </li>
            <li v-if="batch.current_status === 'EVALUATED'" class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-sunshine flex-shrink-0" />
              <span><strong>LSM Head:</strong> Issue official certificate</span>
            </li>
            
            <!-- CERTIFIED: Ready for distribution -->
            <li v-else-if="batch.current_status === 'CERTIFIED'" class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
              <span>Certificate issued successfully</span>
            </li>
            <li v-if="batch.current_status === 'CERTIFIED'" class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-sunshine flex-shrink-0" />
              <span><strong>Producer:</strong> Record seed distribution details</span>
            </li>
            
            <!-- DISTRIBUTED: Process completed -->
            <li v-else-if="batch.current_status === 'DISTRIBUTED'" class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
              <span>Batch distributed - Process completed</span>
            </li>
            
            <!-- REVOKED: Certificate revoked -->
            <li v-else-if="batch.current_status === 'REVOKED'" class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-red-600 flex-shrink-0" />
              <span>Certificate has been revoked</span>
            </li>
            
            <!-- Pending steps (shown based on current status) -->
            <li v-if="['REGISTERED', 'SUBMITTED'].includes(batch.current_status)" class="flex items-start gap-3">
              <ClockIcon class="w-5 h-5 mt-0.5 text-ink/30 flex-shrink-0" />
              <span>Field inspection</span>
            </li>
            <li v-if="['REGISTERED', 'SUBMITTED', 'INSPECTED'].includes(batch.current_status)" class="flex items-start gap-3">
              <ClockIcon class="w-5 h-5 mt-0.5 text-ink/30 flex-shrink-0" />
              <span>Evaluation by PBT Chief</span>
            </li>
            <li v-if="['REGISTERED', 'SUBMITTED', 'INSPECTED', 'EVALUATED'].includes(batch.current_status)" class="flex items-start gap-3">
              <ClockIcon class="w-5 h-5 mt-0.5 text-ink/30 flex-shrink-0" />
              <span>Certificate issuance</span>
            </li>
            <li v-if="['REGISTERED', 'SUBMITTED', 'INSPECTED', 'EVALUATED', 'CERTIFIED'].includes(batch.current_status)" class="flex items-start gap-3">
              <ClockIcon class="w-5 h-5 mt-0.5 text-ink/30 flex-shrink-0" />
              <span>Distribution</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </DashboardLayout>
</template>
