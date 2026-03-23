/**
 * Web IC Trainer - Main UI Controller
 * Integrates Simulation, Wiring, and UI interactions.
 */

import { CircuitEngine, STATE_LOW, STATE_HIGH, STATE_FLOAT, STATE_ERROR } from './simulation.js';
import { WiringManager } from './wiring-engine.js';
import { icRegistry } from './ic-registration.js';
import { ClockManager } from './clock-manager.js';
import { PIN_TYPE } from './ttl-chip.js';

const DATASHEET_URLS = {
    '74LS00': 'https://www.futurlec.com/Datasheet/74ls/74LS00.pdf',
    '74LS02': 'https://www.futurlec.com/Datasheet/74ls/74LS02.pdf',
    '74LS04': 'https://www.futurlec.com/Datasheet/74ls/74LS04.pdf',
    '74LS08': 'https://www.futurlec.com/Datasheet/74ls/74LS08.pdf',
    '74LS32': 'https://www.futurlec.com/Datasheet/74ls/74LS32.pdf',
    '74LS86': 'https://www.futurlec.com/Datasheet/74ls/74LS86.pdf',
    '74LS74': 'https://www.futurlec.com/Datasheet/74ls/74LS74.pdf',
    '74LS76': 'https://www.futurlec.com/Datasheet/74ls/74LS76.pdf',
    '74LS90': 'https://www.futurlec.com/Datasheet/74ls/74LS90.pdf',
    '74LS93': 'https://www.futurlec.com/Datasheet/74ls/74LS93.pdf',
    '74LS138': 'https://www.futurlec.com/Datasheet/74ls/74LS138.pdf',
    '74LS47': 'https://www.futurlec.com/Datasheet/74ls/74LS47.pdf',
    '74LS151': 'https://www.futurlec.com/Datasheet/74ls/74LS151.pdf',
    '74LS153': 'https://www.futurlec.com/Datasheet/74ls/74LS153.pdf',
    '74LS157': 'https://www.jameco.com/Jameco/Products/ProdDS/301612-DS01.pdf',
    '74LS283': 'https://www.futurlec.com/Datasheet/74ls/74LS283.pdf'
};

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

        this.pinDrivers = new Map();
        this.pinListeners = new Map();

        this.pinDrivers.set('vcc', this.vccDriver);
        this.pinDrivers.set('gnd', this.gndDriver);
        this.pinDrivers.set('gnd-2', this.gndDriver);

        // UI State
        this.isPowered = false;
        this.wireMode = 'drag';
        this.dragStart = null;
        this.tempWire = null;

        // History
        this.history = [];
        this.historyIndex = -1;
        this.currentPresetId = null;
        this.presetExperiments = [];
        this.expressionMeta = null;
        this.preventImportedPresetPollution = true;
        this._missingDatasheetWarnings = new Set();

        this.waveform = {
            running: true,
            sampleIntervalMs: 40,
            timeWindowMs: 8000,
            lastSampleAt: 0,
            colors: ['#00e5ff', '#00ffa3', '#ffd166', '#ff6b6b', '#c77dff', '#72efdd', '#f4a261'],
            channels: [],
            signalOptions: []
        };

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
        this.setupPresetExperiments();
        this.setupCircuitJsonIO();
        this.setupTruthTableGenerator();
        this.setupCodeGenerators();
        this.setupExpressionBuilder();
        this.setupWaveformViewer();
        this.setupRemoveIC();
        this.setupWiringEvents();
        this.setupHistoryControls();

        // Start Simulation Loop
        this.startSimulation();
    }

    startSimulation() {
        const loop = (now) => {
            if (this.isPowered) {
                this.engine.step(10); // Run 10ns per frame
                this.updatePinStates(); // Update visual indicators
            }

            const t = typeof now === 'number' ? now : performance.now();
            this.captureWaveformSample(t);
            this.refreshWaveformChannelValues();
            this.renderWaveformViewer();

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
            this.pinDrivers.set(`switch-${i}`, switchDriver);
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
            led.id = 'led-' + i;

            const socket = document.createElement('div');
            socket.className = 'socket socket-red';
            socket.dataset.pinId = 'led-' + i + '-in';

            const label = document.createElement('span');
            label.className = 'led-number';
            label.innerText = 'L' + i;

            group.append(led, socket, label);
            container.appendChild(group);

            // Logic
            const ledNode = this.engine.createNode();
            const ledPinId = 'led-' + i + '-in';
            this.wiring.registerPin(ledPinId, ledNode.id, 'INPUT');

            const ledListener = (state) => {
                if (!this.isPowered) {
                    led.className = 'led';
                    led.style.backgroundColor = '';
                    return;
                }

                if (state === STATE_HIGH) {
                    led.className = 'led on';
                    led.style.backgroundColor = '';
                } else if (state === STATE_ERROR) {
                    led.className = 'led on';
                    led.style.backgroundColor = 'purple';
                } else {
                    led.className = 'led';
                    led.style.backgroundColor = '';
                }
            };

            this.engine.addListener(ledNode.id, ledListener);
            this.pinListeners.set(ledPinId, ledListener);

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
        const pulseDriver = () => this.isPowered && pulseActive ? STATE_HIGH : STATE_LOW;
        this.engine.addDriver(pulseOutNode.id, pulseDriver);
        this.pinDrivers.set('pulse-out', pulseDriver);

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

        const isValidDatasheetUrl = (value) => {
            if (typeof value !== 'string') return false;
            const trimmed = value.trim();
            if (!trimmed) return false;
            try {
                const parsed = new URL(trimmed, window.location.origin);
                return ['http:', 'https:', 'file:'].includes(parsed.protocol);
            } catch (_) {
                return false;
            }
        };

        // Populate Grid from registry
        icRegistry.getAll().forEach(icInfo => {
            const card = document.createElement('div');
            card.className = 'ic-card';
            const datasheetUrl = DATASHEET_URLS[icInfo.id];
            const hasDatasheet = isValidDatasheetUrl(datasheetUrl);
            card.innerHTML = `
                <div class="ic-card-name">${icInfo.id}</div>
                <div class="ic-card-desc">${icInfo.description}</div>
                ${hasDatasheet
                    ? `<a class="ic-card-datasheet" href="${datasheetUrl}" target="_blank" rel="noopener noreferrer">View Datasheet</a>`
                    : `<span class="ic-card-datasheet disabled">Datasheet unavailable</span>`
                }
            `;
            card.onclick = () => {
                document.querySelectorAll('.ic-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedIC = icInfo.id;
                confirm.disabled = false;
            };

            const datasheetLink = card.querySelector('.ic-card-datasheet');
            if (datasheetLink) {
                datasheetLink.addEventListener('click', (event) => {
                    event.stopPropagation();
                    if (!hasDatasheet) {
                        event.preventDefault();
                    }
                });
            }

            if (!hasDatasheet && !this._missingDatasheetWarnings.has(icInfo.id)) {
                this._missingDatasheetWarnings.add(icInfo.id);
                console.warn(`[Datasheet] Missing/invalid datasheet URL for ${icInfo.id}`);
            }

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

    setupPresetExperiments() {
        const modal = document.getElementById('preset-modal');
        const grid = document.getElementById('preset-grid');
        const openBtn = document.getElementById('run-preset-btn');
        const cancelBtn = document.getElementById('preset-cancel');
        const runBtn = document.getElementById('preset-run');

        if (!modal || !grid || !openBtn || !cancelBtn || !runBtn) return;

        const builtInPresets = [
            {
                id: 'and-gate',
                title: 'AND Gate Truth Table (74LS08)',
                description: 'S0,S1 -> AND -> L0',
                load: () => {
                    this.placeIC('74LS08', document.getElementById('ic-1'), false);
                    this.connectPins('switch-0', 'ic-1-pin-1');
                    this.connectPins('switch-1', 'ic-1-pin-2');
                    this.connectPins('ic-1-pin-3', 'led-0-in');
                }
            },
            {
                id: 'or-gate',
                title: 'OR Gate Truth Table (74LS32)',
                description: 'S0,S1 -> OR -> L0',
                load: () => {
                    this.placeIC('74LS32', document.getElementById('ic-1'), false);
                    this.connectPins('switch-0', 'ic-1-pin-1');
                    this.connectPins('switch-1', 'ic-1-pin-2');
                    this.connectPins('ic-1-pin-3', 'led-0-in');
                }
            },
            {
                id: 'nand-gate',
                title: 'NAND Gate Truth Table (74LS00)',
                description: 'S0,S1 -> NAND -> L0',
                load: () => {
                    this.placeIC('74LS00', document.getElementById('ic-1'), false);
                    this.connectPins('switch-0', 'ic-1-pin-1');
                    this.connectPins('switch-1', 'ic-1-pin-2');
                    this.connectPins('ic-1-pin-3', 'led-0-in');
                }
            },
            {
                id: 'nor-gate',
                title: 'NOR Gate Truth Table (74LS02)',
                description: 'S0,S1 -> NOR -> L0',
                load: () => {
                    this.placeIC('74LS02', document.getElementById('ic-1'), false);
                    this.connectPins('switch-0', 'ic-1-pin-2');
                    this.connectPins('switch-1', 'ic-1-pin-3');
                    this.connectPins('ic-1-pin-1', 'led-0-in');
                }
            },
            {
                id: 'xor-gate',
                title: 'XOR Gate Truth Table (74LS86)',
                description: 'S0,S1 -> XOR -> L0',
                load: () => {
                    this.placeIC('74LS86', document.getElementById('ic-1'), false);
                    this.connectPins('switch-0', 'ic-1-pin-1');
                    this.connectPins('switch-1', 'ic-1-pin-2');
                    this.connectPins('ic-1-pin-3', 'led-0-in');
                }
            },
            {
                id: 'not-gate',
                title: 'NOT Gate Operation (74LS04)',
                description: 'S0 -> NOT -> L0',
                load: () => {
                    this.placeIC('74LS04', document.getElementById('ic-1'), false);
                    this.connectPins('switch-0', 'ic-1-pin-1');
                    this.connectPins('ic-1-pin-2', 'led-0-in');
                }
            },
            {
                id: 'decoder-74ls138',
                title: '3-to-8 Decoder (74LS138)',
                description: 'A,B,C on S0..S2 and active-LOW outputs on L0..L7',
                load: () => {
                    this.placeIC('74LS138', document.getElementById('ic-1'), false);

                    this.connectPins('switch-0', 'ic-1-pin-1');
                    this.connectPins('switch-1', 'ic-1-pin-2');
                    this.connectPins('switch-2', 'ic-1-pin-3');
                    this.connectPins('gnd', 'ic-1-pin-4');
                    this.connectPins('gnd', 'ic-1-pin-5');
                    this.connectPins('vcc', 'ic-1-pin-6');

                    this.connectPins('ic-1-pin-15', 'led-0-in'); // Y0
                    this.connectPins('ic-1-pin-14', 'led-1-in'); // Y1
                    this.connectPins('ic-1-pin-13', 'led-2-in'); // Y2
                    this.connectPins('ic-1-pin-12', 'led-3-in'); // Y3
                    this.connectPins('ic-1-pin-11', 'led-4-in'); // Y4
                    this.connectPins('ic-1-pin-10', 'led-5-in'); // Y5
                    this.connectPins('ic-1-pin-9', 'led-6-in');  // Y6
                    this.connectPins('ic-1-pin-7', 'led-7-in');  // Y7
                }
            },
            {
                id: 'mux-8to1-74ls151',
                title: '8-to-1 Multiplexer (74LS151)',
                description: 'S0..S2 select input data and drive L0 (with W on L1)',
                load: () => {
                    this.placeIC('74LS151', document.getElementById('ic-1'), false);

                    this.connectPins('switch-0', 'ic-1-pin-15'); // S0
                    this.connectPins('switch-1', 'ic-1-pin-14'); // S1
                    this.connectPins('switch-2', 'ic-1-pin-13'); // S2
                    this.connectPins('gnd', 'ic-1-pin-7');       // STROBE active LOW

                    this.connectPins('switch-3', 'ic-1-pin-4');  // D0
                    this.connectPins('switch-4', 'ic-1-pin-3');  // D1
                    this.connectPins('switch-5', 'ic-1-pin-2');  // D2
                    this.connectPins('switch-6', 'ic-1-pin-1');  // D3
                    this.connectPins('switch-7', 'ic-1-pin-12'); // D4
                    this.connectPins('gnd', 'ic-1-pin-11');      // D5
                    this.connectPins('gnd', 'ic-1-pin-10');      // D6
                    this.connectPins('gnd', 'ic-1-pin-9');       // D7

                    this.connectPins('ic-1-pin-5', 'led-0-in'); // Y
                    this.connectPins('ic-1-pin-6', 'led-1-in'); // W
                }
            },
            {
                id: 'mux-4to1-74ls153',
                title: '4-to-1 Multiplexer (74LS153)',
                description: 'Single channel demo: C0..C3 with common S0,S1',
                load: () => {
                    this.placeIC('74LS153', document.getElementById('ic-1'), false);

                    this.connectPins('gnd', 'ic-1-pin-1');      // 1G enable
                    this.connectPins('vcc', 'ic-1-pin-15');     // Disable channel 2
                    this.connectPins('switch-4', 'ic-1-pin-2'); // S0
                    this.connectPins('switch-5', 'ic-1-pin-14'); // S1

                    this.connectPins('switch-0', 'ic-1-pin-6'); // 1C0
                    this.connectPins('switch-1', 'ic-1-pin-5'); // 1C1
                    this.connectPins('switch-2', 'ic-1-pin-4'); // 1C2
                    this.connectPins('switch-3', 'ic-1-pin-3'); // 1C3

                    this.connectPins('ic-1-pin-7', 'led-0-in'); // 1Y
                }
            },
            {
                id: 'mux-2to1-74ls157',
                title: '2-to-1 Multiplexer (74LS157)',
                description: 'Single channel demo: A/B selected by S2',
                load: () => {
                    this.placeIC('74LS157', document.getElementById('ic-1'), false);

                    this.connectPins('gnd', 'ic-1-pin-15');     // STROBE enable
                    this.connectPins('switch-2', 'ic-1-pin-1'); // SELECT
                    this.connectPins('switch-0', 'ic-1-pin-2'); // 1A
                    this.connectPins('switch-1', 'ic-1-pin-3'); // 1B
                    this.connectPins('ic-1-pin-4', 'led-0-in'); // 1Y
                }
            },
            {
                id: 'counter-74ls93',
                title: 'Binary Counter (74LS93)',
                description: '1Hz clock, L0..L3 show QA..QD (0000 to 1111)',
                load: () => {
                    this.placeIC('74LS93', document.getElementById('ic-1'), false);

                    this.connectPins('clock-1hz', 'ic-1-pin-14');
                    this.connectPins('ic-1-pin-12', 'ic-1-pin-1');
                    this.connectPins('gnd', 'ic-1-pin-2');
                    this.connectPins('gnd', 'ic-1-pin-3');

                    this.connectPins('ic-1-pin-12', 'led-0-in'); // QA
                    this.connectPins('ic-1-pin-9', 'led-1-in');  // QB
                    this.connectPins('ic-1-pin-8', 'led-2-in');  // QC
                    this.connectPins('ic-1-pin-11', 'led-3-in'); // QD
                }
            },
            {
                id: 'counter-74ls90',
                title: 'Decade Counter (74LS90)',
                description: '1Hz clock, L0..L3 show QA..QD',
                load: () => {
                    this.placeIC('74LS90', document.getElementById('ic-1'), false);

                    this.connectPins('clock-1hz', 'ic-1-pin-14');
                    this.connectPins('ic-1-pin-12', 'ic-1-pin-1');
                    this.connectPins('gnd', 'ic-1-pin-2');
                    this.connectPins('gnd', 'ic-1-pin-3');
                    this.connectPins('gnd', 'ic-1-pin-6');
                    this.connectPins('gnd', 'ic-1-pin-7');

                    this.connectPins('ic-1-pin-12', 'led-0-in'); // QA
                    this.connectPins('ic-1-pin-9', 'led-1-in');  // QB
                    this.connectPins('ic-1-pin-8', 'led-2-in');  // QC
                    this.connectPins('ic-1-pin-11', 'led-3-in'); // QD
                }
            },
            {
                id: 'dff-74ls74',
                title: 'D Flip-Flop Operation (74LS74)',
                description: 'S0 as D, mono pulse as clock, L0/L1 = Q/Qbar',
                load: () => {
                    this.placeIC('74LS74', document.getElementById('ic-1'), false);

                    this.connectPins('vcc', 'ic-1-pin-1');      // CLR1 inactive
                    this.connectPins('vcc', 'ic-1-pin-4');      // PR1 inactive
                    this.connectPins('switch-0', 'ic-1-pin-2'); // D1
                    this.connectPins('pulse-out', 'ic-1-pin-3'); // CLK1
                    this.connectPins('ic-1-pin-5', 'led-0-in'); // Q1
                    this.connectPins('ic-1-pin-6', 'led-1-in'); // Q1'
                }
            },
            {
                id: 'jkff-74ls76',
                title: 'JK Flip-Flop Truth Table (74LS76)',
                description: 'S0=J, S1=K, mono pulse clock, L0/L1 = Q/Qbar',
                load: () => {
                    this.placeIC('74LS76', document.getElementById('ic-1'), false);

                    this.connectPins('vcc', 'ic-1-pin-16');      // PR2 inactive
                    this.connectPins('vcc', 'ic-1-pin-10');      // CLR2 inactive
                    this.connectPins('switch-0', 'ic-1-pin-11'); // J2
                    this.connectPins('switch-1', 'ic-1-pin-14'); // K2
                    this.connectPins('pulse-out', 'ic-1-pin-12'); // CLK2
                    this.connectPins('ic-1-pin-9', 'led-0-in');  // Q2
                    this.connectPins('ic-1-pin-8', 'led-1-in');  // Q2'
                }
            },
            {
                id: 'adder-74ls283',
                title: '4-Bit Binary Addition (74LS283)',
                description: 'S0..S3=A, S4..S7=B, outputs on L0..L4',
                load: () => {
                    this.placeIC('74LS283', document.getElementById('ic-1'), false);

                    this.connectPins('switch-0', 'ic-1-pin-1');  // A1
                    this.connectPins('switch-1', 'ic-1-pin-3');  // A2
                    this.connectPins('switch-2', 'ic-1-pin-5');  // A3
                    this.connectPins('switch-3', 'ic-1-pin-7');  // A4
                    this.connectPins('switch-4', 'ic-1-pin-2');  // B1
                    this.connectPins('switch-5', 'ic-1-pin-4');  // B2
                    this.connectPins('switch-6', 'ic-1-pin-6');  // B3
                    this.connectPins('switch-7', 'ic-1-pin-11'); // B4
                    this.connectPins('gnd', 'ic-1-pin-15');      // C0

                    this.connectPins('ic-1-pin-13', 'led-0-in'); // SUM1
                    this.connectPins('ic-1-pin-12', 'led-1-in'); // SUM2
                    this.connectPins('ic-1-pin-10', 'led-2-in'); // SUM3
                    this.connectPins('ic-1-pin-9', 'led-3-in');  // SUM4
                    this.connectPins('ic-1-pin-14', 'led-4-in'); // C4
                }
            },
            {
                id: 'half-adder',
                title: 'Half Adder (74LS86 + 74LS08)',
                description: 'S0=A, S1=B, L0=SUM, L1=CARRY',
                load: () => {
                    this.placeIC('74LS86', document.getElementById('ic-1'), false);
                    this.placeIC('74LS08', document.getElementById('ic-2'), false);

                    this.connectPins('switch-0', 'ic-1-pin-1');
                    this.connectPins('switch-1', 'ic-1-pin-2');
                    this.connectPins('ic-1-pin-3', 'led-0-in');

                    this.connectPins('switch-0', 'ic-2-pin-1');
                    this.connectPins('switch-1', 'ic-2-pin-2');
                    this.connectPins('ic-2-pin-3', 'led-1-in');
                }
            },
            {
                id: 'full-adder',
                title: 'Full Adder (74LS86 + 74LS08 + 74LS32)',
                description: 'S0=A, S1=B, S2=Cin, L0=SUM, L1=Cout',
                load: () => {
                    this.placeIC('74LS86', document.getElementById('ic-1'), false);
                    this.placeIC('74LS08', document.getElementById('ic-2'), false);
                    this.placeIC('74LS32', document.getElementById('ic-3'), false);

                    // XOR chain: x1=A xor B, SUM=x1 xor Cin
                    this.connectPins('switch-0', 'ic-1-pin-1');
                    this.connectPins('switch-1', 'ic-1-pin-2');
                    this.connectPins('ic-1-pin-3', 'ic-1-pin-4');
                    this.connectPins('switch-2', 'ic-1-pin-5');
                    this.connectPins('ic-1-pin-6', 'led-0-in');

                    // Carry terms: c1=A.B, c2=Cin.x1
                    this.connectPins('switch-0', 'ic-2-pin-1');
                    this.connectPins('switch-1', 'ic-2-pin-2');
                    this.connectPins('switch-2', 'ic-2-pin-4');
                    this.connectPins('ic-1-pin-3', 'ic-2-pin-5');

                    // Cout = c1 OR c2
                    this.connectPins('ic-2-pin-3', 'ic-3-pin-1');
                    this.connectPins('ic-2-pin-6', 'ic-3-pin-2');
                    this.connectPins('ic-3-pin-3', 'led-1-in');
                }
            },
            {
                id: 'half-subtractor',
                title: 'Half Subtractor (74LS86 + 74LS04 + 74LS08)',
                description: 'S0=A, S1=B, L0=DIFF, L1=BORROW',
                load: () => {
                    this.placeIC('74LS86', document.getElementById('ic-1'), false);
                    this.placeIC('74LS04', document.getElementById('ic-2'), false);
                    this.placeIC('74LS08', document.getElementById('ic-3'), false);

                    // DIFF = A xor B
                    this.connectPins('switch-0', 'ic-1-pin-1');
                    this.connectPins('switch-1', 'ic-1-pin-2');
                    this.connectPins('ic-1-pin-3', 'led-0-in');

                    // BORROW = A' . B
                    this.connectPins('switch-0', 'ic-2-pin-1');
                    this.connectPins('ic-2-pin-2', 'ic-3-pin-1');
                    this.connectPins('switch-1', 'ic-3-pin-2');
                    this.connectPins('ic-3-pin-3', 'led-1-in');
                }
            },
            {
                id: 'parity-generator',
                title: 'Parity Generator (74LS86)',
                description: 'S0 xor S1 xor S2 xor S3 on L0',
                load: () => {
                    this.placeIC('74LS86', document.getElementById('ic-1'), false);

                    this.connectPins('switch-0', 'ic-1-pin-1');
                    this.connectPins('switch-1', 'ic-1-pin-2');
                    this.connectPins('ic-1-pin-3', 'ic-1-pin-4');
                    this.connectPins('switch-2', 'ic-1-pin-5');
                    this.connectPins('ic-1-pin-6', 'ic-1-pin-9');
                    this.connectPins('switch-3', 'ic-1-pin-10');
                    this.connectPins('ic-1-pin-8', 'led-0-in');
                }
            },
            {
                id: 'mod6-counter',
                title: 'Mod-6 Counter (74LS93 + 74LS00)',
                description: 'Auto-reset at 6 using NAND reset logic',
                load: () => {
                    this.placeIC('74LS93', document.getElementById('ic-1'), false);
                    this.placeIC('74LS00', document.getElementById('ic-2'), false);

                    this.connectPins('clock-1hz', 'ic-1-pin-14');
                    this.connectPins('ic-1-pin-12', 'ic-1-pin-1');

                    // Reset logic: reset when QB and QC are HIGH.
                    this.connectPins('ic-1-pin-9', 'ic-2-pin-1');  // QB
                    this.connectPins('ic-1-pin-8', 'ic-2-pin-2');  // QC
                    this.connectPins('ic-2-pin-3', 'ic-2-pin-4');
                    this.connectPins('ic-2-pin-3', 'ic-2-pin-5');
                    this.connectPins('ic-2-pin-6', 'ic-1-pin-2');
                    this.connectPins('ic-2-pin-6', 'ic-1-pin-3');

                    this.connectPins('ic-1-pin-12', 'led-0-in'); // QA
                    this.connectPins('ic-1-pin-9', 'led-1-in');  // QB
                    this.connectPins('ic-1-pin-8', 'led-2-in');  // QC
                    this.connectPins('ic-1-pin-11', 'led-3-in'); // QD
                }
            },
            {
                id: 'frequency-divider',
                title: 'Frequency Divider (74LS74)',
                description: '1Hz in, divided-by-2 on L0',
                load: () => {
                    this.placeIC('74LS74', document.getElementById('ic-1'), false);

                    this.connectPins('vcc', 'ic-1-pin-1');      // CLR1 inactive
                    this.connectPins('vcc', 'ic-1-pin-4');      // PR1 inactive
                    this.connectPins('clock-1hz', 'ic-1-pin-3'); // CLK1
                    this.connectPins('ic-1-pin-6', 'ic-1-pin-2'); // D1 = Qbar
                    this.connectPins('ic-1-pin-5', 'led-0-in'); // Q1
                }
            }
        ];

        const savedPresets = this.getSavedPresetRecords().map((record) => ({
            id: record.id,
            title: record.title,
            description: record.description,
            payload: record.payload,
            source: 'saved-json'
        }));

        const presets = [...savedPresets, ...builtInPresets];
        this.presetExperiments = presets;

        let selectedPreset = null;

        const renderPresetCards = () => {
            grid.innerHTML = '';
            this.presetExperiments.forEach(preset => {
                const card = document.createElement('div');
                card.className = 'ic-card';
                card.innerHTML = `
                    <div class="ic-card-name">${preset.title}</div>
                    <div class="ic-card-desc">${preset.description}</div>
                `;

                card.onclick = () => {
                    document.querySelectorAll('#preset-grid .ic-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    selectedPreset = preset;
                    runBtn.disabled = false;
                };

                grid.appendChild(card);
            });
        };

        renderPresetCards();

        openBtn.addEventListener('click', () => {
            const refreshedSavedPresets = this.getSavedPresetRecords().map((record) => ({
                id: record.id,
                title: record.title,
                description: record.description,
                payload: record.payload,
                source: 'saved-json'
            }));
            this.presetExperiments = [...refreshedSavedPresets, ...builtInPresets];

            selectedPreset = null;
            runBtn.disabled = true;
            renderPresetCards();
            modal.classList.add('show');
        });

        cancelBtn.addEventListener('click', () => {
            modal.classList.remove('show');
        });

        runBtn.addEventListener('click', () => {
            if (!selectedPreset) return;
            this.runPresetById(selectedPreset.id);
            modal.classList.remove('show');
        });

        // Fallback assignment keeps button responsive if listeners are re-bound externally.
        openBtn.onclick = () => {
            const refreshedSavedPresets = this.getSavedPresetRecords().map((record) => ({
                id: record.id,
                title: record.title,
                description: record.description,
                payload: record.payload,
                source: 'saved-json'
            }));
            this.presetExperiments = [...refreshedSavedPresets, ...builtInPresets];

            selectedPreset = null;
            runBtn.disabled = true;
            renderPresetCards();
            modal.classList.add('show');
        };
    }

    runPresetById(presetId) {
        const preset = this.presetExperiments.find(p => p.id === presetId);
        if (!preset) {
            this.log('Preset', '!', `Preset not found: ${presetId}`);
            return false;
        }

        // If user switches from one preset to a different one, reload first for a clean state.
        if (this.currentPresetId && this.currentPresetId !== presetId) {
            sessionStorage.setItem('trainer_pending_preset', presetId);
            this.log('Preset', 'P', `Switching preset (${this.currentPresetId} -> ${presetId}) with clean reload...`);
            location.reload();
            return true;
        }

        if (preset.payload) {
            const report = this.validateCircuitJson(preset.payload);
            if (report.errors.length > 0) {
                this.log('Preset', '!', `Preset JSON invalid: ${preset.title}`);
                report.errors.forEach(err => this.log('Error', '!', err));
                return false;
            }

            const applied = this.applyCircuitJson(preset.payload);
            if (!applied.ok) {
                this.log('Preset', '!', `Preset wiring issues: ${preset.title}`);
                applied.errors.forEach(err => this.log('Error', '!', err));
                return false;
            }
        } else {
            this.clearBoardForPreset();
            preset.load();
            this.ensurePowerOn();
        }

        this.currentPresetId = preset.id;
        this.log('Preset', 'P', `Loaded preset: ${preset.title}`);
        return true;
    }

    applyPendingPresetOnLoad() {
        const pendingPreset = sessionStorage.getItem('trainer_pending_preset');
        if (!pendingPreset) return;

        sessionStorage.removeItem('trainer_pending_preset');
        this.runPresetById(pendingPreset);
    }

    applyPendingJsonOnLoad() {
        const pendingJson = sessionStorage.getItem('trainer_pending_json');
        const pendingJsonSource = sessionStorage.getItem('trainer_pending_json_source') || 'pending-json';
        if (!pendingJson) return;

        sessionStorage.removeItem('trainer_pending_json');
        sessionStorage.removeItem('trainer_pending_json_source');
        this.importCircuitJsonText(pendingJson, pendingJsonSource);
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

    ensurePowerOn() {
        if (!this.isPowered) {
            document.getElementById('power-btn')?.click();
        }
    }

    connectPins(sourcePin, targetPin, color = 'var(--color-text)') {
        // Treat existing equivalent wire as success (important for JSON reloads).
        const alreadyConnected = this.wiring.wires.some(w =>
            (w.source === sourcePin && w.target === targetPin) ||
            (w.source === targetPin && w.target === sourcePin)
        );
        if (alreadyConnected) {
            return 'existing-wire';
        }

        const wireId = this.wiring.addWire(sourcePin, targetPin, color);
        if (!wireId) {
            this.log('Preset', '!', `Could not connect ${sourcePin} -> ${targetPin}`);
        }
        return wireId;
    }

    setSwitchState(index, isHigh) {
        const switchBox = document.querySelector(`#input-switches .switch-group:nth-child(${index + 1}) .switch-box`);
        if (!switchBox) return;

        const currentlyHigh = switchBox.classList.contains('active');
        if (currentlyHigh !== isHigh) {
            switchBox.click();
        }
    }

    resetAllSwitches() {
        const switchBoxes = document.querySelectorAll('#input-switches .switch-box');
        switchBoxes.forEach(box => {
            if (box.classList.contains('active')) {
                box.click();
            }
        });
    }

    clearBoardForPreset() {
        // Remove all ICs (which also removes connected IC wires)
        Array.from(this.icInstances.keys()).forEach(socketId => {
            this.removeIC(socketId, false);
        });

        // Remove any remaining board wires
        [...this.wiring.wires].forEach(wire => {
            this.wiring.removeWire(wire.id);
            this.removeWireUI(wire.id);
        });

        // Reset user controls and history so preset starts cleanly
        this.resetAllSwitches();
        this.history = [];
        this.historyIndex = -1;
        this.currentPresetId = null;
        this.expressionMeta = null;
        this.syncExpressionContextUI();
        this.updateHistoryUI();
    }

        setupWaveformViewer() {
        this.waveform.canvas = document.getElementById('waveform-canvas');
        this.waveform.empty = document.getElementById('waveform-empty');
        this.waveform.channelsEl = document.getElementById('waveform-channels');
        this.waveform.selectEl = document.getElementById('waveform-signal-select');
        this.waveform.addBtn = document.getElementById('waveform-add-channel');
        this.waveform.toggleBtn = document.getElementById('waveform-toggle');
        this.waveform.clearBtn = document.getElementById('waveform-clear');
        this.waveform.exportBtn = document.getElementById('waveform-export');
        this.waveform.timebaseEl = document.getElementById('waveform-timebase');
        this.waveform.stopBtn = document.getElementById('waveform-stop');
        this.waveform.closeBtn = document.getElementById('waveform-close');
        this.waveform.openBtn = document.getElementById('waveform-open-btn');
        this.waveform.overlayEl = document.getElementById('waveform-panel');

        if (!this.waveform.canvas || !this.waveform.selectEl || !this.waveform.channelsEl) return;

        this.waveform.ctx = this.waveform.canvas.getContext('2d');
        this.waveform.signalOptions = this.buildWaveformSignalOptions();
        this.populateWaveformSignalSelect();

        this.waveform.addBtn?.addEventListener('click', () => {
            const pinId = this.waveform.selectEl.value;
            if (!pinId) return;
            this.addWaveformChannel(pinId);
        });

        this.waveform.toggleBtn?.addEventListener('click', () => {
            this.waveform.running = !this.waveform.running;
            this.waveform.toggleBtn.textContent = this.waveform.running ? 'Pause' : 'Run';
        });

        this.waveform.stopBtn?.addEventListener('click', () => {
            this.waveform.running = false;
            if (this.waveform.toggleBtn) this.waveform.toggleBtn.textContent = 'Run';
            this.log('Waveform', 'WF', 'Waveform capture stopped for inspection.');
        });

        this.waveform.openBtn?.addEventListener('click', () => {
            this.waveform.overlayEl?.classList.add('open');
            this.waveform.overlayEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            this.renderWaveformViewer();
        });

        this.waveform.closeBtn?.addEventListener('click', () => {
            this.waveform.overlayEl?.classList.remove('open');
        });

        this.waveform.clearBtn?.addEventListener('click', () => {
            this.waveform.channels.forEach(ch => { ch.samples = []; });
            this.waveform.lastSampleAt = 0;
            this.renderWaveformViewer();
        });

        this.waveform.exportBtn?.addEventListener('click', () => {
            this.exportWaveformCsv();
        });

        this.waveform.timebaseEl?.addEventListener('change', () => {
            const ms = parseInt(this.waveform.timebaseEl.value, 10);
            if (!Number.isNaN(ms) && ms > 0) {
                this.waveform.timeWindowMs = ms;
            }
        });

        window.addEventListener('resize', () => this.renderWaveformViewer(), { passive: true });

        this.addWaveformChannel('switch-0');
        this.addWaveformChannel('clock-1hz');

        this.waveform.overlayEl?.classList.remove('open');
        this.log('System', 'WF', 'Waveform viewer ready.');
    }

    buildWaveformSignalOptions() {
        const options = [];
        for (let i = 0; i < 8; i++) {
            options.push({ pinId: `switch-${i}`, label: `S${i} (Switch ${i})` });
        }
        for (let i = 0; i < 8; i++) {
            options.push({ pinId: `led-${i}-in`, label: `L${i} (LED ${i})` });
        }
        options.push(
            { pinId: 'clock-1hz', label: 'CLK 1Hz' },
            { pinId: 'clock-10hz', label: 'CLK 10Hz' },
            { pinId: 'clock-100hz', label: 'CLK 100Hz' },
            { pinId: 'clock-1khz', label: 'CLK 1kHz' },
            { pinId: 'clock-10khz', label: 'CLK 10kHz' },
            { pinId: 'pulse-out', label: 'Pulse OUT' },
            { pinId: 'bcd-out-a', label: 'BCD OUT A' },
            { pinId: 'bcd-out-b', label: 'BCD OUT B' },
            { pinId: 'bcd-out-c', label: 'BCD OUT C' },
            { pinId: 'bcd-out-d', label: 'BCD OUT D' }
        );
        return options;
    }

    populateWaveformSignalSelect() {
        if (!this.waveform.selectEl) return;
        this.waveform.selectEl.innerHTML = '';
        this.waveform.signalOptions.forEach((opt) => {
            const el = document.createElement('option');
            el.value = opt.pinId;
            el.textContent = opt.label;
            this.waveform.selectEl.appendChild(el);
        });
    }

    addWaveformChannel(pinId) {
        if (!pinId) return;
        const already = this.waveform.channels.some(c => c.pinId === pinId);
        if (already) return;

        const idx = this.waveform.channels.length % this.waveform.colors.length;
        const label = this.waveform.signalOptions.find(s => s.pinId === pinId)?.label || pinId;
        this.waveform.channels.push({
            id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            pinId,
            label,
            color: this.waveform.colors[idx],
            samples: [],
            lastValue: 'X'
        });

        this.renderWaveformChannelList();
    }

    removeWaveformChannel(channelId) {
        this.waveform.channels = this.waveform.channels.filter(ch => ch.id !== channelId);
        this.renderWaveformChannelList();
        this.renderWaveformViewer();
    }

    renderWaveformChannelList() {
        if (!this.waveform.channelsEl) return;
        this.waveform.channelsEl.innerHTML = '';

        this.waveform.channels.forEach((channel) => {
            const item = document.createElement('div');
            item.className = 'waveform-channel-item';

            const main = document.createElement('div');
            main.className = 'waveform-channel-main';

            const dot = document.createElement('span');
            dot.className = 'waveform-dot';
            dot.style.background = channel.color;

            const label = document.createElement('span');
            label.className = 'waveform-label';
            label.textContent = channel.label;

            const value = document.createElement('span');
            value.className = 'waveform-value';
            value.dataset.channelId = channel.id;
            value.textContent = channel.lastValue;

            main.append(dot, label, value);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'control-btn';
            removeBtn.textContent = 'X';
            removeBtn.style.minWidth = '34px';
            removeBtn.style.padding = '6px';
            removeBtn.addEventListener('click', () => this.removeWaveformChannel(channel.id));

            item.append(main, removeBtn);
            this.waveform.channelsEl.appendChild(item);
        });

        if (this.waveform.empty) {
            this.waveform.empty.style.display = this.waveform.channels.length ? 'none' : 'flex';
        }
    }

    refreshWaveformChannelValues() {
        if (!this.waveform.channelsEl) return;
        this.waveform.channels.forEach((channel) => {
            const el = this.waveform.channelsEl.querySelector(`.waveform-value[data-channel-id="${channel.id}"]`);
            if (el) el.textContent = channel.lastValue;
        });
    }

    captureWaveformSample(nowMs) {
        if (!this.waveform.running || !this.waveform.channels.length) return;
        if (!this.waveform.lastSampleAt) this.waveform.lastSampleAt = nowMs;
        if ((nowMs - this.waveform.lastSampleAt) < this.waveform.sampleIntervalMs) return;

        this.waveform.lastSampleAt = nowMs;
        const cutoff = nowMs - this.waveform.timeWindowMs;

        this.waveform.channels.forEach((ch) => {
            const v = this.getWaveformStateValue(ch.pinId);
            ch.lastValue = v;
            ch.samples.push({ t: nowMs, v });
            while (ch.samples.length > 0 && ch.samples[0].t < cutoff) {
                ch.samples.shift();
            }
        });
    }

    getWaveformStateValue(pinId) {
        const nodeId = this.wiring.pinToNodeId.get(pinId);
        if (!nodeId) return 'X';
        const node = this.engine.nodes.get(nodeId);
        if (!node) return 'X';
        node.update();
        if (node.state === STATE_HIGH) return '1';
        if (node.state === STATE_LOW) return '0';
        return 'X';
    }

    ensureWaveformCanvasSize() {
        const canvas = this.waveform.canvas;
        if (!canvas) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(300, canvas.clientWidth || 300);
        const h = Math.max(220, canvas.clientHeight || 320);
        const rw = Math.floor(w * dpr);
        const rh = Math.floor(h * dpr);

        if (canvas.width !== rw || canvas.height !== rh) {
            canvas.width = rw;
            canvas.height = rh;
        }

        this.waveform.dpr = dpr;
    }

    renderWaveformViewer() {
        if (!this.waveform.ctx || !this.waveform.canvas) return;
        this.ensureWaveformCanvasSize();

        const ctx = this.waveform.ctx;
        const dpr = this.waveform.dpr || 1;
        const w = this.waveform.canvas.width / dpr;
        const h = this.waveform.canvas.height / dpr;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        ctx.fillStyle = '#05090f';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(70, 96, 124, 0.35)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const x = (i / 10) * w;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let i = 0; i <= 8; i++) {
            const y = (i / 8) * h;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        if (!this.waveform.channels.length) return;

        const now = performance.now();
        const from = now - this.waveform.timeWindowMs;
        const rowH = h / this.waveform.channels.length;

        this.waveform.channels.forEach((ch, idx) => {
            const yTop = idx * rowH + 8;
            const yHigh = yTop + 8;
            const yLow = yTop + rowH - 10;
            const yMid = (yHigh + yLow) / 2;

            ctx.strokeStyle = 'rgba(120, 170, 210, 0.18)';
            ctx.beginPath();
            ctx.moveTo(0, yTop + rowH - 2);
            ctx.lineTo(w, yTop + rowH - 2);
            ctx.stroke();

            ctx.fillStyle = ch.color;
            ctx.font = '11px monospace';
            ctx.fillText(ch.label, 8, yTop + 10);

            const samples = ch.samples.filter(s => s.t >= from);
            if (!samples.length) return;

            ctx.strokeStyle = ch.color;
            ctx.lineWidth = 2;
            ctx.beginPath();

            for (let i = 0; i < samples.length; i++) {
                const s = samples[i];
                const x = ((s.t - from) / this.waveform.timeWindowMs) * w;
                const y = s.v === '1' ? yHigh : (s.v === '0' ? yLow : yMid);
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    const p = samples[i - 1];
                    const px = ((p.t - from) / this.waveform.timeWindowMs) * w;
                    const py = p.v === '1' ? yHigh : (p.v === '0' ? yLow : yMid);
                    if (py !== y) {
                        ctx.lineTo(x, py);
                    }
                    ctx.lineTo(x, y);
                    if (Math.abs(x - px) < 0.5) {
                        ctx.lineTo(x + 0.5, y);
                    }
                }
            }

            ctx.stroke();
        });
    }

    exportWaveformCsv() {
        if (!this.waveform.channels.length) {
            this.log('Waveform', 'WF', 'No waveform channels to export.');
            return;
        }

        const headers = ['time_ms', ...this.waveform.channels.map(ch => ch.label)];
        const timeSet = new Set();
        this.waveform.channels.forEach(ch => ch.samples.forEach(s => timeSet.add(Math.round(s.t))));
        const times = Array.from(timeSet).sort((a, b) => a - b);

        const rows = times.map((t) => {
            const values = this.waveform.channels.map((ch) => {
                const exact = ch.samples.find(s => Math.round(s.t) === t);
                if (exact) return exact.v;
                const prev = [...ch.samples].reverse().find(s => Math.round(s.t) <= t);
                return prev ? prev.v : 'X';
            });
            return [t, ...values].join(',');
        });

        const csv = `${headers.join(',')}\n${rows.join('\n')}\n`;
        const filename = `waveform-${Date.now()}.csv`;
        this.downloadTextFile(filename, csv, 'text/csv');
        this.log('Waveform', 'WF', `Waveform exported: ${filename}`);
    }

    setupTruthTableGenerator() {
        const btn = document.getElementById('truth-table-btn');
        if (!btn) return;

        btn.addEventListener('click', async () => {
            const inputIndices = this.getTruthTableInputSwitches();
            if (inputIndices.length === 0) {
                this.log('TruthTable', 'TT', 'No connected switch inputs found for truth table generation.');
                alert('No connected switch inputs found. Connect switch pins to your circuit first.');
                return;
            }

            const outputIndices = this.getTruthTableOutputLeds();
            if (outputIndices.length === 0) {
                this.log('TruthTable', 'TT', 'No connected LED outputs found for truth table generation.');
                alert('No connected LED outputs found. Connect circuit outputs to LED inputs first.');
                return;
            }

            const originalSwitches = this.getCurrentSwitchStates();
            const wasPowered = this.isPowered;

            if (!this.isPowered) {
                this.ensurePowerOn();
            }

            const rows = [];
            const combinations = 1 << inputIndices.length;

            for (let mask = 0; mask < combinations; mask++) {
                const inputBits = inputIndices.map((_, bitPos) => ((mask >> bitPos) & 1).toString());
                inputIndices.forEach((switchIndex, bitPos) => {
                    const bit = (mask >> bitPos) & 1;
                    this.setSwitchState(switchIndex, bit === 1);
                });

                this.stabilizeCircuitForTruthTable();
                const outputBits = outputIndices.map((idx) => this.getPinStateBit(`led-${idx}-in`));
                rows.push({ inputBits, outputBits });
            }

            originalSwitches.forEach((isHigh, idx) => this.setSwitchState(idx, !!isHigh));
            this.stabilizeCircuitForTruthTable();

            if (!wasPowered && this.isPowered) {
                document.getElementById('power-btn')?.click();
            }

            const csv = this.buildTruthTableCsv(inputIndices, outputIndices, rows);
            const filename = `truth-table-${Date.now()}.csv`;
            this.downloadTextFile(filename, csv, 'text/csv');

            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(csv);
                    this.log('TruthTable', 'TT', `Generated ${rows.length} row(s). Downloaded ${filename} and copied CSV.`);
                } else {
                    this.log('TruthTable', 'TT', `Generated ${rows.length} row(s). Downloaded ${filename}.`);
                }
            } catch {
                this.log('TruthTable', 'TT', `Generated ${rows.length} row(s). Downloaded ${filename}.`);
            }
        });
    }

    getCurrentSwitchStates() {
        const states = [];
        document.querySelectorAll('#input-switches .switch-box').forEach(box => {
            states.push(box.classList.contains('active'));
        });
        return states;
    }

    getTruthTableInputSwitches() {
        const used = new Set();
        this.wiring.wires.forEach((wire) => {
            const sourceMatch = wire.source.match(/^switch-(\d+)$/);
            const targetMatch = wire.target.match(/^switch-(\d+)$/);
            if (sourceMatch) used.add(parseInt(sourceMatch[1], 10));
            if (targetMatch) used.add(parseInt(targetMatch[1], 10));
        });

        return Array.from(used).filter((x) => x >= 0 && x <= 7).sort((a, b) => a - b).slice(0, 8);
    }

    getTruthTableOutputLeds() {
        const used = new Set();
        this.wiring.wires.forEach((wire) => {
            const sourceMatch = wire.source.match(/^led-(\d+)-in$/);
            const targetMatch = wire.target.match(/^led-(\d+)-in$/);
            if (sourceMatch) used.add(parseInt(sourceMatch[1], 10));
            if (targetMatch) used.add(parseInt(targetMatch[1], 10));
        });

        return Array.from(used).filter((x) => x >= 0 && x <= 7).sort((a, b) => a - b);
    }

    stabilizeCircuitForTruthTable() {
        for (let i = 0; i < 8; i++) {
            this.engine.step(25);
            this.updatePinStates();
        }
    }

    getPinStateBit(pinId) {
        const nodeId = this.wiring.pinToNodeId.get(pinId);
        if (!nodeId) return 'X';
        const node = this.engine.nodes.get(nodeId);
        if (!node) return 'X';
        node.update();
        if (node.state === STATE_HIGH) return '1';
        if (node.state === STATE_LOW) return '0';
        return 'X';
    }

    buildTruthTableCsv(inputIndices, outputIndices, rows) {
        const inputHeaders = inputIndices.map(i => `S${i}`);
        const outputHeaders = outputIndices.map(i => `L${i}`);
        const header = [...inputHeaders, ...outputHeaders].join(',');
        const body = rows.map(row => [...row.inputBits, ...row.outputBits].join(',')).join('\n');
        return `${header}\n${body}\n`;
    }
        setupCodeGenerators() {
        const btn = document.getElementById('generate-code-btn');
        const targetSelect = document.getElementById('codegen-target');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const model = this.buildCodeGenerationModel();
            if (!model) return;

            const stamp = Date.now();
            const target = targetSelect?.value || 'arduino';

            if (target === 'arduino' || target === 'all') {
                this.downloadTextFile(`web-ic-trainer-${stamp}.ino`, this.generateArduinoCode(model), 'text/plain');
            }
            if (target === 'python' || target === 'all') {
                this.downloadTextFile(`web-ic-trainer-${stamp}.py`, this.generatePythonCode(model), 'text/plain');
            }
            if (target === 'cpp' || target === 'all') {
                this.downloadTextFile(`web-ic-trainer-${stamp}.cpp`, this.generateCppCode(model), 'text/plain');
            }
            if (target === 'verilog' || target === 'all') {
                this.downloadTextFile(`web-ic-trainer-${stamp}.v`, this.generateVerilogCode(model), 'text/plain');
            }

            const targetLabel = targetSelect?.selectedOptions?.[0]?.textContent || target;
            this.log('CodeGen', 'CG', `Generated code for ${targetLabel}.`);
        });
    }

    setupExpressionBuilder() {
        const input = document.getElementById('expression-input');
        const btn = document.getElementById('build-expression-btn');
        const toggleBtn = document.getElementById('expression-toggle-btn');
        const panel = document.getElementById('expression-panel');
        if (!input || !btn) return;

        const syncPanelState = () => {
            if (!panel || !toggleBtn) return;
            const isOpen = !panel.hidden;
            const textEl = toggleBtn.querySelector('span');
            if (textEl) textEl.textContent = isOpen ? 'Close Expr' : 'Bool Expr';
            if (isOpen) {
                setTimeout(() => input.focus(), 0);
            }
        };

        if (toggleBtn && panel) {
            toggleBtn.addEventListener('click', () => {
                panel.hidden = !panel.hidden;
                syncPanelState();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !panel.hidden) {
                    panel.hidden = true;
                    syncPanelState();
                }
            });
            syncPanelState();
        }

        const runBuild = () => {
            const expressionText = String(input.value || '').trim();
            let plan;
            try {
                plan = this.createExpressionBuildPlan(expressionText);
            } catch (err) {
                const msg = err?.message || 'Expression build failed';
                this.log('Expr', '!', msg);
                alert(`Expression build failed: ${msg}`);
                return;
            }

            const payload = {
                schema: 'ic-trainer-circuit-v1',
                createdAt: new Date().toISOString(),
                powerOn: true,
                presetId: null,
                presetTitle: null,
                expressionMeta: {
                    source: plan.originalExpression,
                    output: plan.outputName,
                    variables: [...plan.variables]
                },
                ics: plan.chips.map((chip) => ({
                    socket: chip.socket,
                    type: chip.type
                })),
                wires: plan.connections.map((c) => ({
                    source: c.source,
                    target: c.target,
                    color: c.color || 'var(--color-text)'
                })),
                switches: Array.from({ length: 8 }, () => 0)
            };

            sessionStorage.setItem('trainer_pending_json', JSON.stringify(payload));
            sessionStorage.setItem('trainer_pending_json_source', 'expression-build');
            this.log(
                'Expr',
                'EX',
                `Compiled "${plan.outputName}" (${plan.gates.length} gate(s), ${plan.chips.length} IC(s)). Reloading with power ON.`
            );
            location.reload();
        };

        btn.addEventListener('click', runBuild);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                runBuild();
            }
        });

        this.syncExpressionContextUI();
    }

    syncExpressionContextUI() {
        const input = document.getElementById('expression-input');
        const display = document.getElementById('expression-active-display');
        const expr = this.expressionMeta && typeof this.expressionMeta.source === 'string'
            ? this.expressionMeta.source
            : '';

        if (input && expr) {
            input.value = expr;
        }
        if (display) {
            display.textContent = expr ? `Expression: ${expr}` : 'Expression: -';
            display.title = expr ? `Active expression: ${expr}` : 'No expression metadata on current board';
        }
        const toggleBtn = document.getElementById('expression-toggle-btn');
        if (toggleBtn) {
            toggleBtn.title = expr ? `Open Boolean expression builder (active: ${expr})` : 'Open Boolean expression builder';
        }
    }

    buildExpressionCircuit(expressionText) {
        const wasPowered = this.isPowered;
        let plan;
        try {
            plan = this.createExpressionBuildPlan(expressionText);
        } catch (err) {
            const msg = err?.message || 'Invalid expression';
            this.log('Expr', '!', msg);
            return { ok: false, error: msg };
        }

        try {
            this.clearBoardForPreset();

            const socketIds = ['ic-1', 'ic-2', 'ic-3', 'ic-4'];
            for (let i = 0; i < plan.chips.length; i++) {
                const chip = plan.chips[i];
                const socketId = socketIds[i];
                const socketEl = document.getElementById(socketId);
                if (!socketEl) throw new Error(`Socket not found: ${socketId}`);
                this.placeIC(chip.type, socketEl, false);
                if (!this.icInstances.has(socketId)) {
                    throw new Error(`Failed to place ${chip.type} in ${socketId}`);
                }
            }

            const wireErrors = [];
            for (const conn of plan.connections) {
                const ok = this.connectPins(conn.source, conn.target, conn.color || 'var(--color-text)');
                if (!ok) {
                    wireErrors.push(`${conn.source} -> ${conn.target}`);
                }
            }
            if (wireErrors.length > 0) {
                throw new Error(`Failed to connect ${wireErrors.length} wire(s): ${wireErrors.slice(0, 5).join(', ')}`);
            }

            this.expressionMeta = {
                source: plan.originalExpression,
                output: plan.outputName,
                variables: [...plan.variables]
            };
            this.syncExpressionContextUI();

            if (wasPowered) {
                this.ensurePowerOn();
            } else if (this.isPowered) {
                document.getElementById('power-btn')?.click();
            }

            return {
                ok: true,
                stats: {
                    output: plan.outputName,
                    variables: [...plan.variables],
                    gateCount: plan.gates.length,
                    icCount: plan.chips.length
                }
            };
        } catch (err) {
            // Keep board in known clean state on any build failure after mutation starts.
            this.clearBoardForPreset();
            this.expressionMeta = null;
            this.syncExpressionContextUI();
            if (wasPowered) {
                this.ensurePowerOn();
            } else if (this.isPowered) {
                document.getElementById('power-btn')?.click();
            }
            const msg = err?.message || 'Expression build failed';
            this.log('Expr', '!', msg);
            return { ok: false, error: msg };
        }
    }

    createExpressionBuildPlan(expressionText) {
        const normalized = String(expressionText || '').trim();
        if (!normalized) throw new Error('Expression is empty. Use format like: F = (A+B).C');

        const eqPos = normalized.indexOf('=');
        if (eqPos <= 0 || eqPos !== normalized.lastIndexOf('=')) {
            throw new Error('Expression must contain exactly one "=" in the form OUT = expression.');
        }

        const lhs = normalized.slice(0, eqPos).trim();
        const rhs = normalized.slice(eqPos + 1).trim();

        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(lhs)) {
            throw new Error(`Invalid output name "${lhs}". Use letters/digits, starting with a letter.`);
        }
        if (!rhs) throw new Error('Right-hand expression is empty.');

        const tokens = this.tokenizeBooleanExpression(rhs);
        const expanded = this.insertImplicitAnd(tokens);
        const rpn = this.toRpn(expanded);
        const ast = this.buildAstFromRpn(rpn);
        const graph = this.astToGateGraph(ast);
        const variables = Array.from(graph.variables).sort((a, b) => a.localeCompare(b));
        if (variables.length > 8) {
            throw new Error(`Expression uses ${variables.length} variables. Maximum supported is 8 (S0..S7).`);
        }

        const chipPlan = this.mapGatesToTtlChips(graph.gates);
        if (chipPlan.chips.length > 4) {
            throw new Error(`Expression requires ${chipPlan.chips.length} ICs; board supports 4.`);
        }

        const variablePins = new Map();
        variables.forEach((name, index) => variablePins.set(name, `switch-${index}`));

        const outputPinByGate = new Map();
        chipPlan.gatePlacements.forEach((placement) => {
            outputPinByGate.set(placement.gateId, `${placement.socket}-pin-${placement.outPin}`);
        });

        const sourcePinFromRef = (ref) => {
            if (ref.startsWith('var:')) {
                const name = ref.slice(4);
                const pin = variablePins.get(name);
                if (!pin) throw new Error(`No switch mapping for variable ${name}`);
                return pin;
            }
            if (ref.startsWith('gate:')) {
                const id = ref.slice(5);
                const pin = outputPinByGate.get(id);
                if (!pin) throw new Error(`No output pin mapping for gate ${id}`);
                return pin;
            }
            throw new Error(`Unknown node reference ${ref}`);
        };

        const connections = [];
        const dedupe = new Set();
        const pushConn = (source, target, color = 'var(--color-text)') => {
            const key = `${source}->${target}`;
            if (dedupe.has(key)) return;
            dedupe.add(key);
            connections.push({ source, target, color });
        };

        chipPlan.gatePlacements.forEach((placement) => {
            const gate = graph.gates.find((g) => g.id === placement.gateId);
            if (!gate) return;
            for (let i = 0; i < gate.inputs.length; i++) {
                const source = sourcePinFromRef(gate.inputs[i]);
                const target = `${placement.socket}-pin-${placement.inPins[i]}`;
                pushConn(source, target);
            }
        });

        const finalSource = sourcePinFromRef(graph.outputRef);
        pushConn(finalSource, 'led-0-in');

        return {
            originalExpression: normalized,
            outputName: lhs,
            variables,
            gates: graph.gates,
            chips: chipPlan.chips,
            connections
        };
    }

    tokenizeBooleanExpression(expr) {
        const tokens = [];
        let i = 0;
        while (i < expr.length) {
            const ch = expr[i];
            if (/\s/.test(ch)) {
                i++;
                continue;
            }

            if (/[A-Za-z]/.test(ch)) {
                const start = i;
                i++;
                while (i < expr.length && /[A-Za-z0-9]/.test(expr[i])) i++;
                tokens.push({ type: 'id', value: expr.slice(start, i), pos: start + 1 });
                continue;
            }

            if (ch === '(') {
                tokens.push({ type: 'lp', value: ch, pos: i + 1 });
                i++;
                continue;
            }
            if (ch === ')') {
                tokens.push({ type: 'rp', value: ch, pos: i + 1 });
                i++;
                continue;
            }
            if (ch === '+' || ch === '.' || ch === '^' || ch === "'") {
                tokens.push({ type: 'op', value: ch, pos: i + 1 });
                i++;
                continue;
            }

            throw new Error(`Unsupported character "${ch}" at position ${i + 1}.`);
        }

        if (!tokens.length) throw new Error('Right-hand expression is empty.');
        return tokens;
    }

    insertImplicitAnd(tokens) {
        const out = [];
        const isLeftOperandEnd = (t) => t.type === 'id' || t.type === 'rp' || (t.type === 'op' && t.value === "'");
        const isRightOperandStart = (t) => t.type === 'id' || t.type === 'lp';

        for (let i = 0; i < tokens.length; i++) {
            const cur = tokens[i];
            out.push(cur);
            if (i === tokens.length - 1) continue;
            const next = tokens[i + 1];
            if (isLeftOperandEnd(cur) && isRightOperandStart(next)) {
                out.push({ type: 'op', value: '.', pos: next.pos, implied: true });
            }
        }
        return out;
    }

    toRpn(tokens) {
        const output = [];
        const ops = [];
        const prec = { '+': 1, '^': 2, '.': 3, "'": 4 };
        const assoc = { '+': 'left', '^': 'left', '.': 'left', "'": 'left' };

        for (const token of tokens) {
            if (token.type === 'id') {
                output.push(token);
                continue;
            }
            if (token.type === 'lp') {
                ops.push(token);
                continue;
            }
            if (token.type === 'rp') {
                let found = false;
                while (ops.length) {
                    const top = ops.pop();
                    if (top.type === 'lp') {
                        found = true;
                        break;
                    }
                    output.push(top);
                }
                if (!found) throw new Error(`Unbalanced ")" at position ${token.pos}.`);
                continue;
            }
            if (token.type === 'op') {
                while (ops.length) {
                    const top = ops[ops.length - 1];
                    if (top.type !== 'op') break;
                    const pTop = prec[top.value];
                    const pCur = prec[token.value];
                    const leftAssoc = assoc[token.value] === 'left';
                    if ((leftAssoc && pCur <= pTop) || (!leftAssoc && pCur < pTop)) {
                        output.push(ops.pop());
                    } else {
                        break;
                    }
                }
                ops.push(token);
                continue;
            }
        }

        while (ops.length) {
            const top = ops.pop();
            if (top.type === 'lp' || top.type === 'rp') {
                throw new Error('Unbalanced parentheses in expression.');
            }
            output.push(top);
        }
        return output;
    }

    buildAstFromRpn(rpn) {
        const stack = [];
        const opToType = { '+': 'OR', '.': 'AND', '^': 'XOR' };

        for (const token of rpn) {
            if (token.type === 'id') {
                stack.push({ type: 'VAR', name: token.value, pos: token.pos });
                continue;
            }

            if (token.type === 'op' && token.value === "'") {
                const a = stack.pop();
                if (!a) throw new Error(`Missing operand for "'" near position ${token.pos}.`);
                stack.push({ type: 'NOT', input: a, pos: token.pos });
                continue;
            }

            if (token.type === 'op') {
                const b = stack.pop();
                const a = stack.pop();
                if (!a || !b) throw new Error(`Missing operand for "${token.value}" near position ${token.pos}.`);
                stack.push({ type: opToType[token.value], left: a, right: b, pos: token.pos });
            }
        }

        if (stack.length !== 1) throw new Error('Expression syntax is invalid.');
        return stack[0];
    }

    astToGateGraph(ast) {
        const gates = [];
        const variables = new Set();
        let gateIndex = 0;

        const walk = (node) => {
            if (node.type === 'VAR') {
                variables.add(node.name);
                return `var:${node.name}`;
            }
            if (node.type === 'NOT') {
                const source = walk(node.input);
                const id = `g${++gateIndex}`;
                gates.push({ id, type: 'NOT', inputs: [source] });
                return `gate:${id}`;
            }
            if (node.type === 'AND' || node.type === 'OR' || node.type === 'XOR') {
                const left = walk(node.left);
                const right = walk(node.right);
                const id = `g${++gateIndex}`;
                gates.push({ id, type: node.type, inputs: [left, right] });
                return `gate:${id}`;
            }
            throw new Error(`Unsupported AST node type: ${node.type}`);
        };

        const outputRef = walk(ast);
        return { gates, variables, outputRef };
    }

    mapGatesToTtlChips(gates) {
        const defs = [
            {
                gateType: 'NOT',
                icType: '74LS04',
                capacity: 6,
                slots: [
                    { inPins: [1], outPin: 2 },
                    { inPins: [3], outPin: 4 },
                    { inPins: [5], outPin: 6 },
                    { inPins: [9], outPin: 8 },
                    { inPins: [11], outPin: 10 },
                    { inPins: [13], outPin: 12 }
                ]
            },
            {
                gateType: 'AND',
                icType: '74LS08',
                capacity: 4,
                slots: [
                    { inPins: [1, 2], outPin: 3 },
                    { inPins: [4, 5], outPin: 6 },
                    { inPins: [9, 10], outPin: 8 },
                    { inPins: [12, 13], outPin: 11 }
                ]
            },
            {
                gateType: 'OR',
                icType: '74LS32',
                capacity: 4,
                slots: [
                    { inPins: [1, 2], outPin: 3 },
                    { inPins: [4, 5], outPin: 6 },
                    { inPins: [9, 10], outPin: 8 },
                    { inPins: [12, 13], outPin: 11 }
                ]
            },
            {
                gateType: 'XOR',
                icType: '74LS86',
                capacity: 4,
                slots: [
                    { inPins: [1, 2], outPin: 3 },
                    { inPins: [4, 5], outPin: 6 },
                    { inPins: [9, 10], outPin: 8 },
                    { inPins: [12, 13], outPin: 11 }
                ]
            }
        ];

        const chips = [];
        const gatePlacements = [];
        const socketIds = ['ic-1', 'ic-2', 'ic-3', 'ic-4'];

        defs.forEach((def) => {
            const group = gates.filter((g) => g.type === def.gateType);
            for (let i = 0; i < group.length; i++) {
                const chipIndex = Math.floor(i / def.capacity);
                const slotIndex = i % def.capacity;
                if (!chips[def.gateType]) chips[def.gateType] = [];
                if (!chips[def.gateType][chipIndex]) {
                    chips[def.gateType][chipIndex] = { type: def.icType, gateType: def.gateType };
                }
                gatePlacements.push({
                    gateId: group[i].id,
                    gateType: def.gateType,
                    chipType: def.icType,
                    chipGroupIndex: chipIndex,
                    slotIndex,
                    inPins: [...def.slots[slotIndex].inPins],
                    outPin: def.slots[slotIndex].outPin
                });
            }
        });

        const flatChips = [];
        defs.forEach((def) => {
            const list = chips[def.gateType] || [];
            list.forEach((chip) => flatChips.push(chip));
        });

        flatChips.forEach((chip, idx) => {
            chip.socket = socketIds[idx];
        });

        const chipByTypeAndIndex = new Map();
        defs.forEach((def) => {
            const list = flatChips.filter((chip) => chip.gateType === def.gateType);
            list.forEach((chip, idx) => {
                chipByTypeAndIndex.set(`${def.gateType}:${idx}`, chip);
            });
        });

        gatePlacements.forEach((p) => {
            const chip = chipByTypeAndIndex.get(`${p.gateType}:${p.chipGroupIndex}`);
            if (!chip) throw new Error(`Internal placement error for gate ${p.gateId}.`);
            p.socket = chip.socket;
        });

        return { chips: flatChips, gatePlacements };
    }

    buildCodeGenerationModel() {
        const inputIndices = this.getTruthTableInputSwitches();
        const outputIndices = this.getTruthTableOutputLeds();

        if (inputIndices.length === 0) {
            alert('No connected switch inputs found. Connect switch pins first.');
            return null;
        }
        if (outputIndices.length === 0) {
            alert('No connected LED outputs found. Connect circuit outputs to LED inputs first.');
            return null;
        }

        const originalSwitches = this.getCurrentSwitchStates();
        const wasPowered = this.isPowered;
        if (!this.isPowered) this.ensurePowerOn();

        const rows = [];
        const combinations = 1 << inputIndices.length;

        for (let mask = 0; mask < combinations; mask++) {
            const inputBits = inputIndices.map((_, bitPos) => ((mask >> bitPos) & 1).toString());
            inputIndices.forEach((switchIndex, bitPos) => {
                const bit = (mask >> bitPos) & 1;
                this.setSwitchState(switchIndex, bit === 1);
            });
            this.stabilizeCircuitForTruthTable();
            const outputBits = outputIndices.map((idx) => this.getPinStateBit(`led-${idx}-in`) === '1' ? '1' : '0');
            rows.push({ inputBits, outputBits });
        }

        originalSwitches.forEach((isHigh, idx) => this.setSwitchState(idx, !!isHigh));
        this.stabilizeCircuitForTruthTable();
        if (!wasPowered && this.isPowered) document.getElementById('power-btn')?.click();

        return {
            inputIndices,
            outputIndices,
            rows,
            map: rows.map(r => r.outputBits.join(''))
        };
    }

    generateArduinoCode(model) {
        const inPins = model.inputIndices.map((_, i) => `2 + ${i}`).join(', ');
        const outPins = model.outputIndices.map((_, i) => `10 + ${i}`).join(', ');
        const mapVals = model.rows
            .map((row) => row.outputBits.reduce((acc, bit, j) => acc | ((bit === '1' ? 1 : 0) << j), 0))
            .join(', ');
        return `// Auto-generated by Web IC Trainer\n// Input order: ${model.inputIndices.map(i => 'S' + i).join(', ')}\n// Output order: ${model.outputIndices.map(i => 'L' + i).join(', ')}\n\nconst uint8_t IN_COUNT = ${model.inputIndices.length};\nconst uint8_t OUT_COUNT = ${model.outputIndices.length};\nconst uint8_t inputPins[IN_COUNT] = { ${inPins} };\nconst uint8_t outputPins[OUT_COUNT] = { ${outPins} };\nconst uint8_t truthMap[${model.map.length}] = { ${mapVals} };\n\nvoid setup() {\n  for (uint8_t i = 0; i < IN_COUNT; i++) pinMode(inputPins[i], INPUT_PULLUP);\n  for (uint8_t i = 0; i < OUT_COUNT; i++) pinMode(outputPins[i], OUTPUT);\n}\n\nvoid loop() {\n  uint16_t idx = 0;\n  for (uint8_t i = 0; i < IN_COUNT; i++) {\n    uint8_t bit = digitalRead(inputPins[i]) == LOW ? 1 : 0;\n    idx |= (bit << i);\n  }\n  uint8_t out = truthMap[idx];\n  for (uint8_t j = 0; j < OUT_COUNT; j++) digitalWrite(outputPins[j], (out >> j) & 0x1);\n}\n`;
    }

    generatePythonCode(model) {
        const mapVals = model.rows
            .map((row) => row.outputBits.reduce((acc, bit, j) => acc | ((bit === '1' ? 1 : 0) << j), 0))
            .join(', ');
        return `# Auto-generated by Web IC Trainer\n# Input order: ${model.inputIndices.map(i => 'S' + i).join(', ')}\n# Output order: ${model.outputIndices.map(i => 'L' + i).join(', ')}\n\nTRUTH_MAP = [${mapVals}]\nIN_COUNT = ${model.inputIndices.length}\nOUT_COUNT = ${model.outputIndices.length}\n\ndef evaluate(bits):\n    idx = 0\n    for i, b in enumerate(bits):\n        idx |= ((1 if b else 0) << i)\n    out = TRUTH_MAP[idx]\n    return [(out >> j) & 1 for j in range(OUT_COUNT)]\n\nif __name__ == '__main__':\n    print('Truth Table')\n    print('Inputs:', ${JSON.stringify(model.inputIndices.map(i => `S${i}`))})\n    print('Outputs:', ${JSON.stringify(model.outputIndices.map(i => `L${i}`))})\n    total = 1 << IN_COUNT\n    for idx in range(total):\n        bits = [(idx >> i) & 1 for i in range(IN_COUNT)]\n        out_bits = evaluate(bits)\n        in_str = ''.join(str(b) for b in bits)\n        out_str = ''.join(str(b) for b in out_bits)\n        print(f'{in_str} -> {out_str}')\n`;
    }

    generateCppCode(model) {
        const mapVals = model.rows
            .map((row) => row.outputBits.reduce((acc, bit, j) => acc | ((bit === '1' ? 1 : 0) << j), 0))
            .join(', ');
        return `// Auto-generated by Web IC Trainer\n#include <array>\n#include <cstdint>\n#include <iostream>\n\nconstexpr int IN_COUNT = ${model.inputIndices.length};\nconstexpr int OUT_COUNT = ${model.outputIndices.length};\nconstexpr std::array<uint8_t, ${model.map.length}> TRUTH_MAP = { ${mapVals} };\n\nstd::array<uint8_t, OUT_COUNT> evaluate(const std::array<uint8_t, IN_COUNT>& in) {\n    uint16_t idx = 0;\n    for (int i = 0; i < IN_COUNT; ++i) idx |= ((in[i] & 1) << i);\n    uint8_t out = TRUTH_MAP[idx];\n    std::array<uint8_t, OUT_COUNT> y{};\n    for (int j = 0; j < OUT_COUNT; ++j) y[j] = (out >> j) & 1;\n    return y;\n}\n\nint main() {\n    std::cout << "Truth Table\\n";\n    for (int idx = 0; idx < (1 << IN_COUNT); ++idx) {\n        std::array<uint8_t, IN_COUNT> in{};\n        for (int i = 0; i < IN_COUNT; ++i) in[i] = (idx >> i) & 1;\n\n        auto out = evaluate(in);\n\n        for (int i = 0; i < IN_COUNT; ++i) std::cout << int(in[i]);\n        std::cout << " -> ";\n        for (int j = 0; j < OUT_COUNT; ++j) std::cout << int(out[j]);\n        std::cout << "\\n";\n    }\n    return 0;\n}\n`;
    }

    generateVerilogCode(model) {
        const inW = model.inputIndices.length - 1;
        const outW = model.outputIndices.length - 1;
        const cases = model.rows.map((r, i) => `      ${model.inputIndices.length}'b${r.inputBits.slice().reverse().join('')}: out = ${model.outputIndices.length}'b${model.map[i].split('').reverse().join('')};`).join('\n');
        return `// Auto-generated by Web IC Trainer\nmodule web_ic_trainer_logic (\n    input  wire [${inW}:0] in,\n    output reg  [${outW}:0] out\n);\n\nalways @(*) begin\n    case (in)\n${cases}\n      default: out = ${model.outputIndices.length}'b0;\n    endcase\nend\n\nendmodule\n`;
    }
    setupCircuitJsonIO() {
        const saveBtn = document.getElementById('save-json-btn');
        const loadBtn = document.getElementById('load-json-btn');
        const fileInput = document.getElementById('json-file-input');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const payload = this.buildCircuitJson();
                const text = JSON.stringify(payload, null, 2);
                const filename = `ic-trainer-circuit-${Date.now()}.json`;
                this.downloadTextFile(filename, text, 'application/json');
                this.log('System', 'S', `Circuit exported: ${filename}`);
            });
        }

        if (loadBtn && fileInput) {
            loadBtn.addEventListener('click', () => {
                fileInput.value = '';
                fileInput.click();
            });

            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                try {
                    const text = await file.text();
                    // Hard refresh before applying JSON to guarantee clean simulation state.
                    sessionStorage.setItem('trainer_pending_json', text);
                    sessionStorage.setItem('trainer_pending_json_source', file.name);
                    location.reload();
                } catch (err) {
                    console.error(err);
                    this.log('Error', '!', 'Failed to read JSON file');
                    alert('Failed to read JSON file.');
                }
            });
        }
    }

    buildCircuitJson() {
        const switches = [];
        document.querySelectorAll('#input-switches .switch-box').forEach(box => {
            switches.push(box.classList.contains('active') ? 1 : 0);
        });

        const shouldSkipAutoPowerWire = (wire) => {
            const isPowerRail = (pin) => pin === 'vcc' || pin === 'gnd';
            const isICPin = (pin) => /^ic-\d+-pin-\d+$/.test(pin);

            const sideAIsRail = isPowerRail(wire.source) && isICPin(wire.target);
            const sideBIsRail = isPowerRail(wire.target) && isICPin(wire.source);
            if (!sideAIsRail && !sideBIsRail) return false;

            const icPinId = isICPin(wire.source) ? wire.source : wire.target;
            const railPin = isPowerRail(wire.source) ? wire.source : wire.target;

            const match = icPinId.match(/^(ic-\d+)-pin-(\d+)$/);
            if (!match) return false;

            const socketId = match[1];
            const pinNum = parseInt(match[2], 10);
            const ic = this.icInstances.get(socketId);
            if (!ic) return false;

            return (railPin === 'vcc' && pinNum === ic.vccPin) ||
                (railPin === 'gnd' && pinNum === ic.gndPin);
        };

        return {
            schema: 'ic-trainer-circuit-v1',
            createdAt: new Date().toISOString(),
            powerOn: this.isPowered,
            presetId: this.currentPresetId || null,
            presetTitle: (this.currentPresetId && this.presetExperiments.find(p => p.id === this.currentPresetId)?.title) || null,
            expressionMeta: this.expressionMeta ? { ...this.expressionMeta } : null,
            ics: Array.from(this.icInstances.entries()).map(([socket, ic]) => ({
                socket,
                type: ic.name
            })),
            wires: this.wiring.wires
                .filter(w => !shouldSkipAutoPowerWire(w))
                .map(w => ({
                source: w.source,
                target: w.target,
                color: w.color
                })),
            switches
        };
    }

    downloadTextFile(filename, text, mimeType) {
        const blob = new Blob([text], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    importCircuitJsonText(text, sourceLabel = 'JSON') {
        let payload = null;
        try {
            payload = JSON.parse(text);
        } catch (err) {
            this.log('Error', '!', `Invalid JSON syntax in ${sourceLabel}`);
            alert(`Invalid JSON syntax in ${sourceLabel}.`);
            return false;
        }

        const report = this.validateCircuitJson(payload);
        const summaryLines = [
            `Source: ${sourceLabel}`,
            `Can run: ${report.errors.length === 0 ? 'YES' : 'NO'}`,
            `Errors: ${report.errors.length}`,
            `Warnings: ${report.warnings.length}`,
            `Used ICs: ${report.usedICs.length ? report.usedICs.join(', ') : 'None'}`,
            `Unavailable ICs: ${report.unavailableICs.length ? report.unavailableICs.join(', ') : 'None'}`,
            `Available ICs: ${report.availableICs.join(', ')}`
        ];

        summaryLines.forEach(line => this.log('JSON', 'J', line));
        report.errors.forEach(err => this.log('Error', '!', err));
        report.warnings.forEach(warn => this.log('System', 'i', warn));

        if (report.errors.length > 0) {
            alert(`JSON load failed.\n\n${report.errors.join('\n')}`);
            return false;
        }

        const applyResult = this.applyCircuitJson(payload);
        if (!applyResult.ok) {
            alert(`JSON loaded with wiring issues.\n\n${applyResult.errors.join('\n')}`);
            return false;
        }

        this.log('JSON', 'J', 'Circuit loaded successfully from JSON');
        // Precaution: never auto-add imported JSON circuits to Preset Experiments.
        // Presets should come only from explicit Save JSON action or built-in presets.
        if (!this.preventImportedPresetPollution) {
            const source = String(sourceLabel || '').trim();
            const isExpressionImport = /^expression-build$/i.test(source) ||
                (payload && payload.expressionMeta && typeof payload.expressionMeta === 'object');
            const shouldPersistImportedPreset = !isExpressionImport;
            if (shouldPersistImportedPreset) {
                this.persistPresetJson(payload, `Imported ${sourceLabel}`);
            }
        }
        return true;
    }

    getSavedPresetRecords() {
        try {
            const raw = localStorage.getItem('trainer_saved_presets');
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            const filtered = parsed.filter(item =>
                item &&
                typeof item.id === 'string' &&
                typeof item.title === 'string' &&
                item.payload &&
                typeof item.payload === 'object' &&
                !/^Saved\s+\d/.test(item.title) &&
                !/^Imported\b/i.test(item.title) &&
                !/^Imported\s+logic-expression\b/i.test(item.title) &&
                !/^Imported\s+expression-build\b/i.test(item.title) &&
                !(item.payload && item.payload.expressionMeta && typeof item.payload.expressionMeta === 'object')
            );

            // Persist cleanup so removed auto-import entries do not return.
            if (filtered.length !== parsed.length) {
                try {
                    localStorage.setItem('trainer_saved_presets', JSON.stringify(filtered));
                } catch (err) {
                    console.warn('Failed to clean up saved presets:', err);
                }
            }

            return filtered;
        } catch (err) {
            console.warn('Failed to read saved presets:', err);
            return [];
        }
    }

    persistPresetJson(payload, title = 'Saved Circuit') {
        if (!payload || typeof payload !== 'object') return;

        const entry = {
            id: `saved-${Date.now()}`,
            title: String(title),
            description: this.buildPresetDescriptionFromPayload(payload),
            payload
        };

        const records = this.getSavedPresetRecords();
        records.unshift(entry);
        const deduped = [];
        const seen = new Set();

        records.forEach((item) => {
            const key = JSON.stringify(item.payload);
            if (seen.has(key)) return;
            seen.add(key);
            deduped.push(item);
        });

        const maxPresets = 20;
        const trimmed = deduped.slice(0, maxPresets);

        try {
            localStorage.setItem('trainer_saved_presets', JSON.stringify(trimmed));
        } catch (err) {
            console.warn('Failed to persist preset JSON:', err);
        }

        if (Array.isArray(this.presetExperiments)) {
            const payloadKey = JSON.stringify(payload);
            const exists = this.presetExperiments.some(p => JSON.stringify(p?.payload || null) === payloadKey);
            if (!exists) {
                this.presetExperiments.unshift({ ...entry, source: 'saved-json' });
            }
        }
    }

    buildPresetDescriptionFromPayload(payload) {
        const icCount = Array.isArray(payload.ics) ? payload.ics.length : 0;
        const wireCount = Array.isArray(payload.wires) ? payload.wires.length : 0;
        const powered = payload.powerOn ? 'Power ON' : 'Power OFF';
        return `${icCount} IC(s), ${wireCount} wire(s), ${powered}`;
    }
    validateCircuitJson(payload) {
        const errors = [];
        const warnings = [];
        const availableICs = icRegistry.getAll().map(x => x.id);
        const availableICSet = new Set(availableICs);
        const knownSockets = new Set(['ic-1', 'ic-2', 'ic-3', 'ic-4']);
        const icInfoMap = new Map(icRegistry.getAll().map(x => [x.id, x]));

        if (!payload || typeof payload !== 'object') {
            return {
                errors: ['Top-level JSON must be an object.'],
                warnings: [],
                usedICs: [],
                unavailableICs: [],
                availableICs
            };
        }

        if (!Array.isArray(payload.ics)) {
            errors.push('`ics` must be an array.');
        }
        if (!Array.isArray(payload.wires)) {
            errors.push('`wires` must be an array.');
        }
        if (!Array.isArray(payload.switches)) {
            warnings.push('`switches` is missing or not an array. Defaults will be used.');
        }

        const usedICs = Array.isArray(payload.ics)
            ? payload.ics.map(x => x?.type).filter(Boolean)
            : [];
        const unavailableICs = usedICs.filter(type => !availableICSet.has(type));

        if (unavailableICs.length > 0) {
            errors.push(`Unavailable ICs in file: ${Array.from(new Set(unavailableICs)).join(', ')}`);
        }

        const socketUsage = new Set();
        const socketToType = new Map();
        if (Array.isArray(payload.ics)) {
            if (payload.ics.length > 4) {
                errors.push(`Only 4 IC sockets are available, but JSON has ${payload.ics.length} ICs.`);
            }

            payload.ics.forEach((entry, index) => {
                if (!entry || typeof entry !== 'object') {
                    errors.push(`ics[${index}] must be an object with { socket, type }.`);
                    return;
                }

                const { socket, type } = entry;
                if (!knownSockets.has(socket)) {
                    errors.push(`ics[${index}] uses invalid socket "${socket}". Valid: ic-1..ic-4.`);
                }
                if (socketUsage.has(socket)) {
                    errors.push(`Duplicate IC assignment for socket "${socket}".`);
                }
                socketUsage.add(socket);
                socketToType.set(socket, type);

                if (!type || !availableICSet.has(type)) {
                    errors.push(`ics[${index}] uses unknown IC type "${type}".`);
                }
            });
        }

        const validPins = new Set([
            'vcc', 'gnd', 'gnd-2',
            'clock-gnd', 'clock-1hz', 'clock-10hz', 'clock-100hz', 'clock-1khz', 'clock-10khz',
            'pulse-out', 'pulse-gnd',
            'bcd-a', 'bcd-b', 'bcd-c', 'bcd-d', 'bcd-out-a', 'bcd-out-b', 'bcd-out-c', 'bcd-out-d'
        ]);

        for (let i = 0; i < 8; i++) {
            validPins.add(`switch-${i}`);
            validPins.add(`led-${i}-in`);
        }

        socketToType.forEach((type, socket) => {
            const icInfo = icInfoMap.get(type);
            const pinCount = icInfo?.pinCount || 0;
            for (let pin = 1; pin <= pinCount; pin++) {
                validPins.add(`${socket}-pin-${pin}`);
            }
        });

        if (Array.isArray(payload.wires)) {
            payload.wires.forEach((wire, index) => {
                if (!wire || typeof wire !== 'object') {
                    errors.push(`wires[${index}] must be an object.`);
                    return;
                }
                const { source, target } = wire;
                if (typeof source !== 'string' || typeof target !== 'string') {
                    errors.push(`wires[${index}] must have string "source" and "target".`);
                    return;
                }
                if (!validPins.has(source)) {
                    errors.push(`wires[${index}] source pin not found: "${source}".`);
                }
                if (!validPins.has(target)) {
                    errors.push(`wires[${index}] target pin not found: "${target}".`);
                }
            });
        }

        return { errors, warnings, usedICs, unavailableICs, availableICs };
    }

    applyCircuitJson(payload) {
        const errors = [];
        const switches = Array.isArray(payload.switches) ? payload.switches : [];
        const ics = Array.isArray(payload.ics) ? payload.ics : [];
        const wires = Array.isArray(payload.wires) ? payload.wires : [];

        this.clearBoardForPreset();

        ics.forEach(entry => {
            const socketEl = document.getElementById(entry.socket);
            if (!socketEl) {
                errors.push(`Socket not found: ${entry.socket}`);
                return;
            }
            this.placeIC(entry.type, socketEl, false);
            if (!this.icInstances.has(entry.socket)) {
                errors.push(`Failed to place IC "${entry.type}" in ${entry.socket}`);
            }
        });

        for (let i = 0; i < 8; i++) {
            const val = switches[i];
            this.setSwitchState(i, val === 1 || val === true || val === '1');
        }

        wires.forEach(wire => {
            const ok = this.connectPins(wire.source, wire.target, wire.color || 'var(--color-text)');
            if (!ok) {
                errors.push(`Failed wire: ${wire.source} -> ${wire.target}`);
            }
        });

        const shouldPowerOn = !!payload.powerOn;
        if (shouldPowerOn) {
            this.ensurePowerOn();
        } else if (this.isPowered) {
            document.getElementById('power-btn')?.click();
        }

        this.expressionMeta = payload && payload.expressionMeta && typeof payload.expressionMeta === 'object'
            ? { ...payload.expressionMeta }
            : null;
        this.syncExpressionContextUI();

        return { ok: errors.length === 0, errors };
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
                const driverFn = this.pinDrivers.get(pinId);
                if (driverFn) {
                    this.engine.addDriver(newNode.id, driverFn);
                }

                const listenerFn = this.pinListeners.get(pinId);
                if (listenerFn) {
                    this.engine.addListener(newNode.id, listenerFn);
                }

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
                const nextTheme = isDark ? 'light' : 'dark';
                document.body.parentElement.setAttribute('data-theme', nextTheme);
                try {
                    localStorage.setItem('ic-trainer-theme', nextTheme);
                } catch (err) {
                    console.warn('Theme preference could not be saved:', err);
                }
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
    window.controller.applyPendingPresetOnLoad();
    window.controller.applyPendingJsonOnLoad();

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

    // Global helpers for agent-generated JSON workflows
    window.exportCircuitJSON = () => window.controller.buildCircuitJson();
    window.loadCircuitJSON = (jsonInput) => {
        const text = typeof jsonInput === 'string' ? jsonInput : JSON.stringify(jsonInput);
        return window.controller.importCircuitJsonText(text, 'console-input');
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
        const fallbackCopyText = (text) => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            textarea.style.pointerEvents = 'none';
            textarea.style.top = '-9999px';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();

            let ok = false;
            try {
                ok = document.execCommand('copy');
            } catch (err) {
                ok = false;
            }

            textarea.remove();
            return ok;
        };

        const copyText = async (text) => {
            if (navigator.clipboard && window.isSecureContext) {
                try {
                    await navigator.clipboard.writeText(text);
                    return true;
                } catch (err) {
                    // Fall back to execCommand.
                }
            }
            return fallbackCopyText(text);
        };

        const showCopyFeedback = (ok) => {
            const originalText = copyLogBtn.textContent;
            copyLogBtn.textContent = ok ? 'Copied!' : 'Copy Failed';
            copyLogBtn.style.background = ok ? 'var(--color-success)' : 'var(--color-danger)';
            copyLogBtn.style.color = 'white';

            setTimeout(() => {
                copyLogBtn.textContent = originalText;
                copyLogBtn.style.background = '';
                copyLogBtn.style.color = '';
            }, 2000);
        };

        copyLogBtn.addEventListener('click', async () => {
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

            const copied = await copyText(logText);
            showCopyFeedback(copied);

            if (copied) {
                window.controller.log('System', 'Copy', 'Activity log copied to clipboard');
            } else {
                window.controller.log('Error', '!', 'Failed to copy log to clipboard');
            }
        });
    }
});









