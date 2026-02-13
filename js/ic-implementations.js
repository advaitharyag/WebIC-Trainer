/**
 * Digital IC Trainer - IC Implementations
 * All TTL ICs extending TTLChip base class
 */

import { TTLChip, PIN_TYPE } from './ttl-chip.js';
import { STATE_LOW, STATE_HIGH, STATE_FLOAT, STATE_ERROR } from './simulation.js';

// ============================================================================
// LOGIC GATES
// ============================================================================

/**
 * 74LS00 - Quad 2-Input NAND Gate
 * Pinout: 1=A1, 2=B1, 3=Y1, 4=A2, 5=B2, 6=Y2, 7=GND, 8=Y3, 9=A3, 10=B3, 11=Y4, 12=A4, 13=B4, 14=VCC
 */
export class LS00 extends TTLChip {
    constructor(id, name = '74LS00') {
        super(id, name, 14);
        
        // Configure pin types
        this.setPinType(1, PIN_TYPE.INPUT);  // A1
        this.setPinType(2, PIN_TYPE.INPUT);  // B1
        this.setPinType(3, PIN_TYPE.OUTPUT); // Y1
        this.setPinType(4, PIN_TYPE.INPUT); // A2
        this.setPinType(5, PIN_TYPE.INPUT); // B2
        this.setPinType(6, PIN_TYPE.OUTPUT); // Y2
        this.setPinType(8, PIN_TYPE.OUTPUT); // Y3
        this.setPinType(9, PIN_TYPE.INPUT);  // A3
        this.setPinType(10, PIN_TYPE.INPUT); // B3
        this.setPinType(11, PIN_TYPE.OUTPUT); // Y4
        this.setPinType(12, PIN_TYPE.INPUT); // A4
        this.setPinType(13, PIN_TYPE.INPUT); // B4
        this.setPinType(7, PIN_TYPE.POWER);  // GND
        this.setPinType(14, PIN_TYPE.POWER); // VCC
    }

    evaluate() {
        if (!this.isPowered()) {
            return [
                { pin: 3, state: STATE_FLOAT },
                { pin: 6, state: STATE_FLOAT },
                { pin: 8, state: STATE_FLOAT },
                { pin: 11, state: STATE_FLOAT }
            ];
        }

        const a1 = this.getInputState(1);
        const b1 = this.getInputState(2);
        const a2 = this.getInputState(4);
        const b2 = this.getInputState(5);
        const a3 = this.getInputState(9);
        const b3 = this.getInputState(10);
        const a4 = this.getInputState(12);
        const b4 = this.getInputState(13);

        // NAND: Y = NOT(A AND B)
        const nand = (a, b) => {
            if (a === STATE_ERROR || b === STATE_ERROR) return STATE_ERROR;
            const and = (a === STATE_HIGH && b === STATE_HIGH) ? STATE_HIGH : STATE_LOW;
            return (and === STATE_HIGH) ? STATE_LOW : STATE_HIGH;
        };

        return [
            { pin: 3, state: nand(a1, b1) },
            { pin: 6, state: nand(a2, b2) },
            { pin: 8, state: nand(a3, b3) },
            { pin: 11, state: nand(a4, b4) }
        ];
    }
}

/**
 * 74LS02 - Quad 2-Input NOR Gate
 * Pinout: 1=Y1, 2=A1, 3=B1, 4=Y2, 5=A2, 6=B2, 7=GND, 8=Y3, 9=A3, 10=B3, 11=Y4, 12=A4, 13=B4, 14=VCC
 */
export class LS02 extends TTLChip {
    constructor(id, name = '74LS02') {
        super(id, name, 14);
        
        this.setPinType(1, PIN_TYPE.OUTPUT); // Y1
        this.setPinType(2, PIN_TYPE.INPUT);  // A1
        this.setPinType(3, PIN_TYPE.INPUT);  // B1
        this.setPinType(4, PIN_TYPE.OUTPUT); // Y2
        this.setPinType(5, PIN_TYPE.INPUT);  // A2
        this.setPinType(6, PIN_TYPE.INPUT);  // B2
        this.setPinType(8, PIN_TYPE.OUTPUT); // Y3
        this.setPinType(9, PIN_TYPE.INPUT);  // A3
        this.setPinType(10, PIN_TYPE.INPUT); // B3
        this.setPinType(11, PIN_TYPE.OUTPUT); // Y4
        this.setPinType(12, PIN_TYPE.INPUT); // A4
        this.setPinType(13, PIN_TYPE.INPUT); // B4
        this.setPinType(7, PIN_TYPE.POWER);  // GND
        this.setPinType(14, PIN_TYPE.POWER); // VCC
    }

    evaluate() {
        if (!this.isPowered()) {
            return [
                { pin: 1, state: STATE_FLOAT },
                { pin: 4, state: STATE_FLOAT },
                { pin: 8, state: STATE_FLOAT },
                { pin: 11, state: STATE_FLOAT }
            ];
        }

        const nor = (a, b) => {
            if (a === STATE_ERROR || b === STATE_ERROR) return STATE_ERROR;
            const or = (a === STATE_HIGH || b === STATE_HIGH) ? STATE_HIGH : STATE_LOW;
            return (or === STATE_HIGH) ? STATE_LOW : STATE_HIGH;
        };

        return [
            { pin: 1, state: nor(this.getInputState(2), this.getInputState(3)) },
            { pin: 4, state: nor(this.getInputState(5), this.getInputState(6)) },
            { pin: 8, state: nor(this.getInputState(9), this.getInputState(10)) },
            { pin: 11, state: nor(this.getInputState(12), this.getInputState(13)) }
        ];
    }
}

/**
 * 74LS04 - Hex Inverter
 * Pinout: 1=A1, 2=Y1, 3=A2, 4=Y2, 5=A3, 6=Y3, 7=GND, 8=Y4, 9=A4, 10=Y5, 11=A5, 12=Y6, 13=A6, 14=VCC
 */
export class LS04 extends TTLChip {
    constructor(id, name = '74LS04') {
        super(id, name, 14);
        
        this.setPinType(1, PIN_TYPE.INPUT);  // A1
        this.setPinType(2, PIN_TYPE.OUTPUT); // Y1
        this.setPinType(3, PIN_TYPE.INPUT);  // A2
        this.setPinType(4, PIN_TYPE.OUTPUT); // Y2
        this.setPinType(5, PIN_TYPE.INPUT);  // A3
        this.setPinType(6, PIN_TYPE.OUTPUT); // Y3
        this.setPinType(9, PIN_TYPE.INPUT);  // A4
        this.setPinType(8, PIN_TYPE.OUTPUT); // Y4
        this.setPinType(11, PIN_TYPE.INPUT); // A5
        this.setPinType(10, PIN_TYPE.OUTPUT); // Y5
        this.setPinType(13, PIN_TYPE.INPUT); // A6
        this.setPinType(12, PIN_TYPE.OUTPUT); // Y6
        this.setPinType(7, PIN_TYPE.POWER);  // GND
        this.setPinType(14, PIN_TYPE.POWER); // VCC
    }

