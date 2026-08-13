#!/usr/bin/env node

// The short-form binary: same tool, answers with the command only.
// Pass --full when you want the explanation after all.

import { runCli, TERM_VARIANT } from './cli.js';

runCli(TERM_VARIANT);
