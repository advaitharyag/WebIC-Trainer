/**
 * Digital IC Trainer - IC Registry
 * Modular system for registering and creating IC instances
 */

export class ICRegistry {
    constructor() {
        this.registry = new Map(); // id -> { class, name, description, pinCount }
    }

    /**
     * Register an IC class
     */
    register(config) {
        const { id, class: ICClass, name, description, pinCount } = config;
        
        if (!id || !ICClass) {
            throw new Error('IC registration requires id and class');
        }

        this.registry.set(id, {
            id,
            class: ICClass,
            name: name || id,
            description: description || '',
            pinCount: pinCount || 14
        });
    }

    /**
     * Create an IC instance
     */
    create(id, instanceId) {
        const entry = this.registry.get(id);
        if (!entry) {
            console.error(`Unknown IC: ${id}`);
            return null;
        }

        return new entry.class(instanceId, entry.name);
    }

    /**
     * Get all registered ICs
     */
    getAll() {
        return Array.from(this.registry.values());
    }

    /**
     * Get IC info
     */
    getInfo(id) {
        return this.registry.get(id) || null;
    }

    /**
     * Check if IC is registered
     */
    has(id) {
        return this.registry.has(id);
    }
}

// Global registry instance
export const icRegistry = new ICRegistry();
