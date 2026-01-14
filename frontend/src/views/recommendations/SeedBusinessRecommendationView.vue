<script setup>
import { useRouter } from 'vue-router'
import { ClipboardDocumentListIcon, LightBulbIcon } from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'

const router = useRouter()

const recommendationList = [
  {
    id: 'RB-2025-014',
    producer: 'PT Agro Makmur',
    commodity: 'Palm Oil',
    focus: 'Expand DxP seed capacity',
    status: 'Awaiting analysis',
    tone: 'warning',
    updated: '05 Oct 2025 • 10:10 WIB',
  },
  {
    id: 'RB-2025-011',
    producer: 'CV Nusantara Seed',
    commodity: 'Rubber',
    focus: 'Seed source feasibility',
    status: 'Under review',
    tone: 'info',
    updated: '04 Oct 2025 • 16:40 WIB',
  },
  {
    id: 'RB-2025-007',
    producer: 'UPTD Benih Timur',
    commodity: 'Cocoa',
    focus: 'Diversify elite varieties',
    status: 'Completed',
    tone: 'success',
    updated: '03 Oct 2025 • 14:05 WIB',
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

const goToNewForm = () => {
  router.push('/seed-business-recommendations/new')
}
</script>

<template>
  <DashboardLayout
    page-title="Seed Business Recommendation"
    page-subtitle="Manage business recommendation requests for seed producers."
  >
    <template #header-actions>
      <button class="secondary-button">
        <ClipboardDocumentListIcon class="w-5 h-5" />
        Recommendation drafts
      </button>
      <button class="primary-button" @click="goToNewForm">
        New recommendation
      </button>
    </template>

    <section class="p-6 space-y-4 panel-card">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold text-ink">Request list</h3>
          <p class="text-sm text-ink/60">Pick a request or create a new recommendation.</p>
        </div>
        <button class="primary-button" @click="goToNewForm">
          New recommendation
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm divide-y divide-ink/10">
          <thead class="bg-surface">
            <tr>
              <th scope="col" class="px-4 py-3 text-left table-header">ID</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Producer</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Commodity</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Focus</th>
              <th scope="col" class="px-4 py-3 text-left table-header">Status</th>
              <th scope="col" class="px-4 py-3 text-right table-header">Last update</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-ink/10">
            <tr
              v-for="item in recommendationList"
              :key="item.id"
              class="transition bg-white hover:bg-primary/5"
            >
              <td class="px-4 py-3 font-semibold text-ink">{{ item.id }}</td>
              <td class="px-4 py-3">
                <p class="font-semibold text-ink">{{ item.producer }}</p>
                <p class="text-xs text-ink/50">{{ item.commodity }}</p>
              </td>
              <td class="px-4 py-3 text-ink/70">{{ item.commodity }}</td>
              <td class="px-4 py-3 text-ink/70">{{ item.focus }}</td>
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
      <LightBulbIcon class="w-8 h-8 mx-auto text-primary" />
      <p class="mt-3 text-base font-semibold text-ink">No request selected</p>
      <p class="mt-1 text-sm text-ink/60">Start a new recommendation or continue an existing one.</p>
      <button class="mx-auto mt-4 primary-button" @click="goToNewForm">
        New recommendation
      </button>
    </div>
  </DashboardLayout>
</template>
