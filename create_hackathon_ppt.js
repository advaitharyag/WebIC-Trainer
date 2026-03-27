const PptxGenJS = require('pptxgenjs');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Web IC Trainer Team';
pptx.company = 'Web IC Trainer';
pptx.subject = 'Hackathon Project Deck';
pptx.title = 'Web IC Trainer - Hackathon Presentation';
pptx.lang = 'en-US';
pptx.theme = {
  headFontFace: 'Aptos Display',
  bodyFontFace: 'Aptos',
  lang: 'en-US'
};

const COLORS = {
  bg: '0F172A',
  panel: '111827',
  panelSoft: '1F2937',
  text: 'E5E7EB',
  muted: '94A3B8',
  accent: '22C55E',
  accent2: '38BDF8',
  warn: 'F59E0B',
  danger: 'EF4444',
  white: 'FFFFFF'
};

function addBackground(slide) {
  slide.background = { color: COLORS.bg };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.55,
    fill: { color: '0B1220' },
    line: { color: '0B1220' }
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 7.05,
    w: 13.33,
    h: 0.45,
    fill: { color: '0B1220' },
    line: { color: '0B1220' }
  });
}

function addHeader(slide, title, subtitle = '') {
  addBackground(slide);
  slide.addText('Web IC Trainer | Hackathon Deck', {
    x: 0.5,
    y: 0.15,
    w: 6.5,
    h: 0.2,
    fontSize: 11,
    color: COLORS.muted,
    bold: true
  });
  slide.addText(title, {
    x: 0.6,
    y: 0.72,
    w: 12.1,
    h: 0.5,
    fontSize: 30,
    color: COLORS.white,
    bold: true
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.6,
      y: 1.25,
      w: 12,
      h: 0.36,
      fontSize: 14,
      color: COLORS.muted
    });
  }
}

function addFooter(slide, text = 'Confidential - Hackathon Build') {
  slide.addText(text, {
    x: 0.6,
    y: 7.17,
    w: 6.5,
    h: 0.2,
    fontSize: 10,
    color: '64748B'
  });
}

function bullet(slide, items, x, y, w, h, fontSize = 18) {
  const runs = [];
  items.forEach((item) => {
    runs.push({
      text: `${item}`,
      options: { bullet: { indent: 18 } }
    });
  });
  slide.addText(runs, {
    x,
    y,
    w,
    h,
    fontSize,
    color: COLORS.text,
    breakLine: true,
    paraSpaceAfterPt: 12
  });
}

function addSectionCard(slide, title, content, x, y, w, h, accent = COLORS.accent2) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: COLORS.panelSoft, transparency: 5 },
    line: { color: accent, pt: 1.5 }
  });
  slide.addText(title, {
    x: x + 0.25,
    y: y + 0.18,
    w: w - 0.4,
    h: 0.3,
    fontSize: 16,
    color: COLORS.white,
    bold: true
  });
  slide.addText(content, {
    x: x + 0.25,
    y: y + 0.56,
    w: w - 0.45,
    h: h - 0.7,
    fontSize: 13,
    color: COLORS.text,
    valign: 'top'
  });
}

// Slide 1: Title
{
  const slide = pptx.addSlide();
  addBackground(slide);
  slide.addText('WEB IC TRAINER', {
    x: 0.7,
    y: 1.55,
    w: 8,
    h: 0.8,
    fontSize: 48,
    bold: true,
    color: COLORS.white
  });
  slide.addText('Hackathon Pitch Deck', {
    x: 0.75,
    y: 2.42,
    w: 6,
    h: 0.4,
    fontSize: 20,
    color: COLORS.accent2,
    bold: true
  });
  slide.addText('A browser-based digital logic lab for fast TTL circuit learning and prototyping', {
    x: 0.75,
    y: 3.0,
    w: 8.2,
    h: 0.7,
    fontSize: 16,
    color: COLORS.text
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 9.1,
    y: 1.3,
    w: 3.5,
    h: 4.8,
    fill: { color: COLORS.panel },
    line: { color: COLORS.accent, pt: 2 }
  });
  slide.addText('Hackathon Snapshot', {
    x: 9.35,
    y: 1.62,
    w: 3,
    h: 0.35,
    fontSize: 16,
    color: COLORS.white,
    bold: true
  });
  bullet(slide, [
    'Problem-first education product',
    'Live simulation + waveform + code export',
    'Zero install, runs in browser',
    'Built for classrooms, labs, demos'
  ], 9.35, 2.08, 3.05, 3.6, 14);

  addFooter(slide, 'Team: Web IC Trainer | Event: Hackathon');
}