    evaluate() {
        if (!this.isPowered()) {
            return [
                { pin: 2, state: STATE_FLOAT },
                { pin: 4, state: STATE_FLOAT },
                { pin: 6, state: STATE_FLOAT },
                { pin: 8, state: STATE_FLOAT },
                { pin: 10, state: STATE_FLOAT },
                { pin: 12, state: STATE_FLOAT }
            ];
        }

        const invert = (a) => {
            if (a === STATE_ERROR) return STATE_ERROR;
            return (a === STATE_HIGH) ? STATE_LOW : STATE_HIGH;
        };

        return [
            { pin: 2, state: invert(this.getInputState(1)) },
            { pin: 4, state: invert(this.getInputState(3)) },
            { pin: 6, state: invert(this.getInputState(5)) },
            { pin: 8, state: invert(this.getInputState(9)) },
            { pin: 10, state: invert(this.getInputState(11)) },
            { pin: 12, state: invert(this.getInputState(13)) }
        ];
    }
}

/**
 * 74LS08 - Quad 2-Input AND Gate
 * Pinout: 
 * 1  = 1A (Input)
 * 2  = 1B (Input)
 * 3  = 1Y (Output)
 * 4  = 2A (Input)
 * 5  = 2B (Input)
 * 6  = 2Y (Output)
 * 7  = GND
 * 8  = 3Y (Output)
 * 9  = 3A (Input)
 * 10 = 3B (Input)
 * 11 = 4Y (Output)
 * 12 = 4A (Input)
 * 13 = 4B (Input)
 * 14 = VCC
 */
export class LS08 extends TTLChip {
    constructor(id, name = '74LS08') {
        super(id, name, 14);
        
        // Gate 1: pins 1, 2 -> 3
        this.setPinType(1, PIN_TYPE.INPUT);  // 1A
        this.setPinType(2, PIN_TYPE.INPUT);  // 1B
        this.setPinType(3, PIN_TYPE.OUTPUT); // 1Y
        
        // Gate 2: pins 4, 5 -> 6
        this.setPinType(4, PIN_TYPE.INPUT);  // 2A
        this.setPinType(5, PIN_TYPE.INPUT);  // 2B
        this.setPinType(6, PIN_TYPE.OUTPUT); // 2Y
        
        // Gate 3: pins 9, 10 -> 8
        this.setPinType(9, PIN_TYPE.INPUT);  // 3A
        this.setPinType(10, PIN_TYPE.INPUT); // 3B
        this.setPinType(8, PIN_TYPE.OUTPUT); // 3Y
        
        // Gate 4: pins 12, 13 -> 11
        this.setPinType(12, PIN_TYPE.INPUT); // 4A
        this.setPinType(13, PIN_TYPE.INPUT); // 4B
        this.setPinType(11, PIN_TYPE.OUTPUT); // 4Y
        
        // Power pins
        this.setPinType(7, PIN_TYPE.POWER);  // GND
        this.setPinType(14, PIN_TYPE.POWER); // VCC
        
        // Debug flag
        this.debug = false;
    }

    /**
     * Enable/disable debug logging
     */
    setDebug(enabled) {
        this.debug = enabled;
    }

    evaluate() {
        // Check power status
        const powered = this.isPowered();
        
        if (this.debug) {
            console.log(`[${this.name}] Power check:`, {
                vccPin: this.vccPin,
                gndPin: this.gndPin,
                vccNode: this.getPinNode(this.vccPin),
                gndNode: this.getPinNode(this.gndPin),
                vccState: this.getPinNode(this.vccPin)?.state,
                gndState: this.getPinNode(this.gndPin)?.state,
                powered
            });
        }

        if (!powered) {
            if (this.debug) {
                console.log(`[${this.name}] Not powered - outputs floating`);
            }
            return [
                { pin: 3, state: STATE_FLOAT },
                { pin: 6, state: STATE_FLOAT },
                { pin: 8, state: STATE_FLOAT },
                { pin: 11, state: STATE_FLOAT }
            ];
        }

        // AND gate logic function
        const andGate = (a, b) => {
            if (a === STATE_ERROR || b === STATE_ERROR) {
                return STATE_ERROR;
            }
            // AND: HIGH only when both inputs are HIGH
            return (a === STATE_HIGH && b === STATE_HIGH) ? STATE_HIGH : STATE_LOW;
        };

        // Read input states (with TTL floating behavior)
        const a1 = this.getInputState(1);
        const b1 = this.getInputState(2);
        const a2 = this.getInputState(4);
        const b2 = this.getInputState(5);
        const a3 = this.getInputState(9);
        const b3 = this.getInputState(10);
        const a4 = this.getInputState(12);
        const b4 = this.getInputState(13);

        // Calculate outputs
        const y1 = andGate(a1, b1);
        const y2 = andGate(a2, b2);
        const y3 = andGate(a3, b3);
        const y4 = andGate(a4, b4);

        // Debug logging
        if (this.debug) {
            console.log(`[${this.name}] Gate evaluation:`, {
                'Gate1': { A: a1, B: b1, Y: y1 },
                'Gate2': { A: a2, B: b2, Y: y2 },
                'Gate3': { A: a3, B: b3, Y: y3 },
                'Gate4': { A: a4, B: b4, Y: y4 }
            });
        }

        return [
            { pin: 3, state: y1 },  // 1Y = 1A AND 1B
            { pin: 6, state: y2 },  // 2Y = 2A AND 2B
            { pin: 8, state: y3 },  // 3Y = 3A AND 3B
            { pin: 11, state: y4 }  // 4Y = 4A AND 4B
        ];
    }
}

/**
 * 74LS32 - Quad 2-Input OR Gate
 * Pinout: 1=A1, 2=B1, 3=Y1, 4=A2, 5=B2, 6=Y2, 7=GND, 8=Y3, 9=A3, 10=B3, 11=Y4, 12=A4, 13=B4, 14=VCC
 */
export class LS32 extends TTLChip {
    constructor(id, name = '74LS32') {
        super(id, name, 14);
        
        this.setPinType(1, PIN_TYPE.INPUT);  // A1
        this.setPinType(2, PIN_TYPE.INPUT);  // B1
        this.setPinType(3, PIN_TYPE.OUTPUT); // Y1
        this.setPinType(4, PIN_TYPE.INPUT);  // A2
        this.setPinType(5, PIN_TYPE.INPUT);  // B2
        this.setPinType(6, PIN_TYPE.OUTPUT); // Y2
        this.setPinType(9, PIN_TYPE.INPUT);  // A3
        this.setPinType(10, PIN_TYPE.INPUT); // B3
        this.setPinType(8, PIN_TYPE.OUTPUT); // Y3
        this.setPinType(12, PIN_TYPE.INPUT); // A4
        this.setPinType(13, PIN_TYPE.INPUT); // B4
        this.setPinType(11, PIN_TYPE.OUTPUT); // Y4
        this.setPinType(7, PIN_TYPE.POWER);  // GND
        this.setPinType(14, PIN_TYPE.POWER); // VCC
    }

    evaluate() {
        if (!this.isPowered()) {
            return [
                { pin: 3, state: STATE_FLOAT },
                { pin: 6, state: STATE_FLOAT },
                { pin: 8, state: STATE_FLOAT },
                { pin: 11, state: STATE_FLOAT }
            ];
        }

        const or = (a, b) => {
            if (a === STATE_ERROR || b === STATE_ERROR) return STATE_ERROR;
            return (a === STATE_HIGH || b === STATE_HIGH) ? STATE_HIGH : STATE_LOW;
        };

        return [
            { pin: 3, state: or(this.getInputState(1), this.getInputState(2)) },
            { pin: 6, state: or(this.getInputState(4), this.getInputState(5)) },
            { pin: 8, state: or(this.getInputState(9), this.getInputState(10)) },
            { pin: 11, state: or(this.getInputState(12), this.getInputState(13)) }
        ];
    }
}

