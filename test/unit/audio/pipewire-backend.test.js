/**
 * PipeWireBackend Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

const mockSpawn = vi.fn();
const mockExecFile = vi.fn();

vi.mock('child_process', () => ({
  spawn: (...args) => mockSpawn(...args),
  execFile: (...args) => mockExecFile(...args)
}));

import { PipeWireBackend } from '../../../src/audio/backends/pipewire.js';

const makeLogger = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
});

const makeConfig = (overrides = {}) => {
  const defaults = {
    'audio.sampleRate': 48000,
    'audio.channels': 2,
    'audio.latency': 10,
    'audio.pipewire.binary': 'pw-play'
  };

  return {
    get: (key) => {
      if (overrides[key] !== undefined) return overrides[key];
      return defaults[key];
    }
  };
};

const createMockProcess = () => {
  const proc = new EventEmitter();
  proc.stdin = {
    write: vi.fn((buffer, cb) => cb && cb()),
    end: vi.fn()
  };
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn(() => {
    proc.emit('exit', 0, null);
    return true;
  });
  return proc;
};

describe('PipeWireBackend', () => {
  let backend;
  let logger;
  let config;
  let processStub;

  beforeEach(() => {
    logger = makeLogger();
    config = makeConfig();
    backend = new PipeWireBackend(config, logger);
    processStub = createMockProcess();
    mockSpawn.mockReturnValue(processStub);
    mockExecFile.mockImplementation((_cmd, _args, cb) => cb && cb(null, '', ''));
  });

  afterEach(async () => {
    await backend.cleanup();
    vi.clearAllMocks();
  });

  it('initializes by spawning pw-play with correct arguments', async () => {
    await backend.initialize();

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const [binary, args] = mockSpawn.mock.calls[0];
    expect(binary).toBe('pw-play');
    expect(args).toContain('-f');
    expect(args).toContain('F32_LE');
    expect(args).toContain('-c');
    expect(args).toContain('2');
    expect(args).toContain('-r');
    expect(args).toContain('48000');
  });

  it('writes sine wave samples to stdin', async () => {
    await backend.initialize();
    await backend.playSineWave({ frequency: 220, durationMs: 10 });

    expect(processStub.stdin.write).toHaveBeenCalled();
    const written = processStub.stdin.write.mock.calls[0][0];
    expect(Buffer.isBuffer(written)).toBe(true);
  });

  it('stops and kills the PipeWire process', async () => {
    await backend.initialize();
    await backend.stop();

    expect(processStub.stdin.end).toHaveBeenCalled();
    expect(processStub.kill).toHaveBeenCalled();
  });

  it('reports availability via which lookup', async () => {
    mockExecFile.mockImplementation((_cmd, _args, cb) => cb && cb(null, '', ''));
    await expect(PipeWireBackend.isAvailable()).resolves.toBe(true);

    mockExecFile.mockImplementation((_cmd, _args, cb) => cb && cb(new Error('not found')));
    await expect(PipeWireBackend.isAvailable()).resolves.toBe(false);
  });
});