// Slide 2: Agenda
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Agenda', 'Complete walkthrough of problem, solution, architecture, and roadmap');
  addSectionCard(slide, '1. Problem & Opportunity', 'Why digital logic training needs a better hands-on workflow.', 0.8, 1.9, 3.95, 1.45, COLORS.accent2);
  addSectionCard(slide, '2. Product Features', 'All core modules, trainer tools, and power-user capabilities.', 4.9, 1.9, 3.95, 1.45, COLORS.accent);
  addSectionCard(slide, '3. How Features Work', 'Logic engine, expression builder, truth table, waveform, code generation.', 9, 1.9, 3.55, 1.45, COLORS.warn);
  addSectionCard(slide, '4. Architecture & Flows', 'System architecture diagram + simulation and user flowcharts.', 0.8, 3.55, 5.8, 1.6, COLORS.accent);
  addSectionCard(slide, '5. Outcomes & Roadmap', 'Hackathon achievements, impact, and next milestone plan.', 6.8, 3.55, 5.75, 1.6, COLORS.accent2);
  addFooter(slide);
}

// Slide 3: Problem Statement
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Problem Statement', 'Students struggle to move from Boolean theory to practical IC wiring and debugging');

  addSectionCard(
    slide,
    'Current Pain Points',
    '1) Lab hardware is limited and not always accessible.\n2) Manual breadboard debugging consumes time.\n3) Simulation tools are often heavy, expensive, or hard to learn.\n4) Students do not get instant visibility into signal behavior.',
    0.8,
    1.9,
    6.2,
    4.5,
    COLORS.danger
  );

  addSectionCard(
    slide,
    'Our Problem Statement',
    'How might we give learners a fast, low-cost, browser-first platform to design, wire, simulate, and validate TTL logic circuits with immediate feedback?',
    7.25,
    1.9,
    5.25,
    2.05,
    COLORS.accent2
  );

  addSectionCard(
    slide,
    'Target Users',
    'Electronics students\nFaculty and lab instructors\nHackathon builders and hardware clubs',
    7.25,
    4.15,
    5.25,
    2.25,
    COLORS.accent
  );

  addFooter(slide);
}

// Slide 4: Solution Overview
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Solution Overview', 'Web IC Trainer turns circuit design, verification, and export into one integrated workflow');

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.9,
    y: 1.95,
    w: 11.65,
    h: 1.2,
    fill: { color: '0B3A2E' },
    line: { color: COLORS.accent, pt: 1.5 }
  });
  slide.addText('Single browser app combining IC placement, wiring, simulation, waveform analysis, and code generation', {
    x: 1.2,
    y: 2.3,
    w: 11.1,
    h: 0.5,
    fontSize: 17,
    color: COLORS.white,
    bold: true,
    align: 'center'
  });

  const cols = [
    {
      t: 'Design',
      d: 'Add TTL ICs\nConnect pins using drag/drop or click mode\nUse trainer rails and I/O resources'
    },
    {
      t: 'Simulate',
      d: 'Run logic engine\nObserve outputs (LED/BCD)\nTrack timing behavior with waveform viewer'
    },
    {
      t: 'Export & Reuse',
      d: 'Export Arduino/Python/C++/Verilog\nGenerate truth table\nSave/load full circuit JSON'
    }
  ];

  cols.forEach((c, i) => {
    addSectionCard(slide, c.t, c.d, 0.9 + i * 4.05, 3.45, 3.7, 2.75, i === 1 ? COLORS.accent2 : COLORS.accent);
  });

  addFooter(slide);
}

