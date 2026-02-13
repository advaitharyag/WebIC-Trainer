/**
 * Digital IC Trainer - TTLChip Base Class
 * Base class for all TTL ICs with power validation, pin management, and evaluation framework
 */

import { STATE_LOW, STATE_HIGH, STATE_FLOAT, STATE_ERROR } from './simulation.js';

// Pin Type Constants
export const PIN_TYPE = {
    INPUT: 'INPUT',
    OUTPUT: 'OUTPUT',
    POWER: 'POWER',
    CLOCK: 'CLOCK',
    NC: 'NC' // No Connect
};

/**
 * Base class for all TTL ICs
 */
export class TTLChip {
    constructor(id, name, pinCount = 14) {
        this.id = id; // e.g., "ic-1"
        this.name = name;
        this.pinCount = pinCount;

        // Pin management: 1-indexed array
        this.pins = new Array(pinCount + 1).fill(null); // pin[0] unused, pin[1..pinCount] used
        this.pinTypes = new Array(pinCount + 1).fill(PIN_TYPE.NC);
        this.pinNodes = new Array(pinCount + 1).fill(null); // Node references

        // Power pins (default for 14-pin DIP)
        this.vccPin = 14;
        this.gndPin = 7;

        // Internal state
        this.internalState = {};
        this.outputStates = new Map(); // pin -> state

        // Propagation delay (ns)
        this.propDelay = 10;

        // Engine reference (set during setup)
        this.engine = null;

        // Evaluation flag to prevent infinite loops
        this.evaluating = false;

        // Debug flag
        this.debug = false;
    }

    /**
     * Enable/disable debug logging
     */
    setDebug(enabled) {
        this.debug = enabled;
    }

    /**
     * Set pin type (INPUT, OUTPUT, POWER, CLOCK, NC)
     */
    setPinType(pinNumber, type) {
        if (pinNumber > 0 && pinNumber <= this.pinCount) {
            this.pinTypes[pinNumber] = type;
        }
    }

    /**
     * Set pin node reference
     */
    setPinNode(pinNumber, node) {
        if (pinNumber > 0 && pinNumber <= this.pinCount) {
            this.pinNodes[pinNumber] = node;
            this.pins[pinNumber] = node;
        }
    }

    /**
     * Get pin node reference
     */
    getPinNode(pinNumber) {
        return this.pinNodes[pinNumber] || null;
    }

    /**
     * Get input state with TTL floating behavior (floats HIGH)
     */
    getInputState(pinNumber) {
        const node = this.pinNodes[pinNumber];
        if (!node) return STATE_FLOAT; // Physically disconnected

        const state = node.state;
        // TTL behavior: floating inputs default to HIGH
        if (state === STATE_FLOAT) return STATE_HIGH;
        return state;
    }

    /**
     * Validate power connections
     * Returns true if VCC is HIGH and GND is LOW
     */
    validatePower() {
        const vccNode = this.pinNodes[this.vccPin];
        const gndNode = this.pinNodes[this.gndPin];

        if (!vccNode || !gndNode) {
            if (this.debug) {
                console.log(`[${this.name}] Power validation failed: VCC node=${!!vccNode}, GND node=${!!gndNode}`);
            }
            return false;
        }

        // Force node resolution before checking state
        vccNode.update();
        gndNode.update();

        const vccState = vccNode.state;
        const gndState = gndNode.state;
        const powered = (vccState === STATE_HIGH && gndState === STATE_LOW);

        if (this.debug && !powered) {
            console.log(`[${this.name}] Power validation: VCC=${vccState === STATE_HIGH ? 'HIGH' : vccState === STATE_LOW ? 'LOW' : 'FLOAT'}, GND=${gndState === STATE_HIGH ? 'HIGH' : gndState === STATE_LOW ? 'LOW' : 'FLOAT'}`);
        }

        return powered;
    }

    /**
     * Check if chip is powered
     */
    isPowered() {
        return this.validatePower();
    }

