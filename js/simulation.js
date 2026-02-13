/**
 * Digital IC Trainer - Core Simulation Engine
 * Handles electrical nodes, event queue, and propagation delays.
 */

// Electrical States
export const STATE_LOW = 0;
export const STATE_HIGH = 1;
export const STATE_FLOAT = 2; // High-Z / Disconnected
export const STATE_ERROR = 3; // Short Circuit / Contention

// Time Steps (in nanoseconds)
export const TIME_STEP = 1; // 1ns resolution

export class Node {
    constructor(id) {
        this.id = id;
        this.state = STATE_FLOAT;
        this.drivers = new Set(); // Who is driving this node?
        this.listeners = new Set(); // Who is listening to this node?
        this.voltage = 0; // For future analog extensions (optional)
        this.isVCC = false;
        this.isGND = false;
    }

    /**
     * Resolve the logic state based on all drivers.
     * Rules:
     * - Any ERROR drive -> ERROR
     * - Multiple diff logic levels (HIGH + LOW) -> ERROR (Short)
     * - Any HIGH + Pull-up -> HIGH
     * - Any LOW + Pull-down -> LOW
     * - All FLOAT -> FLOAT
     */
    resolve() {
        let hasHigh = false;
        let hasLow = false;
        let hasError = false;

        for (const driver of this.drivers) {
            const val = driver(); // Generic driver function returning state
            if (val === STATE_ERROR) hasError = true;
            if (val === STATE_HIGH) hasHigh = true;
            if (val === STATE_LOW) hasLow = true;
        }

        if (hasError || (hasHigh && hasLow)) {
            // Short circuit detected!
            return STATE_ERROR;
        }

        if (hasHigh) return STATE_HIGH;
        if (hasLow) return STATE_LOW;
        
        // Default to Float if no drivers
        return STATE_FLOAT;
    }

    update() {
        const newState = this.resolve();
        if (newState !== this.state) {
            this.state = newState;
            // Notify listeners (Input pins of other ICs)
            for (const listener of this.listeners) {
                listener(this.state);
            }
            return true; // State changed
        }
        return false;
    }
}

export class CircuitEngine {
    constructor() {
        this.nodes = new Map(); // id -> Node
        this.eventQueue = []; // [{ time, task }]
        this.currentTime = 0;
        this.nodeCounter = 0;
        this.running = false;
        this.breakOnChange = false;
    }

    createNode() {
        const id = `node_${++this.nodeCounter}`;
        const node = new Node(id);
        this.nodes.set(id, node);
        return node;
    }

    /**
     * Connects a driver function to a node.
     * driverFn: () => STATE_XXX
     */
    addDriver(nodeId, driverFn) {
        const node = this.nodes.get(nodeId);
        if (node) {
            node.drivers.add(driverFn);
            this.scheduleNodeUpdate(nodeId, 0);
        }
    }

    /**
     * Connects a listener function to a node.
     * listenerFn: (newState) => void
     */
    addListener(nodeId, listenerFn) {
        const node = this.nodes.get(nodeId);
        if (node) {
            node.listeners.add(listenerFn);
            // Initial update
            listenerFn(node.state);
        }
    }

    scheduleNodeUpdate(nodeId, delay = 0) {
        this.schedule(delay, () => {
            const node = this.nodes.get(nodeId);
            if (node) node.update();
        });
    }

    schedule(delayNa, task) {
        const executeTime = this.currentTime + delayNa;
        this.eventQueue.push({ time: executeTime, task });
        this.eventQueue.sort((a, b) => a.time - b.time); // Keep sorted
    }

    step(dt) {
        this.currentTime += dt;
        
        // Process all events up to current time
        while (this.eventQueue.length > 0 && this.eventQueue[0].time <= this.currentTime) {
            const event = this.eventQueue.shift();
            event.task();
        }
    }

    /**
     * Run simulation for a specific duration (or until stable if duration is null)
     * CAUTION: 'Until stable' can infinite loop with oscillators.
     */
    run(duration = 1000) { // 1000ns default
        const targetTime = this.currentTime + duration;
        
        while (this.currentTime < targetTime) {
            // Jump to next event if it's sooner than step
            if (this.eventQueue.length > 0 && this.eventQueue[0].time <= targetTime) {
                this.currentTime = this.eventQueue[0].time;
                const event = this.eventQueue.shift();
                event.task();
            } else {
                this.currentTime = targetTime;
            }
        }
    }

    /**
     * Merges two nodes into one (Connection wired)
     * All drivers and listeners from nodeB move to nodeA.
     * nodeB is removed.
     */
    mergeNodes(nodeAId, nodeBId) {
        if (nodeAId === nodeBId) return;

        const nodeA = this.nodes.get(nodeAId);
        const nodeB = this.nodes.get(nodeBId);

        if (!nodeA || !nodeB) return;

        // Move drivers
        for (const d of nodeB.drivers) nodeA.drivers.add(d);
        // Move listeners
        for (const l of nodeB.listeners) nodeA.listeners.add(l);

        // Update ID references in listeners if needed? 
        // (Depends on if listeners hold ID refs. Assuming closures for now.)

        this.nodes.delete(nodeBId);
        
        // Trigger update on resolved node
        nodeA.update();

        return nodeAId;
    }
}