// Slide 5: Feature Coverage
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Complete Feature Coverage', 'Core features included in this hackathon build');

  const features = [
    'TTL IC placement on 4 sockets',
    'Dual wiring modes (drag/drop + click)',
    'Power rails, clock outputs, mono pulse',
    'Input switches, LEDs, BCD display support',
    'Preset experiments and custom save/load JSON',
    'Boolean expression to auto-build circuit',
    'Truth table generator',
    'Waveform viewer with CSV export',
    'Code generation: Arduino, Python, C/C++, Verilog',
    'One-click IC datasheet access in Add IC modal'
  ];

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.8,
    y: 1.9,
    w: 12,
    h: 4.9,
    fill: { color: COLORS.panelSoft },
    line: { color: COLORS.accent2, pt: 1.2 }
  });
  bullet(slide, features, 1.1, 2.2, 11.4, 4.4, 15);
  addFooter(slide);
}

// Slide 6: How Features Work
{
  const slide = pptx.addSlide();
  addHeader(slide, 'How Key Features Work', 'Feature mechanics and internal behavior');

  addSectionCard(
    slide,
    'Add IC + Datasheet',
    'User picks socket and IC type.\nMetadata is loaded from registry.\nDatasheet URLs are mapped in UI and opened in a new tab.',
    0.75,
    1.9,
    4.15,
    2.45,
    COLORS.accent2
  );

  addSectionCard(
    slide,
    'Boolean Expression Builder',
    'Expression parser supports OR(+), AND(.), NOT(\'), XOR(^), and implicit AND.\nSystem auto-places compatible gates and creates connections.',
    4.95,
    1.9,
    4.15,
    2.45,
    COLORS.accent
  );

  addSectionCard(
    slide,
    'Truth Table Generator',
    'Reads combinational behavior from active wiring graph.\nEvaluates all input combinations and renders outputs for analysis.',
    9.15,
    1.9,
    3.45,
    2.45,
    COLORS.warn
  );

  addSectionCard(
    slide,
    'Waveform + Code Export',
    'Waveform viewer captures channel transitions over time with controls (Run/Pause/Stop/Clear).\nCode generator emits implementation-ready logic for selected target language.',
    0.75,
    4.55,
    11.85,
    2.25,
    COLORS.accent2
  );

  addFooter(slide);
}

