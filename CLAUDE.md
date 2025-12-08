# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Strudel CLI** is a hybrid command-line interface for the [Strudel](https://strudel.cc) live coding environment. It brings professional-grade, low-latency algorithmic music performance to the terminal with native audio backends, complete offline operation, and multi-platform support.

### Core Mission

Enable terminal-based live coding with **5-10ms audio latency** (75-83% improvement over browser baseline) through native Linux audio backends (ALSA, JACK, PulseAudio), while maintaining full compatibility with existing Strudel patterns.

### Status

- **Current Phase**: Phase 1 - Core Implementation (Started 2025-12-07)
- **Implementation Status**: Project scaffolding complete, core functionality pending
- **License**: GNU Affero General Public License v3.0 (AGPL-3.0)

---

## Architecture

### Hybrid Execution Model

Strudel CLI supports three execution modes with automatic fallback:

```
┌─────────────────────────────────────────────┐
│  CLI Layer (Commander.js + Inquirer)       │
├─────────────────────────────────────────────┤
│  Orchestrator (Mode Selection & Lifecycle) │
├──────────┬──────────────┬───────────────────┤
│  Native  │     Web      │   OSC/SuperDirt   │
│  Mode    │     Mode     │      Mode         │
├──────────┴──────────────┴───────────────────┤
│  Pattern Engine (@strudel/core + mini)     │
├─────────────────────────────────────────────┤
│  Audio Backend Layer                        │
│  (ALSA / JACK / Pulse / WebAudio / OSC)    │
└─────────────────────────────────────────────┘
```

### Execution Modes

| Mode | Backend | Latency | Use Case |
|------|---------|---------|----------|
| **Native** | ALSA/JACK/Pulse | 5-10ms | Production, live performance |
| **Web** | Puppeteer → WebAudio | 20-50ms | Compatibility fallback |
| **OSC** | SuperDirt/SC | 10-15ms | Complex synthesis ecosystems |

**Mode Selection Logic** (`src/core/detector.js`):
1. **Auto Mode** (default):
   - Detect available audio backends
   - Prefer: JACK > ALSA > PulseAudio > Web fallback
2. **Explicit Mode**: User override via `--mode` flag
3. **Graceful Degradation**: Fallback to Web if native unavailable

---

## Project Structure

### Directory Layout

```
strudel-cli/
├── bin/
│   └── strudel.js           # CLI entry point (executable)
├── src/
│   ├── index.js             # Main module export
│   ├── cli.js               # Command definitions (Commander.js)
│   ├── core/                # Core coordination logic
│   │   ├── orchestrator.js  # Mode selection & lifecycle
│   │   ├── config.js        # Configuration management
│   │   ├── logger.js        # Structured logging (pino)
│   │   └── detector.js      # Audio backend detection
│   ├── modes/               # Execution mode implementations
│   │   ├── base.js          # Abstract base class
│   │   ├── web.js           # Puppeteer/WebAudio mode
│   │   ├── native.js        # ALSA/JACK/Pulse mode
│   │   └── osc.js           # SuperDirt/OSC mode
│   ├── audio/               # Audio backend abstraction
│   │   ├── context.js       # Native AudioContext polyfill
│   │   ├── backends/        # Backend-specific implementations
│   │   │   ├── alsa.js      # ALSA backend
│   │   │   ├── jack.js      # JACK backend
│   │   │   ├── pulse.js     # PulseAudio backend
│   │   │   └── factory.js   # Backend factory
│   │   ├── nodes/           # Audio node implementations
│   │   └── scheduler.js     # High-precision scheduling
│   ├── patterns/            # Pattern evaluation layer
│   │   ├── evaluator.js     # Pattern evaluator
│   │   ├── transpiler.js    # Code transpilation
│   │   └── validator.js     # Pattern validation
│   ├── samples/             # Sample management
│   │   ├── server.js        # HTTP sample server
│   │   ├── downloader.js    # Sample pack downloader
│   │   ├── indexer.js       # JSON manifest generator
│   │   └── cache.js         # Intelligent caching
│   ├── repl/                # Terminal REPL
│   │   ├── terminal.js      # REPL implementation
│   │   ├── ui.js            # Terminal UI components
│   │   ├── commands.js      # REPL-specific commands
│   │   └── history.js       # Command history
│   └── utils/               # Helper utilities
│       ├── process-manager.js  # Process lifecycle
│       ├── file-watcher.js     # File watching
│       ├── error-handler.js    # Error handling
│       └── platform.js         # Platform detection
├── config/                  # Configuration files
│   ├── default.json         # Default configuration
│   ├── schema.json          # Config schema validation
│   └── presets/             # Configuration presets
├── test/                    # Test suites
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── e2e/                 # End-to-end tests
├── docs/                    # Documentation
├── examples/                # Example patterns
├── package.json             # Project metadata & dependencies
├── .gitignore               # Git ignore patterns
├── README.md                # User documentation
├── CLAUDE.md                # This file (dev guidance)
└── LICENSE                  # AGPL-3.0 license
```

