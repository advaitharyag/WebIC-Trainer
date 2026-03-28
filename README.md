# Web IC Trainer

Web IC Trainer is a browser-based digital logic lab for building, wiring, testing, and exporting TTL IC circuits.

It is designed for practical learning, fast prototyping, and demo-ready experimentation in classrooms, labs, and hackathons.

## Live Demo

- [https://webictrainer.vercel.app/](https://webictrainer.vercel.app/)

## What You Can Do

- Place and remove TTL ICs on 4 sockets (`ic-1` to `ic-4`)
- Wire any valid board pin using:
  - Drag and Drop mode
  - Click-to-Connect mode
- Use built-in trainer resources:
  - Power rails (`+5V`, `GND`, `+12V`, `-12V`)
  - Clock outputs (`1Hz`, `10Hz`, `100Hz`, `1kHz`, `10kHz`)
  - Mono pulse source
  - Input switches and LED outputs
  - BCD display section
- Run built-in and saved preset experiments
- Build circuits from Boolean expressions
- Generate truth tables automatically
- Open digital waveform viewer and capture channel activity
- Export generated logic code for:
  - Arduino
  - Python
  - C/C++
  - Verilog
- Save/load full circuits as JSON
- Open IC datasheets directly from Add IC modal

## Supported ICs (Current)

- 74LS00, 74LS02, 74LS04, 74LS08, 74LS32, 74LS86
- 74LS74, 74LS76
- 74LS90, 74LS93
- 74LS138, 74LS47
- 74LS151, 74LS153, 74LS157
- 74LS283

## Major Features

### 1. Add IC + Datasheet Links

- Open **Add IC**
- Select an empty socket
- Choose IC from modal
- Click **View Datasheet** under any IC card to open PDF in a new tab

Datasheet links are configured in:

- `js/ui.js` -> `DATASHEET_URLS`

### 2. Boolean Expression Builder

- Use **Bool Expr** panel in toolbar
- Enter expression format:
  - `F = (A+B).C`
  - Supports `+` (OR), `.` (AND), `'` (NOT), `^` (XOR), parentheses, implicit AND
- Build action auto-generates TTL IC placement/wiring

### 3. Truth Table Generator

- Click **Truth Table**
- Generates table from current circuit wiring
- Supports export/download flow already integrated in UI logic

### 4. Waveform Viewer

- Click **Waveform** to open viewer
- Add channels from available signals
- Controls include Run/Pause/Stop/Clear and CSV export
- Timebase selectable in viewer

### 5. Code Generator

- Click **Generate Code**
- Choose target from dropdown:
  - Arduino / Python / C++ / Verilog / All

### 6. JSON Save/Load

- **Save JSON** exports full circuit snapshot
- **Load JSON** validates and applies a JSON circuit
- Includes strong validation for IC types, socket IDs, and pin references

## Circuit JSON Format

The app uses schema `ic-trainer-circuit-v1`.

Example:

```json
{
  "schema": "ic-trainer-circuit-v1",
  "createdAt": "2026-03-22T00:00:00.000Z",
  "powerOn": false,
  "presetId": null,
  "presetTitle": null,
  "expressionMeta": null,
  "ics": [
    { "socket": "ic-1", "type": "74LS08" }
  ],
  "wires": [
    { "source": "switch-0", "target": "ic-1-pin-1", "color": "var(--color-text)" }
  ],
  "switches": [0, 1, 0, 0, 0, 0, 0, 0]
}
```

## Quick Start

### Run Locally (No Build Step)

1. Clone repo
2. Open a local server from project root
3. Open `http://localhost:8080/` (or your selected port)
4. The app opens directly to the trainer (`index.html`) with no landing-page redirect

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

## Project Structure

```text
.
|-- index.html
|-- .gitignore
|-- js/
|   |-- ui.js
|   |-- simulation.js
|   |-- wiring-engine.js
|   |-- ttl-chip.js
|   |-- clock-manager.js
|   |-- ic-registration.js
|   |-- ic-registry.js
|   `-- ic-implementations.js
|-- presets/
|   `-- *.json
|-- docs/
|   `-- ARCHITECTURE.md
|-- .github/workflows/ci.yml
|-- CONTRIBUTING.md
|-- LICENSE
`-- README.md
```

## Developer Notes

- Main app orchestration: `js/ui.js`
- Logic engine: `js/simulation.js`
- Wire graph + node merge: `js/wiring-engine.js`
- IC behavior implementations: `js/ic-implementations.js`
- IC metadata/registration: `js/ic-registration.js` and `js/ic-registry.js`

## Troubleshooting

### UI opens but actions do not work

- Run with local server (not `file://`)
- Check browser console for module load errors

### JSON load fails

- Confirm JSON is valid
- Ensure IC types are supported
- Ensure socket IDs are only `ic-1..ic-4`
- Ensure pin IDs referenced in wires exist

### Datasheet link not opening

- Verify URL exists in `DATASHEET_URLS` in `js/ui.js`
- Verify URL is reachable from browser

## Contributing

Contributions are welcome.

- Read [CONTRIBUTING.md](./CONTRIBUTING.md)
- Open issues/PRs using templates

## License

MIT License. See [LICENSE](./LICENSE).