/**
 * 74LS86 - Quad 2-Input XOR Gate
 * Pinout: 1=A1, 2=B1, 3=Y1, 4=A2, 5=B2, 6=Y2, 7=GND, 8=Y3, 9=A3, 10=B3, 11=Y4, 12=A4, 13=B4, 14=VCC
 */
export class LS86 extends TTLChip {
    constructor(id, name = '74LS86') {
        super(id, name, 14);
        
        this.setPinType(1, PIN_TYPE.INPUT);  // A1
        this.setPinType(2, PIN_TYPE.INPUT);  // B1
        this.setPinType(3, PIN_TYPE.OUTPUT); // Y1
        this.setPinType(4, PIN_TYPE.INPUT);  // A2
        this.setPinType(5, PIN_TYPE.INPUT);  // B2
        this.setPinType(6, PIN_TYPE.OUTPUT); // Y2
        this.setPinType(9, PIN_TYPE.INPUT);  // A3
        this.setPinType(10, PIN_TYPE.INPUT); // B3
        this.setPinType(8, PIN_TYPE.OUTPUT); // Y3
        this.setPinType(12, PIN_TYPE.INPUT); // A4
        this.setPinType(13, PIN_TYPE.INPUT); // B4
        this.setPinType(11, PIN_TYPE.OUTPUT); // Y4
        this.setPinType(7, PIN_TYPE.POWER);  // GND
        this.setPinType(14, PIN_TYPE.POWER); // VCC
    }

    evaluate() {
        if (!this.isPowered()) {
            return [
                { pin: 3, state: STATE_FLOAT },
                { pin: 6, state: STATE_FLOAT },
                { pin: 8, state: STATE_FLOAT },
                { pin: 11, state: STATE_FLOAT }
            ];
        }

        const xor = (a, b) => {
            if (a === STATE_ERROR || b === STATE_ERROR) return STATE_ERROR;
            return (a !== b) ? STATE_HIGH : STATE_LOW;
        };

        return [
            { pin: 3, state: xor(this.getInputState(1), this.getInputState(2)) },
            { pin: 6, state: xor(this.getInputState(4), this.getInputState(5)) },
            { pin: 8, state: xor(this.getInputState(9), this.getInputState(10)) },
            { pin: 11, state: xor(this.getInputState(12), this.getInputState(13)) }
        ];
    }
}

// ============================================================================
// FLIP-FLOPS
// ============================================================================

/**
 * 74LS74 - Dual D-Type Positive-Edge-Triggered Flip-Flop
 * Pinout: 1=CLR1, 2=D1, 3=CLK1, 4=PR1, 5=Q1, 6=Q1', 7=GND, 8=Q2', 9=Q2, 10=PR2, 11=CLK2, 12=D2, 13=CLR2, 14=VCC
 */
export class LS74 extends TTLChip {
    constructor(id, name = '74LS74') {
        super(id, name, 14);
        
        // FF1
        this.setPinType(1, PIN_TYPE.INPUT);  // CLR1 (active LOW)
        this.setPinType(2, PIN_TYPE.INPUT);  // D1
        this.setPinType(3, PIN_TYPE.CLOCK);  // CLK1
        this.setPinType(4, PIN_TYPE.INPUT);  // PR1 (active LOW)
        this.setPinType(5, PIN_TYPE.OUTPUT); // Q1
        this.setPinType(6, PIN_TYPE.OUTPUT); // Q1'
        
        // FF2
        this.setPinType(13, PIN_TYPE.INPUT); // CLR2 (active LOW)
        this.setPinType(12, PIN_TYPE.INPUT); // D2
        this.setPinType(11, PIN_TYPE.CLOCK); // CLK2
        this.setPinType(10, PIN_TYPE.INPUT); // PR2 (active LOW)
        this.setPinType(9, PIN_TYPE.OUTPUT); // Q2
        this.setPinType(8, PIN_TYPE.OUTPUT); // Q2'
        
        this.setPinType(7, PIN_TYPE.POWER);  // GND
        this.setPinType(14, PIN_TYPE.POWER); // VCC
        
        // Internal state
        this.internalState = {
            ff1: { q: STATE_LOW, lastClk: STATE_FLOAT },
            ff2: { q: STATE_LOW, lastClk: STATE_FLOAT }
        };
    }

    evaluate() {
        if (!this.isPowered()) {
            return [
                { pin: 5, state: STATE_FLOAT },
                { pin: 6, state: STATE_FLOAT },
                { pin: 9, state: STATE_FLOAT },
                { pin: 8, state: STATE_FLOAT }
            ];
        }

        const updates = [];
        
        // Evaluate FF1
        const clr1 = this.getInputState(1);
        const d1 = this.getInputState(2);
        const clk1 = this.getInputState(3);
        const pr1 = this.getInputState(4);
        const lastClk1 = this.internalState.ff1.lastClk;
        this.internalState.ff1.lastClk = clk1;
        
        let q1 = this.internalState.ff1.q;
        
        // Async clear (active LOW)
        if (clr1 === STATE_LOW && pr1 === STATE_HIGH) {
            q1 = STATE_LOW;
        }
        // Async preset (active LOW)
        else if (pr1 === STATE_LOW && clr1 === STATE_HIGH) {
            q1 = STATE_HIGH;
        }
        // Both LOW = invalid state (assume HIGH)
        else if (clr1 === STATE_LOW && pr1 === STATE_LOW) {
            q1 = STATE_HIGH;
        }
        // Clock edge (rising edge triggered)
        else if (lastClk1 === STATE_LOW && clk1 === STATE_HIGH) {
            q1 = d1;
        }
        
        this.internalState.ff1.q = q1;
        const q1bar = (q1 === STATE_HIGH) ? STATE_LOW : STATE_HIGH;
        
        updates.push({ pin: 5, state: q1 });
        updates.push({ pin: 6, state: q1bar });
        
        // Evaluate FF2
        const clr2 = this.getInputState(13);
        const d2 = this.getInputState(12);
        const clk2 = this.getInputState(11);
        const pr2 = this.getInputState(10);
        const lastClk2 = this.internalState.ff2.lastClk;
        this.internalState.ff2.lastClk = clk2;
        
        let q2 = this.internalState.ff2.q;
        
        if (clr2 === STATE_LOW && pr2 === STATE_HIGH) {
            q2 = STATE_LOW;
        } else if (pr2 === STATE_LOW && clr2 === STATE_HIGH) {
            q2 = STATE_HIGH;
        } else if (clr2 === STATE_LOW && pr2 === STATE_LOW) {
            q2 = STATE_HIGH;
        } else if (lastClk2 === STATE_LOW && clk2 === STATE_HIGH) {
            q2 = d2;
        }
        
        this.internalState.ff2.q = q2;
        const q2bar = (q2 === STATE_HIGH) ? STATE_LOW : STATE_HIGH;
        
        updates.push({ pin: 9, state: q2 });
        updates.push({ pin: 8, state: q2bar });
        
        return updates;
    }

    reset() {
        super.reset();
        this.internalState = {
            ff1: { q: STATE_LOW, lastClk: STATE_FLOAT },
            ff2: { q: STATE_LOW, lastClk: STATE_FLOAT }
        };
    }
}

/**
 * 74LS76 - Dual JK Negative-Edge-Triggered Flip-Flop
 * Pinout: 16-pin DIP
 * 1=CLK1, 2=PR1, 3=CLR1, 4=J1, 5=VCC, 6=K1, 7=GND, 8=Q2', 9=Q2, 10=CLR2, 11=PR2, 12=CLK2, 13=K2, 14=GND, 15=Q1, 16=Q1'
 * Note: Non-standard pinout, VCC=5, GND=7,13
 */
