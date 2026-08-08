import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// render.ts snapshots `process.env.NO_COLOR` at module load. Set it BEFORE the
// dynamic import so the colors object collapses to empty strings.
process.env.NO_COLOR = '1';

const { renderResponse } = await import('./render.js');

const ANSI = /\x1b\[/;

describe('renderResponse NO_COLOR', () => {
  it('produces no ANSI escape sequences when NO_COLOR is set', () => {
    const json = JSON.stringify({
      title: 'Check disk usage',
      os_assumptions: ['Linux'],
      commands: [
        {
          label: 'Disk usage',
          command: 'df -h',
          explanation: 'Human-readable filesystem usage.',
          risk_level: 'medium',
        },
      ],
      pitfalls: [],
      verification_steps: ['df -h /'],
    });

    const out = renderResponse(json, false);
    assert.ok(out.includes('Check disk usage'), 'title still present');
    assert.ok(out.includes('df -h'), 'command still present');
    assert.ok(out.includes('[MEDIUM]'), 'risk badge still present');
    assert.equal(ANSI.test(out), false, 'no ANSI escapes when NO_COLOR set');
  });
});