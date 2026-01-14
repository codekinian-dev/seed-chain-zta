<script setup>
import { useRouter } from 'vue-router'
import { ClipboardDocumentListIcon } from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'

const router = useRouter()

const evaluationList = [
  {
    id: 'EV-2025-021',
    estate: 'Seed Source Estate Citra',
    commodity: 'Palm Oil',
    stage: 'Upload documents',
    status: 'Waiting for documents',
    tone: 'warning',
    updated: '04 Oct 2025 • 09:45 WIB',
  },
  {
    id: 'EV-2025-017',
    estate: 'Mother Block Tenera 03',
    commodity: 'Palm Oil',
    stage: 'Field validation',
    status: 'On track',
    tone: 'success',
    updated: '03 Oct 2025 • 15:20 WIB',
  },
  {
    id: 'EV-2025-012',
    estate: 'Tropika Utara Estate',
    commodity: 'Rubber',
    stage: 'Document review',
    status: 'Needs follow-up',
    tone: 'critical',
    updated: '02 Oct 2025 • 17:05 WIB',
  },
]

const statusToneClass = (tone) => {
  const map = {
    success: 'bg-primary/10 text-primary',
    warning: 'bg-sunshine/10 text-sunshine',
    critical: 'bg-red-100 text-red-500',
  }
  return map[tone] ?? 'bg-ink/10 text-ink/70'
}

const goToNewForm = () => {
  router.push('/seed-source-evaluations/new')
}
</script>

<template>
  <DashboardLayout
    page-title="Seed Source Evaluation"
    page-subtitle="Complete estate data and upload evaluation documents for seed certification."
  >
    <template #header-actions>
      <button class="secondary-button">
        <ClipboardDocumentListIcon class="w-5 h-5" />
        Evaluation drafts
      </button>
      <button class="primary-button" @click="goToNewForm">
        New evaluation
      </button>
    </template>

    <section class="p-6 space-y-4 panel-card">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold text-ink">Evaluation list</h3>
          <p class="text-sm text-ink/60">Pick an entry then continue to the evaluation form.</p>
        </div>
        <button class="primary-button" @click="goToNewForm">
          New evaluation
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm divide-y divide-ink/10">
          <thead class="bg-surface">
            <tr>
              <th scope="col" class="px-4 py-3 text-left table-header">ID</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Estate</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Commodity</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Stage</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Status</th>
              <th scope="col" class="px-4 py-3 text-right table-header">Last update</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-ink/10">
            <tr
              v-for="item in evaluationList"
              :key="item.id"
              class="transition bg-white hover:bg-primary/5"
            >
              <td class="px-4 py-3 font-semibold text-ink">{{ item.id }}</td>
              <td class="px-4 py-3">
                <p class="font-semibold text-ink">{{ item.estate }}</p>
                <p class="text-xs text-ink/50">{{ item.commodity }}</p>
              </td>
              <td class="px-4 py-3 text-ink/70">{{ item.commodity }}</td>
              <td class="px-4 py-3"><span class="status-pill bg-surface text-ink/70">{{ item.stage }}</span></td>
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
      <p class="text-base font-semibold text-ink">Select an entry to continue the evaluation</p>
      <p class="mt-1 text-sm text-ink/60">Or start a new evaluation to fill estate data and documents.</p>
      <button class="mx-auto mt-4 primary-button" @click="goToNewForm">
        New evaluation
      </button>
    </div>
  </DashboardLayout>
</template>
