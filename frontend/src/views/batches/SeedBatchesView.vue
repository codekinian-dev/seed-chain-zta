<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  ClipboardDocumentListIcon,
  ArrowDownTrayIcon,
  PlusCircleIcon,
  CubeIcon,
  FunnelIcon,
} from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'
import { seedBatchService } from '../../services/api'

const router = useRouter()
const batches = ref([])
const loading = ref(false)
const error = ref(null)

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

        <!-- Table -->
        <div v-else class="overflow-x-auto">
          <table class="min-w-full text-sm divide-y divide-ink/10">
            <thead class="bg-surface">
              <tr>
                <th scope="col" class="px-4 py-3 text-left table-header">ID Batch</th>
                <th scope="col" class="px-4 py-3 text-left table-header">Variety Name</th>
                <th scope="col" class="px-4 py-3 text-left table-header">Commodity</th>
                <th scope="col" class="px-4 py-3 text-left table-header">Origin</th>
                <th scope="col" class="px-4 py-3 text-left table-header">Seed Class</th>
                <th scope="col" class="px-4 py-3 text-left table-header">Status</th>
                <th scope="col" class="px-4 py-3 text-right table-header">Created</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink/10">
              <tr
                v-for="item in batches"
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