---

## Development Workflow

### Prerequisites

**System Requirements**:
- **Node.js**: 20.0.0+ (you have 25.2.1 ✓)
- **npm**: 9.0.0+
- **Platform**: Linux (primary), macOS (secondary), Windows (untested)

**For Native Audio** (Linux):
```bash
# ALSA (usually pre-installed)
sudo pacman -S alsa-lib alsa-utils

# JACK (optional, recommended for pro audio)
sudo pacman -S jack2

# PulseAudio (desktop default)
sudo pacman -S pulseaudio
```

### Initial Setup

```bash
cd ~/Work/github-repos/strudel-cli

# Install dependencies
npm install

# Make CLI executable
chmod +x bin/strudel.js

# Test CLI (should show "Implementation pending" messages)
node bin/strudel.js --help
node bin/strudel.js repl
```

### Development Commands

```bash
# Run CLI in development mode
npm run dev

# Run specific command
node bin/strudel.js play examples/techno.js

# Run tests (when implemented)
npm test
npm run test:unit
npm run test:integration

# Linting and formatting (when configured)
npm run lint
npm run format

# Build standalone binaries (Phase 3)
npm run build
```

### Testing Strategy

**Test Coverage Target**: 80%+

**Test Structure** (from whitepaper Section 7):
- **Unit Tests** (`test/unit/`): Component-level testing
  - Config management
  - Mode selection logic
  - Backend detection
- **Integration Tests** (`test/integration/`): Multi-component workflows
  - Orchestrator + Mode interaction
  - Pattern evaluation pipeline
- **End-to-End Tests** (`test/e2e/`): Complete workflows
  - `strudel play` command execution
  - REPL startup and interaction

**Example Test** (Vitest, per whitepaper):
```javascript
import { describe, it, expect } from 'vitest';
import { Config } from '../src/core/config.js';

describe('Config', () => {
  it('should load default configuration', () => {
    const config = new Config();
    expect(config.get('audio.backend')).toBe('auto');
    expect(config.get('audio.sampleRate')).toBe(48000);
  });
});
```

---

## Implementation Phases

### Phase 1: Core Implementation (Current - Q1 2026)

**Priority**: Establish functional baseline

**Tasks**:
- ✅ Project scaffolding (directory structure, package.json, README)
- ✅ CLI framework (Commander.js command definitions)
- ✅ Core stubs (Orchestrator, Config, Logger, Detector)
- ✅ Mode stubs (BaseMode, WebMode, NativeMode, OSCMode)
- ⏳ **Next**: Implement Config management
- ⏳ Implement Logger (pino integration)
- ⏳ Implement Detector (audio backend detection)
- ⏳ Implement WebMode (Puppeteer + Strudel web REPL)
- ⏳ Implement basic NativeMode (ALSA backend)
- ⏳ Implement Terminal REPL (basic)
- ⏳ Implement Sample Server (HTTP server for local samples)

