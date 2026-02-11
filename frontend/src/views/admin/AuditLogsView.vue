<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  ClipboardDocumentListIcon,
  MagnifyingGlassIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  ArrowPathIcon,
  UserIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  XMarkIcon,
  EyeIcon,
  LinkIcon,
} from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'
import auditService from '../../services/api/audit.service'

// State
const logs = ref([])
const stats = ref(null)
const loading = ref(false)
const statsLoading = ref(false)
const error = ref(null)
const selectedLog = ref(null)
const showDetailModal = ref(false)

// Filters
const filters = ref({
  startTime: '',
  endTime: '',
  action: '',
  searchQuery: '',
})

const showFilters = ref(false)

// Datatable state
const sortKey = ref('timestamp')
const sortOrder = ref('desc')
const currentPage = ref(1)
const itemsPerPage = ref(10)

// Stats period
const statsPeriod = ref(7)

// Action types for filter dropdown
const actionTypes = [
  { value: '', label: 'All Actions' },
  { value: 'CREATE_SEED_BATCH', label: 'Create Seed Batch' },
  { value: 'UPDATE_SEED_BATCH', label: 'Update Seed Batch' },
  { value: 'SUBMIT_CERTIFICATION', label: 'Submit Certification' },
  { value: 'APPROVE_CERTIFICATION', label: 'Approve Certification' },
  { value: 'REJECT_CERTIFICATION', label: 'Reject Certification' },
  { value: 'DISTRIBUTE_SEED', label: 'Distribute Seed' },
  { value: 'REGISTER_USER', label: 'Register User' },
  { value: 'LOGIN', label: 'Login' },
]

// Role labels
const roleLabelMap = {
  role_admin: 'Admin',
  role_producer: 'Producer',
  role_pbt_field: 'PBT Field Officer',
  role_pbt_chief: 'PBT Chief',
  role_lsm_head: 'LSM Head',
  role_bpsb_head: 'BPSB Head',
}

// Status tone classes
const getActionToneClass = (action) => {
  const actionMap = {
    'CREATE_SEED_BATCH': 'success',
    'UPDATE_SEED_BATCH': 'info',
    'SUBMIT_CERTIFICATION': 'warning',
    'APPROVE_CERTIFICATION': 'success',
    'REJECT_CERTIFICATION': 'error',
    'DISTRIBUTE_SEED': 'info',
    'REGISTER_USER': 'success',
    'LOGIN': 'default',
  }
  
  const tone = actionMap[action] || 'default'
  
  const map = {
    success: 'bg-primary/10 text-primary',
    warning: 'bg-sunshine/10 text-sunshine',
    info: 'bg-ocean/10 text-ocean',
    error: 'bg-red-100 text-red-700',
    default: 'bg-ink/10 text-ink/70'
  }
  return map[tone]
}

const formatAction = (action) => {
  if (!action) return 'Unknown'
  return action.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ')
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
    second: '2-digit',
  }) + ' WIB'
}

