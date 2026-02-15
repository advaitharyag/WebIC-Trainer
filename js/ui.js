/**
 * Digital IC Trainer - Main UI Controller
 * Integrates Simulation, Wiring, and UI interactions.
 */

import { CircuitEngine, STATE_LOW, STATE_HIGH, STATE_FLOAT, STATE_ERROR } from './simulation.js';
import { WiringManager } from './wiring-engine.js';
import { icRegistry } from './ic-registration.js';
import { ClockManager } from './clock-manager.js';
import { PIN_TYPE } from './ttl-chip.js';

class SystemController {
    constructor() {
        this.engine = new CircuitEngine();
        this.wiring = new WiringManager(this.engine);
        this.clockManager = new ClockManager(this.engine);
        this.icInstances = new Map(); // socketId -> IC Object

        // Global Power Rails
        this.vccNode = this.engine.createNode();
        this.vccNode.state = STATE_FLOAT; // Start floating until power is ON
        this.vccNode.isVCC = true;
        this.vccDriver = () => this.isPowered ? STATE_HIGH : STATE_FLOAT;
        this.engine.addDriver(this.vccNode.id, this.vccDriver);

        this.gndNode = this.engine.createNode();
        this.gndNode.state = STATE_FLOAT; // Start floating until power is ON
        this.gndNode.isGND = true;
        this.gndDriver = () => this.isPowered ? STATE_LOW : STATE_FLOAT;
        this.engine.addDriver(this.gndNode.id, this.gndDriver);

        // Register power rail pins
        this.wiring.registerPin('vcc', this.vccNode.id, 'POWER');
        this.wiring.registerPin('gnd', this.gndNode.id, 'POWER');
        this.wiring.registerPin('gnd-2', this.gndNode.id, 'POWER');

        // UI State
        this.isPowered = false;
        this.wireMode = 'drag';
        this.dragStart = null;
        this.tempWire = null;

        // History
        this.history = [];
        this.historyIndex = -1;

        this.init();
    }

    init() {
        this.setupPower();
        this.setupSwitches();
        this.setupLEDs();
        this.setupClock();
        this.setupBCDDecoder();
        this.setupMonoPulse();
        this.setupICModal();
        this.setupRemoveIC();
        this.setupWiringEvents();
        this.setupHistoryControls();

        // Start Simulation Loop
        this.startSimulation();
    }

