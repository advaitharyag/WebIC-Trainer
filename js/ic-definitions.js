/**
 * Digital IC Trainer - IC Definitions
 * Contains the logic models for 74LS series ICs.
 */

import { STATE_LOW, STATE_HIGH, STATE_FLOAT, STATE_ERROR } from './simulation.js';

class BaseIC {
    constructor(id, name, pinCount = 14) {
        this.id = id; // e.g., "ic_1"
        this.name = name;
        this.pinCount = pinCount;
        this.pins = new Array(pinCount + 1).fill(null); // 1-indexed pins

        // Default Power Pins for 14-pin DIP (Standard logic gates)
        this.vccPin = 14;
        this.gndPin = 7;

        // Propagation Delay (ns)
        this.propDelay = 10;
    }

    setPinNode(pinNumber, node) {
        if (pinNumber > 0 && pinNumber <= this.pinCount) {
            this.pins[pinNumber] = node;
        }
    }

    getPinNode(pinNumber) {
        return this.pins[pinNumber];
    }

    /**
     * effectiveInput(pin)
     * Returns the logic level of an input pin.
     * TTL Rules:
     * - Connected to High -> HIGH
     * - Connected to Low -> LOW
     * - Floating -> HIGH (Standard TTL behavior)
     * - Error -> ERROR
     */
    getInputState(pinNumber) {
        const node = this.pins[pinNumber];
        if (!node) return STATE_FLOAT; // Physically disconnected pin

        const state = node.state;
        if (state === STATE_FLOAT) return STATE_HIGH; // TTL floats HIGH
        return state;
    }

    isPowered() {
        const vccNode = this.pins[this.vccPin];
        const gndNode = this.pins[this.gndPin];

        if (!vccNode || !gndNode) return false;

        // Strict power check: VCC must be HIGH, GND must be LOW
        return (vccNode.state === STATE_HIGH && gndNode.state === STATE_LOW);
    }

    /**
     * Called by the system after pins are connected to nodes.
     * Registers listeners on inputs and drivers on outputs.
     */
    setup(engine) {
        // To be implemented by subclasses or specific IC definitions
        // LogicGateIC will implement this to bind inputs to evaluate()
    }

    // Override this in subclasses
    evaluate() {
        // Default: Do nothing
        return [];
    }
}

/**
 * Generic Logic Gate IC (AND, OR, NAND, NOR, XOR, NOT)
 */
class LogicGateIC extends BaseIC {
    constructor(id, name, logicFunc, gateMap) {
        super(id, name, 14);
        this.logicFunc = logicFunc;
        this.gateMap = gateMap;
        this.storedOutputs = new Map(); // pin -> state

        // Initialize outputs to FLOAT or High?
        // Let's initialize to FLOAT until power is applied
    }

    setup(engine) {
        // Register Drivers for all Output Pins
        this.gateMap.forEach(gate => {
            const outPin = gate.out;
            this.storedOutputs.set(outPin, STATE_FLOAT);

            // The Driver Function: Returns the IC's internal desire for this pin
            const driver = () => {
                if (!this.isPowered()) return STATE_FLOAT;
                return this.storedOutputs.get(outPin);
            };

            // We need to find the node ID for this pin.
            const node = this.getPinNode(outPin);
            if (node) {
                engine.addDriver(node.id, driver);
            }
        });

        // Register Listeners for all Input Pins
        const inputPins = new Set();
        this.gateMap.forEach(gate => {
            gate.in.forEach(p => inputPins.add(p));
        });

        inputPins.forEach(inPin => {
            const node = this.getPinNode(inPin);
            if (node) {
                engine.addListener(node.id, () => {
                    // When input changes, schedule an evaluation
                    // We don't evaluate immediately; we let the engine handle time.
                    // But wait, we need to calculate the *future* output state.
                    this.runLogic(engine);
                });
            }
        });

        // Also listen to VCC/GND for Power On/Off events?
        // Yes, if power changes, outputs change.
        if (this.pins[this.vccPin]) engine.addListener(this.pins[this.vccPin].id, () => this.runLogic(engine));
        if (this.pins[this.gndPin]) engine.addListener(this.pins[this.gndPin].id, () => this.runLogic(engine));
    }