**Milestone Criteria**:
- `strudel repl --mode web` launches Puppeteer-based REPL
- `strudel play pattern.js --mode native` plays via ALSA backend
- All unit tests passing
- Documentation complete

### Phase 2: Audio Backends (Q2 2026)

**Priority**: Native audio performance

**Tasks**:
- JACK backend implementation
- PulseAudio backend implementation
- Native AudioContext polyfill (WebAudio API subset)
- Audio node implementations (oscillator, gain, filter, buffer source)
- High-precision scheduler (`@ircam/sc-scheduling` integration)
- OSC/SuperDirt mode (basic)
- MIDI output support

**Milestone Criteria**:
- `strudel doctor` reports all available backends correctly
- 5-10ms latency achieved on ALSA/JACK
- Native AudioContext passes Strudel pattern evaluation

### Phase 3: Advanced Features (Q3 2026)

**Priority**: Production readiness

**Tasks**:
- Pattern recording/playback
- MIDI input/clock sync
- Multiple concurrent patterns
- Network collaboration (pattern sharing)
- Plugin system architecture
- Standalone binary distribution (`pkg`)
- AUR package (Arch Linux)

**Milestone Criteria**:
- Public release (v1.0.0)
- AUR package available
- Full documentation site

### Phase 4: Ecosystem Integration (Q4 2026+)

**Priority**: Community adoption

**Tasks**:
- VSCode extension
- Vim/Neovim plugin
- Emacs integration
- Flok compatibility (collaborative live coding)
- Ableton Link support (sync with DAWs)

---

## Key Technical Decisions

### 1. Why Hybrid Architecture?

**Decision**: Support multiple execution modes (Native/Web/OSC) with automatic fallback

**Rationale**:
- **Accessibility**: Not all users have native audio setup (Web fallback ensures "just works")
- **Performance**: Native mode provides <10ms latency for professionals
- **Ecosystem Integration**: OSC mode enables SuperCollider/SuperDirt workflows

**Trade-Off**:
- Complexity: Three execution paths to maintain
- Mitigation: Shared Pattern Engine layer, rigorous testing

**Connection to HFCTM-II**: Parallels MIH-IIE's quantum-classical hybrid strategy (graceful degradation across execution substrates)

### 2. Why AGPL-3.0 License?

**Decision**: GNU Affero General Public License v3.0

**Rationale**:
- **Ecosystem Alignment**: Matches Strudel project's license
- **Copyleft Protection**: Ensures modifications remain open-source
- **Network Use Clause**: AGPL's "network use = distribution" prevents proprietary SaaS capture

**Connection to HFCTM-II**: Same license philosophy as MIH-IIE (prevent institutional enclosure)

### 3. Why Node.js Instead of Rust/C++?

**Decision**: Node.js 20+ with native addons for audio

**Rationale**:
- **Strudel Compatibility**: Strudel is JavaScript; direct library reuse (@strudel/core)
- **Development Velocity**: Faster iteration than low-level languages
- **Native Performance**: Node.js addons (N-API) provide C-level audio performance where needed
- **Community**: npm ecosystem, TidalCycles/Strudel community familiar with JS

**Trade-Off**:
- Lower raw performance than Rust/C++
- Mitigation: Critical audio paths use native addons; most overhead is one-time (pattern parsing)

### 4. Why Offline-First Design?

**Decision**: Complete offline operation with local sample management

**Rationale**:
- **Live Performance Reliability**: No CDN dependency = no network-induced failures
- **Privacy**: No telemetry or external connections required
- **Accessibility**: Works in air-gapped environments (educational, embedded)

**Implementation**:
- Sample downloader (`src/samples/downloader.js`) fetches packs once
- Local sample server (`src/samples/server.js`) serves from disk
- Offline flag prevents any network requests

---

## HFCTM-II Conceptual Alignment

### Architectural Parallels

While Strudel CLI is **not a direct implementation** of HFCTM-II principles, it shares conceptual alignment:

