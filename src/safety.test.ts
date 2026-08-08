import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = join(process.cwd(), 'src');

/**
 * Safety invariant: no code path in src/ may execute a SUGGESTED command.
 * termwhat only ever PRINTS suggestions — it must never run them.
 *
 * The only legitimate spawn site is src/clipboard.ts, which launches clipboard
 * binaries (pbcopy / xclip / xsel / clip) and the `which` lookup helper — never
 * command text returned by the model. This test enforces that structurally.
 */

function listTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listTsFiles(full, acc);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

const ALLOWED_CLIPBOARD_BINARIES = ['pbcopy', 'xclip', 'xsel', 'clip', 'which'];

describe('safety invariant — no execution of suggested commands', () => {
  it('only clipboard.ts imports child_process', () => {
    const offenders: string[] = [];
    for (const file of listTsFiles(SRC_DIR)) {
      const src = readFileSync(file, 'utf-8');
      if (/from\s+['"]child_process['"]/.test(src) || /require\(['"]child_process['"]\)/.test(src)) {
        offenders.push(relative(SRC_DIR, file));
      }
    }
    assert.deepEqual(offenders, ['clipboard.ts'], 'only clipboard.ts may import child_process');
  });

  it('clipboard.ts only spawns the allowlisted clipboard binaries', () => {
    const src = readFileSync(join(SRC_DIR, 'clipboard.ts'), 'utf-8');
    // Find every spawn(...) call and capture the command argument.
    const spawnMatches = [...src.matchAll(/spawn\(\s*([^,)]+)/g)];
    assert.ok(spawnMatches.length > 0, 'clipboard.ts still contains spawn calls');

    for (const m of spawnMatches) {
      const raw = m[1].trim();
      // The command is either a string literal or a variable holding one.
      const literalMatch = raw.match(/^['"`]([^'"`]+)['"`]$/);
      if (literalMatch) {
        const bin = literalMatch[1];
        assert.ok(
          ALLOWED_CLIPBOARD_BINARIES.includes(bin),
          `clipboard.ts spawns allowlisted binary only — found "${bin}"`
        );
      }
      // Variable-named commands (e.g. `command`) must be assignments sourced
      // exclusively from the allowlist above; verify each `command = '...'` in
      // the file references an allowed binary.
    }

    // Verify every string literal assigned to `command` is an allowed binary.
    const commandAssignments = [...src.matchAll(/command\s*=\s*['"`]([^'"`]+)['"`]/g)];
    for (const a of commandAssignments) {
      assert.ok(
        ALLOWED_CLIPBOARD_BINARIES.includes(a[1]),
        `clipboard.ts command assignment uses allowlisted binary only — found "${a[1]}"`
      );
    }
  });

  it('no src/ file calls exec/execSync/spawnSync on command text', () => {
    const offenders: string[] = [];
    for (const file of listTsFiles(SRC_DIR)) {
      const src = readFileSync(file, 'utf-8');
      // exec/execSync/spawnSync would let arbitrary strings run through a shell.
      if (/\bexecSync\s*\(|\bspawnSync\s*\(|\bexec\s*\(/.test(src)) {
        // clipboard.ts uses spawn (not exec), so it should not appear here.
        offenders.push(relative(SRC_DIR, file));
      }
    }
    assert.deepEqual(offenders, [], 'no exec/execSync/spawnSync anywhere in src/');
  });
});