    runLogic(engine) {
        const results = this.evaluate();

        results.forEach(update => {
            const { pin, value } = update;
            // If the calculated value is different from stored, schedule an update
            if (this.storedOutputs.get(pin) !== value) {
                // Determine delay
                const delay = this.propDelay;

                engine.schedule(delay, () => {
                    this.storedOutputs.set(pin, value);
                    // Notify the Output Node that its driver has changed
                    const node = this.getPinNode(pin);
                    if (node) node.update();
                });
            }
        });
    }

    evaluate() {
        if (!this.isPowered()) {
            // If not powered, outputs are FLOAT or Low-Z? 
            // Usually invalid. Let's output FLOAT (High-Z) to simulate "Dead" chip.
            return this.gateMap.map(g => ({ pin: g.out, value: STATE_FLOAT }));
        }

        const updates = [];
        for (const gate of this.gateMap) {
            const inputStates = gate.in.map(p => this.getInputState(p));

            // Check for error on inputs
            if (inputStates.includes(STATE_ERROR)) {
                updates.push({ pin: gate.out, value: STATE_ERROR });
                continue;
            }

            const result = this.logicFunc(inputStates);
            updates.push({ pin: gate.out, value: result });
        }
        return updates;
    }
}

/**
 * Flip-Flop IC (D-Type, J-K, etc.)
 * Supports Sync Clock and Async Preset/Clear
 */
class FlipFlopIC extends BaseIC {
    constructor(id, name, config) {
        super(id, name, config.pins || 14);
        this.flops = config.flops; // [{ clk, pre, clr, q, q_bar, type: 'D'|'JK', triggers: 'rise'|'fall', d, j, k }]

        // Internal state
        this.states = this.flops.map(() => ({
            q: STATE_LOW,
            lastClk: STATE_FLOAT
        }));

        this.storedOutputs = new Map();

        // Custom VCC/GND if provided
        if (config.vcc) this.vccPin = config.vcc;
        if (config.gnd) this.gndPin = config.gnd;
    }

    setup(engine) {
        this.flops.forEach((ff, index) => {
            // Register Drivers
            [ff.q, ff.q_bar].forEach(pin => {
                if (!pin) return;
                this.storedOutputs.set(pin, STATE_FLOAT); // Default float until power

                const driver = () => {
                    if (!this.isPowered()) return STATE_FLOAT;
                    return this.storedOutputs.get(pin);
                };

                const node = this.getPinNode(pin);
                if (node) engine.addDriver(node.id, driver);
            });

            // Register Listeners
            const inputs = [ff.clk, ff.pre, ff.clr, ff.d, ff.j, ff.k].filter(p => p !== undefined);
            inputs.forEach(pin => {
                const node = this.getPinNode(pin);
                if (node) {
                    engine.addListener(node.id, () => this.runLogic(engine, index));
                }
            });
        });

        // Power listeners
        if (this.pins[this.vccPin]) engine.addListener(this.pins[this.vccPin].id, () => this.runAllLogic(engine));
        if (this.pins[this.gndPin]) engine.addListener(this.pins[this.gndPin].id, () => this.runAllLogic(engine));
    }

    runAllLogic(engine) {
        this.flops.forEach((_, i) => this.runLogic(engine, i));
    }

