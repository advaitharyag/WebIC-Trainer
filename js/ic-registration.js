/**
 * Digital IC Trainer - IC Registration
 * Registers all ICs with the registry system
 */

import { icRegistry } from './ic-registry.js';
import {
    LS00, LS02, LS04, LS08, LS32, LS86,
    LS74, LS76,
    LS90, LS93,
    LS138, LS47,
    LS151, LS153, LS157,
    LS283
} from './ic-implementations.js';

// Register all ICs
icRegistry.register({
    id: '74LS00',
    class: LS00,
    name: '74LS00',
    description: 'Quad 2-Input NAND Gate',
    pinCount: 14
});

icRegistry.register({
    id: '74LS02',
    class: LS02,
    name: '74LS02',
    description: 'Quad 2-Input NOR Gate',
    pinCount: 14
});

icRegistry.register({
    id: '74LS04',
    class: LS04,
    name: '74LS04',
    description: 'Hex Inverter',
    pinCount: 14
});

icRegistry.register({
    id: '74LS08',
    class: LS08,
    name: '74LS08',
    description: 'Quad 2-Input AND Gate',
    pinCount: 14
});

icRegistry.register({
    id: '74LS32',
    class: LS32,
    name: '74LS32',
    description: 'Quad 2-Input OR Gate',
    pinCount: 14
});

icRegistry.register({
    id: '74LS86',
    class: LS86,
    name: '74LS86',
    description: 'Quad 2-Input XOR Gate',
    pinCount: 14
});

icRegistry.register({
    id: '74LS74',
    class: LS74,
    name: '74LS74',
    description: 'Dual D-Type Positive-Edge-Triggered Flip-Flop',
    pinCount: 14
});

icRegistry.register({
    id: '74LS76',
    class: LS76,
    name: '74LS76',
    description: 'Dual JK Negative-Edge-Triggered Flip-Flop',
    pinCount: 16
});

icRegistry.register({
    id: '74LS90',
    class: LS90,
    name: '74LS90',
    description: 'Decade Counter (Divide-by-10)',
    pinCount: 14
});

icRegistry.register({
    id: '74LS93',
    class: LS93,
    name: '74LS93',
    description: '4-Bit Binary Counter (Divide-by-16)',
    pinCount: 14
});

icRegistry.register({
    id: '74LS138',
    class: LS138,
    name: '74LS138',
    description: '3-to-8 Line Decoder/Demultiplexer',
    pinCount: 16
});

icRegistry.register({
    id: '74LS47',
    class: LS47,
    name: '74LS47',
    description: 'BCD to 7-Segment Decoder/Driver',
    pinCount: 16
});

icRegistry.register({
    id: '74LS151',
    class: LS151,
    name: '74LS151',
    description: '8-to-1 Data Selector/Multiplexer',
    pinCount: 16
});

icRegistry.register({
    id: '74LS153',
    class: LS153,
    name: '74LS153',
    description: 'Dual 4-to-1 Multiplexer',
    pinCount: 16
});

icRegistry.register({
    id: '74LS157',
    class: LS157,
    name: '74LS157',
    description: 'Quad 2-to-1 Data Selector/Multiplexer',
    pinCount: 16
});

icRegistry.register({
    id: '74LS283',
    class: LS283,
    name: '74LS283',
    description: '4-Bit Binary Full Adder',
    pinCount: 16
});

export { icRegistry };