const formatDateShort = (timestamp) => {
  if (!timestamp) return 'N/A'
  const date = new Date(timestamp)
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const truncateTxId = (txId) => {
  if (!txId) return 'N/A'
  if (txId.length <= 16) return txId
  return `${txId.substring(0, 8)}...${txId.substring(txId.length - 8)}`
}

const getRoleLabel = (role) => {
  return roleLabelMap[role] || role || 'Unknown'
}

// Computed: filtered logs
const filteredLogs = computed(() => {
  let result = [...logs.value]
  
  // Apply search filter
  if (filters.value.searchQuery.trim()) {
    const query = filters.value.searchQuery.toLowerCase().trim()
    result = result.filter(item => 
      item.id?.toLowerCase().includes(query) ||
      item.txId?.toLowerCase().includes(query) ||
      item.action?.toLowerCase().includes(query) ||
      item.resourceId?.toLowerCase().includes(query) ||
      item.user?.username?.toLowerCase().includes(query) ||
      item.user?.role?.toLowerCase().includes(query) ||
      item.status?.toLowerCase().includes(query)
    )
  }
  
  return result
})

// Computed: sorted logs
const sortedLogs = computed(() => {
  const result = [...filteredLogs.value]
  
  result.sort((a, b) => {
    let aVal = a[sortKey.value]
    let bVal = b[sortKey.value]
    
    // Handle nested user fields
    if (sortKey.value === 'username') {
      aVal = a.user?.username || ''
      bVal = b.user?.username || ''
    }
    if (sortKey.value === 'role') {
      aVal = a.user?.role || ''
      bVal = b.user?.role || ''
    }
    
    // Handle date sorting
    if (sortKey.value === 'timestamp') {
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

// Computed: paginated logs
const paginatedLogs = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return sortedLogs.value.slice(start, end)
})

// Computed: total pages
const totalPages = computed(() => {
  return Math.ceil(sortedLogs.value.length / itemsPerPage.value) || 1
})

// Computed: pagination info
const paginationInfo = computed(() => {
  if (sortedLogs.value.length === 0) return 'No entries'
  const start = (currentPage.value - 1) * itemsPerPage.value + 1
  const end = Math.min(currentPage.value * itemsPerPage.value, sortedLogs.value.length)
  return `Showing ${start} to ${end} of ${sortedLogs.value.length} entries`
})

// Computed: stats data for display
const statsDisplay = computed(() => {
  if (!stats.value) return null
  
  return {
    totalLogs: stats.value.totalLogs || 0,
    period: stats.value.period || {},
    topActions: Object.entries(stats.value.byAction || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    topUsers: Object.entries(stats.value.byUser || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    byRole: Object.entries(stats.value.byRole || {})
      .sort((a, b) => b[1] - a[1]),
    timeline: Object.entries(stats.value.timeline || {})
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7),
  }
})

// Methods
const handleSort = (key) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'desc'
  }
  currentPage.value = 1
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

const loadLogs = async () => {
  loading.value = true
  error.value = null
  try {
    const params = {}
    if (filters.value.startTime) params.startTime = new Date(filters.value.startTime).toISOString()
    if (filters.value.endTime) params.endTime = new Date(filters.value.endTime).toISOString()
    if (filters.value.action) params.action = filters.value.action
    params.limit = 500 // Get more logs for client-side filtering
    
    const response = await auditService.getLogs(params)
    logs.value = response.data || []
    
    console.log('Loaded audit logs:', logs.value.length)
  } catch (err) {
    error.value = err.message || 'Failed to load audit logs'
    console.error('Error loading audit logs:', err)
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  statsLoading.value = true
  try {
    const response = await auditService.getStats(statsPeriod.value)
    stats.value = response.data || null
    console.log('Loaded audit stats:', stats.value)
  } catch (err) {
    console.error('Error loading stats:', err)
  } finally {
    statsLoading.value = false
  }
}

const applyFilters = () => {
  currentPage.value = 1
  loadLogs()
}

const resetFilters = () => {
  filters.value = {
    startTime: '',
    endTime: '',
    action: '',
    searchQuery: '',
  }
  currentPage.value = 1
  loadLogs()
}

const refreshData = () => {
  loadLogs()
  loadStats()
}

const viewLogDetail = (log) => {
  selectedLog.value = log
  showDetailModal.value = true
}

const closeDetailModal = () => {
  showDetailModal.value = false
  selectedLog.value = null
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    // Could add a toast notification here
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

// Watch for stats period changes
watch(statsPeriod, () => {
  loadStats()
})

onMounted(() => {
  loadLogs()
  loadStats()
})
</script>

<template>
  <DashboardLayout
    page-title="Audit Logs"
    page-subtitle="Monitor and review blockchain transaction history and system activities."
  >
    <template #header-actions>
      <button class="secondary-button" @click="refreshData">
        <ArrowPathIcon class="w-5 h-5" :class="{ 'animate-spin': loading || statsLoading }" />
        Refresh
      </button>
    </template>

    <div class="space-y-6">
      <!-- Stats Cards -->
      <section class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <!-- Total Logs Card -->
        <div class="p-5 bg-white shadow-sm panel-card rounded-2xl">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-sm font-medium text-ink/60">Total Transactions</p>
              <p class="mt-1 text-2xl font-bold text-ink">
                {{ statsLoading ? '...' : (statsDisplay?.totalLogs || 0) }}
              </p>
              <p class="mt-1 text-xs text-ink/50">Last {{ statsPeriod }} days</p>
            </div>
            <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <ClipboardDocumentListIcon class="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>

        <!-- Unique Users Card -->
        <div class="p-5 bg-white shadow-sm panel-card rounded-2xl">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-sm font-medium text-ink/60">Active Users</p>
              <p class="mt-1 text-2xl font-bold text-ink">
                {{ statsLoading ? '...' : (statsDisplay?.topUsers?.length || 0) }}
              </p>
              <p class="mt-1 text-xs text-ink/50">Unique users</p>
            </div>
            <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-ocean/10">
              <UserIcon class="w-5 h-5 text-ocean" />
            </div>
          </div>
        </div>

        <!-- Actions Types Card -->
        <div class="p-5 bg-white shadow-sm panel-card rounded-2xl">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-sm font-medium text-ink/60">Action Types</p>
              <p class="mt-1 text-2xl font-bold text-ink">
                {{ statsLoading ? '...' : (statsDisplay?.topActions?.length || 0) }}
              </p>
              <p class="mt-1 text-xs text-ink/50">Different operations</p>
            </div>
            <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-sunshine/10">
              <DocumentTextIcon class="w-5 h-5 text-sunshine" />
            </div>
          </div>
        </div>

        <!-- Period Selector Card -->
        <div class="p-5 bg-white shadow-sm panel-card rounded-2xl">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-sm font-medium text-ink/60">Stats Period</p>
              <select 
                v-model.number="statsPeriod"
                class="px-3 py-1.5 mt-1 text-sm border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option :value="7">Last 7 days</option>
                <option :value="14">Last 14 days</option>
                <option :value="30">Last 30 days</option>
                <option :value="90">Last 90 days</option>
              </select>
            </div>
            <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-ink/5">
              <CalendarDaysIcon class="w-5 h-5 text-ink/60" />
            </div>
          </div>
        </div>
      </section>

      <!-- Stats Details Row -->
      <section v-if="statsDisplay" class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <!-- Top Actions -->
        <div class="p-5 bg-white shadow-sm panel-card rounded-2xl">
          <h4 class="mb-3 text-sm font-semibold text-ink">Top Actions</h4>
          <div class="space-y-2">
            <div 
              v-for="[action, count] in statsDisplay.topActions" 
              :key="action"
              class="flex items-center justify-between"
            >
              <span :class="['text-xs px-2 py-1 rounded-full', getActionToneClass(action)]">
                {{ formatAction(action) }}
              </span>
              <span class="text-sm font-medium text-ink">{{ count }}</span>
            </div>
            <p v-if="!statsDisplay.topActions.length" class="text-sm text-ink/50">No data available</p>
          </div>
        </div>

        <!-- Activity by Role -->
        <div class="p-5 bg-white shadow-sm panel-card rounded-2xl">
          <h4 class="mb-3 text-sm font-semibold text-ink">Activity by Role</h4>
          <div class="space-y-2">
            <div 
              v-for="[role, count] in statsDisplay.byRole" 
              :key="role"
              class="flex items-center justify-between"
            >
              <span class="text-sm text-ink/70">{{ getRoleLabel(role) }}</span>
              <span class="text-sm font-medium text-ink">{{ count }}</span>
            </div>
            <p v-if="!statsDisplay.byRole.length" class="text-sm text-ink/50">No data available</p>
          </div>
        </div>

        <!-- Top Users -->
        <div class="p-5 bg-white shadow-sm panel-card rounded-2xl">
          <h4 class="mb-3 text-sm font-semibold text-ink">Most Active Users</h4>
          <div class="space-y-2">
            <div 
              v-for="[username, count] in statsDisplay.topUsers" 
              :key="username"
              class="flex items-center justify-between"
            >
              <span class="text-sm text-ink/70">{{ username }}</span>
              <span class="text-sm font-medium text-ink">{{ count }}</span>
            </div>
            <p v-if="!statsDisplay.topUsers.length" class="text-sm text-ink/50">No data available</p>
          </div>
        </div>
      </section>

      <!-- Main Logs Table Section -->
      <section class="p-6 space-y-4 bg-white shadow-sm panel-card rounded-2xl">
        <!-- Error Alert -->
        <div v-if="error" class="p-4 text-sm text-red-700 bg-red-100 rounded-lg">
          <div class="flex items-center gap-2">
            <ExclamationTriangleIcon class="w-5 h-5" />
            {{ error }}
          </div>
        </div>

        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-lg font-semibold text-ink">Transaction Logs</h3>
            <p class="text-sm text-ink/60">Blockchain audit trail of all system activities.</p>
          </div>
          <button 
            class="secondary-button"
            @click="showFilters = !showFilters"
          >
            <FunnelIcon class="w-5 h-5" />
            {{ showFilters ? 'Hide Filters' : 'Show Filters' }}
          </button>
        </div>

        <!-- Filters Panel -->
        <transition name="slide-fade">
          <div v-if="showFilters" class="p-4 rounded-xl bg-surface border border-ink/10">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label class="block text-sm font-medium text-ink/70 mb-1">Start Date</label>
                <input 
                  v-model="filters.startTime"
                  type="datetime-local"
                  class="w-full px-3 py-2 border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-ink/70 mb-1">End Date</label>
                <input 
                  v-model="filters.endTime"
                  type="datetime-local"
                  class="w-full px-3 py-2 border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-ink/70 mb-1">Action Type</label>
                <select 
                  v-model="filters.action"
                  class="w-full px-3 py-2 border rounded-lg border-ink/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option v-for="action in actionTypes" :key="action.value" :value="action.value">
                    {{ action.label }}
                  </option>
                </select>
              </div>
              <div class="flex items-end gap-2">
                <button class="flex-1 primary-button" @click="applyFilters">
                  Apply
                </button>
                <button class="secondary-button" @click="resetFilters">
                  Reset
                </button>
              </div>
            </div>
          </div>
        </transition>

        <!-- Loading State -->
        <div v-if="loading" class="flex items-center justify-center py-12">
          <div class="text-center">
            <div class="inline-block w-8 h-8 border-4 rounded-full border-t-transparent border-primary animate-spin"></div>
            <p class="mt-2 text-sm text-ink/60">Loading audit logs...</p>
          </div>
        </div>

        <!-- Content -->
        <template v-else>
          <!-- Empty State -->
          <div v-if="logs.length === 0" class="py-12 text-center">
            <ClipboardDocumentListIcon class="w-12 h-12 mx-auto text-ink/30" />
            <p class="mt-3 text-base font-semibold text-ink">No audit logs found</p>
            <p class="mt-1 text-sm text-ink/60">Try adjusting your filters or check back later.</p>
          </div>

          <!-- Datatable -->
          <div v-else class="space-y-4">
            <!-- Search and Per Page -->
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div class="relative flex-1 min-w-[200px] max-w-md">
                <MagnifyingGlassIcon class="absolute w-5 h-5 -translate-y-1/2 left-3 top-1/2 text-ink/40" />
                <input 
                  v-model="filters.searchQuery"
                  type="text"
                  placeholder="Search logs..."
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
                  <option :value="10">10</option>
                  <option :value="25">25</option>
                  <option :value="50">50</option>
                  <option :value="100">100</option>
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
                      @click="handleSort('timestamp')"
                    >
                      <div class="flex items-center gap-1">
                        Timestamp
                        <span v-if="getSortIcon('timestamp') === 'up'"><ChevronUpIcon class="w-4 h-4" /></span>
                        <span v-else-if="getSortIcon('timestamp') === 'down'"><ChevronDownIcon class="w-4 h-4" /></span>
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      class="px-4 py-3 text-left cursor-pointer table-header hover:bg-ink/5"
                      @click="handleSort('action')"
                    >
                      <div class="flex items-center gap-1">
                        Action
                        <span v-if="getSortIcon('action') === 'up'"><ChevronUpIcon class="w-4 h-4" /></span>
                        <span v-else-if="getSortIcon('action') === 'down'"><ChevronDownIcon class="w-4 h-4" /></span>
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      class="px-4 py-3 text-left cursor-pointer table-header hover:bg-ink/5"
                      @click="handleSort('username')"
                    >
                      <div class="flex items-center gap-1">
                        User
                        <span v-if="getSortIcon('username') === 'up'"><ChevronUpIcon class="w-4 h-4" /></span>
                        <span v-else-if="getSortIcon('username') === 'down'"><ChevronDownIcon class="w-4 h-4" /></span>
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      class="px-4 py-3 text-left cursor-pointer table-header hover:bg-ink/5"
                      @click="handleSort('role')"
                    >
                      <div class="flex items-center gap-1">
                        Role
                        <span v-if="getSortIcon('role') === 'up'"><ChevronUpIcon class="w-4 h-4" /></span>
                        <span v-else-if="getSortIcon('role') === 'down'"><ChevronDownIcon class="w-4 h-4" /></span>
                      </div>
                    </th>
                    <th scope="col" class="px-4 py-3 text-left table-header">
                      Resource ID
                    </th>
                    <th scope="col" class="px-4 py-3 text-left table-header">
                      TX ID
                    </th>
                    <th scope="col" class="px-4 py-3 text-center table-header">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-ink/10">
                  <tr
                    v-for="log in paginatedLogs"
                    :key="log.id"
                    class="transition bg-white hover:bg-primary/5"
                  >
                    <td class="px-4 py-3 text-xs text-ink/70 whitespace-nowrap">
                      {{ formatDate(log.timestamp) }}
                    </td>
                    <td class="px-4 py-3">
                      <span :class="['text-xs px-2 py-1 rounded-full font-medium', getActionToneClass(log.action)]">
                        {{ formatAction(log.action) }}
                      </span>
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2">
                        <div class="flex items-center justify-center w-7 h-7 rounded-full bg-ink/10">
                          <UserIcon class="w-4 h-4 text-ink/50" />
                        </div>
                        <span class="text-sm font-medium text-ink">{{ log.user?.username || 'N/A' }}</span>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-sm text-ink/70">
                      {{ getRoleLabel(log.user?.role) }}
                    </td>
                    <td class="px-4 py-3">
                      <span 
                        v-if="log.resourceId"
                        class="text-xs font-mono text-ocean cursor-pointer hover:underline"
                        :title="log.resourceId"
                        @click="copyToClipboard(log.resourceId)"
                      >
                        {{ log.resourceId.length > 20 ? log.resourceId.substring(0, 20) + '...' : log.resourceId }}
                      </span>
                      <span v-else class="text-xs text-ink/40">-</span>
                    </td>
                    <td class="px-4 py-3">
                      <span 
                        class="text-xs font-mono text-ink/60 cursor-pointer hover:text-primary"
                        :title="log.txId"
                        @click="copyToClipboard(log.txId)"
                      >
                        {{ truncateTxId(log.txId) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <button 
                        class="inline-flex items-center justify-center w-8 h-8 transition rounded-lg hover:bg-primary/10 text-ink/50 hover:text-primary"
                        title="View Details"
                        @click="viewLogDetail(log)"
                      >
                        <EyeIcon class="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- No Results After Search -->
            <div v-if="filteredLogs.length === 0 && filters.searchQuery.trim()" class="py-8 text-center">
              <MagnifyingGlassIcon class="w-10 h-10 mx-auto text-ink/30" />
              <p class="mt-2 text-sm text-ink/60">No logs matching "{{ filters.searchQuery }}"</p>
            </div>

            <!-- Pagination -->
            <div v-if="sortedLogs.length > 0" class="flex flex-wrap items-center justify-between gap-4 pt-4">
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
    </div>

    <!-- Detail Modal -->
    <teleport to="body">
      <transition name="fade">
        <div 
          v-if="showDetailModal" 
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm"
          @click.self="closeDetailModal"
        >
          <div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white shadow-xl rounded-2xl">
            <div class="sticky top-0 z-10 flex items-center justify-between p-5 bg-white border-b border-ink/10">
              <h3 class="text-lg font-semibold text-ink">Audit Log Details</h3>
              <button 
                class="p-2 transition rounded-lg hover:bg-ink/5 text-ink/50 hover:text-ink"
                @click="closeDetailModal"
              >
                <XMarkIcon class="w-5 h-5" />
              </button>
            </div>
            
            <div v-if="selectedLog" class="p-5 space-y-5">
              <!-- Transaction Info -->
              <div class="p-4 rounded-xl bg-surface">
                <h4 class="mb-3 text-sm font-semibold text-ink flex items-center gap-2">
                  <LinkIcon class="w-4 h-4" />
                  Transaction Information
                </h4>
                <div class="space-y-2">
                  <div class="flex justify-between">
                    <span class="text-sm text-ink/60">Transaction ID</span>
                    <span 
                      class="text-sm font-mono text-ink cursor-pointer hover:text-primary"
                      @click="copyToClipboard(selectedLog.txId)"
                    >
                      {{ selectedLog.txId || 'N/A' }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-ink/60">Channel</span>
                    <span class="text-sm text-ink">{{ selectedLog.channelId || 'N/A' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-ink/60">Timestamp</span>
                    <span class="text-sm text-ink">{{ formatDate(selectedLog.timestamp) }}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-ink/60">Action</span>
                    <span :class="['text-xs px-2 py-1 rounded-full font-medium', getActionToneClass(selectedLog.action)]">
                      {{ formatAction(selectedLog.action) }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-ink/60">Status</span>
                    <span class="text-sm text-ink">{{ selectedLog.status || 'N/A' }}</span>
                  </div>
                </div>
              </div>

              <!-- User Info -->
              <div class="p-4 rounded-xl bg-surface">
                <h4 class="mb-3 text-sm font-semibold text-ink flex items-center gap-2">
                  <UserIcon class="w-4 h-4" />
                  User Information
                </h4>
                <div class="space-y-2">
                  <div class="flex justify-between">
                    <span class="text-sm text-ink/60">Username</span>
                    <span class="text-sm font-medium text-ink">{{ selectedLog.user?.username || 'N/A' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-ink/60">Role</span>
                    <span class="text-sm text-ink">{{ getRoleLabel(selectedLog.user?.role) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-ink/60">User ID</span>
                    <span class="text-xs font-mono text-ink/70">{{ selectedLog.user?.userId || 'N/A' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-ink/60">Keycloak ID</span>
                    <span class="text-xs font-mono text-ink/70">{{ selectedLog.user?.keycloakId || 'N/A' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-ink/60">MSP ID</span>
                    <span class="text-sm text-ink">{{ selectedLog.user?.mspId || 'N/A' }}</span>
                  </div>
                </div>
              </div>

              <!-- Resource Info -->
              <div class="p-4 rounded-xl bg-surface">
                <h4 class="mb-3 text-sm font-semibold text-ink flex items-center gap-2">
                  <DocumentTextIcon class="w-4 h-4" />
                  Resource Information
                </h4>
                <div class="space-y-2">
                  <div class="flex justify-between">
                    <span class="text-sm text-ink/60">Resource ID</span>
                    <span 
                      class="text-sm font-mono text-ocean cursor-pointer hover:underline"
                      @click="copyToClipboard(selectedLog.resourceId)"
                    >
                      {{ selectedLog.resourceId || 'N/A' }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Details/Payload -->
              <div v-if="selectedLog.details" class="p-4 rounded-xl bg-surface">
                <h4 class="mb-3 text-sm font-semibold text-ink flex items-center gap-2">
                  <ClipboardDocumentListIcon class="w-4 h-4" />
                  Details
                </h4>
                <pre class="p-3 overflow-x-auto text-xs rounded-lg bg-ink/5 text-ink/80">{{ JSON.stringify(selectedLog.details, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </DashboardLayout>
</template>

<style scoped>
.slide-fade-enter-active {
  transition: all 0.2s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.15s ease-in;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