    runLogic(engine, index) {
        if (!this.isPowered()) {
            this.flops.forEach(ff => {
                this.updateOutput(engine, ff.q, STATE_FLOAT);
                this.updateOutput(engine, ff.q_bar, STATE_FLOAT);
            });
            return;
        }

        const ff = this.flops[index];
        const state = this.states[index];

        // Read Inputs (Handle Floating TTL as HIGH)
        const getVal = (pin) => pin ? this.getInputState(pin) : STATE_HIGH;

        const clk = getVal(ff.clk);
        const pre = getVal(ff.pre); // Active Low usually
        const clr = getVal(ff.clr); // Active Low usually

        const lastClk = state.lastClk;
        state.lastClk = clk; // Update history

        let nextQ = state.q;
        let forceUpdate = false;

        // Async Logic (Active LOW for LS series usually)
        if (pre === STATE_LOW && clr === STATE_HIGH) {
            nextQ = STATE_HIGH;
            forceUpdate = true;
        } else if (clr === STATE_LOW && pre === STATE_HIGH) {
            nextQ = STATE_LOW;
            forceUpdate = true;
        } else if (pre === STATE_LOW && clr === STATE_LOW) {
            nextQ = STATE_HIGH; // Unstable/Both High usually, assume High
            forceUpdate = true;
        } else {
            // Sync Logic
            let triggered = false;

            // Check Edge
            if (ff.trigger === 'fall') {
                if (lastClk === STATE_HIGH && clk === STATE_LOW) triggered = true;
            } else {
                // Default Rise
                if (lastClk === STATE_LOW && clk === STATE_HIGH) triggered = true;
            }

            if (triggered) {
                if (ff.type === 'D') {
                    const d = getVal(ff.d);
                    nextQ = d;
                } else if (ff.type === 'JK') {
                    const j = getVal(ff.j);
                    const k = getVal(ff.k);

                    if (j === STATE_LOW && k === STATE_LOW) {
                        // No change
                    } else if (j === STATE_LOW && k === STATE_HIGH) {
                        nextQ = STATE_LOW;
                    } else if (j === STATE_HIGH && k === STATE_LOW) {
                        nextQ = STATE_HIGH;
                    } else if (j === STATE_HIGH && k === STATE_HIGH) {
                        nextQ = (state.q === STATE_LOW) ? STATE_HIGH : STATE_LOW; // Toggle
                    }
                }
            }
        }

        // Check internal state change
        if (state.q !== nextQ || forceUpdate) {
            state.q = nextQ;
            const q_bar = (nextQ === STATE_HIGH) ? STATE_LOW : STATE_HIGH;

            // Schedule Output Updates
            this.updateOutput(engine, ff.q, nextQ);
            this.updateOutput(engine, ff.q_bar, q_bar);
        }
    }

    updateOutput(engine, pin, value) {
        if (!pin) return;
        if (this.storedOutputs.get(pin) !== value) {
            engine.schedule(this.propDelay, () => {
                this.storedOutputs.set(pin, value);
                const node = this.getPinNode(pin);
                if (node) node.update();
            });
        }
    }
}

/**
 * Ripple Counter IC (74LS90, 74LS93)
 * Supports multiple counter sections, async reset/set.
 */
class CounterIC extends BaseIC {
    constructor(id, name, config) {
        super(id, name, config.pins || 14);
        this.sections = config.sections; // [{ clk, outputs: [pin], mod, val: 0, lastClk }]
        this.resets = config.resets; // { pins: [], target: 0 }
        this.sets = config.sets; // { pins: [], target: 9 }

        // Initialize state
        this.sections.forEach(s => {
            s.val = 0;
            s.lastClk = STATE_FLOAT;
        });

        this.storedOutputs = new Map();

        if (config.vcc) this.vccPin = config.vcc;
        if (config.gnd) this.gndPin = config.gnd;
    }

    setup(engine) {
        // Register Drivers
        this.sections.forEach(sec => {
            sec.outputs.forEach(pin => {
                this.storedOutputs.set(pin, STATE_FLOAT);
                engine.addDriver(this.getPinNode(pin).id, () => {
                    if (!this.isPowered()) return STATE_FLOAT;
                    return this.storedOutputs.get(pin);
                });
            });
        });

        // Register Listeners
        const inputs = new Set();
        this.sections.forEach(s => inputs.add(s.clk));
        if (this.resets) this.resets.pins.forEach(p => inputs.add(p));
        if (this.sets) this.sets.pins.forEach(p => inputs.add(p));

        inputs.forEach(pin => {
            const node = this.getPinNode(pin);
            if (node) engine.addListener(node.id, () => this.runLogic(engine));
        });

        // Power listeners
        const vccNode = this.getPinNode(this.vccPin);
        const gndNode = this.getPinNode(this.gndPin);
        if (vccNode) engine.addListener(vccNode.id, () => this.runLogic(engine));
        if (gndNode) engine.addListener(gndNode.id, () => this.runLogic(engine));
    }

