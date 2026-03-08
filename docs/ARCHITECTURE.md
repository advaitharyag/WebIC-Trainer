# Architecture Overview

Web IC Trainer is a client-side simulation app with a modular JavaScript design.

## Core Modules

- `simulation.js`: Logic state engine and node resolution.
- `wiring-engine.js`: Wire creation/removal and pin-node mapping.
- `ttl-chip.js`: Base model for TTL IC behavior.
- `ic-implementations.js`: Concrete chip implementations.
- `ic-registration.js` + `ic-registry.js`: IC metadata and registration.
- `clock-manager.js`: Clock source generation.
- `ui.js`: Main orchestration and DOM interactions.

## UI Flow

1. User action in the UI
2. Wiring or IC state update
3. Engine step + node resolution
4. UI refresh (sockets, LEDs, displays, logs)

## Data Persistence

Circuit state can be exported/imported as JSON.

## Future Improvement Ideas

- Formal simulation unit tests
- Deterministic playback for experiments
- Expanded preset library
