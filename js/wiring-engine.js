/**
 * Digital IC Trainer - Wiring Engine
 * Manages physical connections and updates the simulation engine.
 */

import { STATE_LOW, STATE_HIGH, STATE_FLOAT } from './simulation.js';

export class WiringManager {
    constructor(circuitEngine) {
        this.engine = circuitEngine;
        this.wires = []; // { id, source: pinId, target: pinId, color }
        this.connections = new Map(); // pinId -> Set(pinId) (Adjacency List)
        this.pinToNodeId = new Map(); // pinId -> simulationNodeId
        this.pinTypes = new Map(); // pinId -> 'INPUT' | 'OUTPUT' | 'POWER' | 'CLOCK'
        this.pinToIC = new Map(); // pinId -> IC instance

        // Listeners for UI updates
        this.onWireAdded = null;
        this.onWireRemoved = null;
        this.onNetUpdate = null; // When a net changes state (color update)
        this.onWireError = null; // When wiring validation fails
    }

    /**
     * Register pin type and IC reference
     */
    registerPinType(pinId, pinType, icInstance = null) {
        this.pinTypes.set(pinId, pinType);
        if (icInstance) {
            this.pinToIC.set(pinId, icInstance);
        }
    }

    /**
     * Validate wire connection
     */
    validateWire(sourcePin, targetPin) {
        // Check for self-connection
        if (sourcePin === targetPin) {
            return { valid: false, error: 'Cannot connect pin to itself' };
        }

        // Check if wire already exists
        const existing = this.wires.find(w =>
            (w.source === sourcePin && w.target === targetPin) ||
            (w.source === targetPin && w.target === sourcePin)
        );
        if (existing) {
            return { valid: false, error: 'Wire already exists' };
        }

        const sourceType = this.pinTypes.get(sourcePin);
        const targetType = this.pinTypes.get(targetPin);

        // Prevent output-to-output connection
        if (sourceType === 'OUTPUT' && targetType === 'OUTPUT') {
            return { valid: false, error: 'Cannot connect output to output' };
        }

        // Prevent VCC to GND short
        if ((sourcePin === 'vcc' && targetPin === 'gnd') || 
            (sourcePin === 'gnd' && targetPin === 'vcc')) {
            return { valid: false, error: 'Cannot short VCC to GND' };
        }

        // Check for power rail conflicts
        if (sourcePin === 'vcc' && targetPin === 'gnd') {
            return { valid: false, error: 'Cannot connect VCC to GND' };
        }

        return { valid: true };
    }

    /**
     * formatting: pinId is a string, e.g. "ic-1-pin-3" or "myswitch-1"
     */
    addWire(sourcePin, targetPin, color = 'var(--color-text)') {
        // Validate connection
        const validation = this.validateWire(sourcePin, targetPin);
        if (!validation.valid) {
            if (this.onWireError) {
                this.onWireError(sourcePin, targetPin, validation.error);
            }
            return null;
        }

        const wireId = `wire_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        this.wires.push({ id: wireId, source: sourcePin, target: targetPin, color });

        // Update Adjacency Graph
        if (!this.connections.has(sourcePin)) this.connections.set(sourcePin, new Set());
        if (!this.connections.has(targetPin)) this.connections.set(targetPin, new Set());

        this.connections.get(sourcePin).add(targetPin);
        this.connections.get(targetPin).add(sourcePin);

        // Merge logical nodes in Simulation Engine
        this.mergeNets(sourcePin, targetPin);

        if (this.onWireAdded) this.onWireAdded(this.wires[this.wires.length - 1]);

        return wireId;
    }

    removeWire(wireId) {
        const index = this.wires.findIndex(w => w.id === wireId);
        if (index === -1) return;

        const wire = this.wires[index];
        this.wires.splice(index, 1);

        // Update Adjacency Graph
        this.connections.get(wire.source).delete(wire.target);
        this.connections.get(wire.target).delete(wire.source);

        // Re-evaluate connectivity for both endpoints
        // Because removing a wire might split a net into two
        this.rebuildNet(wire.source);
        this.rebuildNet(wire.target);

        if (this.onWireRemoved) this.onWireRemoved(wireId);
    }

    /**
     * Registers a physical pin with a logical node ID.
     * Called when an IC is socketed.
     */
    registerPin(pinId, nodeId, pinType = null, icInstance = null) {
        this.pinToNodeId.set(pinId, nodeId);
        if (pinType) {
            this.registerPinType(pinId, pinType, icInstance);
        }
    }

    /**
     * Merge the electrical nets of two pins.
     */
    mergeNets(pinA, pinB) {
        const nodeA = this.pinToNodeId.get(pinA);
        const nodeB = this.pinToNodeId.get(pinB);

        if (nodeA && nodeB && nodeA !== nodeB) {
            const newNodeId = this.engine.mergeNodes(nodeA, nodeB);
            const newNode = this.engine.nodes.get(newNodeId);

            // Update all pins on this net to point to the new node ID
            // We need to traverse the graph starting from pinA to find all connected pins
            const visited = new Set();
            const stack = [pinA];
            const updatedPins = [];

            while (stack.length > 0) {
                const p = stack.pop();
                if (visited.has(p)) continue;
                visited.add(p);

                this.pinToNodeId.set(p, newNodeId);
                updatedPins.push(p);

                const neighbors = this.connections.get(p);
                if (neighbors) {
                    for (const n of neighbors) {
                        stack.push(n);
                    }
                }
            }

            // Notify system that pins have been merged to a new node
            // This allows ICs to update their pin node references
            if (this.onNetUpdate && updatedPins.length > 0) {
                this.onNetUpdate(updatedPins, newNode);
            }
        }
    }

    /**
     * Completely rebuilds the simulation node for a given net.
     * Used after a wire is removed (splitting a net).
     * 
     * Strategy:
     * 1. Traverse physical graph to find all pins in this component.
     * 2. Create a NEW simulation node.
     * 3. Assign all those pins to the new simulation node.
     * (Note: This is expensive but safe. We essentially destroy the old node for these pins.)
     */
    rebuildNet(startPin) {
        // Find connected component (pins)
        const component = new Set();
        const stack = [startPin];

        while (stack.length > 0) {
            const p = stack.pop();
            if (component.has(p)) continue;
            component.add(p);

            const neighbors = this.connections.get(p);
            if (neighbors) {
                for (const n of neighbors) {
                    stack.push(n);
                }
            }
        }

        // Create a new fresh node in the engine
        const newNode = this.engine.createNode();
        const newNodeId = newNode.id;

        // Update these pins to point to the new node
        for (const pinId of component) {
            this.pinToNodeId.set(pinId, newNodeId);
            // Also, we need to re-link the "IC driver" to this new node.
            // This is tricky: The IC object holds a reference to the `Node` object.
            // We need to tell the system "Hey, this pin connected to this IC now maps to THIS node"
            // This implies the `WiringManager` needs a way to update the IC's internal pin reference.
        }

        // Notify system that these pins have a new Node ID, so please update your drivers/listeners
        if (this.onNetUpdate) {
            this.onNetUpdate(Array.from(component), newNode);
        }
    }
}
