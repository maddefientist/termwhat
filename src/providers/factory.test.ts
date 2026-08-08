import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { AIProviderFactory } from './index.js';
import { OllamaProvider } from './ollama.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenRouterProvider } from './openrouter.js';

// Keys are required to construct the cloud providers; stub them so construction
// succeeds with no real credentials and no network.
const STUB_KEYS = {
  TERMWHAT_OPENAI_API_KEY: 'sk-test-openai',
  TERMWHAT_ANTHROPIC_API_KEY: 'sk-ant-test',
  TERMWHAT_OPENROUTER_API_KEY: 'or-test',
};
const SAVED: Record<string, string | undefined> = {};

before(() => {
  for (const [k, v] of Object.entries(STUB_KEYS)) {
    SAVED[k] = process.env[k];
    process.env[k] = v;
  }
  // Clear model/host overrides so factory enrichment is predictable.
  delete process.env.TERMWHAT_MODEL;
  delete process.env.TERMWHAT_OLLAMA_HOST;
  delete process.env.TERMWHAT_PROVIDER;
});

after(() => {
  for (const [k] of Object.entries(STUB_KEYS)) {
    if (SAVED[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED[k];
  }
});

describe('AIProviderFactory', () => {
  it('constructs OllamaProvider for the ollama id', () => {
    const p = AIProviderFactory.create({
      provider: 'ollama',
      host: 'http://localhost:11434',
      model: 'qwen3.5:4b',
      timeout: 60000,
    });
    assert.ok(p instanceof OllamaProvider);
    assert.equal(p.getProviderType(), 'ollama');
  });

  it('constructs OpenAIProvider for the openai id', () => {
    const p = AIProviderFactory.create({
      provider: 'openai',
      model: 'gpt-4o',
      timeout: 60000,
    });
    assert.ok(p instanceof OpenAIProvider);
    assert.equal(p.getProviderType(), 'openai');
  });

  it('constructs AnthropicProvider for the anthropic id', () => {
    const p = AIProviderFactory.create({
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      timeout: 60000,
    });
    assert.ok(p instanceof AnthropicProvider);
    assert.equal(p.getProviderType(), 'anthropic');
  });

  it('constructs OpenRouterProvider for the openrouter id', () => {
    const p = AIProviderFactory.create({
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-5',
      timeout: 60000,
    });
    assert.ok(p instanceof OpenRouterProvider);
    assert.equal(p.getProviderType(), 'openrouter');
  });

  it('fails with a clear, actionable error on an unknown provider id', () => {
    assert.throws(
      () =>
        AIProviderFactory.create({
          provider: 'wat' as any,
          model: 'x',
          timeout: 60000,
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error, 'throws an Error');
        assert.match((err as Error).message, /Unknown provider type/);
        return true;
      }
    );
  });
});