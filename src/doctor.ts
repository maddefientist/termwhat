import type { AIProvider } from './providers/index.js';
import { isOllamaCloudHost } from './providers/index.js';

function isCloudProvider(provider: AIProvider): boolean {
  const type = provider.getProviderType();
  if (type === 'ollama-cloud' || type === 'openai' || type === 'anthropic' || type === 'openrouter') {
    return true;
  }
  if (type === 'ollama') {
    const cfg = provider.getConfig();
    return Boolean(cfg.cloud) || isOllamaCloudHost(cfg.host);
  }
  return false;
}

export async function runDoctor(provider: AIProvider): Promise<void> {
  console.log('\n🏥 Running diagnostics...\n');

  const config = provider.getConfig();
  const providerType = provider.getProviderType();
  const model = provider.getModelName();
  const cloud = isCloudProvider(provider);
  const results: Array<{ check: string; status: boolean; message: string; informational?: boolean }> = [];

  // Check 1: Provider reachability
  console.log(`⏳ Checking ${providerType} provider reachability...`);
  const healthCheck = await provider.healthCheck();

  const providerLabel =
    providerType === 'ollama' || providerType === 'ollama-cloud'
      ? `${providerType} (${config.host})`
      : providerType;

  let reachMsg: string;
  if (healthCheck.healthy) {
    reachMsg = `✓ Connected to ${providerLabel}`;
  } else if (healthCheck.status === 401 || healthCheck.status === 403) {
    reachMsg = `✗ Auth failed (HTTP ${healthCheck.status}): ${healthCheck.error}`;
  } else if (healthCheck.status) {
    reachMsg = `✗ HTTP ${healthCheck.status}: ${healthCheck.error}`;
  } else {
    reachMsg = `✗ Failed to connect: ${healthCheck.error}`;
  }

  results.push({
    check: 'Provider reachable',
    status: healthCheck.healthy,
    message: reachMsg,
  });

  // Check 2: API responding
  if (healthCheck.healthy) {
    results.push({
      check: 'API responding',
      status: true,
      message: `✓ Response time: ${healthCheck.responseTime}ms`,
    });

    // Check 3: Model available
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
      results.push({
        check: 'Model configured',
        status: true,
        message: `✓ Using model '${model}'`,
      });
    }

    // Check 4: Latency — report only, no pass/fail (cloud routinely >2s)
    const rt = healthCheck.responseTime || 0;
    const classLabel = cloud ? 'cloud' : 'local';
    results.push({
      check: 'Response latency',
      status: true,
      informational: true,
      message: `ℹ ${rt}ms (${classLabel} provider — informational, not a pass/fail gate)`,
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
      check: 'Response latency',
      status: true,
      informational: true,
      message: 'ℹ Cannot measure - provider unreachable',
    });
  }

  // Print results
  console.log('\nResults:');
  console.log('─'.repeat(60));
  results.forEach(({ check, status, message, informational }) => {
    const icon = informational ? 'ℹ' : status ? '✓' : '✗';
    console.log(`${icon} ${check}`);
    console.log(`  ${message}`);
  });
  console.log('─'.repeat(60));

  // Guidance only for real failures (ignore informational)
  const hasFailures = results.some((r) => !r.status && !r.informational);
  if (hasFailures) {
    console.log('\n💡 Troubleshooting tips:\n');

    if (!healthCheck.healthy) {
      if (providerType === 'ollama') {
        console.log(`• Ollama not found at ${config.host}`);
        console.log('  Is Ollama running? Start it with: ollama serve');
        console.log('  To expose Ollama on LAN: OLLAMA_HOST=0.0.0.0 ollama serve');
        console.log(`  Or set TERMWHAT_OLLAMA_HOST to the correct URL\n`);
      } else if (providerType === 'ollama-cloud') {
        console.log(`• Ollama cloud connection failed`);
        if (healthCheck.status === 401 || healthCheck.status === 403) {
          console.log('  Check your API key: TERMWHAT_OLLAMA_API_KEY');
        }
        console.log('  Keys: https://ollama.com/settings/keys\n');
      } else if (providerType === 'openai') {
        console.log(`• OpenAI API connection failed`);
        if (healthCheck.status === 401 || healthCheck.status === 403) {
          console.log('  Bad or missing key (HTTP ' + healthCheck.status + ')');
        }
        console.log('  Check your API key: TERMWHAT_OPENAI_API_KEY');
        console.log('  Verify the API key is valid at https://platform.openai.com/api-keys\n');
      } else if (providerType === 'anthropic') {
        console.log(`• Anthropic API connection failed`);
        if (healthCheck.status === 401 || healthCheck.status === 403) {
          console.log('  Bad or missing key (HTTP ' + healthCheck.status + ')');
        }
        console.log('  Check your API key: TERMWHAT_ANTHROPIC_API_KEY');
        console.log('  Verify the API key is valid at https://console.anthropic.com/settings/keys\n');
      } else if (providerType === 'openrouter') {
        console.log(`• OpenRouter API connection failed`);
        if (healthCheck.status === 401 || healthCheck.status === 403) {
          console.log('  Bad or missing key (HTTP ' + healthCheck.status + ')');
        }
        console.log('  Check your API key: TERMWHAT_OPENROUTER_API_KEY');
        console.log('  Verify the API key is valid at https://openrouter.ai/keys\n');
      }
    }

    const modelCheck = results.find((r) => r.check === 'Model available');
    if (modelCheck && !modelCheck.status && healthCheck.models) {
      if (providerType === 'ollama') {
        console.log(`• Model '${model}' not installed`);
        console.log(`  Install it with: ollama pull ${model}`);
        console.log('  Available models:');
        healthCheck.models.forEach((m) => console.log(`    - ${m}`));
        console.log('');
      } else {
        console.log(`• Model '${model}' might not be available`);
        console.log('  Available models:');
        healthCheck.models.slice(0, 20).forEach((m) => console.log(`    - ${m}`));
        if (healthCheck.models.length > 20) {
          console.log(`    … and ${healthCheck.models.length - 20} more`);
        }
        console.log('');
      }
    }
  } else {
    console.log('\n✓ All checks passed! Ready to use termwhat.\n');
  }

  // Configuration summary
  console.log('Current configuration:');
  console.log(`  Provider: ${providerType}`);
  if (providerType === 'ollama' || providerType === 'ollama-cloud') {
    console.log(`  Host:     ${config.host}`);
  }
  console.log(`  Model:    ${model}`);
  console.log(`  Timeout:  ${config.timeout}ms\n`);
}
