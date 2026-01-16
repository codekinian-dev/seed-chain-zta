/**
 * Storage Utility
 * LocalStorage and SessionStorage helpers
 */

/**
 * Storage wrapper with JSON serialization
 */
class Storage {
    constructor(storage) {
        this.storage = storage
    }

    /**
     * Set item in storage
     */
    set(key, value) {
        try {
            const serialized = JSON.stringify(value)
            this.storage.setItem(key, serialized)
            return true
        } catch (error) {
            console.error('Storage set error:', error)
            return false
        }
    }

    /**
     * Get item from storage
     */
    get(key, defaultValue = null) {
        try {
            const item = this.storage.getItem(key)
            return item ? JSON.parse(item) : defaultValue
        } catch (error) {
            console.error('Storage get error:', error)
            return defaultValue
        }
    }

    /**
     * Remove item from storage
     */
    remove(key) {
        try {
            this.storage.removeItem(key)
            return true
        } catch (error) {
            console.error('Storage remove error:', error)
            return false
        }
    }

    /**
     * Clear all items from storage
     */
    clear() {
        try {
            this.storage.clear()
            return true
        } catch (error) {
            console.error('Storage clear error:', error)
            return false
        }
    }

    /**
     * Check if key exists
     */
    has(key) {
        return this.storage.getItem(key) !== null
    }

    /**
     * Get all keys
     */
    keys() {
        return Object.keys(this.storage)
    }
}

// Export storage instances
export const localStorage = new Storage(window.localStorage)
export const sessionStorage = new Storage(window.sessionStorage)

export default {
    local: localStorage,
    session: sessionStorage,
}