// Slide 7: Architecture Diagram
{
  const slide = pptx.addSlide();
  addHeader(slide, 'System Architecture Diagram', 'Modular client-side architecture with clear separation of concerns');

  const nodes = [
    { name: 'UI Layer\n(ui.js)', x: 0.8, y: 2.1, w: 2.4, h: 1.0, c: '1E3A8A' },
    { name: 'Wiring Engine\n(wiring-engine.js)', x: 3.7, y: 2.1, w: 2.6, h: 1.0, c: '0F766E' },
    { name: 'Simulation Engine\n(simulation.js)', x: 6.8, y: 2.1, w: 2.7, h: 1.0, c: '7C2D12' },
    { name: 'IC Models\n(ttl-chip.js + implementations)', x: 10.0, y: 2.1, w: 2.5, h: 1.0, c: '4C1D95' },
    { name: 'IC Registry\n(ic-registration + ic-registry)', x: 3.9, y: 4.25, w: 3.0, h: 1.0, c: '374151' },
    { name: 'Clock Manager\n(clock-manager.js)', x: 7.5, y: 4.25, w: 2.9, h: 1.0, c: '14532D' },
    { name: 'Persistence\n(JSON Save/Load)', x: 0.8, y: 4.25, w: 2.7, h: 1.0, c: '7F1D1D' }
  ];

  nodes.forEach((n) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: n.x,
      y: n.y,
      w: n.w,
      h: n.h,
      fill: { color: n.c },
      line: { color: COLORS.white, pt: 0.8 }
    });
    slide.addText(n.name, {
      x: n.x + 0.1,
      y: n.y + 0.22,
      w: n.w - 0.2,
      h: 0.6,
      fontSize: 12,
      color: COLORS.white,
      align: 'center'
    });
  });

  const arrows = [
    [3.25, 2.6, 0.4, 0], [6.35, 2.6, 0.4, 0], [9.55, 2.6, 0.35, 0],
    [5.15, 3.15, 0, 1.0], [8.15, 3.15, 0, 1.0], [2.15, 3.15, 0, 1.0],
    [6.95, 4.75, 0.45, 0]
  ];
  arrows.forEach(([x, y, w, h]) => {
    slide.addShape(pptx.ShapeType.line, {
      x,
      y,
      w,
      h,
      line: { color: COLORS.accent2, pt: 2, beginArrowType: 'none', endArrowType: 'triangle' }
    });
  });

  addFooter(slide);
}

// Slide 8: Simulation Flowchart
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Simulation Flowchart', 'How user actions become stable logic outputs');

  const steps = [
    { t: 'User Action\n(Add IC / Wire / Toggle Input)', y: 1.9, c: '1E3A8A' },
    { t: 'Update Circuit State\n(ICs, wires, pins)', y: 2.95, c: '0F766E' },
    { t: 'Build/Update Node Graph\n(merge connected pins)', y: 4.0, c: '7C2D12' },
    { t: 'Run Logic Evaluation\n(apply IC behavior)', y: 5.05, c: '4C1D95' },
    { t: 'Refresh UI\n(LED, BCD, waveform)', y: 6.1, c: '14532D' }
  ];

  steps.forEach((s) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 3.7,
      y: s.y,
      w: 5.9,
      h: 0.72,
      fill: { color: s.c },
      line: { color: COLORS.white, pt: 0.7 },
      rectRadius: 0.05
    });
    slide.addText(s.t, {
      x: 3.82,
      y: s.y + 0.15,
      w: 5.65,
      h: 0.4,
      fontSize: 13,
      color: COLORS.white,
      align: 'center'
    });
  });

  for (let i = 0; i < steps.length - 1; i += 1) {
    slide.addShape(pptx.ShapeType.line, {
      x: 6.65,
      y: steps[i].y + 0.72,
      w: 0,
      h: 0.25,
      line: { color: COLORS.accent2, pt: 2, endArrowType: 'triangle' }
    });
  }

  addFooter(slide);
}

// Slide 9: User Workflow Flowchart
{
  const slide = pptx.addSlide();
  addHeader(slide, 'User Journey Flowchart', 'End-to-end flow from idea to verifiable output');

  const boxes = [
    { t: 'Select ICs', x: 0.7, y: 3.1, w: 1.8, c: '1E3A8A' },
    { t: 'Wire Circuit', x: 2.8, y: 3.1, w: 1.9, c: '0F766E' },
    { t: 'Run Simulation', x: 5.0, y: 3.1, w: 2.0, c: '7C2D12' },
    { t: 'Check Outputs', x: 7.3, y: 3.1, w: 1.9, c: '4C1D95' },
    { t: 'Analyze Waveform', x: 9.5, y: 3.1, w: 2.1, c: '14532D' }
  ];

  boxes.forEach((b) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: b.x,
      y: b.y,
      w: b.w,
      h: 0.9,
      fill: { color: b.c },
      line: { color: COLORS.white, pt: 0.8 }
    });
    slide.addText(b.t, {
      x: b.x + 0.1,
      y: b.y + 0.28,
      w: b.w - 0.2,
      h: 0.3,
      fontSize: 12,
      color: COLORS.white,
      align: 'center'
    });
  });

  for (let i = 0; i < boxes.length - 1; i += 1) {
    slide.addShape(pptx.ShapeType.line, {
      x: boxes[i].x + boxes[i].w,
      y: 3.55,
      w: boxes[i + 1].x - (boxes[i].x + boxes[i].w) - 0.05,
      h: 0,
      line: { color: COLORS.accent2, pt: 2, endArrowType: 'triangle' }
    });
  }

  addSectionCard(slide, 'Optional Branches', 'Generate Truth Table -> Export Code -> Save JSON\nLoad JSON/Preset -> Re-run -> Compare outputs', 2.2, 4.45, 8.9, 1.65, COLORS.warn);
  addFooter(slide);
}

