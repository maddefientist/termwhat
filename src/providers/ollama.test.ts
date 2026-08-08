import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { OllamaProvider } from './ollama.js';
import { OLLAMA_CLOUD_HOST } from './ollama.js';

// Hermetic: no real network. We stub globalThis.fetch and assert the calls.
type FetchCall = { url: string; init: RequestInit };
let calls: FetchCall[] = [];
let originalFetch: typeof globalThis.fetch;
let nextResponse: Response;

function stubFetch(response: Response): void {
  nextResponse = response;
}

beforeEach(() => {
  calls = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(nextResponse ?? new Response('{}', { status: 200 }));
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.TERMWHAT_OLLAMA_API_KEY;
});

describe('OllamaProvider chat shaping', () => {
  it('posts to {host}/api/chat with the model, the system prompt, and JSON mode', async () => {
    stubFetch(
      new Response(JSON.stringify({ message: { content: '{"title":"ok"}' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const provider = new OllamaProvider({
      provider: 'ollama',
      host: 'http://localhost:11434',
      model: 'qwen3.5:4b',
      timeout: 60000,
      cloud: false,
    });

    const messages = [
      { role: 'system' as const, content: 'SYSTEM_PROMPT_TEXT' },
      { role: 'user' as const, content: 'how do I list files?' },
    ];

    const content = await provider.chat(messages);
    assert.equal(content, '{"title":"ok"}');

    // The ollama library posts to {host}/api/chat.
    const chatCall = calls.find((c) => c.url.endsWith('/api/chat'));
    assert.ok(chatCall, 'a request was made to /api/chat');
    assert.match(chatCall.url, /^http:\/\/localhost:11434\/api\/chat$/);

    const body = JSON.parse(String(chatCall.init.body)) as Record<string, unknown>;
    assert.equal(body.model, 'qwen3.5:4b', 'model in body');
    assert.equal(body.format, 'json', 'JSON mode requested');
    assert.equal(body.stream, false, 'non-streaming');

    const sentMessages = body.messages as Array<{ role: string; content: string }>;
    assert.ok(
      sentMessages.some((m) => m.role === 'system' && m.content === 'SYSTEM_PROMPT_TEXT'),
      'system prompt forwarded'
    );
    assert.ok(
      sentMessages.some((m) => m.role === 'user' && m.content === 'how do I list files?'),
      'user message forwarded'
    );
  });
});

describe('OllamaProvider cloud path', () => {
  it('targets the cloud host and sends Authorization: Bearer <key>', async () => {
    process.env.TERMWHAT_OLLAMA_API_KEY = 'cloud-secret';
    stubFetch(
      new Response(JSON.stringify({ message: { content: '{"title":"cloud"}' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const provider = new OllamaProvider({
      provider: 'ollama',
      host: OLLAMA_CLOUD_HOST,
      model: 'gpt-oss:120b',
      timeout: 60000,
      cloud: true,
    });

    assert.equal(provider.getProviderType(), 'ollama-cloud');

    await provider.chat([
      { role: 'user', content: 'hi' },
    ]);

    const chatCall = calls.find((c) => c.url.includes('/api/chat'));
    assert.ok(chatCall, 'cloud chat request made');
    assert.ok(
      chatCall.url.startsWith(OLLAMA_CLOUD_HOST),
      'targets the cloud host'
    );
    assert.ok(chatCall.url.endsWith('/api/chat'), 'hits /api/chat');

    const headers = new Headers(chatCall.init.headers as HeadersInit);
    assert.equal(headers.get('authorization'), 'Bearer cloud-secret', 'bearer auth sent');
  });
});

describe('OllamaProvider listModels', () => {
  it('parses a stubbed /api/tags payload into a plain model-name list', async () => {
    stubFetch(
      new Response(
        JSON.stringify({
          models: [
            { name: 'qwen3.5:4b' },
            { name: 'llama3:8b' },
            { name: 'gpt-oss:120b' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const provider = new OllamaProvider({
      provider: 'ollama',
      host: 'http://localhost:11434',
      model: 'qwen3.5:4b',
      timeout: 60000,
      cloud: false,
    });

    const models = await provider.listModels();
    assert.deepEqual(models, ['qwen3.5:4b', 'llama3:8b', 'gpt-oss:120b']);

    const tagsCall = calls.find((c) => c.url.endsWith('/api/tags'));
    assert.ok(tagsCall, 'hit /api/tags');
  });

  it('degrades gracefully (empty list, no throw) on a 401', async () => {
    stubFetch(new Response('{"error":"unauthorized"}', { status: 401 }));

    const provider = new OllamaProvider({
      provider: 'ollama',
      host: 'http://localhost:11434',
      model: 'qwen3.5:4b',
      timeout: 60000,
      cloud: false,
    });

    const models = await provider.listModels();
    assert.deepEqual(models, [], 'empty list on auth failure, not a throw');
  });

  it('degrades gracefully (empty list, no throw) on a network error', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new Error('ECONNREFUSED'))) as typeof globalThis.fetch;
    try {
      const provider = new OllamaProvider({
        provider: 'ollama',
        host: 'http://localhost:11434',
        model: 'qwen3.5:4b',
        timeout: 60000,
        cloud: false,
      });

      const models = await provider.listModels();
      assert.deepEqual(models, [], 'empty list on network error, not a throw');
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});