/**
 * Authentication Guard Middleware
 * Protects routes that require authentication
 */

import { identityService } from '../services/api'

export function authGuard(to, from, next) {
    try {
        const isAuthenticated = identityService.isAuthenticated()
        const token = localStorage.getItem('access_token')

        // Debug log
        console.log('Auth Guard:', {
            to: to.path,
            from: from.path,
            isAuthenticated,
            hasToken: !!token,
            requiresAuth: to.meta.requiresAuth,
            guestOnly: to.meta.guestOnly
        })

        // Check if route requires authentication
        if (to.meta.requiresAuth && !isAuthenticated) {
            console.log('Redirecting to login - not authenticated')
            // Redirect to login page
            next({
                name: 'login',
                query: { redirect: to.fullPath },
            })
        } else if ((to.name === 'login' || to.meta.guestOnly) && isAuthenticated) {
            console.log('Redirecting to dashboard - already authenticated')
            // Redirect authenticated users away from login page
            next({ name: 'dashboard' })
        } else {
            console.log('Allowing navigation')
            next()
        }
    } catch (error) {
        console.error('Auth guard error:', error)
        next()
    }
}

/**
 * Role-based Authorization Guard
 * Checks if user has required role to access route
 */
export function roleGuard(to, from, next) {
    const user = identityService.getCurrentUser()
    const requiredRoles = to.meta.roles

    if (!requiredRoles || requiredRoles.length === 0) {
        next()
        return
    }

    if (!user) {
        next({ name: 'login' })
        return
    }

    const hasRequiredRole = requiredRoles.some(role =>
        user.roles?.includes(role) || user.role === role
    )

    if (hasRequiredRole) {
        next()
    } else {
        // Redirect to dashboard with error message
        next({
            name: 'dashboard',
            query: { error: 'unauthorized' },
        })
    }
}

/**
 * Guest Guard
 * Redirects authenticated users away from guest-only pages
 */
export function guestGuard(to, from, next) {
    const isAuthenticated = identityService.isAuthenticated()

    if (to.meta.guestOnly && isAuthenticated) {
        next({ name: 'dashboard' })
    } else {
        next()
    }
}

export default {
    authGuard,
    roleGuard,
    guestGuard,
}
