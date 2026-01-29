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

export function renderResponse(jsonString: string): string {
  let response: TermwhatResponse;

  try {
    // Try to parse the JSON response
    response = JSON.parse(jsonString);
  } catch (error) {
    return renderParseError(jsonString, error);
  }

  // Validate response structure
  if (!isValidResponse(response)) {
    return renderParseError(jsonString, new Error('Invalid response structure'));
  }

  return formatResponse(response);
}

function isValidResponse(obj: any): obj is TermwhatResponse {
  return (
    obj &&
    typeof obj.title === 'string' &&
    Array.isArray(obj.os_assumptions) &&
    Array.isArray(obj.commands) &&
    Array.isArray(obj.pitfalls) &&
    Array.isArray(obj.verification_steps)
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

  // Title
  lines.push('');
  lines.push(`${colors.bold}${colors.cyan}${response.title}${colors.reset}`);
  lines.push('');

  // OS Assumptions
  if (response.os_assumptions.length > 0) {
    lines.push(`${colors.dim}Assumptions:${colors.reset}`);
    response.os_assumptions.forEach(assumption => {
      lines.push(`  ${colors.dim}• ${assumption}${colors.reset}`);
    });
    lines.push('');
  }

  // Commands
  lines.push(`${colors.bold}Commands:${colors.reset}`);
  lines.push('');

  response.commands.forEach((cmd, index) => {
    lines.push(...formatCommand(cmd, index + 1));
  });

  // Pitfalls
  if (response.pitfalls.length > 0) {
    lines.push('');
    lines.push(`${colors.yellow}⚠️  Pitfalls:${colors.reset}`);
    response.pitfalls.forEach(pitfall => {
      lines.push(`  ${colors.yellow}• ${pitfall}${colors.reset}`);
    });
  }

  // Verification Steps
  if (response.verification_steps.length > 0) {
    lines.push('');
    lines.push(`${colors.dim}Verification:${colors.reset}`);
    response.verification_steps.forEach(step => {
      lines.push(`  ${colors.dim}• ${step}${colors.reset}`);
    });
  }

  lines.push('');
  return lines.join('\n');
}

function formatCommand(cmd: CommandSuggestion, number: number): string[] {
  const lines: string[] = [];
  const riskColor = getRiskColor(cmd.risk_level);
  const riskBadge = getRiskBadge(cmd.risk_level);

  // Command header with number and label
  lines.push(`${colors.dim}${number}.${colors.reset} ${colors.bold}${cmd.label}${colors.reset} ${riskBadge}`);

  // The actual command
  lines.push(`   ${riskColor}${cmd.command}${colors.reset}`);

  // Explanation
  lines.push(`   ${colors.dim}${cmd.explanation}${colors.reset}`);
  lines.push('');

  return lines;
}

function getRiskColor(level: string): string {
  switch (level) {
    case 'low': return colors.green;
    case 'medium': return colors.yellow;
    case 'high': return colors.red;
    default: return colors.reset;
  }
}

function getRiskBadge(level: string): string {
  const badge = `[${level.toUpperCase()}]`;
  const color = getRiskColor(level);
  return `${color}${badge}${colors.reset}`;
}

export function renderStreamingChunk(chunk: string): void {
  process.stdout.write(chunk);
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
