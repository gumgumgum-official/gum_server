/**
 * REST API 테스트 스크립트
 *
 * 헬스 체크와 상태 조회 API 테스트
 */

const http = require('http');

const SERVER_HOST = 'localhost';
const SERVER_PORT = 3000;

// 색상 출력
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(color, prefix, message) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          resolve(data);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function testRestAPI() {
  console.log('\n' + '='.repeat(50));
  log(colors.cyan, '🔍', 'REST API 테스트');
  console.log('='.repeat(50) + '\n');

  try {
    // 1. 헬스 체크
    log(colors.cyan, '[테스트 1]', 'GET /health');
    const healthData = await makeRequest('/health');
    console.log(JSON.stringify(healthData, null, 2));
    log(colors.green, '  ✓', '헬스 체크 성공');

    console.log();

    // 2. 상태 조회
    log(colors.cyan, '[테스트 2]', 'GET /status');
    const statusData = await makeRequest('/status');
    console.log(JSON.stringify(statusData, null, 2));
    log(colors.green, '  ✓', '상태 조회 성공');

    console.log('\n' + '='.repeat(50));
    log(colors.green, '✅', 'REST API 테스트 완료!');
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('\n❌ 에러 발생:', error.message);
    console.error('서버가 실행 중인지 확인하세요: npm run dev');
    process.exit(1);
  }
}

testRestAPI();
