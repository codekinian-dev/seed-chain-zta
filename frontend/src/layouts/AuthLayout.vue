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
    default: 'SeedCertify'
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
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div class="absolute -top-40 -right-32 h-[500px] w-[500px] rounded-full bg-primary/30 blur-3xl" />
      <div class="absolute -bottom-56 -left-32 h-[460px] w-[460px] rounded-full bg-ocean/25 blur-3xl" />
      <div class="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-sunshine/30 blur-3xl" />
    </div>
    <div class="relative z-10 flex min-h-screen flex-col lg:flex-row">
      <aside class="hidden w-full max-w-xl flex-col justify-between gap-8 bg-gradient-to-br from-primary via-ocean to-ink p-12 text-white lg:flex">
        <div class="flex items-center gap-3 text-lg font-semibold">
          <span class="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-2xl shadow-inner">🌱</span>
          <span>{{ highlightTitle }}</span>
        </div>
        <div class="space-y-6">
          <div class="space-y-4">
            <p class="text-sm uppercase tracking-[0.4rem] text-white/60">Digital Certification</p>
            <h2 class="text-4xl font-semibold leading-tight">
              Accelerate seed certification with a unified, intelligent workflow.
            </h2>
            <p class="text-base text-white/80">
              {{ highlightDescription }}
            </p>
          </div>
          <ul class="space-y-4 text-base text-white/80">
            <li class="flex items-start gap-3">
              <span class="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">1</span>
              Real-time certification tracking from submission to certificate issuance.
            </li>
            <li class="flex items-start gap-3">
              <span class="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">2</span>
              Integrate lab, field, and administrative data in one centralized platform.
            </li>
            <li class="flex items-start gap-3">
              <span class="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">3</span>
              Interactive analytics dashboard to monitor seed quality and process efficiency.
            </li>
          </ul>
        </div>
        <div class="flex items-center gap-4 text-white/70">
          <div class="h-12 w-12 rounded-full bg-white/10" />
          <div>
            <p class="text-sm font-semibold">Directorate General of Plantations</p>
            <p class="text-xs">Ministry of Agriculture, Republic of Indonesia</p>
          </div>
        </div>
      </aside>
      <main class="flex flex-1 items-center justify-center px-6 py-10 sm:px-12 lg:px-16">
        <div class="w-full max-w-md space-y-8">
          <div class="space-y-2 text-center lg:text-left">
            <h1 class="text-3xl font-semibold tracking-tight text-ink">
              {{ title }}
            </h1>
            <p class="text-ink/60">
              {{ subtitle }}
            </p>
          </div>
          <div class="glass-card space-y-6 p-8">
            <slot />
          </div>
          <slot name="footer" />
        </div>
      </main>
    </div>
  </div>
</template>