    runLogic(engine) {
        if (!this.isPowered()) {
            this.sections.forEach(sec => {
                sec.outputs.forEach(pin => this.updateOutput(engine, pin, STATE_FLOAT));
            });
            return;
        }

        const getVal = (pin) => this.getInputState(pin);

        // Handle Async Reset/Set (Active HIGH for 74LS90/93)
        // Check Resets
        let resetActive = false;
        if (this.resets) {
            const states = this.resets.pins.map(p => getVal(p));
            // All must be HIGH to reset
            if (states.every(s => s === STATE_HIGH)) {
                this.forceState(engine, this.resets.target || 0);
                resetActive = true;
            }
        }

        // Check Sets (74LS90 only)
        if (!resetActive && this.sets) {
            const states = this.sets.pins.map(p => getVal(p));
            if (states.every(s => s === STATE_HIGH)) {
                this.forceSet90(engine); // Special case for LS90 Set-to-9
                resetActive = true;
            }
        }

        if (resetActive) {
            // Update history to avoid false triggers
            this.sections.forEach(sec => {
                sec.lastClk = getVal(sec.clk);
            });
            return;
        }

        // Clock Logic (Falling Edge Trigger for 74LS90/93)
        this.sections.forEach(sec => {
            const clk = getVal(sec.clk);
            const last = sec.lastClk;
            sec.lastClk = clk;

            if (last === STATE_HIGH && clk === STATE_LOW) {
                // Falling Edge -> Increment
                sec.val = (sec.val + 1) % sec.mod;
                this.updateSectionOutputs(engine, sec);
            }
        });
    }

    forceState(engine, targetVal) {
        // Target val is global? No, counters are separate usually.
        // But for Reset/Set, it usually affects ALL bits.
        // For LS90/93, Master Reset clears ALL outputs (QA, QB, QC, QD).
        this.sections.forEach(sec => {
            sec.val = 0; // Reset clears to 0
            this.updateSectionOutputs(engine, sec);
        });
    }

    forceSet90(engine) {
        // Specific to 74LS90: Sets QA=1, QD=1, QB=0, QC=0 (Output 1001 = 9)
        // Sections: A (QA), B (QB, QC, QD)
        // Sec A (mod 2): Set to 1
        // Sec B (mod 5): Set to 4 (100 binary => QD=1, QC=0, QB=0) => 4.

        if (this.sections[0]) { this.sections[0].val = 1; this.updateSectionOutputs(engine, this.sections[0]); }
        if (this.sections[1]) { this.sections[1].val = 4; this.updateSectionOutputs(engine, this.sections[1]); }
    }

    updateSectionOutputs(engine, sec) {
        sec.outputs.forEach((pin, i) => {
            const bit = (sec.val >> i) & 1;
            this.updateOutput(engine, pin, bit === 1 ? STATE_HIGH : STATE_LOW);
        });
    }

    updateOutput(engine, pin, value) {
        if (!pin) return;
        if (this.storedOutputs.get(pin) !== value) {
            engine.schedule(this.propDelay, () => {
                this.storedOutputs.set(pin, value);
                const node = this.getPinNode(pin);
                if (node) node.update();
            });
        }
    }
}

/**
 * Generic Combinational Logic IC (Decoders, Muxes)
 * Evaluates all outputs based on all inputs.
 */
class CombinationalIC extends BaseIC {
    constructor(id, name, config) {
        super(id, name, config.pins || 16);
        this.inputPins = config.inputPins; // Array of pin numbers
        this.outputPins = config.outputPins; // Array of pin numbers
        this.logic = config.logic; // (inputs[]) -> outputs[] (states)

        this.storedOutputs = new Map();

        if (config.vcc) this.vccPin = config.vcc;
        if (config.gnd) this.gndPin = config.gnd;
    }

