import type { TermwhatResponse, CommandSuggestion } from './types.js';

const NO_COLOR = process.env.NO_COLOR !== undefined;

const colors = {
  reset: NO_COLOR ? '' : '\x1b[0m',
  bold: NO_COLOR ? '' : '\x1b[1m',
  dim: NO_COLOR ? '' : '\x1b[2m',
  cyan: NO_COLOR ? '' : '\x1b[36m',
  green: NO_COLOR ? '' : '\x1b[32m',
  yellow: NO_COLOR ? '' : '\x1b[33m',
  red: NO_COLOR ? '' : '\x1b[31m',
  gray: NO_COLOR ? '' : '\x1b[90m',
};

export function renderResponse(jsonString: string, brief: boolean = false): string {
  let response: TermwhatResponse;

  try {
    response = JSON.parse(jsonString);
  } catch (error) {
    return renderParseError(jsonString, error);
  }

  if (!isValidResponse(response)) {
    return renderParseError(jsonString, new Error('Invalid response structure'));
  }

  return brief ? formatBriefResponse(response) : formatResponse(response);
}

function formatBriefResponse(response: TermwhatResponse): string {
  if (response.commands.length === 0) {
    return 'No commands found';
  }

  const commandsToShow = response.commands.slice(0, Math.min(2, response.commands.length));
  return commandsToShow.map((cmd) => cmd.command).join('\n');
}

/**
 * Detects a command string that has swallowed the rest of the JSON object.
 *
 * Smaller models sometimes emit output that parses as valid JSON while the
 * `command` value actually contains the remaining fields verbatim, e.g.
 *   "command": "find . -mmin -60\", \"explanation\": \"Finds files...\""
 * That renders as a broken, unrunnable command. Since the whole promise here is
 * "paste this into your shell", showing the parse-error path is safer than
 * handing someone a mangled command.
 */
function looksLikeSwallowedJson(command: string): boolean {
  return /"\s*,\s*"(explanation|risk_level|label|command)"\s*:/.test(command);
}

function isValidCommand(cmd: any): cmd is CommandSuggestion {
  return (
    cmd &&
    typeof cmd.command === 'string' &&
    cmd.command.trim().length > 0 &&
    !looksLikeSwallowedJson(cmd.command)
  );
}

function isValidResponse(obj: any): obj is TermwhatResponse {
  return (
    obj &&
    typeof obj.title === 'string' &&
    Array.isArray(obj.os_assumptions) &&
    Array.isArray(obj.commands) &&
    Array.isArray(obj.pitfalls) &&
    Array.isArray(obj.verification_steps) &&
    obj.commands.every(isValidCommand)
  );
}

function renderParseError(rawResponse: string, error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error';

  return [
    '',
    `${colors.yellow}⚠️  Warning: Failed to parse JSON response${colors.reset}`,
    `${colors.dim}Error: ${message}${colors.reset}`,
    '',
    '─'.repeat(60),
    'Raw Response:',
    '─'.repeat(60),
    rawResponse,
    '─'.repeat(60),
    '',
  ].join('\n');
}

function formatResponse(response: TermwhatResponse): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`${colors.bold}${colors.cyan}${response.title}${colors.reset}`);
  lines.push('');

  if (response.os_assumptions.length > 0) {
    lines.push(`${colors.dim}Assumptions:${colors.reset}`);
    response.os_assumptions.forEach((assumption) => {
      lines.push(`  ${colors.dim}• ${assumption}${colors.reset}`);
    });
    lines.push('');
  }

  lines.push(`${colors.bold}Commands:${colors.reset}`);
  lines.push('');

  response.commands.forEach((cmd, index) => {
    lines.push(...formatCommand(cmd, index + 1));
  });

  if (response.pitfalls.length > 0) {
    lines.push('');
    lines.push(`${colors.yellow}⚠️  Pitfalls:${colors.reset}`);
    response.pitfalls.forEach((pitfall) => {
      lines.push(`  ${colors.yellow}• ${toBulletText(pitfall)}${colors.reset}`);
    });
  }

  if (response.verification_steps.length > 0) {
    lines.push('');
    lines.push(`${colors.dim}Verification:${colors.reset}`);
    response.verification_steps.forEach((step) => {
      lines.push(`  ${colors.dim}• ${toBulletText(step)}${colors.reset}`);
    });
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Models often return richer shapes than the prompt asks for — a bare string is
 * the contract, but `{command, description}` objects are common. Render those
 * readably instead of letting them stringify to "[object Object]".
 */
function toBulletText(entry: unknown): string {
  if (typeof entry === 'string') return entry;
  if (entry === null || entry === undefined) return '';
  if (typeof entry !== 'object') return String(entry);

  const obj = entry as Record<string, unknown>;
  const primary = obj.command ?? obj.step ?? obj.text ?? obj.title;
  const detail = obj.description ?? obj.explanation ?? obj.details;

  if (typeof primary === 'string' && typeof detail === 'string') {
    return `${primary} — ${detail}`;
  }
  if (typeof primary === 'string') return primary;
  if (typeof detail === 'string') return detail;

  return JSON.stringify(entry);
}

function formatCommand(cmd: CommandSuggestion, number: number): string[] {
  const lines: string[] = [];
  const riskColor = getRiskColor(cmd.risk_level);
  const riskBadge = getRiskBadge(cmd.risk_level);

  lines.push(
    `${colors.dim}${number}.${colors.reset} ${colors.bold}${cmd.label}${colors.reset} ${riskBadge}`
  );
  lines.push(`   ${riskColor}${cmd.command}${colors.reset}`);
  lines.push(`   ${colors.dim}${cmd.explanation}${colors.reset}`);
  lines.push('');

  return lines;
}

function getRiskColor(level: string): string {
  switch (level) {
    case 'low':
      return colors.green;
    case 'medium':
      return colors.yellow;
    case 'high':
      return colors.red;
    default:
      return colors.reset;
  }
}

function getRiskBadge(level: string): string {
  const badge = `[${level.toUpperCase()}]`;
  const color = getRiskColor(level);
  return `${color}${badge}${colors.reset}`;
}

export function renderSpinner(text: string): () => void {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let index = 0;
  let stopped = false;

  const interval = setInterval(() => {
    if (stopped) return;
    process.stdout.write(`\r${frames[index]} ${text}`);
    index = (index + 1) % frames.length;
  }, 80);

  return () => {
    stopped = true;
    clearInterval(interval);
    process.stdout.write('\r' + ' '.repeat(text.length + 3) + '\r');
  };
}