| Strudel CLI Concept | HFCTM-II Analogue | Nature of Connection |
|---------------------|-------------------|----------------------|
| **Hybrid modes** (Web/Native/OSC) | Quantum-classical hybrid (MIH-IIE L2-L4) | **Metaphorical** - Multi-substrate execution with graceful degradation |
| **5-10ms latency** | Polychronic temporal sync (τL/τC coordination) | **Metaphorical** - Real-time coherence requirements |
| **Pattern engine** | Fractal self-similarity (DH ≈ e ≈ 2.718) | **Metaphorical** - Recursive pattern generation |
| **Offline autonomy** | 0D seed principle (substrate-independent) | **Conceptual** - Autonomous operation without external dependencies |
| **ALSA/JACK/Pulse backends** | Hardware abstraction layer (MIH-IIE L3) | **Architectural** - Abstraction enabling hardware-agnostic code |

**CRITICAL DISTINCTION**: These are **metaphorical parallels**, not technical integrations. Strudel CLI operates in the audio synthesis domain; HFCTM-II operates in quantum inference. Do not conflate the two domains.

### Semantic Drift Prevention (FLAG-004)

From `HFCTM-II-ORION/.hfctm-context/drift-flags.md`:

> **FLAG-004: Strudel-CLI Cross-Domain Concept Leakage (LOW)**
>
> Risk of conceptual conflation:
> - "Hybrid architecture" in audio ≠ "hybrid architecture" in quantum computing
> - Low-latency audio synthesis ≠ quantum coherence time management
> - Fractal patterns in music ≠ HFCTM-II fractal self-similarity

**Mitigation**:
- Keep domain boundaries **explicitly distinct** in documentation
- Use "conceptual alignment" language, never "technical integration" (unless proven)
- Do NOT claim "quantum-inspired audio synthesis" without rigorous justification

### Integration Opportunities (Speculative)

**Potential Cross-Pollination** (requires further research):

