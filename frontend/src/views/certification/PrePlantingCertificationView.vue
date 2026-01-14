<script setup>
import { useRouter } from 'vue-router'
import { ClipboardDocumentListIcon, BeakerIcon } from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'

const router = useRouter()

const batchList = [
  {
    id: 'PT-2025-031',
    batch: 'Batch DxP Tenera-22',
    estate: 'Seed Source Estate Citra',
    commodity: 'Palm Oil',
    status: 'Ready to submit',
    tone: 'warning',
    updated: '05 Oct 2025 • 09:30 WIB',
  },
  {
    id: 'PT-2025-028',
    batch: 'Batch RRIM-600',
    estate: 'Tropika Utara Estate',
    commodity: 'Rubber',
    status: 'In progress',
    tone: 'info',
    updated: '04 Oct 2025 • 17:20 WIB',
  },
  {
    id: 'PT-2025-021',
    batch: 'Batch Liberika-15',
    estate: 'Cakrawala Estate',
    commodity: 'Coffee',
    status: 'Pre-planting completed',
    tone: 'success',
    updated: '03 Oct 2025 • 11:05 WIB',
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

const goToNewForm = () => router.push('/certifications/pre-planting/new')
</script>

<template>
  <DashboardLayout
    page-title="Pre-Planting Certification"
    page-subtitle="Submit pre-planting certification by selecting batches linked to seed source estates."
  >
    <template #header-actions>
      <button class="secondary-button">
        <ClipboardDocumentListIcon class="w-5 h-5" />
        Application drafts
      </button>
      <button class="primary-button" @click="goToNewForm">
        New pre-planting application
      </button>
    </template>

    <section class="p-6 space-y-4 panel-card">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold text-ink">Seed batches</h3>
          <p class="text-sm text-ink/60">Select a batch and submit a pre-planting application.</p>
        </div>
        <button class="primary-button" @click="goToNewForm">
          New pre-planting application
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm divide-y divide-ink/10">
          <thead class="bg-surface">
            <tr>
              <th scope="col" class="px-4 py-3 text-left table-header">ID</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Batch</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Source Estate</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Commodity</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Status</th>
              <th scope="col" class="px-4 py-3 text-right table-header">Last update</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-ink/10">
            <tr
              v-for="item in batchList"
              :key="item.id"
              class="transition bg-white hover:bg-primary/5"
            >
              <td class="px-4 py-3 font-semibold text-ink">{{ item.id }}</td>
              <td class="px-4 py-3">
                <p class="font-semibold text-ink">{{ item.batch }}</p>
                <p class="text-xs text-ink/50">{{ item.estate }}</p>
              </td>
              <td class="px-4 py-3 text-ink/70">{{ item.estate }}</td>
              <td class="px-4 py-3 text-ink/70">{{ item.commodity }}</td>
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
      <BeakerIcon class="w-8 h-8 mx-auto text-primary" />
      <p class="mt-3 text-base font-semibold text-ink">No batch selected</p>
      <p class="mt-1 text-sm text-ink/60">Start a pre-planting application by selecting a seed batch.</p>
      <button class="mx-auto mt-4 primary-button" @click="goToNewForm">
        New pre-planting application
      </button>
    </div>
  </DashboardLayout>
</template>
