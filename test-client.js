/**
 * REST API 수동 테스트 스크립트
 *
 * 1) 터미널 1: npm run dev
 * 2) 터미널 2: node test-client.js
 */

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(color, prefix, message) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

async function req(path, options = {}) {
  const url = `${SERVER_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function main() {
  log(colors.cyan, '\n[1]', 'GET /health');
  const h = await req('/health');
  console.log(h.status, h.body);

  log(colors.cyan, '\n[2]', 'POST /api/request-monitor (즉시 할당)');
  const a = await req('/api/request-monitor', {
    method: 'POST',
    body: JSON.stringify({ worryId: 'demo-1', clientId: 'test-client-js' })
  });
  console.log(a.status, a.body);
  const mid = a.body?.monitorId || 'monitor-1';

  log(colors.cyan, '\n[3]', `GET /api/monitors/${mid}/current`);
  const cur = await req(`/api/monitors/${mid}/current`);
  console.log(cur.status, cur.body);

  log(colors.cyan, '\n[4]', `POST /api/monitors/${mid}/complete`);
  const done = await req(`/api/monitors/${mid}/complete`, { method: 'POST', body: '{}' });
  console.log(done.status, done.body);

  log(colors.green, '\n✓', '시나리오 종료');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