    /**
     * Reset chip to initial state
     */
    reset() {
        this.internalState = {};
        this.outputStates.clear();
        this.evaluating = false;
    }

    /**
     * Evaluate chip logic (to be overridden by subclasses)
     * Returns array of {pin, state} updates
     */
    evaluate() {
        // To be implemented by subclasses
        return [];
    }

    /**
     * Propagate outputs to nodes
     */
    propagate(updates) {
        if (!this.engine) return;

        console.log(`[${this.name}] PROPAGATE called with ${updates.length} updates:`, updates.map(u => `pin ${u.pin} -> ${u.state === STATE_HIGH ? 'HIGH' : u.state === STATE_LOW ? 'LOW' : 'FLOAT'}`));

        updates.forEach(({ pin, state }) => {
            const currentState = this.outputStates.get(pin);
            console.log(`[${this.name}] Processing pin ${pin}: current=${currentState}, new=${state}`);

            if (currentState !== state) {
                this.outputStates.set(pin, state);
                const node = this.getPinNode(pin);
                console.log(`[${this.name}] Pin ${pin} node:`, node?.id, 'drivers:', node?.drivers.size, 'listeners:', node?.listeners.size);

                if (node) {
                    if (this.debug) {
                        console.log(`[${this.name}] Setting output pin ${pin} to ${state === STATE_HIGH ? 'HIGH' : state === STATE_LOW ? 'LOW' : 'FLOAT'} (was ${currentState === STATE_HIGH ? 'HIGH' : currentState === STATE_LOW ? 'LOW' : 'FLOAT'})`);
                        console.log(`[${this.name}] Node before update: ${node.state === STATE_HIGH ? 'HIGH' : node.state === STATE_LOW ? 'LOW' : 'FLOAT'}, drivers: ${node.drivers.size}`);
                    }
                    // Force node resolution - the driver function will return the new state
                    const oldNodeState = node.state;
                    const changed = node.update();
                    const newNodeState = node.state;

                    console.log(`[${this.name}] Pin ${pin} after node.update(): oldState=${oldNodeState}, newState=${newNodeState}, changed=${changed}`);

                    if (this.debug) {
                        const resolvedState = node.resolve();
                        console.log(`[${this.name}] Pin ${pin} node update:`, {
                            oldState: oldNodeState === STATE_HIGH ? 'HIGH' : oldNodeState === STATE_LOW ? 'LOW' : 'FLOAT',
                            newState: newNodeState === STATE_HIGH ? 'HIGH' : newNodeState === STATE_LOW ? 'LOW' : 'FLOAT',
                            resolvedState: resolvedState === STATE_HIGH ? 'HIGH' : resolvedState === STATE_LOW ? 'LOW' : 'FLOAT',
                            changed,
                            drivers: node.drivers.size,
                            listeners: node.listeners.size,
                            driverReturns: node.drivers.size > 0 ? Array.from(node.drivers)[0]() : 'no drivers'
                        });
                    }

                    // CRITICAL: Always notify listeners when output state changes, even if node state appears unchanged
                    // This ensures LEDs and other listeners get updated when IC output changes
                    if (currentState !== state) {
                        // Output state changed - ensure listeners are notified
                        if (!changed) {
                            // Node state didn't change (was already correct), but output state did change
                            // Force notify all listeners with the current resolved state
                            const resolvedState = node.resolve();
                            console.log(`[${this.name}] Forcing notification to ${node.listeners.size} listeners with state ${resolvedState}`);
                            for (const listener of node.listeners) {
                                listener(resolvedState);
                            }
                            if (this.debug) {
                                console.log(`[${this.name}] Output state changed, forced notification to ${node.listeners.size} listeners: ${resolvedState === STATE_HIGH ? 'HIGH' : resolvedState === STATE_LOW ? 'LOW' : 'FLOAT'}`);
                            }
                        } else {
                            // Node state changed, listeners were already notified by node.update()
                            console.log(`[${this.name}] Node state changed, ${node.listeners.size} listeners already notified by node.update()`);
                            if (this.debug) {
                                console.log(`[${this.name}] Node state changed, ${node.listeners.size} listeners notified`);
                            }
                        }
                    }
                } else if (this.debug) {
                    console.warn(`[${this.name}] Output pin ${pin} has no node!`);
                }
            } else if (this.debug) {
                console.log(`[${this.name}] Output pin ${pin} already at ${state === STATE_HIGH ? 'HIGH' : state === STATE_LOW ? 'LOW' : 'FLOAT'}, skipping`);
            }
        });
    }