export class LS76 extends TTLChip {
    constructor(id, name = '74LS76') {
        super(id, name, 16);
        
        // Custom power pins
        this.vccPin = 5;
        this.gndPin = 7;
        
        // FF1
        this.setPinType(1, PIN_TYPE.CLOCK);  // CLK1
        this.setPinType(2, PIN_TYPE.INPUT);  // PR1 (active LOW)
        this.setPinType(3, PIN_TYPE.INPUT);  // CLR1 (active LOW)
        this.setPinType(4, PIN_TYPE.INPUT);  // J1
        this.setPinType(6, PIN_TYPE.INPUT);  // K1
        this.setPinType(15, PIN_TYPE.OUTPUT); // Q1
        this.setPinType(16, PIN_TYPE.OUTPUT); // Q1'
        
        // FF2
        this.setPinType(12, PIN_TYPE.CLOCK); // CLK2
        this.setPinType(11, PIN_TYPE.INPUT); // PR2 (active LOW)
        this.setPinType(10, PIN_TYPE.INPUT); // CLR2 (active LOW)
        this.setPinType(14, PIN_TYPE.INPUT); // J2 (Note: pin 14 is GND, checking datasheet...)
        // Actually, pin 14 is GND, so J2 must be elsewhere. Let me check standard pinout.
        // Standard 74LS76: 1=CLK1, 2=PR1, 3=CLR1, 4=J1, 5=VCC, 6=K1, 7=GND, 8=Q2', 9=Q2, 10=CLR2, 11=PR2, 12=CLK2, 13=K2, 14=J2, 15=Q1, 16=Q1'
        this.setPinType(14, PIN_TYPE.INPUT); // J2
        this.setPinType(13, PIN_TYPE.INPUT); // K2
        this.setPinType(9, PIN_TYPE.OUTPUT); // Q2
        this.setPinType(8, PIN_TYPE.OUTPUT); // Q2'
        
        this.setPinType(5, PIN_TYPE.POWER);  // VCC
        this.setPinType(7, PIN_TYPE.POWER);  // GND
        
        this.internalState = {
            ff1: { q: STATE_LOW, lastClk: STATE_FLOAT },
            ff2: { q: STATE_LOW, lastClk: STATE_FLOAT }
        };
    }

    evaluate() {
        if (!this.isPowered()) {
            return [
                { pin: 15, state: STATE_FLOAT },
                { pin: 16, state: STATE_FLOAT },
                { pin: 9, state: STATE_FLOAT },
                { pin: 8, state: STATE_FLOAT }
            ];
        }

        const updates = [];
        
        // FF1
        const clk1 = this.getInputState(1);
        const pr1 = this.getInputState(2);
        const clr1 = this.getInputState(3);
        const j1 = this.getInputState(4);
        const k1 = this.getInputState(6);
        const lastClk1 = this.internalState.ff1.lastClk;
        this.internalState.ff1.lastClk = clk1;
        
        let q1 = this.internalState.ff1.q;
        
        // Async clear
        if (clr1 === STATE_LOW && pr1 === STATE_HIGH) {
            q1 = STATE_LOW;
        } else if (pr1 === STATE_LOW && clr1 === STATE_HIGH) {
            q1 = STATE_HIGH;
        } else if (clr1 === STATE_LOW && pr1 === STATE_LOW) {
            q1 = STATE_HIGH;
        }
        // Falling edge triggered
        else if (lastClk1 === STATE_HIGH && clk1 === STATE_LOW) {
            if (j1 === STATE_HIGH && k1 === STATE_LOW) {
                q1 = STATE_HIGH;
            } else if (j1 === STATE_LOW && k1 === STATE_HIGH) {
                q1 = STATE_LOW;
            } else if (j1 === STATE_HIGH && k1 === STATE_HIGH) {
                q1 = (q1 === STATE_HIGH) ? STATE_LOW : STATE_HIGH; // Toggle
            }
            // j1=LOW, k1=LOW: no change
        }
        
        this.internalState.ff1.q = q1;
        const q1bar = (q1 === STATE_HIGH) ? STATE_LOW : STATE_HIGH;
        
        updates.push({ pin: 15, state: q1 });
        updates.push({ pin: 16, state: q1bar });
        
        // FF2
        const clk2 = this.getInputState(12);
        const pr2 = this.getInputState(11);
        const clr2 = this.getInputState(10);
        const j2 = this.getInputState(14);
        const k2 = this.getInputState(13);
        const lastClk2 = this.internalState.ff2.lastClk;
        this.internalState.ff2.lastClk = clk2;
        
        let q2 = this.internalState.ff2.q;
        
        if (clr2 === STATE_LOW && pr2 === STATE_HIGH) {
            q2 = STATE_LOW;
        } else if (pr2 === STATE_LOW && clr2 === STATE_HIGH) {
            q2 = STATE_HIGH;
        } else if (clr2 === STATE_LOW && pr2 === STATE_LOW) {
            q2 = STATE_HIGH;
        } else if (lastClk2 === STATE_HIGH && clk2 === STATE_LOW) {
            if (j2 === STATE_HIGH && k2 === STATE_LOW) {
                q2 = STATE_HIGH;
            } else if (j2 === STATE_LOW && k2 === STATE_HIGH) {
                q2 = STATE_LOW;
            } else if (j2 === STATE_HIGH && k2 === STATE_HIGH) {
                q2 = (q2 === STATE_HIGH) ? STATE_LOW : STATE_HIGH;
            }
        }
        
        this.internalState.ff2.q = q2;
        const q2bar = (q2 === STATE_HIGH) ? STATE_LOW : STATE_HIGH;
        
        updates.push({ pin: 9, state: q2 });
        updates.push({ pin: 8, state: q2bar });
        
        return updates;
    }

    reset() {
        super.reset();
        this.internalState = {
            ff1: { q: STATE_LOW, lastClk: STATE_FLOAT },
            ff2: { q: STATE_LOW, lastClk: STATE_FLOAT }
        };
    }
}
// ============================================================================
// COUNTERS
// ============================================================================

/**
 * 74LS90 - Decade Counter (Divide-by-10)
 * Pinout: 1=CKB, 2=R0(1), 3=R0(2), 4=NC, 5=VCC, 6=R9(1), 7=R9(2), 8=QC, 9=QB, 10=GND, 11=QD, 12=QA, 13=NC, 14=CKA
 */
export class LS90 extends TTLChip {
    constructor(id, name = '74LS90') {
        super(id, name, 14);
        
        this.vccPin = 5;
        this.gndPin = 10;
        
        this.setPinType(1, PIN_TYPE.CLOCK);  // CKB
        this.setPinType(2, PIN_TYPE.INPUT);   // R0(1) - Reset (active HIGH)
        this.setPinType(3, PIN_TYPE.INPUT);   // R0(2) - Reset (active HIGH)
        this.setPinType(6, PIN_TYPE.INPUT);  // R9(1) - Set to 9 (active HIGH)
        this.setPinType(7, PIN_TYPE.INPUT);  // R9(2) - Set to 9 (active HIGH)
        this.setPinType(14, PIN_TYPE.CLOCK); // CKA
        this.setPinType(12, PIN_TYPE.OUTPUT); // QA
        this.setPinType(9, PIN_TYPE.OUTPUT);  // QB
        this.setPinType(8, PIN_TYPE.OUTPUT);  // QC
        this.setPinType(11, PIN_TYPE.OUTPUT); // QD
        this.setPinType(5, PIN_TYPE.POWER);   // VCC
        this.setPinType(10, PIN_TYPE.POWER);   // GND
        
        // Internal: Two sections - mod-2 (QA) and mod-5 (QB, QC, QD)
        this.internalState = {
            sectionA: { count: 0, lastClk: STATE_FLOAT }, // mod-2
            sectionB: { count: 0, lastClk: STATE_FLOAT }    // mod-5
        };
    }

