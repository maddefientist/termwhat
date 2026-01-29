import { spawn } from 'child_process';
import { platform } from 'os';

export async function copyToClipboard(text: string): Promise<void> {
  const os = platform();

  let command: string;
  let args: string[];

  switch (os) {
    case 'darwin':
      command = 'pbcopy';
      args = [];
      break;
    case 'linux':
      // Try xclip first, fall back to xsel
      if (await commandExists('xclip')) {
        command = 'xclip';
        args = ['-selection', 'clipboard'];
      } else if (await commandExists('xsel')) {
        command = 'xsel';
        args = ['--clipboard', '--input'];
      } else {
        throw new Error('No clipboard utility found. Install xclip or xsel.');
      }
      break;
    case 'win32':
      command = 'clip';
      args = [];
      break;
    default:
      throw new Error(`Clipboard not supported on platform: ${os}`);
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);

    proc.stdin.write(text);
    proc.stdin.end();

    proc.on('error', (error) => {
      reject(new Error(`Failed to copy to clipboard: ${error.message}`));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Clipboard command exited with code ${code}`));
      }
    });
  });
}

async function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('which', [command]);
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}
