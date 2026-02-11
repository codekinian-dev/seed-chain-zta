import { createRouter, createWebHistory } from 'vue-router'
import { authGuard, roleGuard } from '../middleware/auth.guard'

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
            meta: { guestOnly: true },
        },
        {
            path: '/register',
            name: 'register',
            component: () => import('../views/auth/AuthRegister.vue'),
            meta: { guestOnly: true },
        },
        // Public routes (no auth required)
        {
            path: '/verify',
            name: 'public-verify',
            component: () => import('../views/public/DocumentVerifyView.vue'),
            meta: { public: true },
        },
        {
            path: '/dashboard',
            name: 'dashboard',
            component: () => import('../views/dashboard/DashboardView.vue'),
            meta: { requiresAuth: true },
        },
        // DISABLED: Backend API not yet integrated
        // {
        //     path: '/seed-source-evaluations',
        //     name: 'seed-source-evaluations',
        //     component: () => import('../views/evaluations/SeedSourceEvaluationView.vue'),
        //     meta: { requiresAuth: true },
        // },
        // {
        //     path: '/seed-source-evaluations/new',
        //     name: 'seed-source-evaluations-new',
        //     component: () => import('../views/evaluations/SeedSourceEvaluationFormView.vue'),
        //     meta: { requiresAuth: true },
        // },
        // {
        //     path: '/seed-business-recommendations',
        //     name: 'seed-business-recommendations',
        //     component: () => import('../views/recommendations/SeedBusinessRecommendationView.vue'),
        //     meta: { requiresAuth: true },
        // },
        // {
        //     path: '/seed-business-recommendations/new',
        //     name: 'seed-business-recommendations-new',
        //     component: () => import('../views/recommendations/SeedBusinessRecommendationFormView.vue'),
        //     meta: { requiresAuth: true },
        // },
        {
            path: '/seed-batches',
            name: 'seed-batches',
            component: () => import('../views/batches/SeedBatchesView.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/seed-batches/new',
            name: 'seed-batches-new',
            component: () => import('../views/batches/SeedBatchFormView.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/seed-batches/:id',
            name: 'seed-batches-detail',
            component: () => import('../views/batches/SeedBatchDetailView.vue'),
            meta: { requiresAuth: true },
        },
        // Admin Routes
        {
            path: '/admin/audit-logs',
            name: 'admin-audit-logs',
            component: () => import('../views/admin/AuditLogsView.vue'),
            meta: { requiresAuth: true, roles: ['role_admin'] },
        },
        // DISABLED: Backend API not yet integrated
        // {
        //     path: '/certifications/pre-planting',
        //     name: 'certifications-pre-planting',
        //     component: () => import('../views/certification/PrePlantingCertificationView.vue'),
        //     meta: { requiresAuth: true, roles: ['role_pbt_field', 'role_pbt_chief', 'role_lsm_head'] },
        // },
        // {
        //     path: '/certifications/pre-planting/new',
        //     name: 'certifications-pre-planting-new',
        //     component: () => import('../views/certification/PrePlantingCertificationFormView.vue'),
        //     meta: { requiresAuth: true, roles: ['role_pbt_field', 'role_pbt_chief', 'role_lsm_head'] },
        // },
        // {
        //     path: '/certifications/planting-ready',
        //     name: 'certifications-planting-ready',
        //     component: () => import('../views/certification/PlantingReadyCertificationView.vue'),
        //     meta: { requiresAuth: true, roles: ['role_pbt_field', 'role_pbt_chief', 'role_lsm_head'] },
        // },
        // {
        //     path: '/certifications/planting-ready/new',
        //     name: 'certifications-planting-ready-new',
        //     component: () => import('../views/certification/PlantingReadyCertificationFormView.vue'),
        //     meta: { requiresAuth: true, roles: ['role_pbt_field', 'role_pbt_chief', 'role_lsm_head'] },
        // },
        // DISABLED: Backend API not yet integrated
        // {
        //     path: '/seed-distribution',
        //     name: 'seed-distribution',
        //     component: () => import('../views/distribution/SeedDistributionList.vue'),
        //     meta: { requiresAuth: true },
        // },
        // {
        //     path: '/seed-distribution/new',
        //     name: 'seed-distribution-new',
        //     component: () => import('../views/distribution/SeedDistributionEntry.vue'),
        //     meta: { requiresAuth: true },
        // },
        // {
        //     path: '/seed-distribution/new/form',
        //     name: 'seed-distribution-new-form',
        //     component: () => import('../views/distribution/SeedDistributionForm.vue'),
        //     meta: { requiresAuth: true },
        // },
        {
            path: '/:pathMatch(.*)*',
            redirect: '/dashboard',
        },
    ],
})

// Apply global guards
router.beforeEach(authGuard)
router.beforeEach(roleGuard)

export default router