    evaluate() {
        if (!this.isPowered()) {
            return [
                { pin: 12, state: STATE_FLOAT },
                { pin: 9, state: STATE_FLOAT },
                { pin: 8, state: STATE_FLOAT },
                { pin: 11, state: STATE_FLOAT }
            ];
        }

        const r01 = this.getInputState(2);
        const r02 = this.getInputState(3);
        const r91 = this.getInputState(6);
        const r92 = this.getInputState(7);
        
        // Reset (both R0 pins HIGH)
        if (r01 === STATE_HIGH && r02 === STATE_HIGH) {
            this.internalState.sectionA.count = 0;
            this.internalState.sectionB.count = 0;
        }
        // Set to 9 (both R9 pins HIGH)
        else if (r91 === STATE_HIGH && r92 === STATE_HIGH) {
            this.internalState.sectionA.count = 1; // QA = 1
            this.internalState.sectionB.count = 4; // QD=1, QC=0, QB=0 = 100 binary = 4 decimal
        }
        // Normal counting
        else {
            // Section A: mod-2 counter (CKA -> QA)
            const clkA = this.getInputState(14);
            const lastClkA = this.internalState.sectionA.lastClk;
            this.internalState.sectionA.lastClk = clkA;
            
            if (lastClkA === STATE_HIGH && clkA === STATE_LOW) {
                this.internalState.sectionA.count = (this.internalState.sectionA.count + 1) % 2;
            }
            
            // Section B: mod-5 counter (CKB -> QB, QC, QD)
            const clkB = this.getInputState(1);
            const lastClkB = this.internalState.sectionB.lastClk;
            this.internalState.sectionB.lastClk = clkB;
            
            if (lastClkB === STATE_HIGH && clkB === STATE_LOW) {
                this.internalState.sectionB.count = (this.internalState.sectionB.count + 1) % 5;
            }
        }
        
        // Output QA (bit 0 of section A)
        const qa = (this.internalState.sectionA.count & 1) ? STATE_HIGH : STATE_LOW;
        
        // Output QB, QC, QD (bits 0, 1, 2 of section B)
        const qb = (this.internalState.sectionB.count & 1) ? STATE_HIGH : STATE_LOW;
        const qc = (this.internalState.sectionB.count & 2) ? STATE_HIGH : STATE_LOW;
        const qd = (this.internalState.sectionB.count & 4) ? STATE_HIGH : STATE_LOW;
        
        return [
            { pin: 12, state: qa },
            { pin: 9, state: qb },
            { pin: 8, state: qc },
            { pin: 11, state: qd }
        ];
    }

    reset() {
        super.reset();
        this.internalState = {
            sectionA: { count: 0, lastClk: STATE_FLOAT },
            sectionB: { count: 0, lastClk: STATE_FLOAT }
        };
    }
}

/**
 * 74LS93 - 4-Bit Binary Counter (Divide-by-16)
 * Pinout: 1=CKB, 2=R0(1), 3=R0(2), 4=NC, 5=VCC, 6=NC, 7=NC, 8=QC, 9=QB, 10=GND, 11=QD, 12=QA, 13=NC, 14=CKA
 */
export class LS93 extends TTLChip {
    constructor(id, name = '74LS93') {
        super(id, name, 14);
        
        this.vccPin = 5;
        this.gndPin = 10;
        
        this.setPinType(1, PIN_TYPE.CLOCK);  // CKB
        this.setPinType(2, PIN_TYPE.INPUT);   // R0(1)
        this.setPinType(3, PIN_TYPE.INPUT);   // R0(2)
        this.setPinType(14, PIN_TYPE.CLOCK); // CKA
        this.setPinType(12, PIN_TYPE.OUTPUT); // QA
        this.setPinType(9, PIN_TYPE.OUTPUT);  // QB
        this.setPinType(8, PIN_TYPE.OUTPUT);  // QC
        this.setPinType(11, PIN_TYPE.OUTPUT); // QD
        this.setPinType(5, PIN_TYPE.POWER);   // VCC
        this.setPinType(10, PIN_TYPE.POWER);   // GND
        
        this.internalState = {
            sectionA: { count: 0, lastClk: STATE_FLOAT }, // mod-2
            sectionB: { count: 0, lastClk: STATE_FLOAT }    // mod-8
        };
    }

    evaluate() {
        if (!this.isPowered()) {
            return [
                { pin: 12, state: STATE_FLOAT },
                { pin: 9, state: STATE_FLOAT },
                { pin: 8, state: STATE_FLOAT },
                { pin: 11, state: STATE_FLOAT }
            ];
        }

        const r01 = this.getInputState(2);
        const r02 = this.getInputState(3);
        
        // Reset
        if (r01 === STATE_HIGH && r02 === STATE_HIGH) {
            this.internalState.sectionA.count = 0;
            this.internalState.sectionB.count = 0;
        } else {
            // Section A: mod-2
            const clkA = this.getInputState(14);
            const lastClkA = this.internalState.sectionA.lastClk;
            this.internalState.sectionA.lastClk = clkA;
            
            if (lastClkA === STATE_HIGH && clkA === STATE_LOW) {
                this.internalState.sectionA.count = (this.internalState.sectionA.count + 1) % 2;
            }
            
            // Section B: mod-8
            const clkB = this.getInputState(1);
            const lastClkB = this.internalState.sectionB.lastClk;
            this.internalState.sectionB.lastClk = clkB;
            
            if (lastClkB === STATE_HIGH && clkB === STATE_LOW) {
                this.internalState.sectionB.count = (this.internalState.sectionB.count + 1) % 8;
            }
        }
        
        const qa = (this.internalState.sectionA.count & 1) ? STATE_HIGH : STATE_LOW;
        const qb = (this.internalState.sectionB.count & 1) ? STATE_HIGH : STATE_LOW;
        const qc = (this.internalState.sectionB.count & 2) ? STATE_HIGH : STATE_LOW;
        const qd = (this.internalState.sectionB.count & 4) ? STATE_HIGH : STATE_LOW;
        
        return [
            { pin: 12, state: qa },
            { pin: 9, state: qb },
            { pin: 8, state: qc },
            { pin: 11, state: qd }
        ];
    }

    reset() {
        super.reset();
        this.internalState = {
            sectionA: { count: 0, lastClk: STATE_FLOAT },
            sectionB: { count: 0, lastClk: STATE_FLOAT }
        };
    }
}

// ============================================================================
// DECODERS
// ============================================================================

/**
 * 74LS138 - 3-to-8 Line Decoder/Demultiplexer
 * Pinout: 1=A, 2=B, 3=C, 4=G2A, 5=G2B, 6=G1, 7=Y7, 8=GND, 9=Y6, 10=Y5, 11=Y4, 12=Y3, 13=Y2, 14=Y1, 15=Y0, 16=VCC
 */
