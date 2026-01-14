<script setup>
import { useRouter } from 'vue-router'
import { ArrowRightIcon, InboxStackIcon } from '@heroicons/vue/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout.vue'

const router = useRouter()

const options = [
  {
    id: 'pre-planting',
    title: 'Pre-Planting Distribution',
    description: 'Distribute seeds or seedlings that are approved for planting preparation.',
    badge: 'Before planting',
    target: '/seed-distribution/new/form?category=pre-planting',
  },
  {
    id: 'planting-ready',
    title: 'Planting-Ready Distribution',
    description: 'Distribute batches that passed planting-ready certification.',
    badge: 'Post certification',
    target: '/seed-distribution/new/form?category=planting-ready',
  },
]

const goToForm = (target) => {
  router.push(target)
}
</script>

<template>
  <DashboardLayout
    page-title="Seed Distribution"
    page-subtitle="Choose the category before filling out the distribution form."
  >
    <div class="grid gap-6 md:grid-cols-2">
      <article
        v-for="card in options"
        :key="card.id"
        class="flex flex-col gap-4 p-6 transition bg-white border rounded-3xl border-ink/10 hover:-translate-y-1 hover:shadow-lg"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary">
              <InboxStackIcon class="w-6 h-6" />
            </span>
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.3rem] text-ink/40">Seed Distribution</p>
              <h3 class="text-xl font-semibold text-ink">{{ card.title }}</h3>
            </div>
          </div>
          <span class="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-ink/5 text-ink/70">
            {{ card.badge }}
          </span>
        </div>
        <p class="text-sm text-ink/70">{{ card.description }}</p>
        <div class="flex items-center justify-between pt-2">
          <div class="text-sm font-semibold text-primary">Continue with this category</div>
          <button class="primary-button" @click="goToForm(card.target)">
            <span>Start form</span>
            <ArrowRightIcon class="w-5 h-5" />
          </button>
        </div>
      </article>
    </div>
  </DashboardLayout>
</template>
