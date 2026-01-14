<script setup>
import { useRouter } from 'vue-router'
import {
  CloudArrowUpIcon,
  ClipboardDocumentListIcon,
  MapPinIcon,
  ChartBarSquareIcon,
  DocumentTextIcon,
  BuildingStorefrontIcon,
  LightBulbIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'

const router = useRouter()

const dokumenChecklist = [
  { id: 1, label: 'Company profile & Business ID', status: 'Complete' },
  { id: 2, label: '3-year seed business plan', status: 'Not uploaded' },
  { id: 3, label: 'Estate/facility map', status: 'Complete' },
  { id: 4, label: 'Market & distribution analysis', status: 'Not uploaded' },
]

const timeline = [
  { id: 1, title: 'Recommendation requested', detail: '05 Oct 2025 • Producer', tone: 'done' },
  { id: 2, title: 'Basic docs verified', detail: '05 Oct 2025 • System', tone: 'done' },
  { id: 3, title: 'Feasibility analysis', detail: 'Pending', tone: 'pending' },
  { id: 4, title: 'Recommendation issued', detail: 'Pending', tone: 'pending' },
]

const statusToneClass = (tone) => {
  const map = {
    done: 'bg-primary/10 text-primary',
    pending: 'bg-ink/5 text-ink/70',
  }
  return map[tone] ?? 'bg-ink/10 text-ink/70'
}

const goBackToList = () => {
  router.push('/seed-business-recommendations')
}
</script>

<template>
  <DashboardLayout
    page-title="Seed Business Recommendation Form"
    page-subtitle="Fill producer profile, business plan, supporting documents, and feasibility notes."
  >
    <template #header-actions>
      <button class="secondary-button">
        <ClipboardDocumentListIcon class="w-5 h-5" />
        Recommendation drafts
      </button>
      <button class="primary-button">
        Save & submit recommendation
      </button>
    </template>

    <template #subheader-actions>
      <button class="secondary-button" @click="goBackToList">Back to list</button>
    </template>

    <div class="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div class="space-y-6">
        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <BuildingStorefrontIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Producer Profile</h3>
              <p class="text-sm text-ink/60">Seed producer identity and contacts.</p>
            </div>
          </div>

          <div class="grid gap-4 mt-6 md:grid-cols-2">
            <div class="input-group">
              <label class="input-label">Producer Name</label>
              <input type="text" class="text-input" placeholder="Company / UPTD" />
            </div>
            <div class="input-group">
              <label class="input-label">Business ID (NIB)</label>
              <input type="text" class="text-input" placeholder="24xxxxxxxxxxx" />
            </div>
            <div class="input-group">
              <label class="input-label">PIC Contact</label>
              <input type="text" class="text-input" placeholder="Name & phone number" />
            </div>
            <div class="input-group">
              <label class="input-label">PIC Email</label>
              <input type="email" class="text-input" placeholder="name@company.com" />
            </div>
            <div class="input-group">
              <label class="input-label">Province</label>
              <input type="text" class="text-input" placeholder="West Java" />
            </div>
            <div class="input-group">
              <label class="input-label">Regency/City</label>
              <input type="text" class="text-input" placeholder="Bandung" />
            </div>
            <div class="md:col-span-2 input-group">
              <label class="input-label">Facility address</label>
              <input type="text" class="text-input" placeholder="Full estate / warehouse address" />
            </div>
          </div>
        </section>

        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <DocumentTextIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Business Plan & Commodity</h3>
              <p class="text-sm text-ink/60">Seed production targets and planting plan.</p>
            </div>
          </div>

          <div class="grid gap-4 mt-6 md:grid-cols-2">
            <div class="input-group">
              <label class="input-label">Commodity</label>
              <select class="text-input">
                <option>Palm Oil</option>
                <option>Rubber</option>
                <option>Cocoa</option>
                <option>Coffee</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Variety/Clone</label>
              <input type="text" class="text-input" placeholder="DxP Tenera / RRIM 600" />
            </div>
            <div class="input-group">
              <label class="input-label">Planned area (ha)</label>
              <input type="number" class="text-input" placeholder="20" />
            </div>
            <div class="input-group">
              <label class="input-label">Seed production target/year</label>
              <div class="flex items-center gap-2">
                <input type="number" class="text-input" placeholder="50,000" />
                <span class="text-sm text-ink/50">seeds / seedlings</span>
              </div>
            </div>
            <div class="input-group">
              <label class="input-label">Planting plan</label>
              <input type="text" class="text-input" placeholder="Q1 2026 - Q2 2026" />
            </div>
            <div class="input-group">
              <label class="input-label">Target market</label>
              <input type="text" class="text-input" placeholder="Nucleus / plasma / export" />
            </div>
          </div>
        </section>

        <section class="p-6 panel-card">
          <div class="flex items-center gap-3">
            <CloudArrowUpIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Supporting Documents</h3>
              <p class="text-sm text-ink/60">Upload business plan, location map, and market analysis.</p>
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
            <LightBulbIcon class="w-6 h-6 text-primary" />
            <div>
              <h3 class="text-lg font-semibold text-ink">Analysis & Notes</h3>
              <p class="text-sm text-ink/60">Capture risks, mitigations, and technical recommendations.</p>
            </div>
          </div>

          <div class="grid gap-4 mt-6 md:grid-cols-2">
            <div class="input-group">
              <label class="input-label">Infrastructure readiness</label>
              <select class="text-input">
                <option>Ready</option>
                <option>Adequate</option>
                <option>Needs upgrade</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Funding & investment</label>
              <input type="text" class="text-input" placeholder="Capex/Opex, funding source" />
            </div>
            <div class="md:col-span-2 input-group">
              <label class="input-label">Risk & mitigation summary</label>
              <textarea class="text-input min-h-[120px]" placeholder="List pest, logistics, funding risks, etc."></textarea>
            </div>
            <div class="md:col-span-2 input-group">
              <label class="input-label">Final recommendation</label>
              <textarea class="text-input min-h-[120px]" placeholder="Feasibility notes and follow-up actions."></textarea>
            </div>
          </div>
        </section>
      </div>

      <aside class="space-y-6">
        <div class="p-6 panel-card">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-ink">Recommendation Progress</h3>
              <p class="text-sm text-ink/60">Track form completion steps.</p>
            </div>
            <span class="status-pill bg-primary/10 text-primary">2/4 steps</span>
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
          <h3 class="text-lg font-semibold text-ink">Validation checklist</h3>
          <ul class="space-y-3 text-sm text-ink/70">
            <li class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-primary" />
              <span>Producer profile and business ID filled.</span>
            </li>
            <li class="flex items-start gap-3">
              <CheckCircleIcon class="w-5 h-5 mt-0.5 text-primary" />
              <span>Commodity, production target, and planting plan filled.</span>
            </li>
            <li class="flex items-start gap-3">
              <ExclamationTriangleIcon class="w-5 h-5 mt-0.5 text-sunshine" />
              <span>3-year business plan not uploaded.</span>
            </li>
            <li class="flex items-start gap-3">
              <ExclamationTriangleIcon class="w-5 h-5 mt-0.5 text-sunshine" />
              <span>Market & distribution analysis not uploaded.</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </DashboardLayout>
</template>