1. **Pattern Engine Architecture**: Strudel's mini-notation parser → potential inspiration for MIH-IIE L6 Codex symbolic operations
2. **Temporal Scheduling**: JACK audio callback scheduling → MIH-IIE L4 Ironwood tensor scheduling patterns
3. **Hybrid Mode Testing**: Strudel's Web/Native fallback → validates MIH-IIE's quantum/classical strategy design pattern
4. **Community Overlap**: TidalCycles community → HFCTM-II Discord (#strudel channel)

**Action**: Document any future integration points in `.hfctm-context/inference-map.md` (HFCTM-II-ORION repo)

---

## Configuration Management

### Configuration Sources (Priority Order)

1. **Command-line flags**: `--mode native --samples ~/samples`
2. **Environment variables**: `export STRUDEL_MODE=native`
3. **Config file**: `~/.config/strudel-cli/config.json`
4. **Defaults**: Hardcoded in `src/core/config.js`

### Environment Variables

```bash
# Execution mode
export STRUDEL_MODE=native           # auto|web|native|osc

# Audio backend (for native mode)
export STRUDEL_AUDIO_BACKEND=alsa    # alsa|jack|pulse|auto

# Samples directory
export STRUDEL_SAMPLES_DIR=~/strudel-samples

# Offline mode (no network requests)
export STRUDEL_OFFLINE=true

# Logging
export STRUDEL_LOG_LEVEL=debug       # debug|info|warn|error
```

### Config File Schema

`~/.config/strudel-cli/config.json`:

```json
{
  "mode": "native",
  "audio": {
    "backend": "jack",
    "sampleRate": 48000,
    "bufferSize": 256,
    "latency": 5,
    "channels": 2
  },
  "samples": {
    "localPath": "~/strudel-samples",
    "autoDownload": false,
    "cacheSizeMB": 1000
  },
  "repl": {
    "theme": "dark",
    "showBanner": true,
    "historySize": 1000
  },
  "offline": false
}
```

### Configuration Presets

**Performance Preset** (`config/presets/performance.json`):
- Native mode, JACK backend
- 256 buffer size, 48kHz
- Offline mode enabled

**Development Preset** (`config/presets/development.json`):
- Web mode (faster iteration, no audio setup needed)
- Verbose logging

**Educational Preset** (`config/presets/education.json`):
- Offline mode, local samples
- Auto-download sample packs on init

---

## Audio Backend Implementation Notes

### Native AudioContext Polyfill Strategy

**Goal**: Implement subset of WebAudio API using native audio libraries

**Approach** (from whitepaper Section 4.3.1):

```javascript
class AudioContext {
  constructor(options) {
    this.sampleRate = options.sampleRate || 48000;
    this.currentTime = 0;
    this.destination = new AudioDestinationNode(this);
    this.backend = selectBackend(); // ALSA / JACK / Pulse
  }

  createOscillator() {
    return new OscillatorNode(this);
  }

  createGain() {
    return new GainNode(this);
  }

  createBiquadFilter() {
    return new BiquadFilterNode(this);
  }

  createBufferSource() {
    return new AudioBufferSourceNode(this);
  }

  createBuffer(channels, length, sampleRate) {
    return new AudioBuffer({
      length,
      sampleRate,
      numberOfChannels: channels
    });
  }
}
```

**Implementation Libraries** (from whitepaper):
- **@ircam/sc-scheduling**: High-precision scheduling (microsecond-level timing)
- **@ircam/sc-audio**: DSP primitives (oscillators, filters)
- **Custom**: Native audio graph rendering

**Status**: Phase 2 (Q2 2026)

### Backend-Specific Notes

#### ALSA Backend (`src/audio/backends/alsa.js`)

**Advantages**:
- Lowest possible latency on Linux (5-10ms)
- Direct hardware access
- No daemon dependencies

**Disadvantages**:
- Exclusive device access (no mixing)
- Manual sample rate conversion required
- Linux-only

**Implementation**:
- Use `node-alsa` npm package or FFI bindings to `libasound`
- Configuration: `hw:0,0` (device), `S16_LE` (format), 256 period size

#### JACK Backend (`src/audio/backends/jack.js`)

**Advantages**:
- Professional audio routing
- Multi-application support
- Ultra-low latency (<5ms possible)
- Cross-platform (Linux/macOS with JACK2)

**Disadvantages**:
- Requires JACK daemon running
- More complex setup

**Implementation**:
- Use `node-jack` npm package or `jack-connector`
- Auto-connect to `system:playback_1`, `system:playback_2`

#### PulseAudio Backend (`src/audio/backends/pulse.js`)

**Advantages**:
- Desktop Linux default (no extra setup)
- Automatic mixing and routing
- Per-application volume control

**Disadvantages**:
- Higher latency than ALSA/JACK (15-30ms)
- Additional daemon overhead

**Implementation**:
- Use `pulseaudio` npm package or native bindings
- Detect default sink via `pactl`

---

## Common Development Tasks

### Adding a New Command

1. Edit `src/cli.js`:
   ```javascript
   program
     .command('new-command <arg>')
     .description('Description of new command')
     .option('-o, --option <value>', 'Option description')
     .action(async (arg, options) => {
       console.log(`Executing new-command with ${arg}`);
       // Implementation
     });
   ```

2. Implement handler in appropriate module (e.g., `src/core/orchestrator.js`)

3. Add unit tests (`test/unit/cli.test.js`)

4. Update README.md with usage examples

### Adding a New Execution Mode

1. Create mode class in `src/modes/`:
   ```javascript
   import { BaseMode } from './base.js';

   export class CustomMode extends BaseMode {
     constructor(config, logger) {
       super('custom', config, logger);
     }

     async initialize(options = {}) {
       // Mode-specific initialization
     }

     async play(code, options = {}) {
       // Pattern execution logic
     }

     async cleanup() {
       await super.cleanup();
       // Mode-specific cleanup
     }
   }
   ```

2. Register in `src/core/orchestrator.js`:
   ```javascript
   async selectMode(mode) {
     switch (mode) {
       case 'custom':
         return new CustomMode(this.config, this.logger);
       // ...
     }
   }
   ```

3. Add detection logic in `src/core/detector.js` (if auto-detectable)

4. Write integration tests

### Adding a New Audio Backend

1. Create backend implementation in `src/audio/backends/`:
   ```javascript
   export class CustomBackend {
     constructor(config) {
       this.config = config;
     }

     async initialize() {
       // Backend initialization
     }

     async start() {
       // Start audio stream
     }

     async stop() {
       // Stop audio stream
     }
   }
   ```

2. Register in `src/audio/backends/factory.js`

3. Add detection in `src/core/detector.js`

4. Update documentation

---

## Testing Guidelines

### Unit Test Example

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { Detector } from '../src/core/detector.js';

describe('Detector', () => {
  it('should detect available audio backends', async () => {
    const backends = await Detector.detectAudioBackends();
    expect(Array.isArray(backends)).toBe(true);
    // On Linux, should include at least one backend
    if (process.platform === 'linux') {
      expect(backends.length).toBeGreaterThan(0);
    }
  });

  it('should recommend optimal mode based on backends', async () => {
    const mode = await Detector.detectOptimalMode();
    expect(['native', 'web']).toContain(mode);
  });
});
```

### Integration Test Example

```javascript
import { describe, it, expect } from 'vitest';
import { Orchestrator } from '../src/core/orchestrator.js';
import { Config } from '../src/core/config.js';
import { Logger } from '../src/core/logger.js';

describe('Orchestrator + Mode Integration', () => {
  it('should select appropriate mode based on config', async () => {
    const config = new Config();
    config.set('mode', 'web');

    const logger = new Logger({ quiet: true });
    const orchestrator = new Orchestrator(config, logger);

    const mode = await orchestrator.selectMode('auto');
    expect(mode.name).toBe('web');
  });
});
```

---

## Debugging Tips

### Enable Verbose Logging

```bash
# Via environment
export STRUDEL_LOG_LEVEL=debug
node bin/strudel.js repl

# Via CLI flag
node bin/strudel.js repl --verbose
```

### Test Audio Backend Detection

```bash
# Run doctor command (when implemented)
node bin/strudel.js doctor

# Manual detection test
node -e "import('./src/core/detector.js').then(m => m.Detector.getSystemInfo().then(console.log))"
```

### Debug REPL

```bash
# Launch Node.js REPL with strudel-cli loaded
node
> const { Config, Logger, Orchestrator } = await import('./src/index.js');
> const config = await Config.load();
> config.get('mode');
```

---

## Contribution Guidelines

### Code Style

- **Linter**: ESLint with Airbnb configuration
- **Formatter**: Prettier
- **Commits**: Conventional Commits format (`feat:`, `fix:`, `docs:`, etc.)

### Pull Request Process

1. Fork repository
2. Create feature branch (`git checkout -b feature/new-backend`)
3. Write tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Update documentation (README.md, this file)
6. Submit pull request with clear description

### Issue Reporting

- **Bugs**: Use GitHub Issues with `bug` label
- **Feature Requests**: Use GitHub Issues with `enhancement` label
- **Questions**: Use GitHub Discussions

---

## Related Documentation

- **Whitepaper**: `~/Downloads/strudel-cli-whitepaper.pdf` (full technical specification)
- **Strudel Docs**: https://strudel.cc/learn/
- **TidalCycles**: https://tidalcycles.org/docs/
- **JACK Audio**: https://jackaudio.org/
- **ALSA Project**: https://www.alsa-project.org/

---

## Project Metadata

**Author**: Grimm (Joshua Robert Humphrey)
**License**: AGPL-3.0
**Repository**: https://github.com/Grimmasura/strudel-cli
**Community**: TidalCycles Discord (#strudel channel)
**Last Updated**: 2025-12-07
**Status**: Phase 1 Development - Core Implementation

---

**Development Philosophy**: Build hybrid architecture that prioritizes **performance** (native backends), **accessibility** (web fallback), and **autonomy** (offline operation), while maintaining full compatibility with the Strudel ecosystem.
