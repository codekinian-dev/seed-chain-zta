<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  ClipboardDocumentListIcon,
  ArrowDownTrayIcon,
  PlusCircleIcon,
  CubeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'
import { seedBatchService } from '../../services/api'

const router = useRouter()
const batches = ref([])
const loading = ref(false)
const error = ref(null)

// Datatable state
const searchQuery = ref('')
const sortKey = ref('created_at')
const sortOrder = ref('desc') // 'asc' or 'desc'
const currentPage = ref(1)
const itemsPerPage = ref(10)

// Check if user is producer for role-based UI
const user = JSON.parse(localStorage.getItem('user') || '{}')
const roles = user.roles || []
const isProducer = ref(roles.includes('role_producer'))

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

const formatDate = (timestamp) => {
  if (!timestamp) return 'N/A'
  const date = new Date(timestamp)
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' WIB'
}

// Computed: filtered batches
const filteredBatches = computed(() => {
  let result = [...batches.value]
  
  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    result = result.filter(item => 
      item.id?.toLowerCase().includes(query) ||
      item.variety_name?.toLowerCase().includes(query) ||
      item.commodity?.toLowerCase().includes(query) ||
      item.origin?.toLowerCase().includes(query) ||
      item.seed_class?.toLowerCase().includes(query) ||
      item.current_status?.toLowerCase().includes(query)
    )
  }
  
  return result
})

// Computed: sorted batches
const sortedBatches = computed(() => {
  const result = [...filteredBatches.value]
  
  result.sort((a, b) => {
    let aVal = a[sortKey.value]
    let bVal = b[sortKey.value]
    
    // Handle date sorting
    if (sortKey.value === 'created_at' || sortKey.value === 'updated_at') {
      aVal = aVal ? new Date(aVal).getTime() : 0
      bVal = bVal ? new Date(bVal).getTime() : 0
    }
    
    // Handle string sorting
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase()
      bVal = bVal?.toLowerCase() || ''
    }
    
    if (sortOrder.value === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
    }
  })
  
  return result
})

// Computed: paginated batches
const paginatedBatches = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return sortedBatches.value.slice(start, end)
})

// Computed: total pages
const totalPages = computed(() => {
  return Math.ceil(sortedBatches.value.length / itemsPerPage.value)
})

// Computed: pagination info
const paginationInfo = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value + 1
  const end = Math.min(currentPage.value * itemsPerPage.value, sortedBatches.value.length)
  return `Showing ${start} to ${end} of ${sortedBatches.value.length} entries`
})

// Methods
const handleSort = (key) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'desc'
  }
  currentPage.value = 1 // Reset to first page
}

const getSortIcon = (key) => {
  if (sortKey.value !== key) return null
  return sortOrder.value === 'asc' ? 'up' : 'down'
}

const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

const loadBatches = async () => {
  loading.value = true
  error.value = null
  try {
    // role_producer uses my-batches, other roles use all batches
    const response = isProducer.value 
      ? await seedBatchService.getMyBatches()
      : await seedBatchService.getAllBatches()
    
    // Backend transformer already flattens fields, just use directly
    batches.value = response.data || []
    
    console.log('Loaded batches:', batches.value)
  } catch (err) {
    error.value = err.message || 'Failed to load seed batches'
    console.error('Error loading batches:', err)
  } finally {
    loading.value = false
  }
}

const goToNewForm = () => router.push('/seed-batches/new')
const goToDetail = (batchId) => router.push(`/seed-batches/${batchId}`)

onMounted(() => {
  loadBatches()
})
</script>