// Slide 10: Tech Stack + Modules
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Tech Stack And Module Ownership', 'Lightweight static app architecture for fast delivery and easy deployment');

  addSectionCard(slide, 'Frontend', 'HTML + CSS + Vanilla JavaScript\nNo heavy build chain required', 0.8, 1.9, 4.0, 1.75, COLORS.accent2);
  addSectionCard(slide, 'Simulation Core', 'Node graph resolution\nTTL behavior modeling\nClock and pulse integration', 4.95, 1.9, 4.0, 1.75, COLORS.accent);
  addSectionCard(slide, 'Persistence', 'Schema: ic-trainer-circuit-v1\nSave/load complete state JSON', 9.1, 1.9, 3.4, 1.75, COLORS.warn);

  addSectionCard(slide, 'Exporters', 'Arduino, Python, C/C++, Verilog\nCSV export from waveform viewer', 0.8, 3.95, 5.75, 1.95, COLORS.accent);
  addSectionCard(slide, 'Deployment', 'Static hosting ready\nWorks on local server or Vercel', 6.75, 3.95, 5.75, 1.95, COLORS.accent2);

  addFooter(slide);
}

// Slide 11: Hackathon Execution
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Hackathon Execution Timeline', 'How the solution was built in rapid iterations');

  const phases = [
    { n: 'Phase 1', t: 'Core Board Setup', d: 'Sockets, IC placement, basic wiring', x: 0.8, c: '1E3A8A' },
    { n: 'Phase 2', t: 'Logic Engine', d: 'Node mapping + IC behavior evaluation', x: 3.35, c: '0F766E' },
    { n: 'Phase 3', t: 'Learning Tools', d: 'Expression builder + truth table', x: 5.9, c: '7C2D12' },
    { n: 'Phase 4', t: 'Validation Tools', d: 'Waveform viewer + presets + JSON', x: 8.45, c: '4C1D95' },
    { n: 'Phase 5', t: 'Output Tools', d: 'Multi-language code generation', x: 11.0, c: '14532D' }
  ];

  phases.forEach((p) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: p.x,
      y: 2.45,
      w: 2.25,
      h: 2.7,
      fill: { color: p.c },
      line: { color: COLORS.white, pt: 0.7 }
    });
    slide.addText(p.n, {
      x: p.x + 0.15,
      y: 2.7,
      w: 1.9,
      h: 0.3,
      fontSize: 13,
      color: COLORS.accent2,
      bold: true,
      align: 'center'
    });
    slide.addText(p.t, {
      x: p.x + 0.15,
      y: 3.05,
      w: 1.9,
      h: 0.5,
      fontSize: 14,
      color: COLORS.white,
      bold: true,
      align: 'center'
    });
    slide.addText(p.d, {
      x: p.x + 0.15,
      y: 3.6,
      w: 1.9,
      h: 1.1,
      fontSize: 12,
      color: COLORS.text,
      align: 'center'
    });
  });

  addFooter(slide);
}