    setup(engine) {
        // Drivers
        this.outputPins.forEach(pin => {
            this.storedOutputs.set(pin, STATE_FLOAT);
            engine.addDriver(this.getPinNode(pin).id, () => {
                if (!this.isPowered()) return STATE_FLOAT;
                return this.storedOutputs.get(pin);
            });
        });

        // Listeners
        this.inputPins.forEach(pin => {
            const node = this.getPinNode(pin);
            if (node) engine.addListener(node.id, () => this.runLogic(engine));
        });

        // Power
        const vccNode = this.getPinNode(this.vccPin);
        const gndNode = this.getPinNode(this.gndPin);
        if (vccNode) engine.addListener(vccNode.id, () => this.runLogic(engine));
        if (gndNode) engine.addListener(gndNode.id, () => this.runLogic(engine));
    }

    runLogic(engine) {
        const results = this.evaluate();
        results.forEach(update => {
            const { pin, value } = update;
            if (this.storedOutputs.get(pin) !== value) {
                engine.schedule(this.propDelay, () => {
                    this.storedOutputs.set(pin, value);
                    const node = this.getPinNode(pin);
                    if (node) node.update();
                });
            }
        });
    }

    evaluate() {
        if (!this.isPowered()) {
            return this.outputPins.map(p => ({ pin: p, value: STATE_FLOAT }));
        }

        const inputs = this.inputPins.map(p => this.getInputState(p));
        // Check for ERROR
        if (inputs.includes(STATE_ERROR)) {
            return this.outputPins.map(p => ({ pin: p, value: STATE_ERROR }));
        }

        const outputs = this.logic(inputs);
        return this.outputPins.map((p, i) => ({ pin: p, value: outputs[i] }));
    }
}

const LOGIC_NAND = (inputs) => {
    // NAND: LOW if all inputs HIGH
    const allHigh = inputs.every(v => v === STATE_HIGH);
    return allHigh ? STATE_LOW : STATE_HIGH;
};

const LOGIC_AND = (inputs) => {
    const allHigh = inputs.every(v => v === STATE_HIGH);
    return allHigh ? STATE_HIGH : STATE_LOW;
};

const LOGIC_OR = (inputs) => {
    const anyHigh = inputs.some(v => v === STATE_HIGH);
    return anyHigh ? STATE_HIGH : STATE_LOW;
};

const LOGIC_NOR = (inputs) => {
    const anyHigh = inputs.some(v => v === STATE_HIGH);
    return anyHigh ? STATE_LOW : STATE_HIGH;
};

const LOGIC_NOT = (inputs) => {
    return inputs[0] === STATE_HIGH ? STATE_LOW : STATE_HIGH;
};

const LOGIC_XOR = (inputs) => {
    // XOR: High if inputs are different (assuming 2 inputs)
    if (inputs.length !== 2) return STATE_ERROR;
    return (inputs[0] !== inputs[1]) ? STATE_HIGH : STATE_LOW;
};


// --- IC Factory ---

