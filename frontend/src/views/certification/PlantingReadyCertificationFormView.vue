<script setup>
import { useRouter } from 'vue-router'
import {
  CloudArrowUpIcon,
  ClipboardDocumentListIcon,
  DocumentCheckIcon,
  MapPinIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'

const router = useRouter()

const batchOptions = [
  { id: 'ST-2025-012', label: 'Batch DxP Tenera-22', kebun: 'Seed Source Estate Citra', pra: 'Pre-planting passed' },
  { id: 'ST-2025-010', label: 'Batch RRIM-600', kebun: 'Tropika Utara Estate', pra: 'Ready for verification' },
  { id: 'ST-2025-006', label: 'Batch Liberika-15', kebun: 'Cakrawala Estate', pra: 'Pre-planting passed' },
]

const inspectionTasks = [
  { id: 1, title: 'Validate planting site', detail: 'Coordinates and block area', status: 'Done' },
  { id: 2, title: 'Land readiness', detail: 'Drainage, sanitation, planting holes', status: 'Pending' },
  { id: 3, title: 'Seedling condition', detail: 'Uniformity, health, batch labels', status: 'Pending' },
]

const dokumenChecklist = [
  { id: 1, label: 'Pre-planting minutes', status: 'Complete' },
  { id: 2, label: 'Final planting plan', status: 'Not uploaded' },
  { id: 3, label: 'Site readiness photos', status: 'Not uploaded' },
]

const timeline = [
  { id: 1, title: 'Pre-planting completed', detail: 'Batch passed pre-planting', tone: 'done' },
  { id: 2, title: 'Planting-ready application', detail: 'Being filled', tone: 'active' },
  { id: 3, title: 'Field inspection', detail: 'Scheduled after submission', tone: 'pending' },
]

const statusToneClass = (tone) => {
  const map = {
    done: 'bg-primary/10 text-primary',
    active: 'bg-ocean/10 text-ocean',
    pending: 'bg-ink/5 text-ink/70',
  }
  return map[tone] ?? 'bg-ink/10 text-ink/70'
}

const goBackToList = () => router.push('/certifications/planting-ready')
</script>

<template>
  <DashboardLayout
    page-title="Planting-Ready Certification Application"
    page-subtitle="Use batches that passed pre-planting, fill planting readiness, and upload supporting documents."
  >
    <template #header-actions>
      <button class="secondary-button">
        <ClipboardDocumentListIcon class="w-5 h-5" />
        Planting-ready drafts
      </button>
      <button class="primary-button">
        Save & submit planting-ready
      </button>
    </template>

    <template #subheader-actions>
      <button class="secondary-button" @click="goBackToList">Back to list</button>
    </template>

    <div class="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div class="space-y-6">
        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <DocumentCheckIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Batch & Pre-Planting Status</h3>
              <p class="text-sm text-ink/60">Select a batch that passed pre-planting and review its summary.</p>
            </div>
          </div>

          <div class="grid gap-4 mt-6 md:grid-cols-2">
            <div class="input-group md:col-span-2">
              <label class="input-label">Select batch</label>
              <select class="text-input">
                <option disabled selected>Select a batch that passed pre-planting</option>
                <option v-for="batch in batchOptions" :key="batch.id">{{ batch.label }} — {{ batch.kebun }}</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Source estate</label>
              <input type="text" class="text-input" placeholder="Auto-filled from batch" />
            </div>
            <div class="input-group">
              <label class="input-label">Pre-planting status</label>
              <input type="text" class="text-input" placeholder="Pre-planting passed" />
            </div>
            <div class="input-group">
              <label class="input-label">Pre-planting number</label>
              <input type="text" class="text-input" placeholder="PT-2025-031" />
            </div>
            <div class="input-group">
              <label class="input-label">Planting-ready volume (seeds/seedlings)</label>
              <input type="number" class="text-input" placeholder="50,000" />
            </div>
          </div>
        </section>

        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <MapPinIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Planting Location & Schedule</h3>
              <p class="text-sm text-ink/60">Planting plan details for field inspection.</p>
            </div>
          </div>

          <div class="grid gap-4 mt-6 md:grid-cols-2">
            <div class="input-group">
              <label class="input-label">Planting location</label>
              <input type="text" class="text-input" placeholder="Regency/City" />
            </div>
            <div class="input-group">
              <label class="input-label">Planting area (ha)</label>
              <input type="number" class="text-input" placeholder="25" />
            </div>
            <div class="input-group">
              <label class="input-label">Planting schedule</label>
              <div class="flex items-center gap-2">
                <CalendarDaysIcon class="w-5 h-5 text-ink/50" />
                <input type="text" class="text-input" placeholder="November 2025" />
              </div>
            </div>
            <div class="input-group">
              <label class="input-label">Planting method</label>
              <select class="text-input">
                <option>Raised bed</option>
                <option>Polybag</option>
                <option>Direct to field</option>
              </select>
            </div>
            <div class="md:col-span-2 input-group">
              <label class="input-label">Land readiness notes</label>
              <textarea class="text-input min-h-[120px]" placeholder="Drainage, sanitation, planting hole preparation."></textarea>
            </div>
          </div>
        </section>

        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <ClipboardDocumentListIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Field Inspection</h3>
              <p class="text-sm text-ink/60">Field checklist before issuing planting-ready certificates.</p>
            </div>
          </div>

          <div class="grid gap-3 mt-6">
            <div
              v-for="task in inspectionTasks"
              :key="task.id"
              class="flex items-start justify-between px-4 py-3 bg-white border rounded-2xl border-ink/10"
            >
              <div>
                <p class="text-sm font-semibold text-ink">{{ task.title }}</p>
                <p class="text-xs text-ink/50">{{ task.detail }}</p>
              </div>
              <span :class="['status-pill', task.status === 'Done' ? 'bg-primary/10 text-primary' : 'bg-ink/5 text-ink/70']">
                {{ task.status }}
              </span>
            </div>
          </div>
        </section>

        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <CloudArrowUpIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Planting-Ready Documents</h3>
              <p class="text-sm text-ink/60">Upload final planting plan and field readiness evidence.</p>
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

        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <DocumentCheckIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Notes & Recommendations</h3>
              <p class="text-sm text-ink/60">Inspection summary and follow-up actions.</p>
            </div>
          </div>

          <div class="grid gap-4 mt-6 md:grid-cols-2">
            <div class="input-group">
              <label class="input-label">Verification result</label>
              <select class="text-input">
                <option>Eligible for planting-ready</option>
                <option>Improvements required</option>
                <option>Not eligible</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Estimated certificate issue</label>
              <input type="text" class="text-input" placeholder="20 November 2025" />
            </div>
            <div class="md:col-span-2 input-group">
              <label class="input-label">Field notes</label>
              <textarea class="text-input min-h-[140px]" placeholder="Inspection conclusion and improvement recommendations."></textarea>
            </div>
          </div>
        </section>
      </div>

      <aside class="space-y-6">
        <div class="p-6 panel-card">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-ink">Planting-Ready Progress</h3>
              <p class="text-sm text-ink/60">Track form completion steps.</p>
            </div>
            <span class="status-pill bg-ocean/10 text-ocean">2/3 steps</span>
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
              <span :class="['status-pill', statusToneClass(step.tone)]">
                {{ step.tone === 'done' ? 'Done' : step.tone === 'active' ? 'In progress' : 'Pending' }}
              </span>
            </div>
          </div>
        </div>

        <div class="p-6 space-y-4 panel-card">
          <h3 class="text-lg font-semibold text-ink">Planting-ready checklist</h3>
          <ul class="space-y-3 text-sm text-ink/70">
            <li class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-primary" />
              <span>Batch linked with pre-planting results.</span>
            </li>
            <li class="flex items-start gap-3">
              <ExclamationTriangleIcon class="w-5 h-5 mt-0.5 text-sunshine" />
              <span>Final planting plan not uploaded.</span>
            </li>
            <li class="flex items-start gap-3">
              <ExclamationTriangleIcon class="w-5 h-5 mt-0.5 text-sunshine" />
              <span>Site readiness photos not uploaded.</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </DashboardLayout>
</template>