export class LS138 extends TTLChip {
    constructor(id, name = '74LS138') {
        super(id, name, 16);
        
        this.vccPin = 16;
        this.gndPin = 8;
        
        this.setPinType(1, PIN_TYPE.INPUT);  // A
        this.setPinType(2, PIN_TYPE.INPUT);  // B
        this.setPinType(3, PIN_TYPE.INPUT);  // C
        this.setPinType(4, PIN_TYPE.INPUT);  // G2A (active LOW)
        this.setPinType(5, PIN_TYPE.INPUT);  // G2B (active LOW)
        this.setPinType(6, PIN_TYPE.INPUT);  // G1 (active HIGH)
        this.setPinType(7, PIN_TYPE.OUTPUT); // Y7 (active LOW)
        this.setPinType(9, PIN_TYPE.OUTPUT); // Y6
        this.setPinType(10, PIN_TYPE.OUTPUT); // Y5
        this.setPinType(11, PIN_TYPE.OUTPUT); // Y4
        this.setPinType(12, PIN_TYPE.OUTPUT); // Y3
        this.setPinType(13, PIN_TYPE.OUTPUT); // Y2
        this.setPinType(14, PIN_TYPE.OUTPUT); // Y1
        this.setPinType(15, PIN_TYPE.OUTPUT); // Y0
        this.setPinType(8, PIN_TYPE.POWER);   // GND
        this.setPinType(16, PIN_TYPE.POWER);  // VCC
    }

    evaluate() {
        if (!this.isPowered()) {
            return [
                { pin: 15, state: STATE_FLOAT },
                { pin: 14, state: STATE_FLOAT },
                { pin: 13, state: STATE_FLOAT },
                { pin: 12, state: STATE_FLOAT },
                { pin: 11, state: STATE_FLOAT },
                { pin: 10, state: STATE_FLOAT },
                { pin: 9, state: STATE_FLOAT },
                { pin: 7, state: STATE_FLOAT }
            ];
        }

        const a = this.getInputState(1);
        const b = this.getInputState(2);
        const c = this.getInputState(3);
        const g2a = this.getInputState(4);
        const g2b = this.getInputState(5);
        const g1 = this.getInputState(6);
        
        // Enable: G1=HIGH, G2A=LOW, G2B=LOW
        const enabled = (g1 === STATE_HIGH && g2a === STATE_LOW && g2b === STATE_LOW);
        
        if (!enabled) {
            // All outputs HIGH (disabled)
            return [
                { pin: 15, state: STATE_HIGH },
                { pin: 14, state: STATE_HIGH },
                { pin: 13, state: STATE_HIGH },
                { pin: 12, state: STATE_HIGH },
                { pin: 11, state: STATE_HIGH },
                { pin: 10, state: STATE_HIGH },
                { pin: 9, state: STATE_HIGH },
                { pin: 7, state: STATE_HIGH }
            ];
        }
        
        // Decode: select = C*4 + B*2 + A
        const select = (c === STATE_HIGH ? 4 : 0) + 
                      (b === STATE_HIGH ? 2 : 0) + 
                      (a === STATE_HIGH ? 1 : 0);
        
        // Active LOW outputs: selected output is LOW, others HIGH
        const outputs = Array(8).fill(STATE_HIGH);
        outputs[select] = STATE_LOW;
        
        return [
            { pin: 15, state: outputs[0] }, // Y0
            { pin: 14, state: outputs[1] }, // Y1
            { pin: 13, state: outputs[2] }, // Y2
            { pin: 12, state: outputs[3] }, // Y3
            { pin: 11, state: outputs[4] }, // Y4
            { pin: 10, state: outputs[5] }, // Y5
            { pin: 9, state: outputs[6] },  // Y6
            { pin: 7, state: outputs[7] }    // Y7
        ];
    }
}

/**
 * 74LS47 - BCD to 7-Segment Decoder/Driver (Active LOW outputs)
 * Pinout: 1=B, 2=C, 3=LT, 4=BI/RBO, 5=RBI, 6=D, 7=A, 8=GND, 9=e, 10=d, 11=c, 12=b, 13=a, 14=g, 15=f, 16=VCC
 */
export class LS47 extends TTLChip {
    constructor(id, name = '74LS47') {
        super(id, name, 16);
        
        this.vccPin = 16;
        this.gndPin = 8;
        
        this.setPinType(7, PIN_TYPE.INPUT);  // A (LSB)
        this.setPinType(1, PIN_TYPE.INPUT);  // B
        this.setPinType(2, PIN_TYPE.INPUT);  // C
        this.setPinType(6, PIN_TYPE.INPUT);  // D (MSB)
        this.setPinType(3, PIN_TYPE.INPUT);  // LT (Lamp Test, active LOW)
        this.setPinType(4, PIN_TYPE.INPUT);  // BI/RBO (Blanking Input/Ripple Blanking Output)
        this.setPinType(5, PIN_TYPE.INPUT);  // RBI (Ripple Blanking Input, active LOW)
        this.setPinType(13, PIN_TYPE.OUTPUT); // a (active LOW)
        this.setPinType(12, PIN_TYPE.OUTPUT); // b
        this.setPinType(11, PIN_TYPE.OUTPUT); // c
        this.setPinType(10, PIN_TYPE.OUTPUT); // d
        this.setPinType(9, PIN_TYPE.OUTPUT);  // e
        this.setPinType(15, PIN_TYPE.OUTPUT); // f
        this.setPinType(14, PIN_TYPE.OUTPUT); // g
        this.setPinType(8, PIN_TYPE.POWER);   // GND
        this.setPinType(16, PIN_TYPE.POWER);  // VCC
        
        // 7-segment patterns (active LOW: 0=segment ON, 1=segment OFF)
        this.patterns = [
            [0, 0, 0, 0, 0, 0, 1], // 0: a,b,c,d,e,f on
            [1, 0, 0, 1, 1, 1, 1], // 1: b,c on
            [0, 0, 1, 0, 0, 1, 0], // 2: a,b,d,e,g on
            [0, 0, 0, 0, 1, 1, 0], // 3: a,b,c,d,g on
            [1, 0, 0, 1, 1, 0, 0], // 4: b,c,f,g on
            [0, 1, 0, 0, 1, 0, 0], // 5: a,c,d,f,g on
            [0, 1, 0, 0, 0, 0, 0], // 6: a,c,d,e,f,g on
            [0, 0, 0, 1, 1, 1, 1], // 7: a,b,c on
            [0, 0, 0, 0, 0, 0, 0], // 8: all on
            [0, 0, 0, 0, 1, 0, 0], // 9: a,b,c,d,f,g on
            [1, 1, 1, 1, 1, 1, 1]  // Blank/invalid
        ];
    }

