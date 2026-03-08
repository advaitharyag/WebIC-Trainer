# Web IC Trainer

Web IC Trainer is an interactive browser-based digital electronics sandbox focused on TTL logic learning, circuit prototyping, and quick classroom/lab demonstrations.

It lets you place ICs, wire pins, drive inputs, observe outputs, and save/reload complete circuit states as JSON.

## Live Demo

- https://webictrainer.vercel.app/


## Why This Project

- Learn core digital logic with hands-on interaction.
- Validate simple combinational and sequential logic setups quickly.
- Create repeatable experiment snapshots for teaching and revision.

## Key Features

- Interactive wiring with two modes:
  - **Drag & Drop** for rapid wiring
  - **Click to Connect** for precise point-to-point links
- IC placement/removal with automatic power pin hookup
- Built-in board resources:
  - +5V / GND rails
  - Clock outputs (1Hz, 10Hz, 100Hz, 1kHz, 10kHz)
  - Mono pulse source
  - Input switches and LED outputs
  - BCD to decimal section
- Undo/redo for wiring and IC actions
- Activity log terminal for state changes and events
- JSON export/import for full circuit persistence
- Light/dark theme toggle

## Tech Stack

- Plain HTML/CSS/JavaScript (ES modules)
- No required build step
- Runs fully in browser

## Quick Start

1. Clone the repository.
2. Open [ic-trainer-simulator.html](./ic-trainer-simulator.html) in a modern browser.
3. Turn power on, place ICs, wire pins, and test logic states.

### Optional: Local Server (recommended)

Some browsers have stricter local file restrictions. If needed, run a local server:

Option A (Python):

```powershell
cd D:\WebIC-Trainer
python -m http.server 8080
```

Option B (Node):

```powershell
cd D:\WebIC-Trainer
npx http-server -p 8080
```

Then open `http://localhost:8080/ic-trainer-simulator.html`.

## How To Use

### 1. Place an IC

- Click **Add IC**.
- Select an empty socket.
- Choose a component from the IC modal.

### 2. Wire the circuit

- Use **Drag & Drop** or **Click to Connect**.
- Connect switch outputs and clocks to IC inputs.
- Connect IC outputs to LED input sockets.

### 3. Run and observe

- Turn **Power** on.
- Toggle input switches and watch outputs / activity log.

### 4. Save / Load JSON

- **Save JSON** exports the exact board state.
- **Load JSON** imports a saved state and applies it to the board.

## JSON Circuit Format

Saved files use this schema (`ic-trainer-circuit-v1`):

```json
{
  "schema": "ic-trainer-circuit-v1",
  "createdAt": "2026-03-08T00:00:00.000Z",
  "powerOn": false,
  "presetId": null,
  "presetTitle": null,
  "ics": [
    { "socket": "ic-1", "type": "74LS08" }
  ],
  "wires": [
    { "source": "switch-0", "target": "ic-1-pin-1", "color": "var(--color-text)" }
  ],
  "switches": [0, 1, 0, 0, 0, 0, 0, 0]
}
```

Notes:

- `ics` must map only to `ic-1`..`ic-4`.
- `wires` pins must exist on the current board/IC setup.
- `switches` should include 8 values (`0/1` or `false/true`).

## Project Structure

```text
.
|-- ic-trainer-simulator.html
|-- js/
|   |-- simulation.js
|   |-- wiring-engine.js
|   |-- ui.js
|   |-- ic-registration.js
|   |-- ic-registry.js
|   |-- ic-implementations.js
|   |-- clock-manager.js
|   `-- ttl-chip.js
|-- docs/
|   `-- ARCHITECTURE.md
|-- presets/
|   `-- sample-empty-circuit.json
|-- .github/
|   |-- ISSUE_TEMPLATE/
|   |-- workflows/
|   `-- pull_request_template.md
|-- CONTRIBUTING.md
`-- LICENSE
```

## Supported IC Workflow

IC definitions are registered through:

- [js/ic-registration.js](./js/ic-registration.js)
- [js/ic-registry.js](./js/ic-registry.js)
- [js/ic-implementations.js](./js/ic-implementations.js)

To add a new IC:

1. Implement behavior in `ic-implementations.js`.
2. Register metadata and pin map.
3. Confirm pin logic updates and UI interaction.

## Development Notes

- Main controller and UI orchestration live in [js/ui.js](./js/ui.js).
- Engine/state resolution is in [js/simulation.js](./js/simulation.js).
- Wiring graph/merge logic is in [js/wiring-engine.js](./js/wiring-engine.js).

## Troubleshooting

### App opens but controls do not work

- Use a local server instead of opening as `file://`.
- Check browser console for module loading errors.

### JSON file fails to load

- Validate JSON syntax.
- Ensure `ics`, `wires`, and `switches` are present and correctly typed.
- Ensure referenced IC types are registered in the app.

### Wires look wrong after big changes

- Use reload for a full clean state reset.
- Then re-import JSON if needed.

## Roadmap

- More IC families and richer component library
- More experiment presets and teaching templates
- Better diagnostics, validation UX, and testing coverage
- Optional packaging/build workflow for deployment
- Schematic generator 
- VHDL,Verilog code generator 
- AI implementation like for circuit generation , debugger , helping etc


## Contributing

Contributions are welcome.

- Read [CONTRIBUTING.md](./CONTRIBUTING.md)
- Use the provided issue and PR templates

## License

This project is licensed under the MIT License.
See [LICENSE](./LICENSE).


