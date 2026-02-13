/**
 * Digital IC Trainer - Clock Manager
 * Manages clock signal generation with proper cleanup
 */

import { STATE_LOW, STATE_HIGH, STATE_FLOAT } from './simulation.js';

export class ClockManager {
    constructor(engine) {
        this.engine = engine;
        this.clocks = new Map(); // frequency -> { node, state, interval }
        this.isPowered = false;
    }

    /**
     * Register a clock output
     */
    registerClock(frequency, nodeId, pinId) {
        const node = this.engine.nodes.get(nodeId);
        if (!node) return;

        // Clean up existing clock if any
        if (this.clocks.has(frequency)) {
            this.stopClock(frequency);
        }

        let clockState = STATE_LOW;
        const halfPeriod = (1000 / frequency) / 2; // milliseconds

        // Driver function
        this.engine.addDriver(nodeId, () => {
            return this.isPowered ? clockState : STATE_FLOAT;
        });

        // Clock toggle interval
        const interval = setInterval(() => {
            if (this.isPowered) {
                clockState = (clockState === STATE_HIGH) ? STATE_LOW : STATE_HIGH;
                this.engine.scheduleNodeUpdate(nodeId, 0);
            }
        }, halfPeriod);

        this.clocks.set(frequency, {
            nodeId,
            pinId,
            state: clockState,
            interval,
            halfPeriod
        });
    }

    /**
     * Stop a specific clock
     */
    stopClock(frequency) {
        const clock = this.clocks.get(frequency);
        if (clock && clock.interval) {
            clearInterval(clock.interval);
            this.clocks.delete(frequency);
        }
    }

    /**
     * Set power state
     */
    setPower(powered) {
        this.isPowered = powered;
        // Update all clock nodes
        this.clocks.forEach((clock) => {
            this.engine.scheduleNodeUpdate(clock.nodeId, 0);
        });
    }

    /**
     * Stop all clocks
     */
    stopAll() {
        this.clocks.forEach((clock, frequency) => {
            this.stopClock(frequency);
        });
    }

    /**
     * Get clock state
     */
    getClockState(frequency) {
        const clock = this.clocks.get(frequency);
        return clock ? clock.state : STATE_FLOAT;
    }
}
