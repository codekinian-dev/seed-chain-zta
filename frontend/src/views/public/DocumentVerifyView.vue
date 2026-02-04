<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { 
  ShieldCheckIcon, 
  DocumentMagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentArrowDownIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  CloudArrowUpIcon,
  DocumentTextIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'
import documentService from '../../services/api/document.service'

const route = useRoute()

// CID from URL query param
const cid = ref('')

// File upload state
const selectedFile = ref(null)
const fileInputRef = ref(null)
const isDragging = ref(false)

// UI state
const loading = ref(false)
const result = ref(null)
const error = ref(null)

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

// Computed
const canSubmit = computed(() => {
  return cid.value && selectedFile.value
})

const verificationStatus = computed(() => {
  if (!result.value) return null
  return result.value.verified
})

// Initialize CID from URL
onMounted(() => {
  const urlCid = route.query.key || route.query.cid
  if (urlCid) {
    cid.value = urlCid
  }
})

// Watch for route changes
watch(() => route.query, (newQuery) => {
  const urlCid = newQuery.key || newQuery.cid
  if (urlCid) {
    cid.value = urlCid
  }
})

// File handling methods
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

// Verification methods
async function handleSubmit() {
  if (!canSubmit.value) return
  
  loading.value = true
  error.value = null
  result.value = null
  
  try {
    const response = await documentService.publicVerify(cid.value.trim(), selectedFile.value)
    result.value = response.data
  } catch (err) {
    console.error('Verification error:', err)
    error.value = err.response?.data?.message || err.response?.data?.error || err.message || 'Gagal memverifikasi dokumen'
  } finally {
    loading.value = false
  }
}

function resetForm() {
  selectedFile.value = null
  result.value = null
  error.value = null
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
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
</script>

<template>
  <div class="relative min-h-screen bg-surface">
    <!-- Background decorations -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-40 -right-32 h-[500px] w-[500px] rounded-full bg-primary/30 blur-3xl" />
      <div class="absolute -bottom-56 -left-32 h-[460px] w-[460px] rounded-full bg-ocean/25 blur-3xl" />
      <div class="absolute w-64 h-64 rounded-full top-1/3 right-1/4 bg-sunshine/30 blur-3xl" />
    </div>

    <div class="relative z-10 flex flex-col min-h-screen">
      <!-- Header -->
      <header class="px-6 py-6 border-b border-ink/10 bg-white/50 backdrop-blur-sm">
        <div class="flex items-center justify-between max-w-4xl mx-auto">
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center justify-center text-2xl text-white shadow-lg h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-ocean">🌱</span>
            <div>
              <span class="text-lg font-semibold text-ink">BenihChain</span>
              <p class="text-xs text-ink/60">Verifikasi Dokumen Publik</p>
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
          <!-- Title Section -->
          <div class="space-y-3 text-center">
            <div class="inline-flex items-center justify-center w-16 h-16 mx-auto rounded-2xl bg-primary/10">
              <ShieldCheckIcon class="w-8 h-8 text-primary" />
            </div>
            <h1 class="text-3xl font-semibold tracking-tight text-ink">
              Verifikasi Dokumen Sertifikasi
            </h1>
            <p class="max-w-lg mx-auto text-ink/60">
              Upload dokumen yang Anda miliki untuk memverifikasi keasliannya dengan dokumen yang tersimpan di sistem BenihChain.
            </p>
          </div>

          <!-- Verification Form Card -->
          <div class="p-8 space-y-6 bg-white border shadow-xl rounded-2xl border-ink/10">
            <form @submit.prevent="handleSubmit" class="space-y-6">
              <!-- CID Display (auto-filled from QR code) -->
              <div class="space-y-2">
                <label class="text-sm font-medium text-ink" for="cid">
                  Document ID (CID)
                </label>
                <div class="relative">
                  <input
                    id="cid"
                    v-model="cid"
                    type="text"
                    placeholder="CID akan terisi otomatis dari QR Code"
                    class="w-full px-4 py-3 pr-10 font-mono text-sm transition-all border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-ink/5 placeholder:text-ink/40"
                    :disabled="loading"
                    readonly
                  />
                  <DocumentMagnifyingGlassIcon class="absolute w-5 h-5 -translate-y-1/2 right-3 top-1/2 text-ink/40" />
                </div>
                <p class="text-xs text-ink/50">
                  ID dokumen dari QR Code yang di-scan
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
                    :disabled="loading"
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
                    :disabled="loading"
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
                  :disabled="!canSubmit || loading"
                  class="flex items-center justify-center flex-1 gap-2 px-6 py-3 text-sm font-semibold text-white transition-all rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowPathIcon v-if="loading" class="w-5 h-5 animate-spin" />
                  <ShieldCheckIcon v-else class="w-5 h-5" />
                  {{ loading ? 'Memverifikasi...' : 'Verifikasi Dokumen' }}
                </button>
                <button
                  type="button"
                  @click="resetForm"
                  :disabled="loading"
                  class="px-4 py-3 text-sm font-medium transition-all border rounded-lg text-ink/70 border-ink/20 hover:bg-ink/5 disabled:opacity-50"
                >
                  Reset
                </button>
              </div>
            </form>
          </div>

          <!-- Error Alert -->
          <div v-if="error" class="p-4 border border-red-100 rounded-xl bg-red-50">
            <div class="flex items-start gap-3">
              <XCircleIcon class="flex-shrink-0 w-5 h-5 text-red-500" />
              <div>
                <h4 class="font-medium text-red-800">Verifikasi Gagal</h4>
                <p class="mt-1 text-sm text-red-600">{{ error }}</p>
              </div>
            </div>
          </div>

          <!-- Result Card -->
          <div v-if="result" class="overflow-hidden bg-white border shadow-xl rounded-2xl border-ink/10">
            <!-- Status Header -->
            <div 
              :class="[
                'px-6 py-4 border-b',
                verificationStatus 
                  ? 'bg-green-50 border-green-100' 
                  : 'bg-red-50 border-red-100'
              ]"
            >
              <div class="flex items-center gap-3">
                <div 
                  :class="[
                    'flex items-center justify-center w-12 h-12 rounded-full',
                    verificationStatus ? 'bg-green-100' : 'bg-red-100'
                  ]"
                >
                  <CheckCircleIcon v-if="verificationStatus" class="text-green-600 w-7 h-7" />
                  <XCircleIcon v-else class="text-red-600 w-7 h-7" />
                </div>
                <div>
                  <h3 
                    :class="[
                      'text-lg font-semibold',
                      verificationStatus ? 'text-green-800' : 'text-red-800'
                    ]"
                  >
                    {{ verificationStatus ? 'Dokumen Terverifikasi ✓' : 'Verifikasi Gagal ✗' }}
                  </h3>
                  <p 
                    :class="[
                      'text-sm',
                      verificationStatus ? 'text-green-600' : 'text-red-600'
                    ]"
                  >
                    {{ verificationStatus 
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
                    <p class="font-mono text-xs break-all text-ink">{{ result.cid }}</p>
                  </div>
                  <div class="p-4 rounded-lg bg-ink/5">
                    <p class="mb-1 text-xs font-medium tracking-wider uppercase text-ink/60">Ukuran File</p>
                    <p class="text-sm font-medium text-ink">{{ formatFileSize(result.fileSize) }}</p>
                  </div>
                </div>
                
                <div v-if="result.hash || result.storedHash" class="p-4 rounded-lg bg-ink/5">
                  <p class="mb-1 text-xs font-medium tracking-wider uppercase text-ink/60">SHA256 Hash (Tersimpan)</p>
                  <p class="font-mono text-xs break-all text-ink">{{ result.hash || result.storedHash }}</p>
                </div>

                <div v-if="result.uploadedHash && !verificationStatus" class="p-4 border border-red-100 rounded-lg bg-red-50">
                  <p class="mb-1 text-xs font-medium tracking-wider text-red-600 uppercase">SHA256 Hash (Dokumen Anda)</p>
                  <p class="font-mono text-xs text-red-700 break-all">{{ result.uploadedHash }}</p>
                </div>

                <div class="p-4 rounded-lg bg-ink/5">
                  <p class="mb-1 text-xs font-medium tracking-wider uppercase text-ink/60">Waktu Verifikasi</p>
                  <p class="text-sm text-ink">{{ new Date(result.verifiedAt).toLocaleString('id-ID') }}</p>
                </div>
              </div>

              <!-- Batch/Certificate Data (only if verified) -->
              <div v-if="verificationStatus && result.batchData" class="pt-4 space-y-4 border-t border-ink/10">
                <h4 class="text-sm font-semibold tracking-wider uppercase text-ink/70">Informasi Sertifikasi</h4>
                
                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="p-4 border rounded-lg bg-primary/5 border-primary/10">
                    <p class="mb-1 text-xs font-medium tracking-wider uppercase text-primary/70">Batch ID</p>
                    <p class="text-sm font-semibold text-ink">{{ result.batchData.batchId }}</p>
                  </div>
                  <div class="p-4 border rounded-lg bg-primary/5 border-primary/10">
                    <p class="mb-1 text-xs font-medium tracking-wider uppercase text-primary/70">Nomor Batch</p>
                    <p class="text-sm font-semibold text-ink">{{ result.batchData.batchNumber || '-' }}</p>
                  </div>
                </div>

                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="p-4 rounded-lg bg-ink/5">
                    <p class="mb-1 text-xs font-medium tracking-wider uppercase text-ink/60">Varietas</p>
                    <p class="text-sm font-medium text-ink">{{ result.batchData.varietyName || '-' }}</p>
                  </div>
                  <div class="p-4 rounded-lg bg-ink/5">
                    <p class="mb-1 text-xs font-medium tracking-wider uppercase text-ink/60">Produsen</p>
                    <p class="text-sm font-medium text-ink">{{ result.batchData.producerName || '-' }}</p>
                  </div>
                </div>

                <div class="grid gap-4 sm:grid-cols-3">
                  <div class="p-4 rounded-lg bg-ink/5">
                    <p class="mb-1 text-xs font-medium tracking-wider uppercase text-ink/60">Kuantitas</p>
                    <p class="text-sm font-medium text-ink">
                      {{ result.batchData.quantity || '-' }} {{ result.batchData.quantityUnit || '' }}
                    </p>
                  </div>
                  <div class="p-4 rounded-lg bg-ink/5">
                    <p class="mb-1 text-xs font-medium tracking-wider uppercase text-ink/60">Status</p>
                    <span :class="['inline-flex px-2 py-1 text-xs font-medium rounded-full', getStatusClass(result.batchData.status)]">
                      {{ getStatusLabel(result.batchData.status) }}
                    </span>
                  </div>
                  <div class="p-4 rounded-lg bg-ink/5">
                    <p class="mb-1 text-xs font-medium tracking-wider uppercase text-ink/60">Tipe Dokumen</p>
                    <p class="text-sm font-medium text-ink">{{ getDocTypeLabel(result.batchData.documentType) }}</p>
                  </div>
                </div>

                <!-- Certificate Info if available -->
                <div v-if="result.batchData.certificate" class="p-4 border border-green-200 rounded-lg bg-green-50">
                  <div class="flex items-start gap-3">
                    <CheckCircleIcon class="flex-shrink-0 w-5 h-5 text-green-600 mt-0.5" />
                    <div class="space-y-1">
                      <p class="text-sm font-semibold text-green-800">Tersertifikasi</p>
                      <p v-if="result.batchData.certificate.certNumber" class="text-sm text-green-700">
                        No. Sertifikat: {{ result.batchData.certificate.certNumber }}
                      </p>
                      <p v-if="result.batchData.certificate.issuedAt" class="text-xs text-green-600">
                        Diterbitkan: {{ new Date(result.batchData.certificate.issuedAt).toLocaleDateString('id-ID') }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- No batch data message -->
              <div v-else-if="verificationStatus && !result.batchData" class="p-4 border border-yellow-200 rounded-lg bg-yellow-50">
                <div class="flex items-start gap-3">
                  <InformationCircleIcon class="flex-shrink-0 w-5 h-5 text-yellow-600" />
                  <div>
                    <p class="text-sm font-medium text-yellow-800">Dokumen Valid</p>
                    <p class="text-sm text-yellow-700">
                      Dokumen terverifikasi, namun data batch tidak ditemukan di sistem.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Action Buttons -->
              <div v-if="verificationStatus" class="flex flex-wrap gap-3 pt-4 border-t border-ink/10">
                <a
                  :href="getDocumentUrl(result.cid)"
                  target="_blank"
                  class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors rounded-lg text-primary bg-primary/10 hover:bg-primary/20"
                >
                  <DocumentMagnifyingGlassIcon class="w-4 h-4" />
                  Lihat Dokumen Asli
                </a>
                <a
                  :href="getDownloadUrl(result.cid)"
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
                <h4 class="font-medium text-ocean">Cara Verifikasi Dokumen</h4>
                <ol class="space-y-1 text-sm list-decimal list-inside text-ink/70">
                  <li>Scan QR Code pada dokumen sertifikasi benih</li>
                  <li>Halaman ini akan terbuka dengan CID dokumen terisi otomatis</li>
                  <li>Upload file dokumen yang Anda miliki</li>
                  <li>Sistem akan membandingkan hash dokumen Anda dengan yang tersimpan di blockchain</li>
                  <li>Jika cocok, dokumen dinyatakan asli dan informasi sertifikasi akan ditampilkan</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- Footer -->
      <footer class="px-6 py-4 text-center border-t border-ink/10 bg-white/50">
        <p class="text-sm text-ink/50">
          © 2024 BenihChain - Sistem Sertifikasi Benih Terintegrasi Blockchain
        </p>
      </footer>
    </div>
  </div>
</template>