    /**
     * Setup chip with engine
     * Registers drivers and listeners
     */
    setup(engine) {
        this.engine = engine;
        this.registerDrivers();
        this.registerListeners();
        // Initial evaluation
        this.triggerEvaluation();
    }

    /**
     * Register output drivers
     */
    registerDrivers() {
        for (let pin = 1; pin <= this.pinCount; pin++) {
            if (this.pinTypes[pin] === PIN_TYPE.OUTPUT) {
                const node = this.getPinNode(pin);
                if (node) {
                    this.outputStates.set(pin, STATE_FLOAT);
                    const driverFn = () => {
                        if (!this.isPowered()) return STATE_FLOAT;
                        const state = this.outputStates.get(pin);
                        // Handle STATE_LOW (0) correctly - can't use || because 0 is falsy!
                        return state !== undefined && state !== null ? state : STATE_FLOAT;
                    };
                    this.engine.addDriver(node.id, driverFn);
                    // Immediately resolve initial state
                    node.update();
                }
            }
        }
    }

    /**
     * Register input listeners
     */
    registerListeners() {
        for (let pin = 1; pin <= this.pinCount; pin++) {
            if (this.pinTypes[pin] === PIN_TYPE.INPUT || this.pinTypes[pin] === PIN_TYPE.CLOCK) {
                const node = this.getPinNode(pin);
                if (node) {
                    this.engine.addListener(node.id, (newState) => {
                        if (this.debug) {
                            console.log(`[${this.name}] Input pin ${pin} changed to ${newState === STATE_HIGH ? 'HIGH' : newState === STATE_LOW ? 'LOW' : 'FLOAT'}`);
                        }
                        this.triggerEvaluation();
                    });
                    // Trigger initial evaluation with current state
                    if (node.state !== STATE_FLOAT) {
                        setTimeout(() => this.triggerEvaluation(), 0);
                    }
                }
            }
        }

        // Also listen to power pins
        const vccNode = this.getPinNode(this.vccPin);
        const gndNode = this.getPinNode(this.gndPin);
        if (vccNode) {
            this.engine.addListener(vccNode.id, () => {
                if (this.debug) {
                    console.log(`[${this.name}] VCC pin changed`);
                }
                this.triggerEvaluation();
            });
        }
        if (gndNode) {
            this.engine.addListener(gndNode.id, () => {
                if (this.debug) {
                    console.log(`[${this.name}] GND pin changed`);
                }
                this.triggerEvaluation();
            });
        }
    }

    /**
     * Trigger evaluation (with loop prevention)
     */
    triggerEvaluation() {
        if (this.evaluating || !this.engine) return;

        this.evaluating = true;
        try {
            const updates = this.evaluate();
            console.log(`[${this.name}] triggerEvaluation: evaluate() returned`, updates);
            if (updates && updates.length > 0) {
                console.log(`[${this.name}] Calling propagate with ${updates.length} updates`);
                this.propagate(updates);
            } else {
                console.log(`[${this.name}] No updates to propagate (updates=${updates}, length=${updates?.length})`);
            }
        } catch (error) {
            console.error(`[${this.name}] Evaluation error:`, error);
        } finally {
            this.evaluating = false;
        }
    }

    /**
     * Get pin configuration (for UI display)
     */
    getPinConfig() {
        const config = {};
        for (let pin = 1; pin <= this.pinCount; pin++) {
            config[pin] = {
                type: this.pinTypes[pin],
                state: this.outputStates.get(pin) || STATE_FLOAT
            };
        }
        return config;
    }
}
