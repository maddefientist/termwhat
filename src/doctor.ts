import { OllamaClient } from './ollama.js';

export async function runDoctor(client: OllamaClient): Promise<void> {
  console.log('\n🏥 Running diagnostics...\n');

  const config = client.getConfig();
  const results: Array<{ check: string; status: boolean; message: string }> = [];

  // Check 1: Ollama host reachable
  console.log('⏳ Checking Ollama host reachability...');
  const healthCheck = await client.healthCheck();

  results.push({
    check: 'Ollama host reachable',
    status: healthCheck.healthy,
    message: healthCheck.healthy
      ? `✓ Connected to ${config.host}`
      : `✗ Failed to connect: ${healthCheck.error}`,
  });

  // Check 2: API responding
  if (healthCheck.healthy) {
    results.push({
      check: 'API responding',
      status: true,
      message: `✓ Response time: ${healthCheck.responseTime}ms`,
    });

    // Check 3: Model available
    const modelAvailable = healthCheck.models?.includes(config.model) || false;
    results.push({
      check: 'Model available',
      status: modelAvailable,
      message: modelAvailable
        ? `✓ Model '${config.model}' is installed`
        : `✗ Model '${config.model}' not found`,
    });

    // Check 4: Response time acceptable
    const responseTimeOk = (healthCheck.responseTime || 0) < 2000;
    results.push({
      check: 'Response time acceptable',
      status: responseTimeOk,
      message: responseTimeOk
        ? '✓ Response time under 2s'
        : `⚠ Response time high (${healthCheck.responseTime}ms)`,
    });
  } else {
    results.push({
      check: 'API responding',
      status: false,
      message: '✗ Cannot test - host unreachable',
    });
    results.push({
      check: 'Model available',
      status: false,
      message: '✗ Cannot test - host unreachable',
    });
    results.push({
      check: 'Response time acceptable',
      status: false,
      message: '✗ Cannot test - host unreachable',
    });
  }

  // Print results
  console.log('\nResults:');
  console.log('─'.repeat(60));
  results.forEach(({ check, status, message }) => {
    const icon = status ? '✓' : '✗';
    console.log(`${icon} ${check}`);
    console.log(`  ${message}`);
  });
  console.log('─'.repeat(60));

  // Provide guidance if there are failures
  const hasFailures = results.some(r => !r.status);
  if (hasFailures) {
    console.log('\n💡 Troubleshooting tips:\n');

    if (!healthCheck.healthy) {
      console.log(`• Ollama not found at ${config.host}`);
      console.log('  Is Ollama running? Start it with: ollama serve');
      console.log('  To expose Ollama on LAN: OLLAMA_HOST=0.0.0.0 ollama serve');
      console.log(`  Or set TERMWHAT_OLLAMA_HOST to the correct URL\n`);
    }

    const modelCheck = results.find(r => r.check === 'Model available');
    if (modelCheck && !modelCheck.status && healthCheck.models) {
      console.log(`• Model '${config.model}' not installed`);
      console.log(`  Install it with: ollama pull ${config.model}`);
      console.log('  Available models:');
      healthCheck.models.forEach(m => console.log(`    - ${m}`));
      console.log('');
    }

    const responseCheck = results.find(r => r.check === 'Response time acceptable');
    if (responseCheck && !responseCheck.status) {
      console.log('• Response time is high');
      console.log('  Consider using a smaller/faster model');
      console.log('  Or check your network connection to Ollama\n');
    }
  } else {
    console.log('\n✓ All checks passed! Ready to use termwhat.\n');
  }

  // Configuration summary
  console.log('Current configuration:');
  console.log(`  Host:    ${config.host}`);
  console.log(`  Model:   ${config.model}`);
  console.log(`  Timeout: ${config.timeout}ms\n`);
}
