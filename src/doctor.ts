import type { AIProvider } from './providers/index.js';

export async function runDoctor(provider: AIProvider): Promise<void> {
  console.log('\n🏥 Running diagnostics...\n');

  const config = provider.getConfig();
  const providerType = provider.getProviderType();
  const model = provider.getModelName();
  const results: Array<{ check: string; status: boolean; message: string }> = [];

  // Check 1: Provider reachability
  console.log(`⏳ Checking ${providerType} provider reachability...`);
  const healthCheck = await provider.healthCheck();

  const providerLabel = providerType === 'ollama' ? `${providerType} (${config.host})` : providerType;

  results.push({
    check: 'Provider reachable',
    status: healthCheck.healthy,
    message: healthCheck.healthy
      ? `✓ Connected to ${providerLabel}`
      : `✗ Failed to connect: ${healthCheck.error}`,
  });

  // Check 2: API responding
  if (healthCheck.healthy) {
    results.push({
      check: 'API responding',
      status: true,
      message: `✓ Response time: ${healthCheck.responseTime}ms`,
    });

    // Check 3: Model available (for providers that support model listing)
    if (healthCheck.models && healthCheck.models.length > 0) {
      const modelAvailable = healthCheck.models.includes(model);
      results.push({
        check: 'Model available',
        status: modelAvailable,
        message: modelAvailable
          ? `✓ Model '${model}' is available`
          : `⚠ Model '${model}' not found in list`,
      });
    } else {
      // Some providers (like cloud APIs) don't list models
      results.push({
        check: 'Model configured',
        status: true,
        message: `✓ Using model '${model}'`,
      });
    }

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
      message: '✗ Cannot test - provider unreachable',
    });
    results.push({
      check: 'Model available',
      status: false,
      message: '✗ Cannot test - provider unreachable',
    });
    results.push({
      check: 'Response time acceptable',
      status: false,
      message: '✗ Cannot test - provider unreachable',
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
      if (providerType === 'ollama') {
        console.log(`• Ollama not found at ${config.host}`);
        console.log('  Is Ollama running? Start it with: ollama serve');
        console.log('  To expose Ollama on LAN: OLLAMA_HOST=0.0.0.0 ollama serve');
        console.log(`  Or set TERMWHAT_OLLAMA_HOST to the correct URL\n`);
      } else if (providerType === 'openai') {
        console.log(`• OpenAI API connection failed`);
        console.log('  Check your API key: TERMWHAT_OPENAI_API_KEY');
        console.log('  Verify the API key is valid at https://platform.openai.com/api-keys\n');
      } else if (providerType === 'anthropic') {
        console.log(`• Anthropic API connection failed`);
        console.log('  Check your API key: TERMWHAT_ANTHROPIC_API_KEY');
        console.log('  Verify the API key is valid at https://console.anthropic.com/settings/keys\n');
      } else if (providerType === 'openrouter') {
        console.log(`• OpenRouter API connection failed`);
        console.log('  Check your API key: TERMWHAT_OPENROUTER_API_KEY');
        console.log('  Verify the API key is valid at https://openrouter.ai/keys\n');
      }
    }

    const modelCheck = results.find(r => r.check === 'Model available');
    if (modelCheck && !modelCheck.status && healthCheck.models) {
      if (providerType === 'ollama') {
        console.log(`• Model '${model}' not installed`);
        console.log(`  Install it with: ollama pull ${model}`);
        console.log('  Available models:');
        healthCheck.models.forEach(m => console.log(`    - ${m}`));
        console.log('');
      } else {
        console.log(`• Model '${model}' might not be available`);
        console.log('  Available models:');
        healthCheck.models.forEach(m => console.log(`    - ${m}`));
        console.log('');
      }
    }

    const responseCheck = results.find(r => r.check === 'Response time acceptable');
    if (responseCheck && !responseCheck.status) {
      console.log('• Response time is high');
      if (providerType === 'ollama') {
        console.log('  Consider using a smaller/faster model');
        console.log('  Or check your network connection to Ollama\n');
      } else {
        console.log('  Check your internet connection\n');
      }
    }
  } else {
    console.log('\n✓ All checks passed! Ready to use termwhat.\n');
  }

  // Configuration summary
  console.log('Current configuration:');
  console.log(`  Provider: ${providerType}`);
  if (providerType === 'ollama') {
    console.log(`  Host:     ${config.host}`);
  }
  console.log(`  Model:    ${model}`);
  console.log(`  Timeout:  ${config.timeout}ms\n`);
}
