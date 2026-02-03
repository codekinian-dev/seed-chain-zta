<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  BeakerIcon,
  CloudArrowUpIcon,
  CalendarDaysIcon,
  MapPinIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PaperClipIcon,
} from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'
import { seedBatchService } from '../../services/api'

const router = useRouter()
const loading = ref(false)
const error = ref(null)
const success = ref(null)
const selectedFile = ref(null)
const createdBatchId = ref(null)

const formData = reactive({
  varietyName: '',
  commodity: '',
  harvestDate: '',
  seedSourceNumber: '',
  origin: '',
  iupbNumber: '',
  seedClass: 'BD', // Default to BD (Breeder Seed)
  declaredQuantity: null,
})

const seedClassOptions = [
  { value: 'BS', label: 'BS - Breeder Seed (Benih Penjenis)' },
  { value: 'BD', label: 'BD - Foundation Seed (Benih Dasar)' },
  { value: 'BP', label: 'BP - Stock Seed (Benih Pokok)' },
  { value: 'BR', label: 'BR - Extension Seed (Benih Sebar)' },
]

const handleFileChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      error.value = 'File size must be less than 10MB'
      return
    }
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowedTypes.includes(file.type)) {
      error.value = 'File must be PDF or Word document'
      return
    }
    
    selectedFile.value = file
    error.value = null
  }
}

const isFormValid = computed(() => {
  return (
    formData.varietyName &&
    formData.commodity &&
    formData.harvestDate &&
    formData.seedSourceNumber &&
    formData.origin &&
    formData.iupbNumber &&
    formData.seedClass &&
    formData.declaredQuantity > 0 &&
    selectedFile.value
  )
})

const handleSubmit = async () => {
  if (!isFormValid.value) {
    error.value = 'Please fill in all required fields and upload a document'
    return
  }

  loading.value = true
  error.value = null
  success.value = null

  try {
    // Create FormData for multipart upload
    const data = new FormData()
    data.append('varietyName', formData.varietyName)
    data.append('commodity', formData.commodity)
    data.append('harvestDate', formData.harvestDate) // Send as YYYY-MM-DD
    data.append('seedSourceNumber', formData.seedSourceNumber)
    data.append('origin', formData.origin)
    data.append('iupbNumber', formData.iupbNumber)
    data.append('seedClass', formData.seedClass)
    data.append('declaredQuantity', formData.declaredQuantity.toString())
    data.append('document', selectedFile.value)

    console.log('Submitting seed batch:', {
      varietyName: formData.varietyName,
      commodity: formData.commodity,
      harvestDate: formData.harvestDate,
      seedSourceNumber: formData.seedSourceNumber,
      origin: formData.origin,
      iupbNumber: formData.iupbNumber,
      seedClass: formData.seedClass,
      declaredQuantity: formData.declaredQuantity,
      fileName: selectedFile.value.name
    })

    const response = await seedBatchService.createBatch(data)
    
    success.value = 'Seed batch created successfully!'
    createdBatchId.value = response.data?.batchId
    
    // Redirect after 2 seconds
    setTimeout(() => {
      router.push('/seed-batches')
    }, 2000)
  } catch (err) {
    error.value = err.message || 'Failed to create seed batch'
    console.error('Error creating batch:', err)
  } finally {
    loading.value = false
  }
}

const goBackToList = () => router.push('/seed-batches')
</script>

