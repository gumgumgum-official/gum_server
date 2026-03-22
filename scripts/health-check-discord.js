#!/usr/bin/env node
/**
 * 외부에서 주기 실행(cron / GitHub Actions)용 헬스 체크.
 * 성공 시: 출력만 하고 종료 0
 * 실패 시: Discord Webhook으로 알림 후 종료 1
 *
 * 환경변수:
 *   HEALTH_URL            (필수) 예: https://your-app.onrender.com/health
 *   DISCORD_WEBHOOK_URL   (필수) Discord 채널 웹훅 URL
 *   HEALTH_TIMEOUT_MS     (선택) 기본 15000
 */

require('dotenv').config();

const HEALTH_URL = process.env.HEALTH_URL;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS || 15000);

async function sendDiscordFailure(payload) {
  const body = {
    embeds: [
      {
        title: 'gum_server 헬스체크 실패',
        description: payload.message,
        color: 0xe74c3c,
        fields: [
          { name: 'URL', value: payload.url || HEALTH_URL || '(없음)', inline: false },
          { name: '시각', value: new Date().toISOString(), inline: false }
        ]
      }
    ]
  };

  const res = await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord webhook failed: ${res.status} ${text}`);
  }
}

async function main() {
  if (!HEALTH_URL || !DISCORD_WEBHOOK_URL) {
    console.error('[health-check-discord] HEALTH_URL 과 DISCORD_WEBHOOK_URL 이 필요합니다.');
    process.exit(2);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    clearTimeout(timer);

    if (!res.ok) {
      const msg = `HTTP ${res.status} ${res.statusText}`;
      await sendDiscordFailure({ message: msg, url: HEALTH_URL });
      console.error('[health-check-discord]', msg);
      process.exit(1);
    }

    let data;
    try {
      data = await res.json();
    } catch {
      const msg = '응답이 JSON이 아님';
      await sendDiscordFailure({ message: msg, url: HEALTH_URL });
      console.error('[health-check-discord]', msg);
      process.exit(1);
    }

    if (data.status !== 'ok') {
      const msg = `본문 status가 ok 아님: ${JSON.stringify(data.status)}`;
      await sendDiscordFailure({ message: msg, url: HEALTH_URL });
      console.error('[health-check-discord]', msg);
      process.exit(1);
    }

    console.log('[health-check-discord] OK', data.timestamp || '');
    process.exit(0);
  } catch (err) {
    clearTimeout(timer);
    const message = err.name === 'AbortError' ? `타임아웃 (${TIMEOUT_MS}ms)` : String(err.message || err);
    try {
      await sendDiscordFailure({ message, url: HEALTH_URL });
    } catch (e) {
      console.error('[health-check-discord] Discord 전송 실패:', e);
    }
    console.error('[health-check-discord]', message);
    process.exit(1);
  }
}

main();
