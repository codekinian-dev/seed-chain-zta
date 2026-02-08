<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  ShieldCheckIcon, 
  DocumentMagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentArrowDownIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  CloudArrowUpIcon,
  DocumentTextIcon,
  XMarkIcon,
  ArrowLeftIcon,
  FingerPrintIcon,
  UserIcon,
  CalendarDaysIcon,
  HashtagIcon,
  TruckIcon,
  MapPinIcon,
  CubeIcon
} from '@heroicons/vue/24/outline'
import documentService from '../../services/api/document.service'

const route = useRoute()
const router = useRouter()

// Verification mode: 'certificate' or 'file'
const verificationMode = ref('certificate')

// Certificate verification state
const certNumber = ref('')
const batchId = ref('')
const distId = ref('')
const certResult = ref(null)
const certLoading = ref(false)
const certError = ref(null)

// File verification state (CID from URL or from certificate result)
const cid = ref('')
const selectedFile = ref(null)
const fileInputRef = ref(null)
const isDragging = ref(false)
const fileResult = ref(null)
const fileLoading = ref(false)
const fileError = ref(null)

// Document types mapping for display
const documentTypeLabels = {
  'seed_source_cert': 'Sertifikat Sumber Benih',
  'inspection_report': 'Laporan Pemeriksaan',
  'evaluation_report': 'Laporan Evaluasi',
  'certificate': 'Sertifikat',
  'distribution_evidence': 'Bukti Distribusi'
}

// Status labels
const statusLabels = {
  'REGISTERED': 'Terdaftar',
  'SUBMITTED': 'Diajukan',
  'INSPECTED': 'Diperiksa',
  'EVALUATED': 'Dievaluasi',
  'CERTIFIED': 'Tersertifikasi',
  'DISTRIBUTED': 'Didistribusikan',
  'REVOKED': 'Dicabut'
}

// Destination type labels
const destinationTypeLabels = {
  'WAREHOUSE': 'Gudang',
  'RETAILER': 'Pengecer',
  'FARMER_GROUP': 'Kelompok Tani',
  'DISTRIBUTOR': 'Distributor',
  'OTHER': 'Lainnya'
}

// Computed
const canSubmitCert = computed(() => {
  return certNumber.value && batchId.value
})

const canSubmitFile = computed(() => {
  return cid.value && selectedFile.value
})

const certificateStatus = computed(() => {
  if (!certResult.value) return null
  return certResult.value.status
})

const statusConfig = computed(() => {
  const status = certificateStatus.value
  const configs = {
    'VALID': {
      bgClass: 'bg-green-50',
      borderClass: 'border-green-200',
      iconBgClass: 'bg-green-100',
      iconClass: 'text-green-600',
      textClass: 'text-green-800',
      subTextClass: 'text-green-600',
      icon: CheckCircleIcon,
      title: 'SERTIFIKAT VALID',
      subtitle: 'Sertifikat ini sah dan berlaku'
    },
    'REVOKED': {
      bgClass: 'bg-red-50',
      borderClass: 'border-red-200',
      iconBgClass: 'bg-red-100',
      iconClass: 'text-red-600',
      textClass: 'text-red-800',
      subTextClass: 'text-red-600',
      icon: XCircleIcon,
      title: 'SERTIFIKAT DICABUT',
      subtitle: 'Sertifikat ini telah dicabut dan tidak berlaku'
    },
    'EXPIRED': {
      bgClass: 'bg-amber-50',
      borderClass: 'border-amber-200',
      iconBgClass: 'bg-amber-100',
      iconClass: 'text-amber-600',
      textClass: 'text-amber-800',
      subTextClass: 'text-amber-600',
      icon: ExclamationTriangleIcon,
      title: 'SERTIFIKAT KEDALUWARSA',
      subtitle: 'Sertifikat ini telah melewati masa berlaku'
    },
    'NOT_FOUND': {
      bgClass: 'bg-gray-50',
      borderClass: 'border-gray-200',
      iconBgClass: 'bg-gray-100',
      iconClass: 'text-gray-600',
      textClass: 'text-gray-800',
      subTextClass: 'text-gray-600',
      icon: XCircleIcon,
      title: 'SERTIFIKAT TIDAK DITEMUKAN',
      subtitle: 'Nomor sertifikat tidak terdaftar dalam sistem'
    },
    'NOT_CERTIFIED': {
      bgClass: 'bg-yellow-50',
      borderClass: 'border-yellow-200',
      iconBgClass: 'bg-yellow-100',
      iconClass: 'text-yellow-600',
      textClass: 'text-yellow-800',
      subTextClass: 'text-yellow-600',
      icon: ExclamationTriangleIcon,
      title: 'BATCH BELUM TERSERTIFIKASI',
      subtitle: 'Batch ini belum memiliki sertifikat yang diterbitkan'
    },
    'MISMATCH': {
      bgClass: 'bg-red-50',
      borderClass: 'border-red-200',
      iconBgClass: 'bg-red-100',
      iconClass: 'text-red-600',
      textClass: 'text-red-800',
      subTextClass: 'text-red-600',
      icon: XCircleIcon,
      title: 'TIDAK SESUAI',
      subtitle: 'Nomor sertifikat tidak sesuai dengan batch ID'
    }
  }
  return configs[status] || configs['NOT_FOUND']
})