export const IC_CATALOG = {
    '74LS00': {
        type: 'Logic',
        pins: 14,
        desc: 'Quad 2-Input NAND',
        create: (id) => new LogicGateIC(id, '74LS00', LOGIC_NAND, [
            { in: [1, 2], out: 3 },
            { in: [4, 5], out: 6 },
            { in: [10, 9], out: 8 },
            { in: [13, 12], out: 11 } // Note: Standard pinout for 7400
        ])
    },
    '74LS02': {
        type: 'Logic',
        pins: 14,
        desc: 'Quad 2-Input NOR',
        create: (id) => new LogicGateIC(id, '74LS02', LOGIC_NOR, [
            { in: [2, 3], out: 1 },
            { in: [5, 6], out: 4 },
            { in: [8, 9], out: 10 },
            { in: [11, 12], out: 13 }
        ])
    },
    '74LS04': {
        type: 'Logic',
        pins: 14,
        desc: 'Hex Inverter',
        create: (id) => new LogicGateIC(id, '74LS04', LOGIC_NOT, [
            { in: [1], out: 2 },
            { in: [3], out: 4 },
            { in: [5], out: 6 },
            { in: [9], out: 8 },
            { in: [11], out: 10 },
            { in: [13], out: 12 }
        ])
    },
    '74LS08': {
        type: 'Logic',
        pins: 14,
        desc: 'Quad 2-Input AND',
        create: (id) => new LogicGateIC(id, '74LS08', LOGIC_AND, [
            { in: [1, 2], out: 3 },
            { in: [4, 5], out: 6 },
            { in: [10, 9], out: 8 },
            { in: [13, 12], out: 11 }
        ])
    },
    '74LS32': {
        type: 'Logic',
        pins: 14,
        desc: 'Quad 2-Input OR',
        create: (id) => new LogicGateIC(id, '74LS32', LOGIC_OR, [
            { in: [1, 2], out: 3 },
            { in: [4, 5], out: 6 },
            { in: [10, 9], out: 8 },
            { in: [13, 12], out: 11 }
        ])
    },
    '74LS86': {
        type: 'Logic',
        pins: 14,
        desc: 'Quad 2-Input XOR',
        create: (id) => new LogicGateIC(id, '74LS86', LOGIC_XOR, [
            { in: [1, 2], out: 3 },
            { in: [4, 5], out: 6 },
            { in: [10, 9], out: 8 },
            { in: [13, 12], out: 11 }
        ])
    },
    '74LS74': {
        type: 'FlipFlop',
        pins: 14,
        desc: 'Dual D-Type Flip-Flop',
        create: (id) => new FlipFlopIC(id, '74LS74', {
            flops: [
                { type: 'D', trigger: 'rise', clk: 3, d: 2, pre: 4, clr: 1, q: 5, q_bar: 6 },
                { type: 'D', trigger: 'rise', clk: 11, d: 12, pre: 10, clr: 13, q: 9, q_bar: 8 }
            ]
        })
    },
    '74LS76': {
        type: 'FlipFlop',
        pins: 16,
        desc: 'Dual J-K Flip-Flop',
        create: (id) => new FlipFlopIC(id, '74LS76', {
            pins: 16,
            vcc: 5,
            gnd: 13,
            flops: [
                { type: 'JK', trigger: 'fall', clk: 1, j: 4, k: 16, pre: 2, clr: 3, q: 15, q_bar: 14 },
                { type: 'JK', trigger: 'fall', clk: 6, j: 9, k: 12, pre: 7, clr: 8, q: 11, q_bar: 10 }
            ]
        })
    },
    '74LS90': {
        type: 'Counter',
        pins: 14,
        desc: 'Decade Counter',
        create: (id) => new CounterIC(id, '74LS90', {
            vcc: 5, gnd: 10,
            sections: [
                { clk: 14, outputs: [12], mod: 2 }, // A: CKA(14) -> QA(12)
                { clk: 1, outputs: [9, 8, 11], mod: 5 } // B: CKB(1) -> QB(9), QC(8), QD(11)
            ],
            resets: { pins: [2, 3] }, // R0(1), R0(2) -> 0
            sets: { pins: [6, 7] }   // R9(1), R9(2) -> 9
        })
    },
    '74LS93': {
        type: 'Counter',
        pins: 14,
        desc: 'Binary Counter',
        create: (id) => new CounterIC(id, '74LS93', {
            vcc: 5, gnd: 10,
            sections: [
                { clk: 14, outputs: [12], mod: 2 }, // A: CKA(14) -> QA(12)
                { clk: 1, outputs: [9, 8, 11], mod: 8 } // B: CKB(1) -> QB(9), QC(8), QD(11)
            ],
            resets: { pins: [2, 3] } // R0(1), R0(2) -> 0
        })
    },
    '74LS138': {
        type: 'Decoder',
        pins: 16,
        desc: '3-to-8 Line Decoder',
        create: (id) => new CombinationalIC(id, '74LS138', {
            pins: 16, vcc: 16, gnd: 8,
            inputPins: [1, 2, 3, 4, 5, 6], // A, B, C, G2A, G2B, G1
            outputPins: [15, 14, 13, 12, 11, 10, 9, 7], // Y0..Y7
            logic: (inputs) => {
                // Inputs: A(1), B(2), C(3), G2A(4), G2B(5), G1(6)
                // Note: Array index 0..5
                const [A, B, C, G2A, G2B, G1] = inputs;

                // Enable Logic: G1=H, G2A=L, G2B=L
                if (G1 === STATE_HIGH && G2A === STATE_LOW && G2B === STATE_LOW) {
                    // Active LOW outputs
                    const index = (C === STATE_HIGH ? 4 : 0) + (B === STATE_HIGH ? 2 : 0) + (A === STATE_HIGH ? 1 : 0);
                    // Y0..Y7 are at indices 0..7 of outputPins
                    return Array(8).fill(STATE_HIGH).map((v, i) => i === index ? STATE_LOW : STATE_HIGH);
                } else {
                    // Disabled: All HIGH
                    return Array(8).fill(STATE_HIGH);
                }
            }
        })
    },
    '74LS151': {
        type: 'Multiplexer',
        pins: 16,
        desc: '8-to-1 Data Selector/Multiplexer',
        create: (id) => new CombinationalIC(id, '74LS151', {
            pins: 16, vcc: 16, gnd: 8,
            inputPins: [7, 11, 10, 9, 4, 3, 2, 1, 15, 14, 13, 12],
            outputPins: [5, 6],
            logic: (inputs) => {
                const [STROBE, C, B, A, D0, D1, D2, D3, D4, D5, D6, D7] = inputs;
                if (STROBE === STATE_HIGH) return [STATE_LOW, STATE_HIGH];
                const selectIndex = (C === STATE_HIGH ? 4 : 0) + (B === STATE_HIGH ? 2 : 0) + (A === STATE_HIGH ? 1 : 0);
                const selectedData = [D0, D1, D2, D3, D4, D5, D6, D7][selectIndex];
                return [selectedData, selectedData === STATE_HIGH ? STATE_LOW : STATE_HIGH];
            }
        })
    },
    '74LS153': {
        type: 'Multiplexer',
        pins: 16,
        desc: 'Dual 4-to-1 Multiplexer',
        create: (id) => new CombinationalIC(id, '74LS153', {
            pins: 16, vcc: 16, gnd: 8,
            inputPins: [14, 2, 1, 6, 5, 4, 3, 15, 10, 11, 12, 13],
            outputPins: [7, 9],
            logic: (inputs) => {
                const [S0, S1, G1, C10, C11, C12, C13, G2, C20, C21, C22, C23] = inputs;
                const idx = (S1 === STATE_HIGH ? 2 : 0) + (S0 === STATE_HIGH ? 1 : 0);
                let Y1 = STATE_LOW;
                if (G1 === STATE_LOW) Y1 = [C10, C11, C12, C13][idx];
                let Y2 = STATE_LOW;
                if (G2 === STATE_LOW) Y2 = [C20, C21, C22, C23][idx];
                return [Y1, Y2];
            }
        })
    },
    '74LS47': {
        type: 'Decoder',
        pins: 16,
        desc: 'BCD to 7-Segment Decoder/Driver',
        create: (id) => new CombinationalIC(id, '74LS47', {
            pins: 16, vcc: 16, gnd: 8,
            inputPins: [3, 4, 7, 1, 2, 6],
            outputPins: [13, 12, 11, 10, 9, 15, 14],
            logic: (inputs) => {
                const [LT, RBI, A, B, C, D] = inputs;
                const bcd = (D === STATE_HIGH ? 8 : 0) + (C === STATE_HIGH ? 4 : 0) + (B === STATE_HIGH ? 2 : 0) + (A === STATE_HIGH ? 1 : 0);
                const patterns = [[0, 0, 0, 0, 0, 0, 1], [1, 0, 0, 1, 1, 1, 1], [0, 0, 1, 0, 0, 1, 0], [0, 0, 0, 0, 1, 1, 0], [1, 0, 0, 1, 1, 0, 0], [0, 1, 0, 0, 1, 0, 0], [0, 1, 0, 0, 0, 0, 0], [0, 0, 0, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 1, 0, 0], [1, 1, 1, 1, 1, 1, 1]];
                if (LT === STATE_LOW) return [0, 0, 0, 0, 0, 0, 0].map(v => STATE_LOW);
                const pattern = (bcd <= 9) ? patterns[bcd] : patterns[10];
                return pattern.map(v => v === 0 ? STATE_LOW : STATE_HIGH);
            }
        })
    },
    '74LS138': {
        type: 'Decoder',
        pins: 16,
        desc: '3-to-8 Line Decoder/Demultiplexer',
        create: (id) => new CombinationalIC(id, '74LS138', {
            pins: 16, vcc: 16, gnd: 8,
            inputPins: [1, 2, 3, 6, 4, 5],
            outputPins: [15, 14, 13, 12, 11, 10, 9, 7],
            logic: (inputs) => {
                const [A, B, C, G1, G2A, G2B] = inputs;
                const enabled = (G1 === STATE_HIGH) && (G2A === STATE_LOW) && (G2B === STATE_LOW);
                if (!enabled) return Array(8).fill(STATE_HIGH);
                const select = (C === STATE_HIGH ? 4 : 0) + (B === STATE_HIGH ? 2 : 0) + (A === STATE_HIGH ? 1 : 0);
                const outputs = Array(8).fill(STATE_HIGH);
                outputs[select] = STATE_LOW;
                return outputs;
            }
        })
    },
    '74LS157': {
        type: 'Multiplexer',
        pins: 16,
        desc: 'Quad 2-to-1 Data Selector/Multiplexer',
        create: (id) => new CombinationalIC(id, '74LS157', {
            pins: 16, vcc: 16, gnd: 8,
            inputPins: [1, 15, 2, 3, 5, 6, 11, 10, 14, 13],
            outputPins: [4, 7, 9, 12],
            logic: (inputs) => {
                const [SELECT, STROBE, A1, B1, A2, B2, A3, B3, A4, B4] = inputs;
                if (STROBE === STATE_HIGH) return [STATE_LOW, STATE_LOW, STATE_LOW, STATE_LOW];
                const selectB = (SELECT === STATE_HIGH);
                return [selectB ? B1 : A1, selectB ? B2 : A2, selectB ? B3 : A3, selectB ? B4 : A4];
            }
        })
    },
    '74LS283': {
        type: 'Arithmetic',
        pins: 16,
        desc: '4-bit Binary Full Adder',
        create: (id) => new CombinationalIC(id, '74LS283', {
            pins: 16, vcc: 16, gnd: 8,
            inputPins: [5, 3, 14, 12, 6, 2, 15, 11, 7],
            outputPins: [4, 1, 13, 10, 9],
            logic: (inputs) => {
                const [A1, A2, A3, A4, B1, B2, B3, B4, C0] = inputs;
                const a = [A1, A2, A3, A4].map(s => s === STATE_HIGH ? 1 : 0);
                const b = [B1, B2, B3, B4].map(s => s === STATE_HIGH ? 1 : 0);
                let carry = (C0 === STATE_HIGH ? 1 : 0);
                const sums = [];
                for (let i = 0; i < 4; i++) {
                    const sum = a[i] + b[i] + carry;
                    sums.push(sum & 1);
                    carry = sum >> 1;
                }
                return [...sums.map(s => s ? STATE_HIGH : STATE_LOW), carry ? STATE_HIGH : STATE_LOW];
            }
        })
    }
};

/**
 * Creates an IC instance by name
 */
export function createIC(name, id) {
    if (IC_CATALOG[name]) {
        return IC_CATALOG[name].create(id);
    }
    console.error(`Unknown IC: ${name}`);
    return null;
}

