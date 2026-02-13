/**
 * Digital IC Trainer - Main UI Controller
 * Integrates Simulation, Wiring, and UI interactions.
 */

import { CircuitEngine, STATE_LOW, STATE_HIGH, STATE_FLOAT, STATE_ERROR } from './simulation.js';
import { WiringManager } from './wiring-engine.js';
import { createIC, IC_CATALOG } from './ic-definitions.js';

class SystemController {
    constructor() {
        this.engine = new CircuitEngine();
        this.wiring = new WiringManager(this.engine);
        this.icInstances = new Map(); // socketId -> IC Object

        // Global Power Rails
        this.vccNode = this.engine.createNode();
        this.vccNode.state = STATE_HIGH;
        this.vccNode.isVCC = true;
        this.engine.addDriver(this.vccNode.id, () => STATE_HIGH);

        this.gndNode = this.engine.createNode();
        this.gndNode.state = STATE_LOW;
        this.gndNode.isGND = true;
        this.engine.addDriver(this.gndNode.id, () => STATE_LOW);

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
            const nodeId = this.wiring.pinToNode.get(pinId);

            if (!nodeId) {
                // Not connected to any node
                socket.classList.remove('state-high', 'state-low', 'state-float', 'state-error');
                return;
            }

            const node = this.engine.nodes.get(nodeId);
            if (!node) return;

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

        // Register Power Rails Wiring
        // We added data-pin-id to HTML, but we need to register them to nodes
        this.wiring.registerPin('vcc', this.vccNode.id);
        this.wiring.registerPin('gnd', this.gndNode.id);
        this.wiring.registerPin('gnd-2', this.gndNode.id);
        // We don't have +/-12V in engine yet, map to Open or Gnd? 
        // For logic trainer, often just VCC/GND matters.
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

            // Label
            const label = document.createElement('span');
            label.className = 'switch-number';
            label.innerText = `S${i}`;

            group.append(box, socket, label);
            container.appendChild(group);

            // Logic
            const switchNode = this.engine.createNode();
            this.wiring.registerPin(`switch-${i}`, switchNode.id);

            let switchState = STATE_LOW;

            // Driver function
            this.engine.addDriver(switchNode.id, () => this.isPowered ? switchState : STATE_FLOAT);

            box.addEventListener('click', () => {
                box.classList.toggle('active');
                switchState = box.classList.contains('active') ? STATE_HIGH : STATE_LOW;
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
            this.wiring.registerPin(`led-${i}-in`, ledNode.id);

            this.engine.addListener(ledNode.id, (state) => {
                if (!this.isPowered) {
                    led.className = 'led';
                    return;
                }
                if (state === STATE_HIGH) led.className = 'led on';
                else if (state === STATE_ERROR) {
                    led.className = 'led on';
                    led.style.backgroundColor = 'purple';
                }
                else {
                    led.className = 'led';
                    led.style.backgroundColor = '';
                }
            });
        }
    }

    setupClock() {
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
            this.wiring.registerPin(pinId, clockNode.id);

            let clockState = STATE_LOW;
            const halfPeriod = (1000 / freq) / 2; // Half period in milliseconds

            // Driver function that returns current clock state
            this.engine.addDriver(clockNode.id, () => {
                return this.isPowered ? clockState : STATE_FLOAT;
            });

            // Toggle clock state at the specified frequency
            setInterval(() => {
                if (this.isPowered) {
                    clockState = (clockState === STATE_HIGH) ? STATE_LOW : STATE_HIGH;
                    this.engine.scheduleNodeUpdate(clockNode.id, 0);
                }
            }, halfPeriod);
        });

        this.log('System', '⏱️', 'Clock generators initialized (1Hz to 10KHz)');
    }

    setupICModal() {
        const modal = document.getElementById('ic-modal');
        const grid = document.getElementById('available-ics');
        const addBtn = document.getElementById('add-ic-btn');
        const cancel = document.getElementById('modal-cancel');
        const confirm = document.getElementById('modal-confirm');

        let selectedIC = null;
        let targetSocket = null;

        // Populate Grid
        Object.entries(IC_CATALOG).forEach(([key, ic]) => {
            const card = document.createElement('div');
            card.className = 'ic-card';
            card.innerHTML = `
                <div class="ic-card-name">${key}</div>
                <div class="ic-card-desc">${ic.desc}</div>
            `;
            card.onclick = () => {
                document.querySelectorAll('.ic-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedIC = key;
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
        const ic = createIC(icName, socketId);
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

        // Left: sidePins + 1 to pinCount (Top-Down)
        // User wants higher numbered pins on LEFT side
        for (let i = sidePins + 1; i <= ic.pinCount; i++) {
            this.createPinUI(leftPins, i, socketId);
        }

        // Right: 1 to sidePins (Top-Down)
        // User wants lower numbered pins on RIGHT side
        for (let i = 1; i <= sidePins; i++) {
            this.createPinUI(rightPins, i, socketId);
        }

        // Initialize IC Logic
        if (ic.setup) ic.setup(this.engine);
        if (ic.runLogic) ic.runLogic(this.engine);

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
            // Remove IC's pins from wiring? 
            // Ideally we should disconnect them. 
            // For now, logic nodes persist but wrappers go away. 
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
        this.wiring.registerPin(pinId, node.id);

        const ic = this.icInstances.get(socketId);
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

        this.wiring.onNetUpdate = (pins, newNode) => {
            pins.forEach(pinId => {
                if (pinId.startsWith('ic-')) {
                    const parts = pinId.split('-');
                    const icId = `${parts[0]}-${parts[1]}`;
                    const pinNum = parseInt(parts[3]);
                    const ic = this.icInstances.get(icId);
                    if (ic) {
                        ic.setPinNode(pinNum, newNode);
                    }
                }
            });
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
                    this.wiring.removeWire(wireId);
                    this.removeWireUI(wireId);
                    this.pushAction({ type: 'removeWire', data: wire });
                    this.log('Wire', '✂️', 'Wire removed');
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
                        this.wiring.removeWire(wireId);
                        this.removeWireUI(wireId);
                        this.pushAction({ type: 'removeWire', data: wire });
                        this.log('Wire', '✂️', 'Wire removed');
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
        if (el) el.remove();
    }
}

// Start Controller when DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    window.controller = new SystemController();
});
