import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AIProviderFactory } from './factory.js';
import { timeoutMessage } from './ollama.js';

/**
 * TERMWHAT_TIMEOUT was documented in .env.example for a long time while
 * nothing actually read it, so the documented escape hatch for slow cold
 * model loads did not exist. These pin the behaviour now that it does.
 */
describe('TERMWHAT_TIMEOUT', () => {
  function withEnv(value: string | undefined, fn: () => void): void {
    const saved = process.env.TERMWHAT_TIMEOUT;
    try {
      if (value === undefined) delete process.env.TERMWHAT_TIMEOUT;
      else process.env.TERMWHAT_TIMEOUT = value;
      fn();
    } finally {
      if (saved === undefined) delete process.env.TERMWHAT_TIMEOUT;
      else process.env.TERMWHAT_TIMEOUT = saved;
    }
  }

  it('overrides the configured timeout', () => {
    withEnv('180000', () => {
      const p = AIProviderFactory.create({
        provider: 'ollama',
        model: 'qwen3.5:9b',
        host: 'http://localhost:11434',
        timeout: 60000,
      });
      assert.equal(p.getConfig().timeout, 180000);
    });
  });

  it('leaves the configured timeout alone when unset', () => {
    withEnv(undefined, () => {
      const p = AIProviderFactory.create({
        provider: 'ollama',
        model: 'qwen3.5:9b',
        host: 'http://localhost:11434',
        timeout: 60000,
      });
      assert.equal(p.getConfig().timeout, 60000);
    });
  });

  it('ignores garbage rather than disabling the timeout', () => {
    for (const bad of ['nonsense', '0', '-5']) {
      withEnv(bad, () => {
        const p = AIProviderFactory.create({
          provider: 'ollama',
          model: 'qwen3.5:9b',
          host: 'http://localhost:11434',
          timeout: 60000,
        });
        assert.equal(p.getConfig().timeout, 60000, `TERMWHAT_TIMEOUT="${bad}" must be ignored`);
      });
    }
  });

  it('timeout errors explain cold model loads and name the override', () => {
    const msg = timeoutMessage(120000);
    assert.match(msg, /120000ms/);
    assert.match(msg, /TERMWHAT_TIMEOUT/);
    assert.notEqual(msg, 'Request aborted');
  });
});