    startSimulation() {
        const loop = () => {
            if (this.isPowered) {
                this.engine.step(10); // Run 10ns per frame
                this.updatePinStates(); // Update visual indicators
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    updatePinStates() {
        // Update all socket visual states based on their node states
        document.querySelectorAll('.socket[data-pin-id]').forEach(socket => {
            const pinId = socket.dataset.pinId;
            if (!pinId) return;

            const nodeId = this.wiring.pinToNodeId.get(pinId);

            if (!nodeId) {
                // Not connected to any node
                socket.classList.remove('state-high', 'state-low', 'state-float', 'state-error');
                return;
            }

            const node = this.engine.nodes.get(nodeId);
            if (!node) {
                socket.classList.remove('state-high', 'state-low', 'state-float', 'state-error');
                return;
            }

            // Force node resolution before checking state
            node.update();

            // Remove all state classes
            socket.classList.remove('state-high', 'state-low', 'state-float', 'state-error');

            // Add appropriate state class
            switch (node.state) {
                case STATE_HIGH:
                    socket.classList.add('state-high');
                    break;
                case STATE_LOW:
                    socket.classList.add('state-low');
                    break;
                case STATE_FLOAT:
                    socket.classList.add('state-float');
                    break;
                case STATE_ERROR:
                    socket.classList.add('state-error');
                    break;
            }
        });
    }

    setupHistoryControls() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        const clearBtn = document.getElementById('clear-log');


        undoBtn.addEventListener('click', () => this.undo());
        redoBtn.addEventListener('click', () => this.redo());
        if (clearBtn) clearBtn.addEventListener('click', () => {
            document.getElementById('activity-log').innerHTML = '';
        });



        this.updateHistoryUI();
    }

    pushAction(action) {
        // action: { type: 'addWire'|'removeWire'|'placeIC'|'removeIC', data: ... }
        // Remove redo stack
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        this.history.push(action);
        this.historyIndex++;
        this.updateHistoryUI();
    }

    undo() {
        if (this.historyIndex < 0) return;
        const action = this.history[this.historyIndex];
        this.historyIndex--;

        // Invert action
        switch (action.type) {
            case 'addWire':
                this.wiring.removeWire(action.data.id);
                this.removeWireUI(action.data.id);
                break;
            case 'removeWire':
                this.wiring.addWire(action.data.source, action.data.target, action.data.color, action.data.id); // restore with same ID if possible? WiringManager generates ID. 
                // Actually WiringManager.addWire doesn't take ID. We might need to handle this differently or just let it generate new ID.
                // For simple undo, functional equiv is fine.
                const newId = this.wiring.addWire(action.data.source, action.data.target, action.data.color);
                // We need to update the history item if we want to redo this specific one? 
                // No, when redoing 'removeWire', we need the ID.
                break;
            case 'placeIC':
                this.removeIC(action.data.socketId, false); // false = don't push history
                break;
            case 'removeIC':
                this.placeIC(action.data.name, document.getElementById(action.data.socketId), false);
                break;
        }
        this.updateHistoryUI();
    }

    redo() {
        if (this.historyIndex >= this.history.length - 1) return;
        this.historyIndex++;
        const action = this.history[this.historyIndex];

        switch (action.type) {
            case 'addWire':
                action.data.id = this.wiring.addWire(action.data.source, action.data.target, action.data.color);
                break;
            case 'removeWire':
                this.wiring.removeWire(action.data.id);
                this.removeWireUI(action.data.id);
                break;
            case 'placeIC':
                this.placeIC(action.data.name, document.getElementById(action.data.socketId), false);
                break;
            case 'removeIC':
                this.removeIC(action.data.socketId, false);
                break;
        }
        this.updateHistoryUI();
    }

    updateHistoryUI() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        if (undoBtn) undoBtn.disabled = this.historyIndex < 0;
        if (redoBtn) redoBtn.disabled = this.historyIndex >= this.history.length - 1;
    }

    setupPower() {
        const btn = document.getElementById('power-btn');
        const indicator = document.querySelector('.power-indicator');

        btn.addEventListener('click', () => {
            this.isPowered = !this.isPowered;
            btn.classList.toggle('active', this.isPowered);

            // Update power rail states
            this.vccNode.update();
            this.gndNode.update();

            // Update clock manager power state
            this.clockManager.setPower(this.isPowered);

            // Trigger re-evaluation of all ICs when power changes
            setTimeout(() => {
                this.icInstances.forEach(ic => {
                    ic.triggerEvaluation();
                });
            }, 0);

            if (this.isPowered) {
                indicator.style.backgroundColor = 'var(--color-success)';
                indicator.style.boxShadow = '0 0 20px rgba(48, 209, 88, 0.5)';
                this.log('System', '⚡', 'Power logic ON');
            } else {
                indicator.style.backgroundColor = '#e5e5e7';
                indicator.style.boxShadow = 'none';
                this.log('System', '⚡', 'Power logic OFF');
            }
        });

        // Power rails already registered in constructor
    }

    setupSwitches() {
        const container = document.getElementById('input-switches');
        container.innerHTML = '';

        for (let i = 0; i < 8; i++) {
            const group = document.createElement('div');
            group.className = 'switch-group';

            // Switch UI
            const box = document.createElement('div');
            box.className = 'switch-box';
            box.innerHTML = '<div class="switch-knob"></div>';

            // Output Socket
            const socket = document.createElement('div');
            socket.className = 'socket socket-green';
            socket.dataset.pinId = `switch-${i}`;

            // Label with binary weight (LSB-first: S0=1, S1=2, S2=4, ..., S7=128)
            const binaryWeights = [1, 2, 4, 8, 16, 32, 64, 128];
            const label = document.createElement('span');
            label.className = 'switch-number';
            label.innerHTML = `S${i}<br><small>${binaryWeights[i]}</small>`;

            group.append(box, socket, label);
            container.appendChild(group);

            // Logic
            const switchNode = this.engine.createNode();
            this.wiring.registerPin(`switch-${i}`, switchNode.id, 'OUTPUT');

            let switchState = STATE_LOW;

            // Driver function
            const switchDriver = () => this.isPowered ? switchState : STATE_FLOAT;
            this.engine.addDriver(switchNode.id, switchDriver);
            // Initialize node state
            switchNode.update();

            box.addEventListener('click', () => {
                box.classList.toggle('active');
                switchState = box.classList.contains('active') ? STATE_HIGH : STATE_LOW;
                // Immediately update node state and trigger propagation
                switchNode.update();
                this.engine.scheduleNodeUpdate(switchNode.id, 0); // Trigger update
            });
        }
    }

    setupLEDs() {
        const container = document.getElementById('output-leds');
        container.innerHTML = '';

        for (let i = 0; i < 8; i++) {
            const group = document.createElement('div');
            group.className = 'led-group';

            const led = document.createElement('div');
            led.className = 'led';
            led.id = `led-${i}`;

            const socket = document.createElement('div');
            socket.className = 'socket socket-red';
            socket.dataset.pinId = `led-${i}-in`;

            const label = document.createElement('span');
            label.className = 'led-number';
            label.innerText = `L${i}`;

            group.append(led, socket, label);
            container.appendChild(group);

            // Logic
            const ledNode = this.engine.createNode();
            this.wiring.registerPin(`led-${i}-in`, ledNode.id, 'INPUT');

            this.engine.addListener(ledNode.id, (state) => {
                console.log(`LED ${i} listener triggered, state: ${state === STATE_HIGH ? 'HIGH' : state === STATE_LOW ? 'LOW' : state === STATE_FLOAT ? 'FLOAT' : 'ERROR'}, powered: ${this.isPowered}`);
                if (!this.isPowered) {
                    led.className = 'led';
                    led.style.backgroundColor = '';
                    return;
                }
                if (state === STATE_HIGH) {
                    led.className = 'led on';
                    led.style.backgroundColor = '';
                    console.log(`LED ${i} turned ON`);
                } else if (state === STATE_ERROR) {
                    led.className = 'led on';
                    led.style.backgroundColor = 'purple';
                }
                else {
                    led.className = 'led';
                    led.style.backgroundColor = '';
                    console.log(`LED ${i} turned OFF (state: ${state})`);
                }
            });

            // Initial update
            ledNode.update();
        }
    }

    setupClock() {
        // Register clock GND pin
        this.wiring.registerPin('clock-gnd', this.gndNode.id, 'POWER');

        // Clock frequencies in Hz
        const frequencies = [
            { freq: 1, pinId: 'clock-1hz' },
            { freq: 10, pinId: 'clock-10hz' },
            { freq: 100, pinId: 'clock-100hz' },
            { freq: 1000, pinId: 'clock-1khz' },
            { freq: 10000, pinId: 'clock-10khz' }
        ];

        frequencies.forEach(({ freq, pinId }) => {
            const clockNode = this.engine.createNode();
            this.wiring.registerPin(pinId, clockNode.id, 'OUTPUT');
            this.clockManager.registerClock(freq, clockNode.id, pinId);
        });

        this.log('System', '⏱️', 'Clock generators initialized (1Hz to 10KHz)');
    }

    setupBCDDecoder() {
        const inputPins = ['bcd-a', 'bcd-b', 'bcd-c', 'bcd-d'];
        const outputPins = ['bcd-out-a', 'bcd-out-b', 'bcd-out-c', 'bcd-out-d'];
        const display = document.getElementById('bcd-display');

        // Create nodes for inputs
        const inputNodes = inputPins.map(pinId => {
            const node = this.engine.createNode();
            this.wiring.registerPin(pinId, node.id, 'INPUT');
            return { pinId, node };
        });

        // Create nodes for outputs and store output states
        const outputStates = [STATE_FLOAT, STATE_FLOAT, STATE_FLOAT, STATE_FLOAT];
        const outputNodes = outputPins.map((pinId, index) => {
            const node = this.engine.createNode();
            this.wiring.registerPin(pinId, node.id, 'OUTPUT');
            // Add driver for output node
            this.engine.addDriver(node.id, () => {
                return this.isPowered ? outputStates[index] : STATE_FLOAT;
            });
            return { pinId, node, index };
        });

        // Update function to decode BCD and update display
        const updateDecoder = () => {
            if (!this.isPowered) {
                display.querySelector('span').textContent = '--';
                outputStates.fill(STATE_FLOAT);
                outputNodes.forEach(({ node }) => this.engine.scheduleNodeUpdate(node.id, 0));
                return;
            }

            // Read BCD inputs (A=LSB, D=MSB)
            const a = inputNodes[0].node.state === STATE_HIGH ? 1 : 0;
            const b = inputNodes[1].node.state === STATE_HIGH ? 1 : 0;
            const c = inputNodes[2].node.state === STATE_HIGH ? 1 : 0;
            const d = inputNodes[3].node.state === STATE_HIGH ? 1 : 0;

            const bcdValue = d * 8 + c * 4 + b * 2 + a;

            // Update display
            if (bcdValue <= 9) {
                display.querySelector('span').textContent = bcdValue.toString();
            } else {
                display.querySelector('span').textContent = '--'; // Invalid BCD
            }

            // Update output pins (active LOW outputs for BCD decoder)
            // Output a = bit 0, b = bit 1, c = bit 2, d = bit 3
            const newOutputs = [
                (bcdValue & 1) === 0 ? STATE_LOW : STATE_HIGH, // a
                ((bcdValue >> 1) & 1) === 0 ? STATE_LOW : STATE_HIGH, // b
                ((bcdValue >> 2) & 1) === 0 ? STATE_LOW : STATE_HIGH, // c
                ((bcdValue >> 3) & 1) === 0 ? STATE_LOW : STATE_HIGH  // d
            ];

            // Update output states and trigger node updates
            let needsUpdate = false;
            outputNodes.forEach((out, i) => {
                if (outputStates[i] !== newOutputs[i]) {
                    outputStates[i] = newOutputs[i];
                    needsUpdate = true;
                    this.engine.scheduleNodeUpdate(out.node.id, 0);
                }
            });
        };

        // Add listeners to input nodes
        inputNodes.forEach(({ node }) => {
            this.engine.addListener(node.id, updateDecoder);
        });

        // Initial update
        updateDecoder();
    }

    setupSevenSegment() {
        const segmentPins = ['seg-a', 'seg-b', 'seg-c', 'seg-d', 'seg-e', 'seg-f', 'seg-g', 'seg-dp'];
        const display = document.getElementById('seven-seg-display');
        const displaySpan = display.querySelector('span');

        // Create nodes for segment inputs
        const segmentNodes = segmentPins.map(pinId => {
            const node = this.engine.createNode();
            this.wiring.registerPin(pinId, node.id, 'INPUT');
            return { pinId, node };
        });

        // Segment patterns for digits 0-9 (common cathode: LOW = ON)
        const patterns = {
            0: [0, 0, 0, 0, 0, 0, 1], // a,b,c,d,e,f on, g off
            1: [1, 0, 0, 1, 1, 1, 1], // b,c on
            2: [0, 0, 1, 0, 0, 1, 0], // a,b,d,e,g on
            3: [0, 0, 0, 0, 1, 1, 0], // a,b,c,d,g on
            4: [1, 0, 0, 1, 1, 0, 0], // b,c,f,g on
            5: [0, 1, 0, 0, 1, 0, 0], // a,c,d,f,g on
            6: [0, 1, 0, 0, 0, 0, 0], // a,c,d,e,f,g on
            7: [0, 0, 0, 1, 1, 1, 1], // a,b,c on
            8: [0, 0, 0, 0, 0, 0, 0], // all on
            9: [0, 0, 0, 0, 1, 0, 0]  // a,b,c,d,f,g on
        };

        // Update function to decode segments and update display
        const updateDisplay = () => {
            if (!this.isPowered) {
                displaySpan.textContent = ' ';
                return;
            }

            // Read segment states (common cathode: LOW = segment ON)
            const segments = segmentNodes.slice(0, 7).map(({ node }) =>
                node.state === STATE_LOW ? 1 : 0
            );
            const dp = segmentNodes[7].node.state === STATE_LOW;

            // Try to match pattern to a digit
            let digit = null;
            for (const [d, pattern] of Object.entries(patterns)) {
                if (pattern.every((val, i) => val === segments[i])) {
                    digit = d;
                    break;
                }
            }

            // Update display
            if (digit !== null) {
                displaySpan.textContent = dp ? digit + '.' : digit;
            } else {
                // Show custom character or blank
                displaySpan.textContent = dp ? '.' : ' ';
            }
        };

        // Add listeners to all segment nodes
        segmentNodes.forEach(({ node }) => {
            this.engine.addListener(node.id, updateDisplay);
        });

        // Initial update
        updateDisplay();
    }

    setupMonoPulse() {
        const pulseOutNode = this.engine.createNode();
        this.wiring.registerPin('pulse-out', pulseOutNode.id, 'OUTPUT');
        this.wiring.registerPin('pulse-gnd', this.gndNode.id, 'POWER');

        const pulseBtn = document.getElementById('pulse-btn');
        let pulseActive = false;

        // Driver function for pulse output
        this.engine.addDriver(pulseOutNode.id, () => {
            return this.isPowered && pulseActive ? STATE_HIGH : STATE_LOW;
        });

        pulseBtn.addEventListener('click', () => {
            if (!this.isPowered) {
                this.log('System', '⚠️', 'Power must be ON to generate pulse');
                return;
            }

            if (pulseActive) return; // Prevent multiple pulses

            pulseActive = true;
            pulseBtn.style.transform = 'scale(0.9)';
            pulseBtn.style.backgroundColor = 'var(--color-success)';

            this.engine.scheduleNodeUpdate(pulseOutNode.id, 0);
            this.log('System', '⚡', 'Mono pulse generated');

            // Reset after 100ms
            setTimeout(() => {
                pulseActive = false;
                pulseBtn.style.transform = '';
                pulseBtn.style.backgroundColor = '';
                this.engine.scheduleNodeUpdate(pulseOutNode.id, 0);
            }, 100);
        });
    }

    setupICModal() {
        const modal = document.getElementById('ic-modal');
        const grid = document.getElementById('available-ics');
        const addBtn = document.getElementById('add-ic-btn');
        const cancel = document.getElementById('modal-cancel');
        const confirm = document.getElementById('modal-confirm');

        let selectedIC = null;
        let targetSocket = null;

        // Populate Grid from registry
        icRegistry.getAll().forEach(icInfo => {
            const card = document.createElement('div');
            card.className = 'ic-card';
            card.innerHTML = `
                <div class="ic-card-name">${icInfo.id}</div>
                <div class="ic-card-desc">${icInfo.description}</div>
            `;
            card.onclick = () => {
                document.querySelectorAll('.ic-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedIC = icInfo.id;
                confirm.disabled = false;
            };
            grid.appendChild(card);
        });

        addBtn.addEventListener('click', () => {
            if (this.dragStart) return; // Don't open if dragging wire

            // Enter "Select Socket" mode
            document.querySelectorAll('.ic-socket').forEach(s => {
                if (!s.hasChildNodes()) {
                    s.classList.add('selectable');
                    s.onclick = () => {
                        targetSocket = s;
                        modal.classList.add('show');
                        // Cleanup
                        document.querySelectorAll('.ic-socket').forEach(x => {
                            x.classList.remove('selectable');
                            x.onclick = null;
                        });
                    };
                }
            });
            this.log('System', 'ℹ️', 'Select an empty socket to place IC.');
        });

        cancel.onclick = () => modal.classList.remove('show');

        confirm.onclick = () => {
            if (selectedIC && targetSocket) {
                this.placeIC(selectedIC, targetSocket, true);
                modal.classList.remove('show');
            }
        };
    }

    setupRemoveIC() {
        const removeBtn = document.getElementById('remove-ic-btn');

        removeBtn.addEventListener('click', () => {
            // Enter "Select IC to Remove" mode
            const occupiedSockets = Array.from(document.querySelectorAll('.ic-socket'))
                .filter(s => s.hasChildNodes());

            if (occupiedSockets.length === 0) {
                this.log('System', 'ℹ️', 'No ICs to remove.');
                return;
            }

            occupiedSockets.forEach(s => {
                s.classList.add('selectable-remove');
                s.style.cursor = 'pointer';
                s.style.outline = '2px solid var(--color-danger)';

                const clickHandler = () => {
                    this.removeIC(s.id);
                    // Cleanup all sockets
                    document.querySelectorAll('.ic-socket').forEach(x => {
                        x.classList.remove('selectable-remove');
                        x.style.cursor = '';
                        x.style.outline = '';
                        x.onclick = null;
                    });
                };

                s.onclick = clickHandler;
            });

            this.log('System', 'ℹ️', 'Click on an IC to remove it.');
        });
    }

    placeIC(icName, socketElement, pushHistory = true) {
        const socketId = socketElement.id;
        const ic = icRegistry.create(icName, socketId);
        if (!ic) return;

        this.icInstances.set(socketId, ic);

        // Adjust ZIF height based on pins:
        // 14 pins = 7 per side. 7*16 + 6*11 = 178px approx.
        // 16 pins = 8 per side. 8*16 + 7*11 = 128+77 = 205px.
        // Base height 180px fits 14 pins.
        const baseHeight = 180;
        const extraPerPin = 27; // 16px pin + 11px gap
        const sidePins = ic.pinCount / 2;
        const extraPins = Math.max(0, sidePins - 7);
        const dynamicHeight = baseHeight + (extraPins * extraPerPin);

        socketElement.innerHTML = `
            <div class="zif-body" style="height: ${dynamicHeight}px;">
                <div class="zif-lever"></div>
                <div class="ic-pin-container left"></div>
                <div class="ic-pin-container right"></div>
                <div class="ic-name-label" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-90deg); color: white; font-weight: bold; font-family: monospace;">${icName}</div>
                <div class="ic-notch" style="position: absolute; top: 4px; left: 50%; transform: translateX(-50%); width: 10px; height: 10px; background: rgba(0,0,0,0.3); border-radius: 50%;"></div>
            </div>
        `;

        const leftPins = socketElement.querySelector('.left');
        const rightPins = socketElement.querySelector('.right');

        // Real DIP IC layout (counter-clockwise pin numbering):
        // CSS: .right container is visually on LEFT, .left container is visually on RIGHT
        // So: put pins 1-7 in 'right' container, pins 14-8 in 'left' container

        // Right container (visually LEFT side): 1, 2, 3, 4, 5, 6, 7 (or 8 for 16-pin)
        for (let i = 1; i <= sidePins; i++) {
            this.createPinUI(rightPins, i, socketId);
        }

        // Left container (visually RIGHT side): 14, 13, 12, 11, 10, 9, 8 (or 16, 15, 14... for 16-pin)
        for (let i = ic.pinCount; i > sidePins; i--) {
            this.createPinUI(leftPins, i, socketId);
        }

        // Auto-connect VCC and GND pins to power rails (like physical trainer)
        const vccPinId = `${socketId}-pin-${ic.vccPin}`;
        const gndPinId = `${socketId}-pin-${ic.gndPin}`;

        console.log(`[DEBUG] Before power wires - VCC rail node:`, this.vccNode.id, 'drivers:', this.vccNode.drivers.size);
        console.log(`[DEBUG] Before power wires - GND rail node:`, this.gndNode.id, 'drivers:', this.gndNode.drivers.size);

        // Connect VCC pin to VCC rail
        const vccWireId = this.wiring.addWire(vccPinId, 'vcc', '#ff3b30');
        if (vccWireId) {
            this.drawWire({ id: vccWireId, source: vccPinId, target: 'vcc', color: '#ff3b30' });
            this.log('Wire', '🔗', `Auto-connected ${icName} VCC (pin ${ic.vccPin}) to +5V`);
            // Update IC's VCC pin node reference to merged node
            const vccNodeId = this.wiring.pinToNodeId.get(vccPinId);
            console.log(`[DEBUG] After VCC wire - merged node ID:`, vccNodeId);
            if (vccNodeId) {
                const vccNode = this.engine.nodes.get(vccNodeId);
                console.log(`[DEBUG] VCC merged node:`, vccNode?.id, 'drivers:', vccNode?.drivers.size, 'state:', vccNode?.state);
                if (vccNode) {
                    ic.setPinNode(ic.vccPin, vccNode);
                    console.log(`[DEBUG] Set IC VCC pin ${ic.vccPin} to node`, vccNode.id);
                }
            }
        }

        // Connect GND pin to GND rail
        const gndWireId = this.wiring.addWire(gndPinId, 'gnd', '#000000');
        if (gndWireId) {
            this.drawWire({ id: gndWireId, source: gndPinId, target: 'gnd', color: '#000000' });
            this.log('Wire', '🔗', `Auto-connected ${icName} GND (pin ${ic.gndPin}) to GND`);
            // Update IC's GND pin node reference to merged node
            const gndNodeId = this.wiring.pinToNodeId.get(gndPinId);
            console.log(`[DEBUG] After GND wire - merged node ID:`, gndNodeId);
            if (gndNodeId) {
                const gndNode = this.engine.nodes.get(gndNodeId);
                console.log(`[DEBUG] GND merged node:`, gndNode?.id, 'drivers:', gndNode?.drivers.size, 'state:', gndNode?.state);
                if (gndNode) {
                    ic.setPinNode(ic.gndPin, gndNode);
                    console.log(`[DEBUG] Set IC GND pin ${ic.gndPin} to node`, gndNode.id);
                }
            }
        }

        // Initialize IC Logic (after power connections are made and pin nodes updated)
        ic.setup(this.engine);

        // Enable debug mode for LS08 (can be toggled)
        if (icName === '74LS08') {
            ic.setDebug(true);
        }

        // Trigger initial evaluation after a short delay to ensure all nodes are connected
        setTimeout(() => {
            ic.triggerEvaluation();
        }, 10);

        this.log('IC', '🧩', `Placed ${icName} in ${socketId}`);

        if (pushHistory) {
            this.pushAction({ type: 'placeIC', data: { name: icName, socketId: socketId } });
        }
    }

    removeIC(socketId, pushHistory = true) {
        const socketElement = document.getElementById(socketId);
        if (!socketElement) return;

        const ic = this.icInstances.get(socketId);
        if (ic) {
            const name = ic.name;

            console.log('[DEBUG] Removing IC:', name, 'from socket:', socketId);

            // Remove all wires connected to this IC's pins
            const icPinPrefix = `${socketId}-pin-`;
            const wiresToRemove = [];

            console.log('[DEBUG] Looking for wires with prefix:', icPinPrefix);
            console.log('[DEBUG] Total wires in circuit:', this.wiring.wires.length);

            // Find all wires connected to this IC
            this.wiring.wires.forEach(wire => {
                console.log('[DEBUG] Checking wire:', wire.id, 'source:', wire.source, 'target:', wire.target);
                if (wire.source.startsWith(icPinPrefix) || wire.target.startsWith(icPinPrefix)) {
                    console.log('[DEBUG] Found wire to remove:', wire.id);
                    wiresToRemove.push(wire.id);
                }
            });

            console.log('[DEBUG] Total wires to remove:', wiresToRemove.length);

            // Remove the wires
            wiresToRemove.forEach(wireId => {
                console.log('[DEBUG] Removing wire:', wireId);
                this.wiring.removeWire(wireId);
                this.removeWireUI(wireId);
            });

            // ADDITIONAL CLEANUP: Remove any orphaned wire visual elements
            // This catches any SVG paths that might have been missed
            const svg = document.getElementById('wire-layer');
            console.log('[DEBUG] Checking for orphaned wires in SVG:', !!svg);
            if (svg) {
                const allPaths = svg.querySelectorAll('.wire-path');
                console.log('[DEBUG] Total wire paths in SVG:', allPaths.length);
                allPaths.forEach(path => {
                    const wireId = path.id;
                    // Check if this wire still exists in the wiring manager
                    const wireExists = this.wiring.wires.some(w => w.id === wireId);
                    if (!wireExists) {
                        console.log('[DEBUG] Removing orphaned wire visual:', wireId);
                        path.remove();
                    }
                });
            }

            if (wiresToRemove.length > 0) {
                this.log('Wire', '✂️', `Removed ${wiresToRemove.length} wire(s) connected to ${name}`);
            }

            this.icInstances.delete(socketId);
            socketElement.innerHTML = '';

            if (pushHistory) {
                this.pushAction({ type: 'removeIC', data: { name, socketId } });
            }
            this.log('IC', '❌', `Removed ${name}`);
        }
    }

    createPinUI(container, pinNum, socketId) {
        const pinId = `${socketId}-pin-${pinNum}`;
        const row = document.createElement('div');
        // If pin count > 14, side split logic handles it, simply checking pinNum vs sidePins
        // But for assigning class 'right' or 'left' inner check...
        // Actually the container determines side. 
        row.className = `ic-pin`;

        const socket = document.createElement('div');
        socket.className = 'socket socket-black';
        socket.dataset.pinId = pinId;
        socket.title = `Pin ${pinNum}`;

        const label = document.createElement('span');
        label.className = 'pin-number';
        label.innerText = pinNum;

        row.append(socket, label);
        container.appendChild(row);

        // Logic
        const node = this.engine.createNode();
        const ic = this.icInstances.get(socketId);

        // Get pin type from IC
        const pinType = ic.pinTypes[pinNum] || 'INPUT';
        this.wiring.registerPin(pinId, node.id, pinType, ic);

        ic.setPinNode(pinNum, node);
    }

    log(type, icon, msg) {
        const log = document.getElementById('activity-log');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type.toLowerCase()}`;
        entry.innerHTML = `
            <span class="log-time">${new Date().toLocaleTimeString()}</span>
            <span class="log-icon">${icon}</span>
            <span class="log-text">${msg}</span>
        `;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }

    setupWiringEvents() {
        this.wiring.onWireAdded = (wire) => {
            this.drawWire(wire);
            this.log('Wire', '🔗', `Connected ${wire.source} to ${wire.target}`);
        };

        this.wiring.onWireError = (sourcePin, targetPin, error) => {
            this.log('Wire', '⚠️', `Wiring error: ${error}`);
        };

        this.wiring.onNetUpdate = (pins, newNode) => {
            pins.forEach(pinId => {
                // Handle IC pins: format is "ic-X-pin-Y"
                if (pinId.startsWith('ic-')) {
                    const parts = pinId.split('-');
                    if (parts.length >= 4 && parts[2] === 'pin') {
                        const icId = `${parts[0]}-${parts[1]}`;
                        const pinNum = parseInt(parts[3]);
                        const ic = this.icInstances.get(icId);
                        if (ic && !isNaN(pinNum)) {
                            ic.setPinNode(pinNum, newNode);
                            // Trigger re-evaluation after pin node update
                            setTimeout(() => {
                                ic.triggerEvaluation();
                            }, 0);
                        }
                    }
                }
            });

            // After merging nodes, force update to notify all listeners (including LEDs)
            // This ensures LEDs get updated when a wire connects them to an output
            setTimeout(() => {
                newNode.update();
                // Also force notification if state didn't change but listeners need update
                const resolvedState = newNode.resolve();
                if (resolvedState !== STATE_FLOAT) {
                    for (const listener of newNode.listeners) {
                        listener(resolvedState);
                    }
                }
            }, 0);
        };

        // Wire Mode Selection
        const dragBtn = document.getElementById('drag-wire-btn');
        const clickBtn = document.getElementById('click-wire-btn');
        const removeBtn = document.getElementById('remove-wire-btn');

        // Default to drag mode
        this.wireMode = 'drag';
        if (dragBtn) dragBtn.classList.add('active');

        if (dragBtn) dragBtn.addEventListener('click', () => {
            this.wireMode = 'drag';
            dragBtn.classList.add('active');
            clickBtn.classList.remove('active');
            removeBtn.classList.remove('active');
            this.selectedWire = null;
            document.querySelectorAll('.socket.wire-source').forEach(el => el.classList.remove('wire-source'));
        });

        if (clickBtn) clickBtn.addEventListener('click', () => {
            this.wireMode = 'click';
            clickBtn.classList.add('active');
            dragBtn.classList.remove('active');
            removeBtn.classList.remove('active');
        });

        if (removeBtn) removeBtn.addEventListener('click', () => {
            this.wireMode = 'remove';
            removeBtn.classList.add('active');
            dragBtn.classList.remove('active');
            clickBtn.classList.remove('active');
        });

        // Combined Mouse Handler
        document.addEventListener('mousedown', (e) => {
            const socket = e.target.closest('.socket');

            // 1. Click-to-Connect Mode
            if (this.wireMode === 'click' && socket) {
                this.handleSocketClick(socket);
                return;
            }

            // 2. Drag Mode
            if (this.wireMode === 'drag' && socket) {
                e.preventDefault();
                this.startDragging(socket);
                return;
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.dragStart) {
                this.updateDragLine(e);
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.dragStart) {
                const socket = e.target.closest('.socket');
                if (socket && socket.dataset.pinId !== this.dragStart.dataset.pinId) {
                    this.finishDragging(socket);
                } else {
                    this.cancelDragging();
                }
            }
        });

        // Global Context Menu Delegate
        document.addEventListener('contextmenu', (e) => {
            console.log('Context menu triggered on:', e.target);

            // 1. Check for Wire Removal
            const path = e.composedPath().find(el => el.classList && el.classList.contains('wire-path'));
            if (path) {
                console.log('Wire path detected:', path.id);
                e.preventDefault();
                const wireId = path.id;
                const wire = this.wiring.wires.find(w => w.id === wireId);
                if (wire) {
                    this.removeWire(wireId);
                    this.pushAction({ type: 'removeWire', data: wire });
                }
                return;
            }

            // 2. Check for IC Removal (Right-click on IC Body or any child)
            const icBody = e.target.closest('.zif-body');
            if (icBody) {
                console.log('IC body detected');
                e.preventDefault();
                const socketElement = icBody.parentElement;
                if (socketElement && socketElement.id) {
                    console.log('Removing IC from:', socketElement.id);
                    this.removeIC(socketElement.id);
                }
                return;
            }
        }, true); // Use capture phase to ensure we catch the event

        document.addEventListener('click', (e) => {
            // Handle "Remove Wire" mode clicks
            if (this.wireMode === 'remove') {
                const path = e.target.closest('.wire-path');
                if (path) {
                    const wireId = path.id;
                    const wire = this.wiring.wires.find(w => w.id === wireId);
                    if (wire) {
                        this.removeWire(wireId);
                        this.pushAction({ type: 'removeWire', data: wire });
                    }
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.cancelDragging();
                this.selectedWire = null;
                document.querySelectorAll('.socket.wire-source').forEach(el => el.classList.remove('wire-source'));
            }
        });

        // Setup Theme Toggle
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const isDark = document.body.parentElement.getAttribute('data-theme') === 'dark';
                document.body.parentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
            });
        }
    }

    handleSocketClick(socketEl) {
        const pinId = socketEl.dataset.pinId;
        if (!pinId) return;

        if (!this.selectedWire) {
            this.selectedWire = pinId;
            socketEl.classList.add('wire-source');
        } else {
            const source = this.selectedWire;
            const target = pinId;

            // Remove source highlight
            document.querySelectorAll('.socket.wire-source').forEach(el => el.classList.remove('wire-source'));
            this.selectedWire = null;

            if (source !== target) {
                const wireId = this.wiring.addWire(source, target);
                if (wireId) {
                    this.pushAction({
                        type: 'addWire',
                        data: { id: wireId, source, target, color: '#0071e3' }
                    });
                }
            }
        }
    }

    startDragging(socketEl) {
        this.dragStart = socketEl;
        socketEl.classList.add('wire-source');

        const svg = document.getElementById('wire-layer');
        // Ensure SVG is top-most or accessible
        // Actually, during drag we want to hit targets BEHIND the SVG?
        // Yes, sockets are DOM elements. If SVG is on top, it blocks clicks.
        // But wires need to be clickable.
        // Solution: SVG pointer-events: none, but PATHs pointer-events: stroke.

        this.tempWire = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.tempWire.setAttribute('class', 'wire-drag');
        this.tempWire.setAttribute('stroke', 'var(--color-accent)');
        this.tempWire.setAttribute('fill', 'none');
        this.tempWire.setAttribute('stroke-width', '3');
        this.tempWire.setAttribute('stroke-dasharray', '5,5');
        // Set temp wire to ignore mouse 
        this.tempWire.style.pointerEvents = 'none';

        svg.appendChild(this.tempWire);
    }

    updateDragLine(e) {
        if (!this.tempWire || !this.dragStart) return;

        const start = this.getSocketCenter(this.dragStart);
        const containerRect = document.querySelector('.board-container').getBoundingClientRect();

        // Offset by scroll position if needed, but getBoundingClientRect accounts for viewport
        // We need coordinates relative to board-container.
        const end = {
            x: e.clientX - containerRect.left,
            y: e.clientY - containerRect.top
        };

        const d = this.getWirePath(start, end);
        this.tempWire.setAttribute('d', d);
    }

    finishDragging(endSocket) {
        const sourceId = this.dragStart.dataset.pinId;
        const targetId = endSocket.dataset.pinId;

        const wireId = this.wiring.addWire(sourceId, targetId);
        if (wireId) {
            this.pushAction({
                type: 'addWire',
                data: { id: wireId, source: sourceId, target: targetId, color: '#0071e3' }
            });
        }

        this.cancelDragging();
    }

    cancelDragging() {
        if (this.dragStart) {
            this.dragStart.classList.remove('wire-source');
        }
        if (this.tempWire) {
            this.tempWire.remove();
        }
        this.dragStart = null;
        this.tempWire = null;
    }

    getSocketCenter(el) {
        const rect = el.getBoundingClientRect();
        const containerRect = document.querySelector('.board-container').getBoundingClientRect();
        return {
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top + rect.height / 2
        };
    }

    getWirePath(start, end) {
        // Bezier Curve Logic for "Rounded" look
        const dist = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
        const controlOffset = Math.min(dist * 0.5, 80);
        // Vertical priority for control points
        return `M ${start.x} ${start.y} C ${start.x} ${start.y + controlOffset}, ${end.x} ${end.y + controlOffset}, ${end.x} ${end.y}`;
    }

    drawWire(wire) {
        const svg = document.getElementById('wire-layer');
        const sourceEl = document.querySelector(`[data-pin-id="${wire.source}"]`);
        const targetEl = document.querySelector(`[data-pin-id="${wire.target}"]`);

        if (!sourceEl || !targetEl) return;

        const start = this.getSocketCenter(sourceEl);
        const end = this.getSocketCenter(targetEl);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const d = this.getWirePath(start, end);

        path.setAttribute('d', d);
        path.setAttribute('class', 'wire-path');
        path.setAttribute('stroke', wire.color);
        path.setAttribute('fill', 'none');
        path.setAttribute('id', wire.id);
        path.setAttribute('stroke-width', '4');
        path.setAttribute('stroke-linecap', 'round');

        // Critical for interaction:
        path.style.cursor = 'pointer';
        path.style.pointerEvents = 'stroke'; // Only click the line itself

        path.addEventListener('mouseenter', () => {
            path.setAttribute('stroke-width', '8');
            path.setAttribute('stroke', 'var(--color-danger)'); // Highlight on hover
        });
        path.addEventListener('mouseleave', () => {
            path.setAttribute('stroke-width', '4');
            path.setAttribute('stroke', wire.color);
        });

        svg.appendChild(path);
    }

    removeWireUI(wireId) {
        const el = document.getElementById(wireId);
        console.log('[DEBUG] removeWireUI called for:', wireId, 'element found:', !!el);
        if (el) {
            el.remove();
            console.log('[DEBUG] Wire UI element removed from DOM');
        } else {
            console.log('[DEBUG] WARNING: Wire UI element not found in DOM!');
        }
    }

    /**
     * Remove a wire by ID
     */
    removeWire(wireId) {
        console.log('[DEBUG] removeWire called with wireId:', wireId);
        console.log('[DEBUG] Wiring manager wires:', this.wiring.wires);
        this.wiring.removeWire(wireId);
        this.removeWireUI(wireId);
        this.log('Wire', '✂️', 'Wire removed');
        console.log('[DEBUG] Wire removed successfully');
    }

}

// Start Controller when DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    window.controller = new SystemController();

    // Global debug function for ICs
    window.debugIC = (icName) => {
        const ic = Array.from(window.controller.icInstances.values())
            .find(chip => chip.name === icName || chip.id.includes(icName));
        if (ic) {
            ic.setDebug(true);
            console.log(`Debug enabled for ${ic.name} (${ic.id})`);
            console.log('Power status:', ic.isPowered());
            console.log('Pin states:', ic.getPinConfig());
            return ic;
        } else {
            console.log('IC not found. Available ICs:',
                Array.from(window.controller.icInstances.values()).map(c => c.name));
            return null;
        }
    };

    // Global function to check IC state
    window.checkIC = (icName) => {
        const ic = Array.from(window.controller.icInstances.values())
            .find(chip => chip.name === icName || chip.id.includes(icName));
        if (ic) {
            // Force node updates before checking
            const vccNode = ic.getPinNode(ic.vccPin);
            const gndNode = ic.getPinNode(ic.gndPin);
            if (vccNode) vccNode.update();
            if (gndNode) gndNode.update();

            console.log(`=== ${ic.name} (${ic.id}) ===`);
            console.log('System Power:', window.controller.isPowered);
            console.log('IC Powered:', ic.isPowered());
            console.log('VCC pin:', ic.vccPin, 'Node:', vccNode?.id, 'State:', vccNode?.state,
                vccNode?.state === STATE_HIGH ? '(HIGH ✓)' : vccNode?.state === STATE_FLOAT ? '(FLOAT - Turn ON Power!)' : '(LOW ✗)');
            console.log('GND pin:', ic.gndPin, 'Node:', gndNode?.id, 'State:', gndNode?.state,
                gndNode?.state === STATE_LOW ? '(LOW ✓)' : gndNode?.state === STATE_FLOAT ? '(FLOAT - Turn ON Power!)' : '(HIGH ✗)');
            console.log('Output states:', Object.fromEntries(ic.outputStates));
            console.log('\nPin States:');
            for (let pin = 1; pin <= ic.pinCount; pin++) {
                const node = ic.getPinNode(pin);
                const pinType = ic.pinTypes[pin];
                if (node && (pinType === 'INPUT' || pinType === 'OUTPUT')) {
                    node.update(); // Force update
                    const state = node.state;
                    const stateStr = state === STATE_HIGH ? 'HIGH' : state === STATE_LOW ? 'LOW' : state === STATE_FLOAT ? 'FLOAT' : 'ERROR';
                    const inputState = pinType === 'INPUT' ? ic.getInputState(pin) : null;
                    const inputStr = inputState !== null ? ` (reads as: ${inputState === STATE_HIGH ? 'HIGH' : inputState === STATE_LOW ? 'LOW' : 'FLOAT'})` : '';
                    console.log(`  Pin ${pin} (${pinType}): ${stateStr}${inputStr}`);
                }
            }
            console.log('\nTo fix: Click the Power button (top-left) to turn ON power!');
            return ic;
        }
        return null;
    };

    // Global function to turn power ON/OFF
    window.setPower = (on) => {
        if (window.controller.isPowered !== on) {
            document.getElementById('power-btn').click();
        }
        console.log(`Power is now ${window.controller.isPowered ? 'ON' : 'OFF'}`);
    };

    // Global function to test LED connection
    window.testLED = (ledIndex, pinId) => {
        const ledNodeId = window.controller.wiring.pinToNodeId.get(`led-${ledIndex}-in`);
        const pinNodeId = window.controller.wiring.pinToNodeId.get(pinId);

        console.log(`Testing LED ${ledIndex} connection:`);
        console.log(`  LED node ID: ${ledNodeId}`);
        console.log(`  Pin node ID: ${pinNodeId}`);
        console.log(`  Connected: ${ledNodeId === pinNodeId}`);

        if (ledNodeId) {
            const ledNode = window.controller.engine.nodes.get(ledNodeId);
            if (ledNode) {
                ledNode.update();
                console.log(`  LED node state: ${ledNode.state === STATE_HIGH ? 'HIGH' : ledNode.state === STATE_LOW ? 'LOW' : 'FLOAT'}`);
                console.log(`  LED node drivers: ${ledNode.drivers.size}`);
                console.log(`  LED node listeners: ${ledNode.listeners.size}`);
                if (ledNode.drivers.size > 0) {
                    const driverVal = Array.from(ledNode.drivers)[0]();
                    console.log(`  Driver returns: ${driverVal === STATE_HIGH ? 'HIGH' : driverVal === STATE_LOW ? 'LOW' : 'FLOAT'}`);
                }
            }
        }

        if (pinNodeId) {
            const pinNode = window.controller.engine.nodes.get(pinNodeId);
            if (pinNode) {
                pinNode.update();
                console.log(`  Pin node state: ${pinNode.state === STATE_HIGH ? 'HIGH' : pinNode.state === STATE_LOW ? 'LOW' : 'FLOAT'}`);
                console.log(`  Pin node drivers: ${pinNode.drivers.size}`);
            }
        }
    };

    // Setup Copy Log button
    const copyLogBtn = document.getElementById('copy-log');
    if (copyLogBtn) {
        copyLogBtn.addEventListener('click', () => {
            const logContainer = document.getElementById('activity-log');
            if (!logContainer) return;

            // Extract log text
            const logEntries = logContainer.querySelectorAll('.log-entry');
            const logText = Array.from(logEntries).map(entry => {
                const time = entry.querySelector('.log-time')?.textContent || '';
                const icon = entry.querySelector('.log-icon')?.textContent || '';
                const text = entry.querySelector('.log-text')?.textContent || '';
                return `${time} ${icon} ${text}`.trim();
            }).join('\n');

            // Copy to clipboard
            navigator.clipboard.writeText(logText).then(() => {
                // Visual feedback
                const originalText = copyLogBtn.textContent;
                copyLogBtn.textContent = 'Copied!';
                copyLogBtn.style.background = 'var(--color-success)';
                copyLogBtn.style.color = 'white';

                setTimeout(() => {
                    copyLogBtn.textContent = originalText;
                    copyLogBtn.style.background = '';
                    copyLogBtn.style.color = '';
                }, 2000);

                window.controller.log('System', '📋', 'Activity log copied to clipboard');
            }).catch(err => {
                console.error('Failed to copy log:', err);
                window.controller.log('Error', '⚠️', 'Failed to copy log to clipboard');
            });
        });
    }
});