<template>
  <DashboardLayout
    page-title="Seed Batches"
    page-subtitle="Manage seed batches, test status, and links to pre/planting-ready certification."
  >
    <template #header-actions>
      <!-- <button v-if="isProducer" class="secondary-button">
        <ClipboardDocumentListIcon class="w-5 h-5" />
        Batch drafts
      </button> -->
      <button v-if="isProducer" class="primary-button" @click="goToNewForm">
        New batch
      </button>
    </template>

    <section class="p-6 space-y-4 panel-card">
      <!-- Error Alert -->
      <div v-if="error" class="p-4 text-sm text-red-700 bg-red-100 rounded-lg">
        {{ error }}
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="text-center">
          <div class="inline-block w-8 h-8 border-4 rounded-full border-t-transparent border-primary animate-spin"></div>
          <p class="mt-2 text-sm text-ink/60">Loading batches...</p>
        </div>
      </div>

      <!-- Content -->
      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-lg font-semibold text-ink">Batch list</h3>
            <p class="text-sm text-ink/60">Track seed batches, volume, and certification status.</p>
          </div>
          <div v-if="isProducer" class="flex flex-wrap items-center gap-2">
            <button class="primary-button" @click="goToNewForm">
              <PlusCircleIcon class="w-5 h-5" />
              New batch
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="batches.length === 0" class="py-12 text-center">
          <CubeIcon class="w-12 h-12 mx-auto text-ink/30" />
          <p class="mt-3 text-base font-semibold text-ink">No batches found</p>
          <p v-if="isProducer" class="mt-1 text-sm text-ink/60">Create your first seed batch to get started.</p>
          <p v-else class="mt-1 text-sm text-ink/60">No batches available for review at this time.</p>
          <button v-if="isProducer" class="mx-auto mt-4 primary-button" @click="goToNewForm">
            <PlusCircleIcon class="w-5 h-5" />
            New batch
          </button>
        </div>

        <!-- Datatable -->
        <div v-else class="space-y-4">
          <!-- Search and Per Page -->
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="relative flex-1 min-w-[200px] max-w-md">
              <MagnifyingGlassIcon class="absolute w-5 h-5 -translate-y-1/2 left-3 top-1/2 text-ink/40" />
              <input 
                v-model="searchQuery"
                type="text"
                placeholder="Search batches..."
                class="w-full py-2 pl-10 pr-4 border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div class="flex items-center gap-2">
              <label class="text-sm text-ink/60">Show:</label>
              <select 
                v-model.number="itemsPerPage"
                class="px-3 py-2 border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
                @change="currentPage = 1"
              >
                <option :value="5">5</option>
                <option :value="10">10</option>
                <option :value="25">25</option>
                <option :value="50">50</option>
              </select>
              <span class="text-sm text-ink/60">entries</span>
            </div>
          </div>

          <!-- Table -->
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm divide-y divide-ink/10">
              <thead class="bg-surface">
                <tr>
                  <th 
                    scope="col" 
                    class="px-4 py-3 text-left cursor-pointer table-header hover:bg-ink/5"
                    @click="handleSort('id')"
                  >
                    <div class="flex items-center gap-1">
                      ID Batch
                      <span v-if="getSortIcon('id') === 'up'"><ChevronUpIcon class="w-4 h-4" /></span>
                      <span v-else-if="getSortIcon('id') === 'down'"><ChevronDownIcon class="w-4 h-4" /></span>
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    class="px-4 py-3 text-left cursor-pointer table-header hover:bg-ink/5"
                    @click="handleSort('variety_name')"
                  >
                    <div class="flex items-center gap-1">
                      Variety Name
                      <span v-if="getSortIcon('variety_name') === 'up'"><ChevronUpIcon class="w-4 h-4" /></span>
                      <span v-else-if="getSortIcon('variety_name') === 'down'"><ChevronDownIcon class="w-4 h-4" /></span>
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    class="px-4 py-3 text-left cursor-pointer table-header hover:bg-ink/5"
                    @click="handleSort('commodity')"
                  >
                    <div class="flex items-center gap-1">
                      Commodity
                      <span v-if="getSortIcon('commodity') === 'up'"><ChevronUpIcon class="w-4 h-4" /></span>
                      <span v-else-if="getSortIcon('commodity') === 'down'"><ChevronDownIcon class="w-4 h-4" /></span>
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    class="px-4 py-3 text-left cursor-pointer table-header hover:bg-ink/5"
                    @click="handleSort('origin')"
                  >
                    <div class="flex items-center gap-1">
                      Origin
                      <span v-if="getSortIcon('origin') === 'up'"><ChevronUpIcon class="w-4 h-4" /></span>
                      <span v-else-if="getSortIcon('origin') === 'down'"><ChevronDownIcon class="w-4 h-4" /></span>
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    class="px-4 py-3 text-left cursor-pointer table-header hover:bg-ink/5"
                    @click="handleSort('seed_class')"
                  >
                    <div class="flex items-center gap-1">
                      Seed Class
                      <span v-if="getSortIcon('seed_class') === 'up'"><ChevronUpIcon class="w-4 h-4" /></span>
                      <span v-else-if="getSortIcon('seed_class') === 'down'"><ChevronDownIcon class="w-4 h-4" /></span>
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    class="px-4 py-3 text-left cursor-pointer table-header hover:bg-ink/5"
                    @click="handleSort('current_status')"
                  >
                    <div class="flex items-center gap-1">
                      Status
                      <span v-if="getSortIcon('current_status') === 'up'"><ChevronUpIcon class="w-4 h-4" /></span>
                      <span v-else-if="getSortIcon('current_status') === 'down'"><ChevronDownIcon class="w-4 h-4" /></span>
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    class="px-4 py-3 text-right cursor-pointer table-header hover:bg-ink/5"
                    @click="handleSort('created_at')"
                  >
                    <div class="flex items-center justify-end gap-1">
                      Created
                      <span v-if="getSortIcon('created_at') === 'up'"><ChevronUpIcon class="w-4 h-4" /></span>
                      <span v-else-if="getSortIcon('created_at') === 'down'"><ChevronDownIcon class="w-4 h-4" /></span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-ink/10">
                <tr
                  v-for="item in paginatedBatches"
                  :key="item.id"
                  class="transition bg-white cursor-pointer hover:bg-primary/5"
                  @click="goToDetail(item.id)"
                >
                  <td class="px-4 py-3 font-semibold text-ink">{{ item.id }}</td>
                  <td class="px-4 py-3">
                    <p class="font-semibold text-ink">{{ item.variety_name }}</p>
                    <p class="text-xs text-ink/50">{{ item.seed_source_number }}</p>
                  </td>
                  <td class="px-4 py-3 text-ink/70">{{ item.commodity }}</td>
                  <td class="px-4 py-3 text-ink/70">{{ item.origin }}</td>
                  <td class="px-4 py-3 text-ink/70">{{ item.seed_class }}</td>
                  <td class="px-4 py-3">
                    <span :class="['status-pill', statusToneClass(item.current_status)]">
                      {{ formatStatus(item.current_status) }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-xs text-right text-ink/60">
                    {{ formatDate(item.created_at) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- No Results After Search -->
          <div v-if="filteredBatches.length === 0 && searchQuery.trim()" class="py-8 text-center">
            <MagnifyingGlassIcon class="w-10 h-10 mx-auto text-ink/30" />
            <p class="mt-2 text-sm text-ink/60">No batches matching "{{ searchQuery }}"</p>
          </div>

          <!-- Pagination -->
          <div v-if="sortedBatches.length > 0" class="flex flex-wrap items-center justify-between gap-4 pt-4">
            <p class="text-sm text-ink/60">{{ paginationInfo }}</p>
            
            <div class="flex items-center gap-1">
              <button 
                @click="goToPage(currentPage - 1)"
                :disabled="currentPage === 1"
                class="p-2 transition rounded-lg hover:bg-ink/5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon class="w-5 h-5" />
              </button>
              
              <template v-for="page in totalPages" :key="page">
                <button 
                  v-if="page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)"
                  @click="goToPage(page)"
                  :class="[
                    'w-8 h-8 rounded-lg text-sm transition',
                    currentPage === page 
                      ? 'bg-primary text-white' 
                      : 'hover:bg-ink/5 text-ink/70'
                  ]"
                >
                  {{ page }}
                </button>
                <span 
                  v-else-if="page === currentPage - 2 || page === currentPage + 2"
                  class="px-1 text-ink/30"
                >
                  ...
                </span>
              </template>
              
              <button 
                @click="goToPage(currentPage + 1)"
                :disabled="currentPage === totalPages"
                class="p-2 transition rounded-lg hover:bg-ink/5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRightIcon class="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </template>
    </section>

    <!-- <div v-if="isProducer" class="p-6 text-center border-dashed panel-card border-primary/20 bg-primary/5">
      <CubeIcon class="w-8 h-8 mx-auto text-primary" />
      <p class="mt-3 text-base font-semibold text-ink">Ready to create a batch?</p>
      <p class="mt-1 text-sm text-ink/60">Click the button below to create your first seed batch.</p>
      <button class="mx-auto mt-4 primary-button" @click="goToNewForm">
        <PlusCircleIcon class="w-5 h-5" />
        New batch
      </button>
    </div> -->
  </DashboardLayout>
</template>
