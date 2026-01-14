<script setup>
import { useRouter } from 'vue-router'
import {
  ClipboardDocumentListIcon,
  ArrowDownTrayIcon,
  PlusCircleIcon,
  CubeIcon,
  FunnelIcon,
} from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'

const router = useRouter()

const batches = [
  {
    id: 'BT-2025-031',
    name: 'Batch DxP Tenera-22',
    estate: 'Seed Source Estate Citra',
    commodity: 'Palm Oil',
    volume: '50.000',
    status: 'Pre-planting passed',
    tone: 'success',
    updated: '05 Oct 2025 • 09:40 WIB',
  },
  {
    id: 'BT-2025-028',
    name: 'Batch RRIM-600',
    estate: 'Tropika Utara Estate',
    commodity: 'Rubber',
    volume: '32.500',
    status: 'Awaiting inspection',
    tone: 'warning',
    updated: '04 Oct 2025 • 17:05 WIB',
  },
  {
    id: 'BT-2025-021',
    name: 'Batch Liberika-15',
    estate: 'Cakrawala Estate',
    commodity: 'Coffee',
    volume: '18.000',
    status: 'Planting-ready completed',
    tone: 'info',
    updated: '03 Oct 2025 • 10:55 WIB',
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

const goToNewForm = () => router.push('/seed-batches/new')
</script>

<template>
  <DashboardLayout
    page-title="Seed Batches"
    page-subtitle="Manage seed batches, test status, and links to pre/planting-ready certification."
  >
    <template #header-actions>
      <button class="secondary-button">
        <ClipboardDocumentListIcon class="w-5 h-5" />
        Batch drafts
      </button>
      <button class="primary-button" @click="goToNewForm">
        New batch
      </button>
    </template>

    <section class="p-6 space-y-4 panel-card">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold text-ink">Batch list</h3>
          <p class="text-sm text-ink/60">Track seed batches, volume, and certification status.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button class="secondary-button">
            <FunnelIcon class="w-5 h-5" />
            Filter status
          </button>
          <button class="secondary-button">
            <ArrowDownTrayIcon class="w-5 h-5" />
            Export
          </button>
          <button class="primary-button" @click="goToNewForm">
            <PlusCircleIcon class="w-5 h-5" />
            New batch
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm divide-y divide-ink/10">
          <thead class="bg-surface">
            <tr>
              <th scope="col" class="px-4 py-3 text-left table-header">ID Batch</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Batch Name</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Source Estate</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Commodity</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Volume</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Status</th>
              <th scope="col" class="px-4 py-3 text-right table-header">Last update</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-ink/10">
            <tr
              v-for="item in batches"
              :key="item.id"
              class="transition bg-white hover:bg-primary/5"
            >
              <td class="px-4 py-3 font-semibold text-ink">{{ item.id }}</td>
              <td class="px-4 py-3">
                <p class="font-semibold text-ink">{{ item.name }}</p>
                <p class="text-xs text-ink/50">{{ item.estate }}</p>
              </td>
              <td class="px-4 py-3 text-ink/70">{{ item.estate }}</td>
              <td class="px-4 py-3 text-ink/70">{{ item.commodity }}</td>
              <td class="px-4 py-3 text-ink/70">{{ item.volume }}</td>
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
      <CubeIcon class="w-8 h-8 mx-auto text-primary" />
      <p class="mt-3 text-base font-semibold text-ink">No batch selected</p>
      <p class="mt-1 text-sm text-ink/60">Add a new batch or import from lab results.</p>
      <button class="mx-auto mt-4 primary-button" @click="goToNewForm">
        New batch
      </button>
    </div>
  </DashboardLayout>
</template>