<template>
  <DashboardLayout
    page-title="Create Seed Batch"
    page-subtitle="Record batch identity and upload seed source document."
  >
    <template #header-actions>
      <button 
        class="secondary-button" 
        @click="goBackToList"
        :disabled="loading"
      >
        Cancel
      </button>
      <button 
        class="primary-button" 
        @click="handleSubmit"
        :disabled="!isFormValid || loading"
      >
        <span v-if="loading">Creating...</span>
        <span v-else>Create Batch</span>
      </button>
    </template>

    <template #subheader-actions>
      <button class="secondary-button" @click="goBackToList">Back to list</button>
    </template>

    <!-- Alert Messages -->
    <div v-if="error" class="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg">
      {{ error }}
    </div>
    <div v-if="success" class="p-4 mb-6 text-sm text-green-700 bg-green-100 rounded-lg">
      {{ success }}
    </div>

    <div class="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div class="space-y-6">
        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <DocumentTextIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Batch Identity</h3>
              <p class="text-sm text-ink/60">Seed batch details and basic information.</p>
            </div>
          </div>

          <div class="grid gap-4 mt-6 md:grid-cols-2">
            <div class="input-group md:col-span-2">
              <label class="input-label">Variety Name *</label>
              <input 
                type="text" 
                class="text-input" 
                placeholder="e.g., DxP Tenera-22"
                v-model="formData.varietyName"
                :disabled="loading"
              />
            </div>
            <div class="input-group">
              <label class="input-label">Commodity *</label>
              <input 
                type="text" 
                class="text-input" 
                placeholder="e.g., Palm Oil, Rubber, Coffee"
                v-model="formData.commodity"
                :disabled="loading"
              />
            </div>
            <div class="input-group">
              <label class="input-label">Harvest Date *</label>
              <input 
                type="date" 
                class="text-input"
                v-model="formData.harvestDate"
                :disabled="loading"
              />
            </div>
            <div class="input-group">
              <label class="input-label">Seed Source Number *</label>
              <input 
                type="text" 
                class="text-input" 
                placeholder="e.g., SSN-2025-001"
                v-model="formData.seedSourceNumber"
                :disabled="loading"
              />
            </div>
            <div class="input-group">
              <label class="input-label">Origin *</label>
              <input 
                type="text" 
                class="text-input" 
                placeholder="e.g., West Java, Indonesia"
                v-model="formData.origin"
                :disabled="loading"
              />
            </div>
            <div class="input-group">
              <label class="input-label">IUPB Number *</label>
              <input 
                type="text" 
                class="text-input" 
                placeholder="e.g., IUPB-2025-001"
                v-model="formData.iupbNumber"
                :disabled="loading"
              />
            </div>
            <div class="input-group">
              <label class="input-label">Declared Quantity (kg) *</label>
              <input 
                type="number" 
                class="text-input" 
                placeholder="e.g., 1000"
                min="0.01"
                step="0.01"
                v-model.number="formData.declaredQuantity"
                :disabled="loading"
              />
              <p class="mt-1 text-xs text-ink/60">Total quantity in kilograms</p>
            </div>
            <div class="input-group">
              <label class="input-label">Seed Class *</label>
              <select 
                class="text-input"
                v-model="formData.seedClass"
                :disabled="loading"
              >
                <option 
                  v-for="option in seedClassOptions" 
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>
        </section>

        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <CloudArrowUpIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Seed Source Document *</h3>
              <p class="text-sm text-ink/60">Upload seed source documentation (PDF or Word, max 10MB).</p>
            </div>
          </div>

          <div class="mt-6">
            <div class="p-6 text-center border border-dashed rounded-2xl border-primary/30 bg-primary/5">
              <CloudArrowUpIcon class="w-12 h-12 mx-auto text-primary" />
              <p class="mt-2 text-sm font-semibold text-ink">
                <label class="cursor-pointer text-primary hover:text-primary/80">
                  Choose a file
                  <input 
                    type="file" 
                    class="hidden" 
                    accept=".pdf,.doc,.docx"
                    @change="handleFileChange"
                    :disabled="loading"
                  />
                </label>
                or drag and drop
              </p>
              <p class="mt-1 text-xs text-ink/60">PDF, DOC, DOCX • max 10MB</p>
              
              <div v-if="selectedFile" class="flex items-center justify-center gap-2 px-4 py-2 mt-4 bg-white border rounded-lg border-ink/10">
                <PaperClipIcon class="w-5 h-5 text-primary" />
                <span class="text-sm text-ink">{{ selectedFile.name }}</span>
                <button 
                  @click="selectedFile = null" 
                  class="ml-2 text-xs text-red-600 hover:text-red-800"
                  :disabled="loading"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside class="space-y-6">
        <div class="p-6 panel-card">
          <h3 class="text-lg font-semibold text-ink">Required Fields</h3>
          <p class="mt-2 text-sm text-ink/60">Please complete all required fields marked with *</p>
          
          <div class="mt-4 space-y-2">
            <div class="flex items-center gap-2">
              <CheckCircleIcon 
                :class="formData.varietyName ? 'text-primary' : 'text-ink/30'" 
                class="w-5 h-5"
              />
              <span class="text-sm text-ink/70">Variety Name</span>
            </div>
            <div class="flex items-center gap-2">
              <CheckCircleIcon 
                :class="formData.commodity ? 'text-primary' : 'text-ink/30'" 
                class="w-5 h-5"
              />
              <span class="text-sm text-ink/70">Commodity</span>
            </div>
            <div class="flex items-center gap-2">
              <CheckCircleIcon 
                :class="formData.harvestDate ? 'text-primary' : 'text-ink/30'" 
                class="w-5 h-5"
              />
              <span class="text-sm text-ink/70">Harvest Date</span>
            </div>
            <div class="flex items-center gap-2">
              <CheckCircleIcon 
                :class="formData.seedSourceNumber ? 'text-primary' : 'text-ink/30'" 
                class="w-5 h-5"
              />
              <span class="text-sm text-ink/70">Seed Source Number</span>
            </div>
            <div class="flex items-center gap-2">
              <CheckCircleIcon 
                :class="formData.origin ? 'text-primary' : 'text-ink/30'" 
                class="w-5 h-5"
              />
              <span class="text-sm text-ink/70">Origin</span>
            </div>
            <div class="flex items-center gap-2">
              <CheckCircleIcon 
                :class="formData.iupbNumber ? 'text-primary' : 'text-ink/30'" 
                class="w-5 h-5"
              />
              <span class="text-sm text-ink/70">IUPB Number</span>
            </div>
            <div class="flex items-center gap-2">
              <CheckCircleIcon 
                :class="formData.declaredQuantity > 0 ? 'text-primary' : 'text-ink/30'" 
                class="w-5 h-5"
              />
              <span class="text-sm text-ink/70">Declared Quantity</span>
            </div>
            <div class="flex items-center gap-2">
              <CheckCircleIcon 
                :class="selectedFile ? 'text-primary' : 'text-ink/30'" 
                class="w-5 h-5"
              />
              <span class="text-sm text-ink/70">Document Upload</span>
            </div>
          </div>
        </div>

        <div class="p-6 space-y-4 panel-card">
          <h3 class="text-lg font-semibold text-ink">What happens next?</h3>
          <ul class="space-y-3 text-sm text-ink/70">
            <li class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
              <span>Your batch will be created on the blockchain</span>
            </li>
            <li class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
              <span>Document will be uploaded to IPFS</span>
            </li>
            <li class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
              <span>You can submit for certification</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </DashboardLayout>
</template>
