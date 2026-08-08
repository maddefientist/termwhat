import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * REGRESSION TEST — OpenRouter construction must NOT require an OpenAI key.
 *
 * Historically OpenRouterProvider extended OpenAIProvider, and the parent
 * constructor read `TERMWHAT_OPENAI_API_KEY` (throwing if absent) BEFORE the
 * OpenRouter override could supply its own key. The result: OpenRouter only
 * worked if an unrelated OpenAI key happened to be exported.
 *
 * This test guarantees the fix holds: with only TERMWHAT_OPENROUTER_API_KEY set
 * and TERMWHAT_OPENAI_API_KEY explicitly removed, construction succeeds.
 */
describe('OpenRouter regression', () => {
  it('constructs without TERMWHAT_OPENAI_API_KEY when only the OpenRouter key is set', async () => {
    const savedOpenRouter = process.env.TERMWHAT_OPENROUTER_API_KEY;
    const savedOpenAI = process.env.TERMWHAT_OPENAI_API_KEY;

    try {
      process.env.TERMWHAT_OPENROUTER_API_KEY = 'or-test-key';
      // Explicitly delete — not just undefined, removed from process.env so the
      // parent constructor's `process.env.TERMWHAT_OPENAI_API_KEY` lookup fails.
      delete process.env.TERMWHAT_OPENAI_API_KEY;

      const { OpenRouterProvider } = await import('./openrouter.js');
      const provider = new OpenRouterProvider({
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet-5',
        timeout: 60000,
      });

      assert.equal(provider.getProviderType(), 'openrouter');
      assert.equal(provider.getModelName(), 'anthropic/claude-sonnet-5');
    } finally {
      // Restore so test order cannot leak env state into other suites.
      if (savedOpenRouter === undefined) delete process.env.TERMWHAT_OPENROUTER_API_KEY;
      else process.env.TERMWHAT_OPENROUTER_API_KEY = savedOpenRouter;
      if (savedOpenAI === undefined) delete process.env.TERMWHAT_OPENAI_API_KEY;
      else process.env.TERMWHAT_OPENAI_API_KEY = savedOpenAI;
    }
  });
});