// Initialize from URL
onMounted(() => {
  initFromUrl()
})

// Watch for route changes
watch(() => route.query, () => {
  initFromUrl()
})

function initFromUrl() {
  const urlCert = route.query.cert
  const urlBatch = route.query.batch
  const urlDist = route.query.distribute
  const urlKey = route.query.key || route.query.cid

  // Determine mode based on URL params
  if (urlCert && urlBatch) {
    verificationMode.value = 'certificate'
    certNumber.value = urlCert
    batchId.value = urlBatch
    distId.value = urlDist || ''
    // Auto-verify on mount
    handleCertVerify()
  } else if (urlKey) {
    verificationMode.value = 'file'
    cid.value = urlKey
  }
}

// Certificate verification methods
async function handleCertVerify() {
  if (!canSubmitCert.value) return
  
  certLoading.value = true
  certError.value = null
  certResult.value = null
  
  try {
    const response = await documentService.verifyCertificate(
      certNumber.value.trim(), 
      batchId.value.trim(),
      distId.value.trim() || null
    )
    // httpClient returns JSON directly (not axios-style response.data)
    // Backend returns { success, status, message, data: {...} }
    console.log('Certificate verification response:', response)
    
    certResult.value = {
      status: response.status,
      message: response.message,
      certNumber: response.data?.certNumber,
      certId: response.data?.certId,
      issuedAt: response.data?.issuedAt,
      expiresAt: response.data?.expiresAt,
      revokedAt: response.data?.revokedAt,
      revokeReason: response.data?.revokeReason,
      issuer: response.data?.issuer,
      batch: response.data?.batch,
      document: response.data?.document ? {
        cid: response.data.document.cid,
        sha256: response.data.document.sha256Hash
      } : null,
      distribution: response.data?.distribution || null,
      verifiedAt: response.data?.verifiedAt
    }
  } catch (err) {
    console.error('Certificate verification error:', err)
    certError.value = err.response?.data?.message || err.response?.data?.error || err.data?.message || err.message || 'Gagal memverifikasi sertifikat'
  } finally {
    certLoading.value = false
  }
}

function resetCertForm() {
  certResult.value = null
  certError.value = null
}

// Redirect to file verification with CID
function goToFileVerification() {
  const docCid = certResult.value?.document?.cid
  if (docCid) {
    router.push({ path: '/verify', query: { key: docCid } })
    verificationMode.value = 'file'
    cid.value = docCid
    // Reset file verification state
    fileResult.value = null
    fileError.value = null
    selectedFile.value = null
  }
}

// File verification methods
function handleFileSelect(event) {
  const file = event.target.files?.[0]
  if (file) {
    selectedFile.value = file
  }
}

