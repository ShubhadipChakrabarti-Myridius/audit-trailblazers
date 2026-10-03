import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { join } from 'node:path';

const host = '127.0.0.1';
const port = Number(process.env.CODEX_RUNNER_PORT || 8787);
let busy = false;

function findCodex() {
  const candidates = [
    process.env.CODEX_CLI_PATH,
    ...process.env.PATH?.split(':').map(dir => join(dir, 'codex')) ?? [],
    '/Applications/ChatGPT.app/Contents/Resources/codex',
    '/Applications/Codex.app/Contents/Resources/codex',
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch { /* Try the next installed location. */ }
  }
  return null;
}

function reply(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    const cli = findCodex();
    return reply(res, cli ? 200 : 503, { ok: Boolean(cli), error: cli ? undefined : 'Codex CLI not found. Set CODEX_CLI_PATH to its executable path.' });
  }
  if (req.method !== 'POST' || req.url !== '/chat') {
    return reply(res, 404, { error: 'Not found' });
  }
  if (busy) return reply(res, 429, { error: 'Codex is already responding' });

  let raw = '';
  try {
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 32_000) return reply(res, 413, { error: 'Message too large' });
    }
    const { message, history = [] } = JSON.parse(raw);
    if (typeof message !== 'string' || !message.trim()) {
      return reply(res, 400, { error: 'A message is required' });
    }
    if (!Array.isArray(history) || history.length > 10 || history.some(
      item => !['human', 'codex'].includes(item?.role) || typeof item?.content !== 'string'
    )) return reply(res, 400, { error: 'Invalid chat history' });

    const cli = findCodex();
    if (!cli) return reply(res, 503, { error: 'Codex CLI not found. Set CODEX_CLI_PATH to its executable path.' });
    busy = true;
    const codex = spawn(cli, [
      'exec', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '-'
    ], { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    let errors = '';
    codex.stdout.on('data', chunk => { output += chunk; });
    codex.stderr.on('data', chunk => { errors += chunk; });
    codex.stdin.on('error', () => {});
    const prompt = [
      'Respond to the user in this local chat. Do not modify files. Prior conversation:',
      ...history.map(item => `${item.role === 'human' ? 'User' : 'Codex'}: ${item.content}`),
      `User: ${message}`,
    ].join('\n\n');
    codex.stdin.end(prompt);
    const timer = setTimeout(() => codex.kill('SIGTERM'), 120_000);
    const result = await new Promise(resolve => {
      codex.on('error', error => resolve({ error }));
      codex.on('close', code => resolve({ code }));
    });
    clearTimeout(timer);
    busy = false;
    if (result.error || result.code !== 0) {
      return reply(res, 502, { error: result.error?.message || errors.trim() || 'Codex failed' });
    }
    return reply(res, 200, { response: output.trim() });
  } catch (error) {
    busy = false;
    return reply(res, 400, { error: error instanceof Error ? error.message : 'Invalid request' });
  }
}).listen(port, host, () => {
  console.log(`Codex runner listening on http://${host}:${port}`);
});
