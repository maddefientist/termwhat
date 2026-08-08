import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TermwhatConfig } from './types.js';

// config.ts computes CONFIG_PATH from os.homedir() at module load. Point HOME at
// a temp dir BEFORE the dynamic import so no test ever touches ~/.termwhatrc.
const TMP_HOME = mkdtempSync(join(tmpdir(), 'termwhat-cfg-'));
const ORIG_HOME = process.env.HOME;
process.env.HOME = TMP_HOME;

// Clear env overrides that getProviderConfig/parseTimeout consult, so tests are hermetic.
delete process.env.TERMWHAT_OLLAMA_HOST;
delete process.env.TERMWHAT_MODEL;
delete process.env.TERMWHAT_PROVIDER;

const config = await import('./config.js');
const CONFIG_PATH = join(TMP_HOME, '.termwhatrc');
const CONFIG_BAK = join(TMP_HOME, '.termwhatrc.bak');

after(() => {
  process.env.HOME = ORIG_HOME;
  rmSync(TMP_HOME, { recursive: true, force: true });
});

describe('config', () => {
  it('loads defaults when no config file exists', () => {
    assert.equal(existsSync(CONFIG_PATH), false);
    const cfg = config.loadConfig();
    assert.equal(cfg.currentProvider, 'ollama');
    assert.ok(cfg.providers.ollama, 'default ollama provider present');
    assert.equal(cfg.providers.ollama.provider, 'ollama');
    assert.ok(cfg.providers.ollama.host.startsWith('http://'), 'host is a URL');
    assert.equal(typeof cfg.providers.ollama.model, 'string');
    assert.equal(typeof cfg.providers.ollama.timeout, 'number');
  });

  it('round-trips a valid config through save → load unchanged', () => {
    const original: TermwhatConfig = {
      currentProvider: 'openai',
      providers: {
        ollama: {
          provider: 'ollama',
          host: 'http://localhost:11434',
          model: 'qwen3.5:4b',
          timeout: 30000,
          cloud: false,
        },
        openai: {
          provider: 'openai',
          model: 'gpt-4o',
          timeout: 45000,
        },
      },
    };
    config.saveConfig(original);
    const onDisk = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as TermwhatConfig;
    // The persisted file round-trips cleanly (JSON drops undefined values).
    assert.equal(onDisk.currentProvider, 'openai');
    assert.deepEqual(onDisk.providers.ollama, original.providers.ollama);
    assert.deepEqual(onDisk.providers.openai, original.providers.openai);

    const reloaded = config.loadConfig();
    assert.equal(reloaded.currentProvider, 'openai');
    assert.deepEqual(reloaded.providers.ollama, original.providers.ollama);
    // migrateModernConfig normalizes the openai entry by explicitly setting
    // optional fields to `undefined` in memory (cosmetic — they are dropped on
    // disk by JSON.stringify). Assert the meaningful fields round-trip.
    assert.equal(reloaded.providers.openai.provider, 'openai');
    assert.equal(reloaded.providers.openai.model, 'gpt-4o');
    assert.equal(reloaded.providers.openai.timeout, 45000);
  });

  it('backs up a corrupt config file instead of silently destroying it', () => {
    // saveConfig from the previous test created a valid file; overwrite with junk.
    writeFileSync(CONFIG_PATH, '{ this is : not json ', 'utf-8');
    assert.equal(existsSync(CONFIG_BAK), false, 'no pre-existing backup');

    const cfg = config.loadConfig();
    // Falls back to defaults, not a crash.
    assert.equal(cfg.currentProvider, 'ollama');
    assert.ok(cfg.providers.ollama, 'defaults returned');

    // The corrupt file was backed up so the user can recover it.
    assert.equal(existsSync(CONFIG_BAK), true, 'backup created');
    const backupContent = readFileSync(CONFIG_BAK, 'utf-8');
    assert.equal(backupContent, '{ this is : not json ', 'backup holds the corrupt payload');

    // Clean up so subsequent tests start fresh.
    rmSync(CONFIG_PATH, { force: true });
    rmSync(CONFIG_BAK, { force: true });
  });

  it('migrates a legacy config without losing the user provider/host/model', () => {
    const legacy = {
      ollamaHost: 'http://my-ollama:11434',
      model: 'llama3:8b',
      timeout: 12000,
    };
    writeFileSync(CONFIG_PATH, JSON.stringify(legacy), 'utf-8');

    const migrated = config.loadConfig();
    assert.equal(migrated.currentProvider, 'ollama');
    const ollama = migrated.providers.ollama;
    assert.equal(ollama.provider, 'ollama');
    assert.equal(ollama.host, 'http://my-ollama:11434', 'host preserved');
    assert.equal(ollama.model, 'llama3:8b', 'model preserved');
    assert.equal(ollama.timeout, 12000, 'timeout preserved');
    assert.equal(ollama.cloud, false);

    // Migration persisted the new shape to disk.
    const onDisk = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    assert.equal(onDisk.currentProvider, 'ollama');
    assert.equal(onDisk.providers.ollama.host, 'http://my-ollama:11434');

    rmSync(CONFIG_PATH, { force: true });
  });

  it('parseTimeout rejects garbage and 0 instead of silently substituting the default', () => {
    const fallback = 60000;
    // Non-numeric garbage → fallback (not silently accepted as NaN/0).
    assert.equal(config.parseTimeout('abc', fallback), fallback);
    assert.equal(config.parseTimeout('12.5', fallback), fallback);
    assert.equal(config.parseTimeout('-5', fallback), fallback);
    // 0 is explicitly rejected (would mean "no timeout" / hang).
    assert.equal(config.parseTimeout('0', fallback), fallback);
    // Out-of-range (too small) → fallback.
    assert.equal(config.parseTimeout('500', fallback), fallback);
    // Empty/undefined → fallback (the intended "not provided" path).
    assert.equal(config.parseTimeout(undefined, fallback), fallback);
    assert.equal(config.parseTimeout('', fallback), fallback);
    // A valid in-range value is honored.
    assert.equal(config.parseTimeout('30000', fallback), 30000);
  });
});