    evaluate() {
        if (!this.isPowered()) {
            return [
                { pin: 13, state: STATE_FLOAT },
                { pin: 12, state: STATE_FLOAT },
                { pin: 11, state: STATE_FLOAT },
                { pin: 10, state: STATE_FLOAT },
                { pin: 9, state: STATE_FLOAT },
                { pin: 15, state: STATE_FLOAT },
                { pin: 14, state: STATE_FLOAT }
            ];
        }

        const lt = this.getInputState(3);  // Lamp Test
        const bi = this.getInputState(4);  // Blanking Input
        const rbi = this.getInputState(5); // Ripple Blanking Input
        
        // Lamp Test: all segments ON
        if (lt === STATE_LOW) {
            return [
                { pin: 13, state: STATE_LOW },
                { pin: 12, state: STATE_LOW },
                { pin: 11, state: STATE_LOW },
                { pin: 10, state: STATE_LOW },
                { pin: 9, state: STATE_LOW },
                { pin: 15, state: STATE_LOW },
                { pin: 14, state: STATE_LOW }
            ];
        }
        
        // Blanking Input: all segments OFF
        if (bi === STATE_LOW) {
            return [
                { pin: 13, state: STATE_HIGH },
                { pin: 12, state: STATE_HIGH },
                { pin: 11, state: STATE_HIGH },
                { pin: 10, state: STATE_HIGH },
                { pin: 9, state: STATE_HIGH },
                { pin: 15, state: STATE_HIGH },
                { pin: 14, state: STATE_HIGH }
            ];
        }
        
        // Read BCD
        const a = this.getInputState(7);
        const b = this.getInputState(1);
        const c = this.getInputState(2);
        const d = this.getInputState(6);
        
        const bcd = (d === STATE_HIGH ? 8 : 0) + 
                   (c === STATE_HIGH ? 4 : 0) + 
                   (b === STATE_HIGH ? 2 : 0) + 
                   (a === STATE_HIGH ? 1 : 0);
        
        // Ripple blanking: if input is 0 and RBI is LOW, blank display
        if (bcd === 0 && rbi === STATE_LOW) {
            return [
                { pin: 13, state: STATE_HIGH },
                { pin: 12, state: STATE_HIGH },
                { pin: 11, state: STATE_HIGH },
                { pin: 10, state: STATE_HIGH },
                { pin: 9, state: STATE_HIGH },
                { pin: 15, state: STATE_HIGH },
                { pin: 14, state: STATE_HIGH }
            ];
        }
        
        // Get pattern
        const patternIndex = (bcd <= 9) ? bcd : 10;
        const pattern = this.patterns[patternIndex];
        
        // Convert to states (0=LOW=ON, 1=HIGH=OFF)
        return [
            { pin: 13, state: pattern[0] === 0 ? STATE_LOW : STATE_HIGH }, // a
            { pin: 12, state: pattern[1] === 0 ? STATE_LOW : STATE_HIGH }, // b
            { pin: 11, state: pattern[2] === 0 ? STATE_LOW : STATE_HIGH }, // c
            { pin: 10, state: pattern[3] === 0 ? STATE_LOW : STATE_HIGH }, // d
            { pin: 9, state: pattern[4] === 0 ? STATE_LOW : STATE_HIGH },  // e
            { pin: 15, state: pattern[5] === 0 ? STATE_LOW : STATE_HIGH }, // f
            { pin: 14, state: pattern[6] === 0 ? STATE_LOW : STATE_HIGH }  // g
        ];
    }
}

// ============================================================================
// MULTIPLEXERS
// ============================================================================

/**
 * 74LS151 - 8-to-1 Data Selector/Multiplexer
 * Pinout: 1=D3, 2=D2, 3=D1, 4=D0, 5=Y, 6=W, 7=STROBE, 8=GND, 9=D7, 10=D6, 11=D5, 12=D4, 13=S2, 14=S1, 15=S0, 16=VCC
 */
export class LS151 extends TTLChip {
    constructor(id, name = '74LS151') {
        super(id, name, 16);
        
        this.vccPin = 16;
        this.gndPin = 8;
        
        this.setPinType(4, PIN_TYPE.INPUT);  // D0
        this.setPinType(3, PIN_TYPE.INPUT);  // D1
        this.setPinType(2, PIN_TYPE.INPUT);  // D2
        this.setPinType(1, PIN_TYPE.INPUT);  // D3
        this.setPinType(12, PIN_TYPE.INPUT); // D4
        this.setPinType(11, PIN_TYPE.INPUT); // D5
        this.setPinType(10, PIN_TYPE.INPUT); // D6
        this.setPinType(9, PIN_TYPE.INPUT);  // D7
        this.setPinType(15, PIN_TYPE.INPUT); // S0
        this.setPinType(14, PIN_TYPE.INPUT); // S1
        this.setPinType(13, PIN_TYPE.INPUT); // S2
        this.setPinType(7, PIN_TYPE.INPUT);  // STROBE (active LOW)
        this.setPinType(5, PIN_TYPE.OUTPUT); // Y
        this.setPinType(6, PIN_TYPE.OUTPUT); // W (complement of Y)
        this.setPinType(8, PIN_TYPE.POWER);   // GND
        this.setPinType(16, PIN_TYPE.POWER);  // VCC
    }

    evaluate() {
        if (!this.isPowered()) {
            return [
                { pin: 5, state: STATE_FLOAT },
                { pin: 6, state: STATE_FLOAT }
            ];
        }

        const strobe = this.getInputState(7);
        
        // If strobe is HIGH, outputs are LOW
        if (strobe === STATE_HIGH) {
            return [
                { pin: 5, state: STATE_LOW },
                { pin: 6, state: STATE_HIGH }
            ];
        }
        
        // Select input
        const s0 = this.getInputState(15);
        const s1 = this.getInputState(14);
        const s2 = this.getInputState(13);
        
        const select = (s2 === STATE_HIGH ? 4 : 0) + 
                      (s1 === STATE_HIGH ? 2 : 0) + 
                      (s0 === STATE_HIGH ? 1 : 0);
        
        const dataInputs = [
            this.getInputState(4),  // D0
            this.getInputState(3),  // D1
            this.getInputState(2),  // D2
            this.getInputState(1),  // D3
            this.getInputState(12), // D4
            this.getInputState(11), // D5
            this.getInputState(10), // D6
            this.getInputState(9)   // D7
        ];
        
        const selected = dataInputs[select];
        const y = selected;
        const w = (selected === STATE_HIGH) ? STATE_LOW : STATE_HIGH;
        
        return [
            { pin: 5, state: y },
            { pin: 6, state: w }
        ];
    }
}

/**
 * 74LS153 - Dual 4-to-1 Multiplexer
 * Pinout: 1=1G, 2=S0, 3=1C3, 4=1C2, 5=1C1, 6=1C0, 7=1Y, 8=GND, 9=2Y, 10=2C0, 11=2C1, 12=2C2, 13=2C3, 14=S1, 15=2G, 16=VCC
 */
export class LS153 extends TTLChip {
    constructor(id, name = '74LS153') {
        super(id, name, 16);
        
        this.vccPin = 16;
        this.gndPin = 8;
        
        // MUX1
        this.setPinType(1, PIN_TYPE.INPUT);  // 1G (active LOW)
        this.setPinType(6, PIN_TYPE.INPUT); // 1C0
        this.setPinType(5, PIN_TYPE.INPUT); // 1C1
        this.setPinType(4, PIN_TYPE.INPUT); // 1C2
        this.setPinType(3, PIN_TYPE.INPUT); // 1C3
        this.setPinType(7, PIN_TYPE.OUTPUT); // 1Y
        
        // MUX2
        this.setPinType(15, PIN_TYPE.INPUT); // 2G (active LOW)
        this.setPinType(10, PIN_TYPE.INPUT); // 2C0
        this.setPinType(11, PIN_TYPE.INPUT); // 2C1
        this.setPinType(12, PIN_TYPE.INPUT); // 2C2
        this.setPinType(13, PIN_TYPE.INPUT); // 2C3
        this.setPinType(9, PIN_TYPE.OUTPUT); // 2Y
        
        // Common select
        this.setPinType(2, PIN_TYPE.INPUT);  // S0
        this.setPinType(14, PIN_TYPE.INPUT); // S1
        
        this.setPinType(8, PIN_TYPE.POWER);   // GND
        this.setPinType(16, PIN_TYPE.POWER);  // VCC
    }