// Slide 12: Impact & Value
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Expected Impact', 'Educational value and practical adoption outcomes');

  addSectionCard(slide, 'Student Value', 'Faster concept clarity\nHands-on virtual lab practice\nLower fear of wiring mistakes', 0.8, 2.0, 3.85, 2.2, COLORS.accent2);
  addSectionCard(slide, 'Instructor Value', 'Demo-ready classes\nReusable experiments\nEasy preset sharing', 4.8, 2.0, 3.85, 2.2, COLORS.accent);
  addSectionCard(slide, 'Hackathon Value', 'Clear problem-solution fit\nWorking prototype with depth\nScalable architecture', 8.8, 2.0, 3.85, 2.2, COLORS.warn);

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.8,
    y: 4.55,
    w: 11.85,
    h: 1.5,
    fill: { color: '0B3A2E' },
    line: { color: COLORS.accent, pt: 1.2 }
  });
  slide.addText('Success Indicators: completed experiments, reduced setup time, stronger logic debugging skills, and higher engagement in digital design labs.', {
    x: 1.1,
    y: 5.0,
    w: 11.2,
    h: 0.7,
    fontSize: 15,
    color: COLORS.white,
    align: 'center'
  });

  addFooter(slide);
}

// Slide 13: Roadmap
{
  const slide = pptx.addSlide();
  addHeader(slide, 'Roadmap', 'Post-hackathon execution plan');

  const roadmap = [
    { q: 'Next 30 Days', points: ['Add more IC families', 'More guided lab presets', 'Improve waveform UX'], c: '1E3A8A', x: 0.8 },
    { q: 'Next 60 Days', points: ['Simulation test harness', 'Deterministic replay mode', 'Classroom activity templates'], c: '0F766E', x: 4.45 },
    { q: 'Next 90 Days', points: ['Collaboration sharing links', 'Assignment and grading hooks', 'LMS integration exploration'], c: '4C1D95', x: 8.1 }
  ];

  roadmap.forEach((r) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: r.x,
      y: 2.0,
      w: 3.55,
      h: 4.5,
      fill: { color: r.c },
      line: { color: COLORS.white, pt: 0.9 }
    });
    slide.addText(r.q, {
      x: r.x + 0.25,
      y: 2.3,
      w: 3.05,
      h: 0.35,
      fontSize: 16,
      bold: true,
      color: COLORS.accent2,
      align: 'center'
    });

    bullet(slide, r.points, r.x + 0.3, 2.8, 2.95, 3.1, 14);
  });

  addFooter(slide);
}

// Slide 14: Closing
{
  const slide = pptx.addSlide();
  addBackground(slide);

  slide.addText('THANK YOU', {
    x: 0.7,
    y: 2.0,
    w: 6,
    h: 0.8,
    fontSize: 54,
    bold: true,
    color: COLORS.white
  });
  slide.addText('Web IC Trainer is ready for live demo.', {
    x: 0.75,
    y: 2.95,
    w: 6.8,
    h: 0.5,
    fontSize: 20,
    color: COLORS.accent2,
    bold: true
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 7.1,
    y: 1.75,
    w: 5.45,
    h: 3.7,
    fill: { color: COLORS.panelSoft },
    line: { color: COLORS.accent, pt: 1.5 }
  });
  bullet(slide, [
    'Problem addressed with practical, buildable workflow',
    'Feature-complete MVP with architecture clarity',
    'Roadmap ready for productization',
    'Open for Q&A and live circuit demo'
  ], 7.45, 2.25, 4.75, 2.8, 16);

  addFooter(slide, 'Contact: Web IC Trainer Team');
}

pptx.writeFile({ fileName: 'WebIC_Trainer_Hackathon_Master_Deck.pptx' })
  .then(() => {
    console.log('Presentation created: WebIC_Trainer_Hackathon_Master_Deck.pptx');
  })
  .catch((err) => {
    console.error('Failed to generate presentation', err);
    process.exit(1);
  });
