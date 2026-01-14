<script setup>
import { computed } from 'vue'
import {
  InboxStackIcon,
  ShieldCheckIcon,
  BeakerIcon,
  ChartBarSquareIcon,
  ArrowTrendingUpIcon,
  DocumentArrowDownIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'
import MetricCard from '../../components/dashboard/MetricCard.vue'

const metrics = [
  {
    title: 'Active Applications',
    value: '128',
    delta: 12.4,
    deltaLabel: 'vs last month',
    icon: InboxStackIcon,
    accent: 'primary',
  },
  {
    title: 'Batches in Testing',
    value: '54 batches',
    delta: -3.2,
    deltaLabel: 'awaiting results',
    icon: BeakerIcon,
    accent: 'ocean',
  },
  {
    title: 'Field Validations',
    value: '32 locations',
    delta: 8.6,
    deltaLabel: 'closed this week',
    icon: ShieldCheckIcon,
    accent: 'sunshine',
  },
  {
    title: 'Average Lead Time',
    value: '14 days',
    delta: -2.1,
    deltaLabel: 'faster than target',
    icon: ArrowTrendingUpIcon,
    accent: 'primary',
  },
]

const applications = [
  {
    id: 'SC-2025-138',
    applicant: 'PT Agro Makmur',
    commodity: 'Palm Oil',
    stage: 'Document Verification',
    progress: 72,
    sla: '3 days left',
    updatedAt: '04 Oct 2025 • 09:12 WIB',
    status: 'In Progress',
    tone: 'warning',
  },
  {
    id: 'SC-2025-133',
    applicant: 'CV Sumber Benih',
    commodity: 'Rubber',
    stage: 'Quality Testing',
    progress: 58,
    sla: '5 days left',
    updatedAt: '04 Oct 2025 • 08:20 WIB',
    status: 'Awaiting Results',
    tone: 'info',
  },
  {
    id: 'SC-2025-129',
    applicant: 'UPTD Benih Jabar',
    commodity: 'Coffee',
    stage: 'Field Validation',
    progress: 92,
    sla: '1 day left',
    updatedAt: '03 Oct 2025 • 16:40 WIB',
    status: 'Priority',
    tone: 'critical',
  },
  {
    id: 'SC-2025-125',
    applicant: 'PT Tropika Sejahtera',
    commodity: 'Coconut',
    stage: 'Certificate',
    progress: 100,
    sla: 'Done',
    updatedAt: '03 Oct 2025 • 11:05 WIB',
    status: 'Completed',
    tone: 'success',
  },
]

const teamActivities = [
  {
    id: 1,
    title: 'Bogor Lab uploaded moisture test results for batch Tenera-19',
    actor: 'Bogor Lab',
    time: '08:45 WIB',
    label: 'Laboratory',
    tone: 'info',
  },
  {
    id: 2,
    title: 'Field inspection for Mitra Hijau confirmed by west zone team',
    actor: 'Arini Rahma',
    time: '07:30 WIB',
    label: 'Field Validation',
    tone: 'success',
  },
  {
    id: 3,
    title: 'Application #SC-2025-127 requested document revision',
    actor: 'UPTD Jatim',
    time: 'Yesterday • 17:10 WIB',
    label: 'Needs Follow-up',
    tone: 'warning',
  },
]

const scheduleItems = [
  {
    id: 1,
    title: 'Field inspection — Citra Lestari Estate',
    detail: 'Wednesday, 09:00 WIB • West Zone Validation Team',
    tone: 'primary',
  },
  {
    id: 2,
    title: 'Lab review — Batch Tenera-17',
    detail: 'Thursday, 13:30 WIB • Lab Lead',
    tone: 'ocean',
  },
  {
    id: 3,
    title: 'Provincial certification coordination meeting',
    detail: 'Friday, 15:00 WIB • Regional Coordinator',
    tone: 'sunshine',
  },
]

const complianceNotes = [
  {
    id: 1,
    title: 'Seed warehouse audit Q3',
    status: 'Follow-up 2/3',
    tone: 'warning',
    checklist: [
      'Complete moisture meter calibration before 8 October',
      'Upload storage photo documentation to the system',
    ],
  },
  {
    id: 2,
    title: 'Quality alert — Batch Java-21',
    status: 'Action required',
    tone: 'critical',
    description: 'Seedling density below standard. Do re-sampling before distribution.',
  },
  {
    id: 3,
    title: 'Vendor evaluation checklist',
    status: '80% complete',
    tone: 'info',
    progress: 80,
  },
]

const progressBreakdown = [
  { label: 'Application Received', value: 82, color: 'bg-primary' },
  { label: 'Lab Testing', value: 65, color: 'bg-ocean' },
  { label: 'Field Validation', value: 48, color: 'bg-sunshine' },
  { label: 'Certificate Issued', value: 36, color: 'bg-forest' },
]

const overallCompletion = computed(() => {
  const maxValue = Math.max(...progressBreakdown.map((item) => item.value))
  return Math.round((progressBreakdown.at(-1).value / maxValue) * 100)
})

const statusToneClass = (tone) => {
  const map = {
    success: 'bg-primary/10 text-primary',
    warning: 'bg-sunshine/10 text-sunshine',
    info: 'bg-ocean/10 text-ocean',
    critical: 'bg-red-100 text-red-500',
  }
  return map[tone] ?? 'bg-ink/10 text-ink/70'
}

const scheduleToneClass = (tone) => {
  const map = {
    primary: 'bg-primary/10 text-primary',
    ocean: 'bg-ocean/10 text-ocean',
    sunshine: 'bg-sunshine/10 text-sunshine',
  }
  return map[tone] ?? 'bg-ink/10 text-ink/70'
}

const complianceToneClass = (tone) => {
  const map = {
    success: 'border-primary/30',
    warning: 'border-sunshine/40',
    info: 'border-ocean/30',
    critical: 'border-red-200 bg-red-50',
  }
  return map[tone] ?? 'border-ink/10'
}
</script>

<template>
  <DashboardLayout page-title="Certification Overview" page-subtitle="Latest snapshot as of 4 October 2025">
    <template #header-actions>
      <button class="secondary-button hidden md:inline-flex">
        <DocumentArrowDownIcon class="h-5 w-5" />
        Export CSV
      </button>
      <button class="primary-button">
        New Application
      </button>
    </template>

    <template #subheader-actions>
      <div class="flex flex-wrap items-center gap-2">
        <button class="secondary-button">
          <AdjustmentsHorizontalIcon class="h-5 w-5" />
          Filter Status
        </button>
        <button class="secondary-button hidden sm:inline-flex">This Week's SLA</button>
        <button class="secondary-button hidden lg:inline-flex">Table Columns</button>
      </div>
    </template>

    <section class="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        v-for="metric in metrics"
        :key="metric.title"
        v-bind="metric"
      />
    </section>

    <section class="grid gap-6 xl:grid-cols-[2fr,1fr]">
      <div class="panel-card overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 px-6 py-5">
          <div>
            <h3 class="text-lg font-semibold text-ink">Latest Applications</h3>
            <p class="text-sm text-ink/60">Status summary of the last four submitted applications.</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button class="secondary-button hidden sm:inline-flex">
              <DocumentArrowDownIcon class="h-5 w-5" />
              Export
            </button>
            <button class="secondary-button">View All</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-ink/10 text-sm">
            <thead class="bg-surface">
              <tr>
                <th scope="col" class="table-header px-6 py-3">Application ID</th>
                <th scope="col" class="table-header px-6 py-3">Applicant</th>
                <th scope="col" class="table-header px-6 py-3">Stage</th>
                <th scope="col" class="table-header px-6 py-3">Progress</th>
                <th scope="col" class="table-header px-6 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink/10">
              <tr
                v-for="app in applications"
                :key="app.id"
                class="bg-white transition hover:bg-primary/5"
              >
                <td class="px-6 py-4 align-top">
                  <div class="space-y-1">
                    <p class="font-semibold text-ink">{{ app.id }}</p>
                    <p class="text-xs text-ink/50">{{ app.updatedAt }}</p>
                  </div>
                </td>
                <td class="px-6 py-4 align-top">
                  <div class="space-y-1">
                    <p class="font-semibold text-ink">{{ app.applicant }}</p>
                    <p class="text-xs text-ink/50">Commodity: {{ app.commodity }}</p>
                  </div>
                </td>
                <td class="px-6 py-4 align-top">
                  <span class="status-pill bg-surface text-ink/70">{{ app.stage }}</span>
                </td>
                <td class="px-6 py-4 align-top">
                  <div class="h-2 w-36 rounded-full bg-ink/10">
                    <div class="h-2 rounded-full bg-primary" :style="{ width: app.progress + '%' }" />
                  </div>
                  <p class="mt-2 text-xs text-ink/50">{{ app.sla }}</p>
                </td>
                <td class="px-6 py-4 align-top text-right">
                  <span :class="['status-pill', statusToneClass(app.tone)]">{{ app.status }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="space-y-6">
        <div class="panel-card p-6">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h3 class="text-lg font-semibold text-ink">Team Activity</h3>
              <p class="text-sm text-ink/60">Cross-unit updates in the last 24 hours.</p>
            </div>
            <button class="secondary-button">View All</button>
          </div>
          <ul class="mt-6 space-y-4">
            <li
              v-for="activity in teamActivities"
              :key="activity.id"
              class="rounded-2xl border border-ink/10 bg-surface/80 px-4 py-3"
            >
              <div class="flex flex-wrap items-center justify-between gap-3">
                <p class="text-sm font-semibold text-ink">{{ activity.title }}</p>
                <span :class="['status-pill', statusToneClass(activity.tone)]">{{ activity.label }}</span>
              </div>
              <p class="mt-2 text-xs text-ink/50">{{ activity.actor }} • {{ activity.time }}</p>
            </li>
          </ul>
        </div>

        <div class="panel-card space-y-6 p-6">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold text-ink">Certification Performance</h3>
              <p class="text-sm text-ink/60">Cycle speed across stages.</p>
            </div>
            <ChartBarSquareIcon class="h-10 w-10 text-primary" />
          </div>
          <div class="rounded-3xl bg-surface/70 p-5">
            <div class="flex items-baseline justify-between">
              <div>
                <p class="text-xs font-semibold uppercase tracking-widest text-ink/40">Final completion</p>
                <p class="text-3xl font-semibold text-ink">{{ overallCompletion }}%</p>
              </div>
              <span class="status-pill bg-primary/10 text-primary">Target 60%</span>
            </div>
            <div class="mt-6 space-y-4">
              <div v-for="stage in progressBreakdown" :key="stage.label" class="space-y-2">
                <div class="flex items-center justify-between text-sm text-ink/60">
                  <span>{{ stage.label }}</span>
                  <span class="font-semibold text-ink">{{ stage.value }} batches</span>
                </div>
                <div class="h-2 w-full rounded-full bg-ink/10">
                  <div :class="[stage.color, 'h-2 rounded-full']" :style="{ width: stage.value + '%' }" />
                </div>
              </div>
            </div>
          </div>
          <div class="rounded-3xl border border-primary/20 bg-primary/5 p-5 text-sm text-ink/70">
            <p class="font-semibold text-primary">Auto recommendation</p>
            <p class="mt-2">
              Prioritize batch <span class="font-semibold text-ink">Tenera-19</span> for field inspection this week to keep the 15-day SLA.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[1.5fr,1fr]">
      <div class="panel-card p-6">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-ink">This Week's Schedule</h3>
            <p class="text-sm text-ink/60">Coordinate field, lab, and meeting activities.</p>
          </div>
          <button class="secondary-button">Manage Schedule</button>
        </div>
        <div class="mt-6 space-y-4">
          <div
            v-for="item in scheduleItems"
            :key="item.id"
            class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-4"
          >
            <div>
              <p class="text-sm font-semibold text-ink">{{ item.title }}</p>
              <p class="text-xs text-ink/50">{{ item.detail }}</p>
            </div>
            <span :class="['status-pill', scheduleToneClass(item.tone)]">
              {{ item.tone === 'primary' ? 'Field' : item.tone === 'ocean' ? 'Lab' : 'Meeting' }}
            </span>
          </div>
        </div>
      </div>

      <div class="panel-card space-y-4 p-6">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-ink">Compliance Notes</h3>
            <p class="text-sm text-ink/60">Track audit follow-ups and improvement actions.</p>
          </div>
          <button class="secondary-button">Add Note</button>
        </div>
        <div class="space-y-4">
          <div
            v-for="note in complianceNotes"
            :key="note.id"
            :class="['rounded-2xl border bg-white px-5 py-4', complianceToneClass(note.tone)]"
          >
            <div class="flex items-center justify-between gap-3">
              <h4 class="text-sm font-semibold text-ink">{{ note.title }}</h4>
              <span :class="['status-pill', statusToneClass(note.tone)]">{{ note.status }}</span>
            </div>
            <template v-if="note.description">
              <p class="mt-2 text-xs text-ink/60">{{ note.description }}</p>
            </template>
            <template v-if="note.checklist">
              <ul class="mt-3 space-y-2 text-sm text-ink/70">
                <li v-for="item in note.checklist" :key="item">• {{ item }}</li>
              </ul>
            </template>
            <template v-if="note.progress">
              <div class="mt-3 h-2 w-full rounded-full bg-ink/10">
                <div class="h-2 rounded-full bg-primary" :style="{ width: note.progress + '%' }" />
              </div>
            </template>
          </div>
        </div>
      </div>
    </section>
  </DashboardLayout>
</template>
