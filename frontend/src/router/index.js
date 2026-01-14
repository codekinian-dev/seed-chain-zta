import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            redirect: '/login',
        },
        {
            path: '/login',
            name: 'login',
            component: () => import('../views/auth/AuthLogin.vue'),
        },
        {
            path: '/register',
            name: 'register',
            component: () => import('../views/auth/AuthRegister.vue'),
        },
        {
            path: '/dashboard',
            name: 'dashboard',
            component: () => import('../views/dashboard/DashboardView.vue'),
        },
        {
            path: '/seed-source-evaluations',
            name: 'seed-source-evaluations',
            component: () => import('../views/evaluations/SeedSourceEvaluationView.vue'),
        },
        {
            path: '/seed-source-evaluations/new',
            name: 'seed-source-evaluations-new',
            component: () => import('../views/evaluations/SeedSourceEvaluationFormView.vue'),
        },
        {
            path: '/seed-business-recommendations',
            name: 'seed-business-recommendations',
            component: () => import('../views/recommendations/SeedBusinessRecommendationView.vue'),
        },
        {
            path: '/seed-business-recommendations/new',
            name: 'seed-business-recommendations-new',
            component: () => import('../views/recommendations/SeedBusinessRecommendationFormView.vue'),
        },
        {
            path: '/seed-batches',
            name: 'seed-batches',
            component: () => import('../views/batches/SeedBatchesView.vue'),
        },
        {
            path: '/seed-batches/new',
            name: 'seed-batches-new',
            component: () => import('../views/batches/SeedBatchFormView.vue'),
        },
        {
            path: '/certifications/pre-planting',
            name: 'certifications-pre-planting',
            component: () => import('../views/certification/PrePlantingCertificationView.vue'),
        },
        {
            path: '/certifications/pre-planting/new',
            name: 'certifications-pre-planting-new',
            component: () => import('../views/certification/PrePlantingCertificationFormView.vue'),
        },
        {
            path: '/certifications/planting-ready',
            name: 'certifications-planting-ready',
            component: () => import('../views/certification/PlantingReadyCertificationView.vue'),
        },
        {
            path: '/certifications/planting-ready/new',
            name: 'certifications-planting-ready-new',
            component: () => import('../views/certification/PlantingReadyCertificationFormView.vue'),
        },
        {
            path: '/seed-distribution',
            name: 'seed-distribution',
            component: () => import('../views/distribution/SeedDistributionList.vue'),
        },
        {
            path: '/seed-distribution/new',
            name: 'seed-distribution-new',
            component: () => import('../views/distribution/SeedDistributionEntry.vue'),
        },
        {
            path: '/seed-distribution/new/form',
            name: 'seed-distribution-new-form',
            component: () => import('../views/distribution/SeedDistributionForm.vue'),
        },
        {
            path: '/:pathMatch(.*)*',
            redirect: '/dashboard',
        },
    ],
})

export default router
