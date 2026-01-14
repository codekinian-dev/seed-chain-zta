<script setup>
import { useRouter } from 'vue-router'
import {
  CloudArrowUpIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  BeakerIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'

const router = useRouter()

const batchOptions = [
  { id: 'PT-2025-031', label: 'Batch DxP Tenera-22', kebun: 'Seed Source Estate Citra', komoditas: 'Palm Oil' },
  { id: 'PT-2025-028', label: 'Batch RRIM-600', kebun: 'Tropika Utara Estate', komoditas: 'Rubber' },
  { id: 'PT-2025-021', label: 'Batch Liberika-15', kebun: 'Cakrawala Estate', komoditas: 'Coffee' },
]

const dokumenChecklist = [
  { id: 1, label: 'Pre-planting minutes', status: 'Not uploaded' },
  { id: 2, label: 'Seed source block map', status: 'Complete' },
  { id: 3, label: 'Planting plan', status: 'Not uploaded' },
]

const timeline = [
  { id: 1, title: 'Batch & estate linked', detail: 'Done', tone: 'done' },
  { id: 2, title: 'Upload pre-planting docs', detail: 'Pending', tone: 'pending' },
  { id: 3, title: 'Verification & inspection', detail: 'Pending', tone: 'pending' },
]

const statusToneClass = (tone) => {
  const map = {
    done: 'bg-primary/10 text-primary',
    pending: 'bg-ink/5 text-ink/70',
  }
  return map[tone] ?? 'bg-ink/10 text-ink/70'
}

const goBackToList = () => {
  router.push('/certifications/pre-planting')
}
</script>

<template>
  <DashboardLayout
    page-title="Pre-Planting Certification Application"
    page-subtitle="Select a seed batch linked to the source estate, then complete pre-planting documents."
  >
    <template #header-actions>
      <button class="secondary-button">
        <ClipboardDocumentListIcon class="w-5 h-5" />
        Pre-planting drafts
      </button>
      <button class="primary-button">
        Save & submit pre-planting
      </button>
    </template>

    <template #subheader-actions>
      <button class="secondary-button" @click="goBackToList">Back to list</button>
    </template>

    <div class="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div class="space-y-6">
        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <BeakerIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Batch & Seed Source</h3>
              <p class="text-sm text-ink/60">Link the pre-planting request to a seed batch.</p>
            </div>
          </div>

          <div class="grid gap-4 mt-6 md:grid-cols-2">
            <div class="input-group md:col-span-2">
              <label class="input-label">Select batch</label>
              <select class="text-input">
                <option disabled selected>Select seed batch</option>
                <option v-for="batch in batchOptions" :key="batch.id">{{ batch.label }} — {{ batch.kebun }}</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Source estate</label>
              <input type="text" class="text-input" placeholder="Auto-filled from batch" />
            </div>
            <div class="input-group">
              <label class="input-label">Commodity</label>
              <input type="text" class="text-input" placeholder="Auto-filled from batch" />
            </div>
            <div class="input-group">
              <label class="input-label">Batch volume (seeds/seedlings)</label>
              <input type="number" class="text-input" placeholder="50,000" />
            </div>
            <div class="input-group">
              <label class="input-label">Bunch estimation / ha</label>
              <input type="number" class="text-input" placeholder="135" />
            </div>
            <div class="input-group">
              <label class="input-label">Planting plan</label>
              <input type="text" class="text-input" placeholder="Q1 2026" />
            </div>
          </div>
        </section>

        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <DocumentTextIcon class="w-6 h-6 text-primary" />
            <div>
                <h3 class="text-lg font-semibold text-ink">Application Details</h3>
                <p class="text-sm text-ink/60">Purpose and coverage of the pre-planting certification.</p>
            </div>
          </div>

          <div class="grid gap-4 mt-6 md:grid-cols-2">
            <div class="input-group">
              <label class="input-label">Distribution target</label>
              <input type="text" class="text-input" placeholder="Nucleus / plasma / export" />
            </div>
            <div class="input-group">
              <label class="input-label">Planting location</label>
              <input type="text" class="text-input" placeholder="Regency/City" />
            </div>
            <div class="md:col-span-2 input-group">
              <label class="input-label">Additional notes</label>
              <textarea class="text-input min-h-[120px]" placeholder="Planting plan summary and inspection needs."></textarea>
            </div>
          </div>
        </section>

        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <CloudArrowUpIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Pre-Planting Documents</h3>
              <p class="text-sm text-ink/60">Upload minutes, block maps, and planting plan.</p>
            </div>
          </div>

          <div class="grid gap-4 mt-6 md:grid-cols-2">
            <div class="p-6 text-center border border-dashed rounded-2xl border-primary/30 bg-primary/5">
              <p class="text-sm font-semibold text-primary">Drag & drop documents here</p>
              <p class="mt-1 text-xs text-ink/60">PDF, JPG, PNG • max 20MB</p>
              <button class="mx-auto mt-4 primary-button">
                <CloudArrowUpIcon class="w-5 h-5" />
                Choose files
              </button>
            </div>
            <div class="space-y-3">
              <div
                v-for="item in dokumenChecklist"
                :key="item.id"
                class="flex items-center justify-between px-4 py-3 border rounded-xl border-ink/10 bg-surface"
              >
                <div class="flex items-center gap-3">
                  <CheckCircleIcon
                    v-if="item.status === 'Complete'"
                    class="w-5 h-5 text-primary"
                  />
                  <ExclamationTriangleIcon
                    v-else
                    class="w-5 h-5 text-sunshine"
                  />
                  <p class="text-sm font-semibold text-ink">{{ item.label }}</p>
                </div>
                <span :class="['status-pill', item.status === 'Complete' ? 'bg-primary/10 text-primary' : 'bg-sunshine/10 text-sunshine']">
                  {{ item.status }}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside class="space-y-6">
        <div class="p-6 panel-card">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-ink">Pre-Planting Progress</h3>
              <p class="text-sm text-ink/60">Track form completion steps.</p>
            </div>
            <span class="status-pill bg-primary/10 text-primary">1/3 steps</span>
          </div>
          <div class="mt-6 space-y-3">
            <div
              v-for="step in timeline"
              :key="step.id"
              class="flex items-start justify-between px-4 py-3 bg-white border rounded-2xl border-ink/10"
            >
              <div>
                <p class="text-sm font-semibold text-ink">{{ step.title }}</p>
                <p class="text-xs text-ink/50">{{ step.detail }}</p>
              </div>
              <span :class="['status-pill', statusToneClass(step.tone)]">{{ step.tone === 'done' ? 'Done' : 'Pending' }}</span>
            </div>
          </div>
        </div>

        <div class="p-6 space-y-4 panel-card">
          <h3 class="text-lg font-semibold text-ink">Pre-planting checklist</h3>
          <ul class="space-y-3 text-sm text-ink/70">
            <li class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-primary" />
              <span>Batch selected and linked to source estate.</span>
            </li>
            <li class="flex items-start gap-3">
              <ExclamationTriangleIcon class="w-5 h-5 mt-0.5 text-sunshine" />
              <span>Pre-planting minutes not uploaded.</span>
            </li>
            <li class="flex items-start gap-3">
              <ExclamationTriangleIcon class="w-5 h-5 mt-0.5 text-sunshine" />
              <span>Planting plan not uploaded.</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </DashboardLayout>
</template>
