import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TERM_VARIANT, TERMWHAT_VARIANT } from './cli.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf-8'));

/**
 * The two binaries differ ONLY in whether explanations are on by default.
 * Swapping that would silently change what every `term` user sees, so it is
 * pinned here rather than left to manual checking.
 */
describe('CLI variants', () => {
  it('termwhat explains by default', () => {
    assert.equal(TERMWHAT_VARIANT.name, 'termwhat');
    assert.equal(TERMWHAT_VARIANT.briefByDefault, false);
  });

  it('term is brief by default', () => {
    assert.equal(TERM_VARIANT.name, 'term');
    assert.equal(TERM_VARIANT.briefByDefault, true);
  });

  it('ships both binaries, each pointing at its own entry file', () => {
    assert.equal(pkg.bin.termwhat, 'dist/index.js');
    assert.equal(pkg.bin.term, 'dist/term.js');
  });

  it('makes both entry files executable during build', () => {
    // npm silently drops a bin whose target is not executable-shaped; the
    // build must chmod BOTH entries, not just the original one.
    assert.match(pkg.scripts.build, /chmod \+x .*dist\/index\.js/);
    assert.match(pkg.scripts.build, /chmod \+x .*dist\/term\.js/);
  });

  it('declares bin paths without a "./" prefix', () => {
    // npm strips bin entries written as "./dist/index.js" on publish, which
    // ships a package that installs no command at all. Regression guard.
    for (const target of Object.values(pkg.bin) as string[]) {
      assert.ok(!target.startsWith('./'), `bin target must not start with ./ : ${target}`);
    }
  });
});
