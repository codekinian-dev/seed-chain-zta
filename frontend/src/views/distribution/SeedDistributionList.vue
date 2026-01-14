<script setup>
import { useRouter } from 'vue-router'
import { ArrowRightIcon, CheckBadgeIcon, ClockIcon, MapPinIcon } from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'

const router = useRouter()

const distributions = [
  {
    id: 'DST-2025-001',
    category: 'Pre-Planting',
    batch: 'PT-2025-031',
    recipient: 'Regional Nursery A',
    address: 'Medan, North Sumatra',
    quantity: '1,200 seedlings',
    status: 'Scheduled',
    statusTone: 'warning',
    updated: '12 Dec 2025 • 09:10',
  },
  {
    id: 'DST-2025-002',
    category: 'Planting-Ready',
    batch: 'ST-2025-012',
    recipient: 'Estate Tropika',
    address: 'Balikpapan, East Kalimantan',
    quantity: '850 bags',
    status: 'Completed',
    statusTone: 'success',
    updated: '11 Dec 2025 • 16:45',
  },
  {
    id: 'DST-2025-003',
    category: 'Pre-Planting',
    batch: 'PT-2025-028',
    recipient: 'Pilot Farm B',
    address: 'Bogor, West Java',
    quantity: '500 seedlings',
    status: 'Awaiting approval',
    statusTone: 'neutral',
    updated: '10 Dec 2025 • 14:20',
  },
]

const toneClass = (tone) => {
  const map = {
    success: 'bg-primary/10 text-primary',
    warning: 'bg-sunshine/10 text-sunshine',
    neutral: 'bg-ink/10 text-ink/70',
  }
  return map[tone] ?? 'bg-ink/10 text-ink/70'
}

const goToNew = () => {
  router.push('/seed-distribution/new')
}
</script>

<template>
  <DashboardLayout
    page-title="Seed Distribution"
    page-subtitle="Review distribution records and start a new request."
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="space-y-1">
        <p class="text-xs font-semibold uppercase tracking-[0.3rem] text-ink/40">Distribution</p>
        <h3 class="text-xl font-semibold text-ink">Active requests</h3>
      </div>
      <button class="primary-button" @click="goToNew">
        <span>New distribution</span>
        <ArrowRightIcon class="w-5 h-5" />
      </button>
    </div>

    <div class="mt-6 overflow-hidden bg-white border shadow-sm rounded-3xl border-ink/10">
      <table class="min-w-full divide-y divide-ink/10">
        <thead class="bg-surface">
          <tr>
            <th scope="col" class="px-4 py-3 text-left table-header">ID</th>
            <th scope="col" class="px-4 py-3 text-left table-header">Category</th>
            <th scope="col" class="px-4 py-3 text-left table-header">Batch</th>
            <th scope="col" class="px-4 py-3 text-left table-header">Recipient</th>
            <th scope="col" class="px-4 py-3 text-left table-header">Quantity</th>
            <th scope="col" class="px-4 py-3 text-left table-header">Status</th>
            <th scope="col" class="px-4 py-3 text-left table-header">Updated</th>
            <th scope="col" class="px-4 py-3 text-left table-header">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-ink/10">
          <tr v-for="item in distributions" :key="item.id" class="hover:bg-surface/60">
            <td class="px-4 py-3 text-sm font-semibold text-ink">{{ item.id }}</td>
            <td class="px-4 py-3 text-sm text-ink/70">{{ item.category }}</td>
            <td class="px-4 py-3 text-sm text-ink/70">{{ item.batch }}</td>
            <td class="px-4 py-3 text-sm text-ink/70">
              <div class="flex items-center gap-2">
                <MapPinIcon class="w-4 h-4 text-ink/50" />
                <div>
                  <p class="text-sm font-semibold leading-tight text-ink">{{ item.recipient }}</p>
                  <p class="text-xs text-ink/60">{{ item.address }}</p>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 text-sm text-ink/70">{{ item.quantity }}</td>
            <td class="px-4 py-3 text-sm">
              <span class="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full" :class="toneClass(item.statusTone)">
                <CheckBadgeIcon v-if="item.statusTone === 'success'" class="w-4 h-4" />
                <ClockIcon v-else class="w-4 h-4" />
                {{ item.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-ink/60">{{ item.updated }}</td>
            <td class="px-4 py-3 text-sm">
              <button class="font-semibold text-primary hover:text-primary-600">View</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </DashboardLayout>
</template>