    evaluate() {
        if (!this.isPowered()) {
            return [
                { pin: 7, state: STATE_FLOAT },
                { pin: 9, state: STATE_FLOAT }
            ];
        }

        const s0 = this.getInputState(2);
        const s1 = this.getInputState(14);
        const select = (s1 === STATE_HIGH ? 2 : 0) + (s0 === STATE_HIGH ? 1 : 0);
        
        // MUX1
        const g1 = this.getInputState(1);
        let y1 = STATE_LOW;
        if (g1 === STATE_LOW) {
            const c1 = [
                this.getInputState(6), // C0
                this.getInputState(5), // C1
                this.getInputState(4), // C2
                this.getInputState(3)  // C3
            ];
            y1 = c1[select];
        }
        
        // MUX2
        const g2 = this.getInputState(15);
        let y2 = STATE_LOW;
        if (g2 === STATE_LOW) {
            const c2 = [
                this.getInputState(10), // C0
                this.getInputState(11), // C1
                this.getInputState(12), // C2
                this.getInputState(13)  // C3
            ];
            y2 = c2[select];
        }
        
        return [
            { pin: 7, state: y1 },
            { pin: 9, state: y2 }
        ];
    }
}

/**
 * 74LS157 - Quad 2-to-1 Data Selector/Multiplexer
 * Pinout: 1=SELECT, 2=1A, 3=1B, 4=1Y, 5=2A, 6=2B, 7=2Y, 8=GND, 9=3Y, 10=3B, 11=3A, 12=4Y, 13=4B, 14=4A, 15=STROBE, 16=VCC
 */
export class LS157 extends TTLChip {
    constructor(id, name = '74LS157') {
        super(id, name, 16);
        
        this.vccPin = 16;
        this.gndPin = 8;
        
        this.setPinType(15, PIN_TYPE.INPUT); // STROBE (active LOW)
        this.setPinType(1, PIN_TYPE.INPUT);  // SELECT
        
        // MUX1
        this.setPinType(2, PIN_TYPE.INPUT);  // 1A
        this.setPinType(3, PIN_TYPE.INPUT);  // 1B
        this.setPinType(4, PIN_TYPE.OUTPUT); // 1Y
        
        // MUX2
        this.setPinType(5, PIN_TYPE.INPUT);  // 2A
        this.setPinType(6, PIN_TYPE.INPUT);  // 2B
        this.setPinType(7, PIN_TYPE.OUTPUT); // 2Y
        
        // MUX3
        this.setPinType(11, PIN_TYPE.INPUT); // 3A
        this.setPinType(10, PIN_TYPE.INPUT); // 3B
        this.setPinType(9, PIN_TYPE.OUTPUT); // 3Y
        
        // MUX4
        this.setPinType(14, PIN_TYPE.INPUT); // 4A
        this.setPinType(13, PIN_TYPE.INPUT); // 4B
        this.setPinType(12, PIN_TYPE.OUTPUT); // 4Y
        
        this.setPinType(8, PIN_TYPE.POWER);   // GND
        this.setPinType(16, PIN_TYPE.POWER);  // VCC
    }

    evaluate() {
        if (!this.isPowered()) {
            return [
                { pin: 4, state: STATE_FLOAT },
                { pin: 7, state: STATE_FLOAT },
                { pin: 9, state: STATE_FLOAT },
                { pin: 12, state: STATE_FLOAT }
            ];
        }

        const strobe = this.getInputState(15);
        const select = this.getInputState(1);
        
        if (strobe === STATE_HIGH) {
            return [
                { pin: 4, state: STATE_LOW },
                { pin: 7, state: STATE_LOW },
                { pin: 9, state: STATE_LOW },
                { pin: 12, state: STATE_LOW }
            ];
        }
        
        const selectB = (select === STATE_HIGH);
        
        return [
            { pin: 4, state: selectB ? this.getInputState(3) : this.getInputState(2) },
            { pin: 7, state: selectB ? this.getInputState(6) : this.getInputState(5) },
            { pin: 9, state: selectB ? this.getInputState(10) : this.getInputState(11) },
            { pin: 12, state: selectB ? this.getInputState(13) : this.getInputState(14) }
        ];
    }
}

// ============================================================================
// ARITHMETIC
// ============================================================================

/**
 * 74LS283 - 4-Bit Binary Full Adder
 * Pinout: 1=A1, 2=B1, 3=A2, 4=B2, 5=A3, 6=B3, 7=A4, 8=GND, 9=SUM4, 10=SUM3, 11=B4, 12=SUM2, 13=SUM1, 14=C4, 15=C0, 16=VCC
 */
export class LS283 extends TTLChip {
    constructor(id, name = '74LS283') {
        super(id, name, 16);
        
        this.vccPin = 16;
        this.gndPin = 8;
        
        this.setPinType(1, PIN_TYPE.INPUT);  // A1
        this.setPinType(2, PIN_TYPE.INPUT);  // B1
        this.setPinType(3, PIN_TYPE.INPUT);  // A2
        this.setPinType(4, PIN_TYPE.INPUT);  // B2
        this.setPinType(5, PIN_TYPE.INPUT);  // A3
        this.setPinType(6, PIN_TYPE.INPUT);  // B3
        this.setPinType(7, PIN_TYPE.INPUT);  // A4
        this.setPinType(11, PIN_TYPE.INPUT); // B4
        this.setPinType(15, PIN_TYPE.INPUT); // C0 (Carry In)
        this.setPinType(13, PIN_TYPE.OUTPUT); // SUM1
        this.setPinType(12, PIN_TYPE.OUTPUT); // SUM2
        this.setPinType(10, PIN_TYPE.OUTPUT); // SUM3
        this.setPinType(9, PIN_TYPE.OUTPUT);  // SUM4
        this.setPinType(14, PIN_TYPE.OUTPUT); // C4 (Carry Out)
        this.setPinType(8, PIN_TYPE.POWER);   // GND
        this.setPinType(16, PIN_TYPE.POWER);  // VCC
    }

    evaluate() {
        if (!this.isPowered()) {
            return [
                { pin: 13, state: STATE_FLOAT },
                { pin: 12, state: STATE_FLOAT },
                { pin: 10, state: STATE_FLOAT },
                { pin: 9, state: STATE_FLOAT },
                { pin: 14, state: STATE_FLOAT }
            ];
        }

        // Read inputs
        const a = [
            this.getInputState(1) === STATE_HIGH ? 1 : 0, // A1
            this.getInputState(3) === STATE_HIGH ? 1 : 0, // A2
            this.getInputState(5) === STATE_HIGH ? 1 : 0, // A3
            this.getInputState(7) === STATE_HIGH ? 1 : 0  // A4
        ];
        
        const b = [
            this.getInputState(2) === STATE_HIGH ? 1 : 0, // B1
            this.getInputState(4) === STATE_HIGH ? 1 : 0, // B2
            this.getInputState(6) === STATE_HIGH ? 1 : 0, // B3
            this.getInputState(11) === STATE_HIGH ? 1 : 0 // B4
        ];
        
        let carry = this.getInputState(15) === STATE_HIGH ? 1 : 0; // C0
        
        // Perform 4-bit addition
        const sums = [];
        for (let i = 0; i < 4; i++) {
            const sum = a[i] + b[i] + carry;
            sums.push(sum & 1); // LSB
            carry = sum >> 1;   // Carry to next bit
        }
        
        return [
            { pin: 13, state: sums[0] ? STATE_HIGH : STATE_LOW }, // SUM1
            { pin: 12, state: sums[1] ? STATE_HIGH : STATE_LOW }, // SUM2
            { pin: 10, state: sums[2] ? STATE_HIGH : STATE_LOW }, // SUM3
            { pin: 9, state: sums[3] ? STATE_HIGH : STATE_LOW },  // SUM4
            { pin: 14, state: carry ? STATE_HIGH : STATE_LOW }    // C4
        ];
    }
}
