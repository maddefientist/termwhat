import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// render.ts snapshots `process.env.NO_COLOR` at module load, so control the env
// before the dynamic import and keep this file hermetic (no color codes here).
delete process.env.NO_COLOR;

const { renderResponse } = await import('./render.js');

const validJson = JSON.stringify({
  title: 'List running processes',
  os_assumptions: ['Linux/macOS'],
  commands: [
    {
      label: 'Show processes',
      command: 'ps aux',
      explanation: 'Lists every running process with CPU/memory stats.',
      risk_level: 'low',
    },
    {
      label: 'Filter by name',
      command: 'ps aux | grep nginx',
      explanation: 'Narrows the list to nginx workers.',
      risk_level: 'low',
    },
  ],
  pitfalls: ['grep itself appears in the output'],
  verification_steps: ['echo $?, expect 0'],
});

describe('renderResponse', () => {
  it('renders a valid response with title, commands, and risk badges', () => {
    const out = renderResponse(validJson, false);
    assert.ok(out.includes('List running processes'), 'title appears');
    assert.ok(out.includes('ps aux'), 'command appears');
    assert.ok(out.includes('grep nginx'), 'second command appears');
    assert.ok(out.includes('[LOW]'), 'risk badge appears');
    assert.ok(out.includes('Commands:'), 'commands section header appears');
  });

  it('falls back to the friendly parse-error path on malformed JSON', () => {
    const out = renderResponse('{ not valid json', false);
    assert.ok(out.includes('Failed to parse JSON response'), 'parse-error heading');
    assert.ok(out.includes('Raw Response:'), 'raw response echoed');
    assert.ok(out.includes('{ not valid json'), 'raw payload echoed');
    assert.ok(!out.includes('Commands:'), 'no commands section on parse error');
  });

  it('rejects a response missing required fields (commands/title) clearly', () => {
    const missing = JSON.stringify({ title: 'No commands here', os_assumptions: [] });
    const out = renderResponse(missing, false);
    assert.ok(out.includes('Failed to parse JSON response'), 'rejected as invalid');
    assert.ok(out.includes('Invalid response structure'), 'invalid-structure reason shown');
  });

  it('emits only the command(s) in brief mode — no explanation prose', () => {
    const out = renderResponse(validJson, true);
    const lines = out.split('\n');
    // Brief mode shows at most the first two commands, joined by newlines.
    assert.deepEqual(lines, ['ps aux', 'ps aux | grep nginx']);
    assert.ok(!out.includes('Lists every running process'), 'no explanation in brief');
    assert.ok(!out.includes('Pitfalls'), 'no pitfalls section in brief');
    assert.ok(!out.includes('Verification'), 'no verification section in brief');
  });

  it('reports "No commands found" in brief mode when commands is empty', () => {
    const empty = JSON.stringify({
      title: 'Nothing',
      os_assumptions: [],
      commands: [],
      pitfalls: [],
      verification_steps: [],
    });
    assert.equal(renderResponse(empty, true), 'No commands found');
  });

  // Captured verbatim from a real qwen3.5:4b response. It is VALID JSON — the
  // model packed the remaining fields into the command string — so JSON.parse
  // happily accepts it and brief mode printed an unrunnable command with raw
  // JSON hanging off the end. Never hand that to someone's shell.
  it('rejects a command that swallowed the rest of the JSON object', () => {
    const swallowed = JSON.stringify({
      title: 'Find files modified in the last hour',
      os_assumptions: ['Linux/macOS'],
      commands: [
        {
          label: 'Find recent files',
          command:
            'find /path/to/search -type f -mmin -60", "explanation": "Finds regular files modified within last 60 minutes.", "risk_level": "low',
          explanation: 'Finds recent files.',
          risk_level: 'low',
        },
      ],
      pitfalls: [],
      verification_steps: [],
    });

    const brief = renderResponse(swallowed, true);
    // The error path deliberately echoes the raw payload so users can report
    // it, so assert on what actually matters: the mangled string is never
    // presented as a runnable command.
    assert.match(brief, /Failed to parse|Invalid response structure/);
    assert.ok(
      !brief.startsWith('find /path/to/search'),
      'must not present the mangled string as a command'
    );

    const full = renderResponse(swallowed, false);
    assert.match(full, /Failed to parse|Invalid response structure/);
  });

  it('still accepts a command containing legitimate quotes', () => {
    // The guard must not fire on ordinary shell quoting.
    const quoted = JSON.stringify({
      title: 'Search files',
      os_assumptions: ['Linux'],
      commands: [
        {
          label: 'Grep with quotes',
          command: 'grep -r "TODO: fix" . --include="*.ts"',
          explanation: 'Finds TODO comments.',
          risk_level: 'low',
        },
      ],
      pitfalls: [],
      verification_steps: [],
    });
    assert.equal(renderResponse(quoted, true), 'grep -r "TODO: fix" . --include="*.ts"');
  });
});