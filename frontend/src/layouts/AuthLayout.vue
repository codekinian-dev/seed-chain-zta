<script setup>
import { defineProps } from 'vue'

defineProps({
  title: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    required: true,
  },
  highlightTitle: {
    type: String,
    default: 'BenihChain'
  },
  highlightDescription: {
    type: String,
    default:
      'Digital platform for modern, transparent, and accessible seed certification management.'
  },
})
</script>

<template>
  <div class="relative min-h-screen bg-surface">
    <div class="relative z-10 flex flex-col min-h-screen lg:flex-row">
      <aside class="flex-col justify-between hidden w-full max-w-xl gap-8 p-12 text-white bg-primary lg:flex">
        <div class="flex items-center gap-3 text-lg font-semibold">
          <span class="inline-flex items-center justify-center text-2xl shadow-inner h-11 w-11 rounded-2xl bg-white/15">🌱</span>
          <span>{{ highlightTitle }}</span>
        </div>
        <div class="space-y-6">
          <div class="space-y-4">
            <p class="text-sm uppercase tracking-[0.4rem] text-white/60">Digital Certification</p>
            <!-- <h2 class="text-4xl font-semibold leading-tight">
              Accelerate seed certification with a unified, intelligent workflow.
            </h2> -->
            <p class="text-base text-white/80">
              {{ highlightDescription }}
            </p>
          </div>
          <!-- <ul class="space-y-4 text-base text-white/80">
            <li class="flex items-start gap-3">
              <span class="inline-flex items-center justify-center w-6 h-6 mt-1 text-sm font-semibold rounded-full bg-white/15">1</span>
              Real-time certification tracking from submission to certificate issuance.
            </li>
            <li class="flex items-start gap-3">
              <span class="inline-flex items-center justify-center w-6 h-6 mt-1 text-sm font-semibold rounded-full bg-white/15">2</span>
              Integrate lab, field, and administrative data in one centralized platform.
            </li>
            <li class="flex items-start gap-3">
              <span class="inline-flex items-center justify-center w-6 h-6 mt-1 text-sm font-semibold rounded-full bg-white/15">3</span>
              Interactive analytics dashboard to monitor seed quality and process efficiency.
            </li>
          </ul> -->
        </div>
        <div class="flex items-center gap-4 text-white/70">
          <!-- <div class="w-12 h-12 rounded-full bg-white/10" />
          <div>
            <p class="text-sm font-semibold">Directorate General of Plantations</p>
            <p class="text-xs">Ministry of Agriculture, Republic of Indonesia</p>
          </div> -->
        </div>
      </aside>
      <main class="flex items-center justify-center flex-1 px-6 py-10 sm:px-12 lg:px-16">
        <div class="w-full max-w-md space-y-8">
          <div class="space-y-2 text-center lg:text-left">
            <h1 class="text-3xl font-semibold tracking-tight text-ink">
              {{ title }}
            </h1>
            <p class="text-ink/60">
              {{ subtitle }}
            </p>
          </div>
          <div class="p-8 space-y-6 glass-card">
            <slot />
          </div>
          <slot name="footer" />
        </div>
      </main>
    </div>
  </div>
</template>