function handleDragOver(event) {
  event.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function handleDrop(event) {
  event.preventDefault()
  isDragging.value = false
  
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    selectedFile.value = file
  }
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function removeFile() {
  selectedFile.value = null
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function formatFileSize(bytes) {
  if (!bytes) return '-'
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
}

async function handleFileVerify() {
  if (!canSubmitFile.value) return
  
  fileLoading.value = true
  fileError.value = null
  fileResult.value = null
  
  try {
    const response = await documentService.publicVerify(cid.value.trim(), selectedFile.value)
    // httpClient returns JSON directly (not axios-style response.data)
    // Backend returns { success, verified, message, data: {...} }
    console.log('File verification response:', response)
    fileResult.value = {
      verified: response.verified,
      message: response.message,
      cid: response.data?.cid,
      hash: response.data?.hash,
      storedHash: response.data?.storedHash,
      uploadedHash: response.data?.uploadedHash,
      fileSize: response.data?.fileSize,
      verifiedAt: response.data?.verifiedAt,
      batchData: response.data?.batchData
    }
  } catch (err) {
    console.error('File verification error:', err)
    fileError.value = err.data?.message || err.message || 'Gagal memverifikasi dokumen'
  } finally {
    fileLoading.value = false
  }
}

function resetFileForm() {
  selectedFile.value = null
  fileResult.value = null
  fileError.value = null
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function backToCertResult() {
  verificationMode.value = 'certificate'
  // Restore URL to cert mode
  router.push({ path: '/verify', query: { cert: certNumber.value, batch: batchId.value } })
}

function getDocumentUrl(cidValue) {
  return documentService.getDocumentUrl(cidValue)
}

function getDownloadUrl(cidValue) {
  return documentService.getDocumentDownloadUrl(cidValue)
}

function getDocTypeLabel(docType) {
  return documentTypeLabels[docType] || docType || '-'
}

function getStatusLabel(status) {
  return statusLabels[status] || status || '-'
}

function getDestinationTypeLabel(destType) {
  return destinationTypeLabels[destType] || destType || '-'
}

function getStatusClass(status) {
  const statusMap = {
    'REGISTERED': 'bg-yellow-100 text-yellow-800',
    'SUBMITTED': 'bg-yellow-100 text-yellow-800',
    'INSPECTED': 'bg-blue-100 text-blue-800',
    'EVALUATED': 'bg-blue-100 text-blue-800',
    'CERTIFIED': 'bg-green-100 text-green-800',
    'DISTRIBUTED': 'bg-purple-100 text-purple-800',
    'REVOKED': 'bg-red-100 text-red-800'
  }
  return statusMap[status] || 'bg-gray-100 text-gray-800'
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long', 
    year: 'numeric'
  })
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="flex flex-col min-h-screen">
      <!-- Header -->
      <header class="px-6 py-6 bg-white border-b border-gray-200">
        <div class="flex items-center justify-between max-w-4xl mx-auto">
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center justify-center text-2xl text-white shadow-md h-11 w-11 rounded-2xl bg-primary">🌱</span>
            <div>
              <span class="text-lg font-semibold text-ink">BenihChain</span>
              <p class="text-xs text-ink/60">Verifikasi Sertifikat Publik</p>
            </div>
          </div>
          <router-link
            to="/login"
            class="px-4 py-2 text-sm font-medium transition-colors rounded-lg text-primary hover:bg-primary/10"
          >
            Login
          </router-link>
        </div>
      </header>

      <!-- Main Content -->
      <main class="flex items-center justify-center flex-1 px-6 py-12">
        <div class="w-full max-w-2xl space-y-8">

          <!-- ========== CERTIFICATE VERIFICATION MODE ========== -->
          <template v-if="verificationMode === 'certificate'">
            <!-- Title Section -->
            <div class="space-y-3 text-center">
              <div class="inline-flex items-center justify-center w-16 h-16 mx-auto rounded-2xl bg-primary/10">
                <ShieldCheckIcon class="w-8 h-8 text-primary" />
              </div>
              <h1 class="text-3xl font-semibold tracking-tight text-ink">
                Verifikasi Sertifikat Benih
              </h1>
              <p class="max-w-lg mx-auto text-ink/60">
                Verifikasi keaslian sertifikat benih dengan memindai QR Code pada label sertifikat atau masukkan nomor sertifikat secara manual.
              </p>
            </div>

            <!-- Certificate Result Card (Shown when result available) -->
            <template v-if="certResult">
              <!-- Status Badge Card -->
              <div :class="['overflow-hidden border shadow-2xl rounded-3xl', statusConfig.borderClass]">
                <!-- Big Status Header -->
                <div :class="['px-8 py-10 text-center', statusConfig.bgClass]">
                  <div 
                    :class="[
                      'inline-flex items-center justify-center w-24 h-24 mx-auto rounded-full shadow-lg mb-6',
                      statusConfig.iconBgClass
                    ]"
                  >
                    <component :is="statusConfig.icon" :class="['w-14 h-14', statusConfig.iconClass]" />
                  </div>
                  <h2 :class="['text-3xl font-bold tracking-tight mb-2', statusConfig.textClass]">
                    {{ statusConfig.title }}
                  </h2>
                  <p :class="['text-lg', statusConfig.subTextClass]">
                    {{ statusConfig.subtitle }}
                  </p>
                </div>

                <!-- Certificate Details -->
                <div class="p-8 space-y-6 bg-white">
                  <!-- Certificate Number -->
                  <div class="flex items-center gap-4 p-4 rounded-xl bg-ink/5">
                    <div class="flex items-center justify-center flex-shrink-0 w-12 h-12 rounded-full bg-primary/10">
                      <HashtagIcon class="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p class="text-xs font-medium tracking-wider uppercase text-ink/60">Nomor Sertifikat</p>
                      <p class="text-lg font-semibold text-ink">{{ certResult.certNumber || certNumber }}</p>
                    </div>
                  </div>

                  <!-- Issuer Info (if available) -->
                  <!-- <div v-if="certResult.issuer" class="flex items-start gap-4 p-4 rounded-xl bg-ink/5">
                    <div class="flex items-center justify-center flex-shrink-0 w-12 h-12 rounded-full bg-ocean/10">
                      <UserIcon class="w-6 h-6 text-ocean" />
                    </div>
                    <div class="flex-1">
                      <p class="text-xs font-medium tracking-wider uppercase text-ink/60">Penerbit Sertifikat</p>
                      <p class="text-lg font-semibold text-ink">{{ certResult.issuer.name || '-' }}</p>
                      <p v-if="certResult.issuer.organization" class="text-sm text-ink/70">{{ certResult.issuer.organization }}</p>
                      <div v-if="certResult.issuer.signature" class="pt-2 mt-2 border-t border-ink/10">
                        <p class="text-xs font-medium text-ink/50">Tanda Tangan Digital</p>
                        <p class="font-mono text-xs break-all text-ink/60">{{ certResult.issuer.signature }}</p>
                      </div>
                    </div>
                  </div> -->

                  <!-- Validity Period (if available) -->
                  <div v-if="certResult.issuedAt || certResult.expiresAt" class="grid gap-4 sm:grid-cols-2">
                    <div class="flex items-center gap-4 p-4 rounded-xl bg-ink/5">
                      <div class="flex items-center justify-center flex-shrink-0 w-10 h-10 bg-green-100 rounded-full">
                        <CalendarDaysIcon class="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p class="text-xs font-medium tracking-wider uppercase text-ink/60">Tanggal Terbit</p>
                        <p class="text-sm font-semibold text-ink">{{ formatDate(certResult.issuedAt) }}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-4 p-4 rounded-xl bg-ink/5">
                      <div class="flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-full bg-amber-100">
                        <CalendarDaysIcon class="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p class="text-xs font-medium tracking-wider uppercase text-ink/60">Berlaku Hingga</p>
                        <p class="text-sm font-semibold text-ink">{{ formatDate(certResult.expiresAt) }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Revoke Info (if revoked) -->
                  <div v-if="certResult.status === 'REVOKED' && certResult.revokedAt" class="p-4 border border-red-200 rounded-xl bg-red-50">
                    <div class="flex items-start gap-3">
                      <XCircleIcon class="flex-shrink-0 w-5 h-5 text-red-500 mt-0.5" />
                      <div>
                        <p class="text-sm font-semibold text-red-800">Dicabut pada {{ formatDate(certResult.revokedAt) }}</p>
                        <p v-if="certResult.revokeReason" class="mt-1 text-sm text-red-700">
                          Alasan: {{ certResult.revokeReason }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Batch Info Summary (if available) -->
                  <!-- <div v-if="certResult.batch" class="p-4 border border-ink/10 rounded-xl">
                    <h4 class="mb-3 text-sm font-semibold tracking-wider uppercase text-ink/70">Informasi Batch</h4>
                    <div class="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p class="text-xs text-ink/60">Batch ID</p>
                        <p class="font-mono text-sm font-medium text-ink">{{ certResult.batch.batchId }}</p>
                      </div>
                      <div>
                        <p class="text-xs text-ink/60">Nomor Batch</p>
                        <p class="text-sm font-medium text-ink">{{ certResult.batch.batchNumber || '-' }}</p>
                      </div>
                      <div>
                        <p class="text-xs text-ink/60">Varietas</p>
                        <p class="text-sm font-medium text-ink">{{ certResult.batch.varietyName || '-' }}</p>
                      </div>
                      <div>
                        <p class="text-xs text-ink/60">Produsen</p>
                        <p class="text-sm font-medium text-ink">{{ certResult.batch.producerName || '-' }}</p>
                      </div>
                    </div>
                  </div> -->

                  <!-- Document Fingerprint -->
                  <div v-if="certResult.document" class="p-4 border rounded-xl bg-ink/5 border-ink/10">
                    <div class="flex items-center gap-2 mb-3">
                      <FingerPrintIcon class="w-5 h-5 text-ink/60" />
                      <h4 class="text-sm font-semibold tracking-wider uppercase text-ink/70">Sidik Jari Dokumen</h4>
                    </div>
                    <div class="space-y-2">
                      <div>
                        <p class="text-xs text-ink/60">CID (Content Identifier)</p>
                        <p class="font-mono text-xs break-all text-ink">{{ certResult.document.cid }}</p>
                      </div>
                      <div v-if="certResult.document.sha256">
                        <p class="text-xs text-ink/60">SHA-256 Hash</p>
                        <p class="font-mono text-xs break-all text-ink">{{ certResult.document.sha256 }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Distribution Info (if available) -->
                  <div v-if="certResult.distribution" class="overflow-hidden border rounded-xl border-ink/10">
                    <div class="flex items-center gap-2 px-4 py-3 bg-purple-50">
                      <TruckIcon class="w-5 h-5 text-purple-600" />
                      <h4 class="text-sm font-semibold tracking-wider text-purple-800 uppercase">Informasi Distribusi</h4>
                    </div>
                    
                    <!-- Distribution Valid -->
                    <div v-if="certResult.distribution.valid" class="p-4 space-y-4 bg-white">
                      <!-- Distribution ID & Date -->
                      <div class="grid gap-4 sm:grid-cols-2">
                        <div class="flex items-center gap-3 p-3 rounded-lg bg-ink/5">
                          <div class="flex items-center justify-center flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full">
                            <HashtagIcon class="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p class="text-xs font-medium tracking-wider uppercase text-ink/60">ID Distribusi</p>
                            <p class="font-mono text-sm font-semibold text-ink">{{ certResult.distribution.distId }}</p>
                          </div>
                        </div>
                        <div class="flex items-center gap-3 p-3 rounded-lg bg-ink/5">
                          <div class="flex items-center justify-center flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full">
                            <CalendarDaysIcon class="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p class="text-xs font-medium tracking-wider uppercase text-ink/60">Tanggal Distribusi</p>
                            <p class="text-sm font-semibold text-ink">{{ formatDate(certResult.distribution.distributedAt) }}</p>
                          </div>
                        </div>
                      </div>
                      
                      <!-- Quantity -->
                      <div class="flex items-center gap-3 p-3 rounded-lg bg-ink/5">
                        <div class="flex items-center justify-center flex-shrink-0 w-10 h-10 bg-green-100 rounded-full">
                          <CubeIcon class="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p class="text-xs font-medium tracking-wider uppercase text-ink/60">Jumlah Didistribusikan</p>
                          <p class="text-lg font-semibold text-ink">
                            {{ certResult.distribution.quantity }} {{ certResult.distribution.quantityUnit || 'kg' }}
                          </p>
                        </div>
                      </div>
                      
                      <!-- Destination -->
                      <div class="p-4 border rounded-lg bg-ink/5 border-ink/10">
                        <div class="flex items-center gap-2 mb-3">
                          <MapPinIcon class="w-5 h-5 text-ink/60" />
                          <p class="text-xs font-medium tracking-wider uppercase text-ink/60">Tujuan Distribusi</p>
                        </div>
                        <div class="space-y-2">
                          <div class="flex items-center gap-2">
                            <span class="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded-full">
                              {{ getDestinationTypeLabel(certResult.distribution.destination?.type) }}
                            </span>
                          </div>
                          <p class="text-sm font-semibold text-ink">{{ certResult.distribution.destination?.name || '-' }}</p>
                          <p class="text-sm text-ink/70">{{ certResult.distribution.destination?.address || '-' }}</p>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Distribution Not Valid/Not Found -->
                    <div v-else class="p-4 bg-amber-50">
                      <div class="flex items-start gap-3">
                        <ExclamationTriangleIcon class="flex-shrink-0 w-5 h-5 text-amber-500 mt-0.5" />
                        <div>
                          <p class="font-medium text-amber-800">Distribusi Tidak Ditemukan</p>
                          <p class="mt-1 text-sm text-amber-700">
                            ID Distribusi <span class="font-mono">{{ certResult.distribution.distId }}</span> tidak ditemukan untuk batch ini.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Action Buttons -->
                  <div class="flex flex-col gap-3 pt-4 sm:flex-row">
                    <button
                      v-if="certResult.document?.cid && certResult.status === 'VALID'"
                      @click="goToFileVerification"
                      class="flex items-center justify-center flex-1 gap-2 px-6 py-3 text-sm font-semibold text-white transition-all rounded-xl bg-primary hover:bg-primary/90"
                    >
                      <DocumentMagnifyingGlassIcon class="w-5 h-5" />
                      Verifikasi File PDF Saya
                    </button>
                    <button
                      @click="resetCertForm"
                      class="flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium transition-all border rounded-xl text-ink/70 border-ink/20 hover:bg-ink/5"
                    >
                      <ArrowPathIcon class="w-4 h-4" />
                      Verifikasi Lagi
                    </button>
                  </div>
                </div>
              </div>
            </template>

            <!-- Certificate Input Form (Shown when no result) -->
            <template v-else>
              <div class="p-8 space-y-6 bg-white border shadow-xl rounded-2xl border-ink/10">
                <form @submit.prevent="handleCertVerify" class="space-y-6">
                  <!-- Certificate Number -->
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-ink" for="certNumber">
                      Nomor Sertifikat <span class="text-red-500">*</span>
                    </label>
                    <div class="relative">
                      <input
                        id="certNumber"
                        v-model="certNumber"
                        type="text"
                        placeholder="Contoh: CERT-2024-001"
                        class="w-full px-4 py-3 pr-10 font-mono text-sm transition-all border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-ink/40"
                        :disabled="certLoading"
                        readonly
                      />
                      <HashtagIcon class="absolute w-5 h-5 -translate-y-1/2 right-3 top-1/2 text-ink/40" />
                    </div>
                    <p class="text-xs text-ink/50">
                      Nomor sertifikat dari QR Code atau label sertifikat
                    </p>
                  </div>

                  <!-- Batch ID -->
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-ink" for="batchId">
                      Batch ID <span class="text-red-500">*</span>
                    </label>
                    <div class="relative">
                      <input
                        id="batchId"
                        v-model="batchId"
                        type="text"
                        placeholder="Contoh: BATCH-123456"
                        class="w-full px-4 py-3 pr-10 font-mono text-sm transition-all border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-ink/40"
                        :disabled="certLoading"
                        readonly
                      />
                      <DocumentMagnifyingGlassIcon class="absolute w-5 h-5 -translate-y-1/2 right-3 top-1/2 text-ink/40" />
                    </div>
                    <p class="text-xs text-ink/50">
                      ID Batch dari QR Code
                    </p>
                  </div>

                  <!-- Action Buttons -->
                  <div class="flex gap-3 pt-2">
                    <button
                      type="submit"
                      :disabled="!canSubmitCert || certLoading"
                      class="flex items-center justify-center flex-1 gap-2 px-6 py-3 text-sm font-semibold text-white transition-all rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ArrowPathIcon v-if="certLoading" class="w-5 h-5 animate-spin" />
                      <ShieldCheckIcon v-else class="w-5 h-5" />
                      {{ certLoading ? 'Memverifikasi...' : 'Verifikasi Sertifikat' }}
                    </button>
                  </div>
                </form>
              </div>
            </template>

            <!-- Error Alert -->
            <div v-if="certError" class="p-4 border border-red-100 rounded-xl bg-red-50">
              <div class="flex items-start gap-3">
                <XCircleIcon class="flex-shrink-0 w-5 h-5 text-red-500" />
                <div>
                  <h4 class="font-medium text-red-800">Verifikasi Gagal</h4>
                  <p class="mt-1 text-sm text-red-600">{{ certError }}</p>
                </div>
              </div>
            </div>

            <!-- Info Section -->
            <div class="p-6 border rounded-xl bg-ocean/5 border-ocean/20">
              <div class="flex gap-4">
                <InformationCircleIcon class="flex-shrink-0 w-6 h-6 text-ocean" />
                <div class="space-y-2">
                  <h4 class="font-medium text-ocean">Cara Verifikasi Sertifikat</h4>
                  <ol class="space-y-1 text-sm list-decimal list-inside text-ink/70">
                    <li>Scan QR Code pada label sertifikat benih</li>
                    <li>Halaman ini akan terbuka dengan data sertifikat terisi otomatis</li>
                    <li>Sistem akan menampilkan status validitas sertifikat</li>
                    <li>Jika valid, Anda dapat memverifikasi file PDF dengan mengklik tombol "Verifikasi File PDF"</li>
                  </ol>
                </div>
              </div>
            </div>
          </template>

          <!-- ========== FILE VERIFICATION MODE ========== -->
          <template v-if="verificationMode === 'file'">
            <!-- Back Button (if came from certificate result) -->
            <button
              v-if="certResult"
              @click="backToCertResult"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors rounded-lg text-ink/70 hover:text-ink hover:bg-ink/5"
            >
              <ArrowLeftIcon class="w-4 h-4" />
              Kembali ke Hasil Sertifikat
            </button>

            <!-- Title Section -->
            <div class="space-y-3 text-center">
              <div class="inline-flex items-center justify-center w-16 h-16 mx-auto rounded-2xl bg-ocean/10">
                <DocumentMagnifyingGlassIcon class="w-8 h-8 text-ocean" />
              </div>
              <h1 class="text-3xl font-semibold tracking-tight text-ink">
                Verifikasi File Dokumen
              </h1>
              <p class="max-w-lg mx-auto text-ink/60">
                Upload file PDF dokumen sertifikat untuk memverifikasi keasliannya dengan dokumen yang tersimpan di blockchain.
              </p>
            </div>

            <!-- File Verification Form Card -->
            <div class="p-8 space-y-6 bg-white border shadow-xl rounded-2xl border-ink/10">
              <form @submit.prevent="handleFileVerify" class="space-y-6">
                <!-- CID Display (auto-filled) -->
                <div class="space-y-2">
                  <label class="text-sm font-medium text-ink" for="cid">
                    Document ID (CID)
                  </label>
                  <div class="relative">
                    <input
                      id="cid"
                      v-model="cid"
                      type="text"
                      placeholder="CID akan terisi otomatis"
                      class="w-full px-4 py-3 pr-10 font-mono text-sm transition-all border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-ink/5 placeholder:text-ink/40"
                      :disabled="fileLoading"
                      readonly
                    />
                    <FingerPrintIcon class="absolute w-5 h-5 -translate-y-1/2 right-3 top-1/2 text-ink/40" />
                  </div>
                  <p class="text-xs text-ink/50">
                    ID dokumen dari sertifikat yang terverifikasi
                  </p>
                </div>

                <!-- File Upload Area -->
                <div class="space-y-2">
                  <label class="text-sm font-medium text-ink">
                    Upload Dokumen untuk Verifikasi <span class="text-red-500">*</span>
                  </label>
                  
                  <!-- Dropzone -->
                  <div
                    v-if="!selectedFile"
                    @click="triggerFileInput"
                    @dragover="handleDragOver"
                    @dragleave="handleDragLeave"
                    @drop="handleDrop"
                    :class="[
                      'relative flex flex-col items-center justify-center w-full p-8 transition-all border-2 border-dashed rounded-xl cursor-pointer',
                      isDragging 
                        ? 'border-primary bg-primary/5' 
                        : 'border-ink/20 hover:border-primary/50 hover:bg-ink/5'
                    ]"
                  >
                    <CloudArrowUpIcon class="w-12 h-12 mb-3 text-ink/40" />
                    <p class="mb-1 text-sm font-medium text-ink/70">
                      <span class="text-primary">Klik untuk upload</span> atau drag & drop
                    </p>
                    <p class="text-xs text-ink/50">
                      PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (Max 10MB)
                    </p>
                    <input
                      ref="fileInputRef"
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      class="hidden"
                      @change="handleFileSelect"
                      :disabled="fileLoading"
                    />
                  </div>

                  <!-- Selected File Preview -->
                  <div
                    v-else
                    class="flex items-center justify-between p-4 border rounded-xl border-ink/20 bg-ink/5"
                  >
                    <div class="flex items-center gap-3">
                      <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                        <DocumentTextIcon class="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p class="text-sm font-medium text-ink truncate max-w-[300px]">
                          {{ selectedFile.name }}
                        </p>
                        <p class="text-xs text-ink/50">
                          {{ formatFileSize(selectedFile.size) }}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      @click="removeFile"
                      :disabled="fileLoading"
                      class="p-2 transition-colors rounded-lg hover:bg-red-100 text-ink/50 hover:text-red-600"
                    >
                      <XMarkIcon class="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-3 pt-2">
                  <button
                    type="submit"
                    :disabled="!canSubmitFile || fileLoading"
                    class="flex items-center justify-center flex-1 gap-2 px-6 py-3 text-sm font-semibold text-white transition-all rounded-lg bg-ocean hover:bg-ocean/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowPathIcon v-if="fileLoading" class="w-5 h-5 animate-spin" />
                    <ShieldCheckIcon v-else class="w-5 h-5" />
                    {{ fileLoading ? 'Memverifikasi...' : 'Verifikasi File' }}
                  </button>
                  <button
                    type="button"
                    @click="resetFileForm"
                    :disabled="fileLoading"
                    class="px-4 py-3 text-sm font-medium transition-all border rounded-lg text-ink/70 border-ink/20 hover:bg-ink/5 disabled:opacity-50"
                  >
                    Reset
                  </button>
                </div>
              </form>
            </div>

            <!-- Error Alert -->
            <div v-if="fileError" class="p-4 border border-red-100 rounded-xl bg-red-50">
              <div class="flex items-start gap-3">
                <XCircleIcon class="flex-shrink-0 w-5 h-5 text-red-500" />
                <div>
                  <h4 class="font-medium text-red-800">Verifikasi Gagal</h4>
                  <p class="mt-1 text-sm text-red-600">{{ fileError }}</p>
                </div>
              </div>
            </div>

            <!-- File Verification Result Card -->
            <div v-if="fileResult" class="overflow-hidden bg-white border shadow-xl rounded-2xl border-ink/10">
              <!-- Status Header -->
              <div 
                :class="[
                  'px-6 py-4 border-b',
                  fileResult.verified 
                    ? 'bg-green-50 border-green-100' 
                    : 'bg-red-50 border-red-100'
                ]"
              >
                <div class="flex items-center gap-3">
                  <div 
                    :class="[
                      'flex items-center justify-center w-12 h-12 rounded-full',
                      fileResult.verified ? 'bg-green-100' : 'bg-red-100'
                    ]"
                  >
                    <CheckCircleIcon v-if="fileResult.verified" class="text-green-600 w-7 h-7" />
                    <XCircleIcon v-else class="text-red-600 w-7 h-7" />
                  </div>
                  <div>
                    <h3 
                      :class="[
                        'text-lg font-semibold',
                        fileResult.verified ? 'text-green-800' : 'text-red-800'
                      ]"
                    >
                      {{ fileResult.verified ? 'Dokumen Terverifikasi ✓' : 'Verifikasi Gagal ✗' }}
                    </h3>
                    <p 
                      :class="[
                        'text-sm',
                        fileResult.verified ? 'text-green-600' : 'text-red-600'
                      ]"
                    >
                      {{ fileResult.verified 
                        ? 'Dokumen asli dan belum dimodifikasi' 
                        : 'Hash dokumen tidak sesuai - kemungkinan dokumen telah diubah'
                      }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Verification Details -->
              <div class="p-6 space-y-6">
                <!-- Hash Info -->
                <div class="space-y-3">
                  <h4 class="text-sm font-semibold tracking-wider uppercase text-ink/70">Detail Verifikasi</h4>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <div class="p-4 rounded-lg bg-ink/5">
                      <p class="mb-1 text-xs font-medium tracking-wider uppercase text-ink/60">CID</p>
                      <p class="font-mono text-xs break-all text-ink">{{ fileResult.cid }}</p>
                    </div>
                    <div class="p-4 rounded-lg bg-ink/5">
                      <p class="mb-1 text-xs font-medium tracking-wider uppercase text-ink/60">Ukuran File</p>
                      <p class="text-sm font-medium text-ink">{{ formatFileSize(fileResult.fileSize) }}</p>
                    </div>
                  </div>
                  
                  <div v-if="fileResult.hash || fileResult.storedHash" class="p-4 rounded-lg bg-ink/5">
                    <p class="mb-1 text-xs font-medium tracking-wider uppercase text-ink/60">SHA256 Hash (Tersimpan)</p>
                    <p class="font-mono text-xs break-all text-ink">{{ fileResult.hash || fileResult.storedHash }}</p>
                  </div>

                  <div v-if="fileResult.uploadedHash && !fileResult.verified" class="p-4 border border-red-100 rounded-lg bg-red-50">
                    <p class="mb-1 text-xs font-medium tracking-wider text-red-600 uppercase">SHA256 Hash (Dokumen Anda)</p>
                    <p class="font-mono text-xs text-red-700 break-all">{{ fileResult.uploadedHash }}</p>
                  </div>

                  <div class="p-4 rounded-lg bg-ink/5">
                    <p class="mb-1 text-xs font-medium tracking-wider uppercase text-ink/60">Waktu Verifikasi</p>
                    <p class="text-sm text-ink">{{ new Date(fileResult.verifiedAt).toLocaleString('id-ID') }}</p>
                  </div>
                </div>

                <!-- Action Buttons -->
                <div v-if="fileResult.verified" class="flex flex-wrap gap-3 pt-4 border-t border-ink/10">
                  <a
                    :href="getDocumentUrl(fileResult.cid)"
                    target="_blank"
                    class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors rounded-lg text-primary bg-primary/10 hover:bg-primary/20"
                  >
                    <DocumentMagnifyingGlassIcon class="w-4 h-4" />
                    Lihat Dokumen Asli
                  </a>
                  <a
                    :href="getDownloadUrl(fileResult.cid)"
                    download
                    class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border rounded-lg text-ink/70 border-ink/20 hover:bg-ink/5"
                  >
                    <DocumentArrowDownIcon class="w-4 h-4" />
                    Download
                  </a>
                </div>
              </div>
            </div>

            <!-- Info Section -->
            <div class="p-6 border rounded-xl bg-ocean/5 border-ocean/20">
              <div class="flex gap-4">
                <InformationCircleIcon class="flex-shrink-0 w-6 h-6 text-ocean" />
                <div class="space-y-2">
                  <h4 class="font-medium text-ocean">Cara Verifikasi File</h4>
                  <ol class="space-y-1 text-sm list-decimal list-inside text-ink/70">
                    <li>Upload file PDF dokumen sertifikat yang Anda miliki</li>
                    <li>Sistem akan menghitung hash (sidik jari digital) dokumen</li>
                    <li>Hash akan dibandingkan dengan yang tersimpan di blockchain</li>
                    <li>Jika cocok, dokumen dinyatakan asli dan belum dimodifikasi</li>
                  </ol>
                </div>
              </div>
            </div>
          </template>

        </div>
      </main>

      <!-- Footer -->
      <footer class="px-6 py-4 text-center bg-white border-t border-gray-200">
        <p class="text-sm text-gray-500">
          © 2024 BenihChain - Sistem Sertifikasi Benih Terintegrasi Blockchain
        </p>
      </footer>
    </div>
  </div>
</template>
