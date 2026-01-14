<script setup>
import { useRouter } from 'vue-router'
import { ClipboardDocumentListIcon, ShieldCheckIcon } from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'

const router = useRouter()

const siapTanamList = [
  {
    id: 'ST-2025-012',
    batch: 'Batch DxP Tenera-22',
    estate: 'Seed Source Estate Citra',
    preStatus: 'Pre-planting completed',
    status: 'Ready for inspection',
    tone: 'info',
    updated: '05 Oct 2025 • 11:10 WIB',
  },
  {
    id: 'ST-2025-010',
    batch: 'Batch RRIM-600',
    estate: 'Tropika Utara Estate',
    preStatus: 'Pre-planting verification pending',
    status: 'Awaiting schedule',
    tone: 'warning',
    updated: '04 Oct 2025 • 16:45 WIB',
  },
  {
    id: 'ST-2025-006',
    batch: 'Batch Liberika-15',
    estate: 'Cakrawala Estate',
    preStatus: 'Pre-planting passed',
    status: 'Certificate issued',
    tone: 'success',
    updated: '03 Oct 2025 • 13:20 WIB',
  },
]

const statusToneClass = (tone) => {
  const map = {
    success: 'bg-primary/10 text-primary',
    warning: 'bg-sunshine/10 text-sunshine',
    info: 'bg-ocean/10 text-ocean',
  }
  return map[tone] ?? 'bg-ink/10 text-ink/70'
}

const goToNewForm = () => router.push('/certifications/planting-ready/new')
</script>

<template>
  <DashboardLayout
    page-title="Planting-Ready Certification"
    page-subtitle="Submit planting-ready certification for batches that passed pre-planting."
  >
    <template #header-actions>
      <button class="secondary-button">
        <ClipboardDocumentListIcon class="w-5 h-5" />
        Planting-ready drafts
      </button>
      <button class="primary-button" @click="goToNewForm">
        New planting-ready application
      </button>
    </template>

    <section class="p-6 space-y-4 panel-card">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold text-ink">Batches that passed pre-planting</h3>
          <p class="text-sm text-ink/60">Use batches that completed pre-planting for planting-ready applications.</p>
        </div>
        <button class="primary-button" @click="goToNewForm">
          New planting-ready application
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm divide-y divide-ink/10">
          <thead class="bg-surface">
            <tr>
              <th scope="col" class="px-4 py-3 text-left table-header">ID</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Batch</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Source Estate</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Pre-Planting Status</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Planting-Ready Status</th>
              <th scope="col" class="px-4 py-3 text-right table-header">Last update</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-ink/10">
            <tr
              v-for="item in siapTanamList"
              :key="item.id"
              class="transition bg-white hover:bg-primary/5"
            >
              <td class="px-4 py-3 font-semibold text-ink">{{ item.id }}</td>
              <td class="px-4 py-3">
                <p class="font-semibold text-ink">{{ item.batch }}</p>
                <p class="text-xs text-ink/50">{{ item.estate }}</p>
              </td>
              <td class="px-4 py-3 text-ink/70">{{ item.estate }}</td>
              <td class="px-4 py-3 text-ink/70">{{ item.preStatus }}</td>
              <td class="px-4 py-3">
                <span :class="['status-pill', statusToneClass(item.tone)]">{{ item.status }}</span>
              </td>
              <td class="px-4 py-3 text-xs text-right text-ink/60">{{ item.updated }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="p-6 text-center border-dashed panel-card border-primary/20 bg-primary/5">
      <ShieldCheckIcon class="w-8 h-8 mx-auto text-primary" />
      <p class="mt-3 text-base font-semibold text-ink">No planting-ready applications</p>
      <p class="mt-1 text-sm text-ink/60">Select a batch that passed pre-planting to continue.</p>
      <button class="mx-auto mt-4 primary-button" @click="goToNewForm">
        New planting-ready application
      </button>
    </div>
  </DashboardLayout>
</template>
