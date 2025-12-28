/**
 * 서버 테스트 스크립트
 *
 * 실행 방법:
 * 1. 터미널 1: npm run dev (서버 시작)
 * 2. 터미널 2: node test-client.js (이 스크립트 실행)
 */

const io = require('socket.io-client');

// 서버 주소
const SERVER_URL = 'http://localhost:3000';

// 색상 출력 (터미널에서 보기 좋게)
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, prefix, message) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

// ============================================
// 시나리오 1: 모니터 등록
// ============================================
function testMonitorRegistration() {
  return new Promise((resolve) => {
    log(colors.cyan, '\n[테스트 1]', '모니터 등록');

    const monitor1 = io(SERVER_URL);

    monitor1.on('connect', () => {
      log(colors.blue, '  ✓', `모니터 1 연결됨 (${monitor1.id})`);
      monitor1.emit('register-device', 'monitor-1');
    });

    monitor1.on('registered', (data) => {
      log(colors.green, '  ✓', `모니터 1 등록 완료: ${data.deviceType}`);
      monitor1.close();
      resolve();
    });
  });
}

// ============================================
// 시나리오 2: 태블릿 → 모니터 할당 (성공)
// ============================================
function testMonitorAssignment() {
  return new Promise((resolve) => {
    log(colors.cyan, '\n[테스트 2]', '모니터 할당 (성공 케이스)');

    const tablet = io(SERVER_URL);

    tablet.on('connect', () => {
      log(colors.blue, '  ✓', `태블릿 연결됨 (${tablet.id})`);

      // 모니터 할당 요청
      tablet.emit('request-monitor', {
        worryId: 'worry-test-001'
      });
      log(colors.yellow, '  →', 'worryId=worry-test-001 로 모니터 요청');
    });

    tablet.on('monitor-assigned', (data) => {
      log(colors.green, '  ✓', `모니터 할당됨: ${data.monitorId} (${data.monitorNumber}번)`);
      log(colors.green, '    ', `메시지: ${data.message}`);
      tablet.close();

      setTimeout(resolve, 500);
    });

    tablet.on('please-wait', (data) => {
      log(colors.yellow, '  !', `대기 필요: ${data.queuePosition}번째`);
      tablet.close();
      resolve();
    });
  });
}

// ============================================
// 시나리오 3: 모니터 2개 모두 사용 중 → 대기
// ============================================
function testQueue() {
  return new Promise((resolve) => {
    log(colors.cyan, '\n[테스트 3]', '대기열 테스트 (모니터 부족)');

    const tablet1 = io(SERVER_URL);
    const tablet2 = io(SERVER_URL);
    const tablet3 = io(SERVER_URL);

    let connected = 0;
    const checkAllConnected = () => {
      connected++;
      if (connected === 3) {
        // 모두 연결되면 순차적으로 요청
        setTimeout(() => {
          tablet1.emit('request-monitor', { worryId: 'worry-001' });
          log(colors.yellow, '  →', '태블릿 1: 모니터 요청 (worry-001)');
        }, 100);

        setTimeout(() => {
          tablet2.emit('request-monitor', { worryId: 'worry-002' });
          log(colors.yellow, '  →', '태블릿 2: 모니터 요청 (worry-002)');
        }, 200);

        setTimeout(() => {
          tablet3.emit('request-monitor', { worryId: 'worry-003' });
          log(colors.yellow, '  →', '태블릿 3: 모니터 요청 (worry-003)');
        }, 300);
      }
    };

    tablet1.on('connect', () => {
      log(colors.blue, '  ✓', `태블릿 1 연결됨`);
      checkAllConnected();
    });

    tablet2.on('connect', () => {
      log(colors.blue, '  ✓', `태블릿 2 연결됨`);
      checkAllConnected();
    });

    tablet3.on('connect', () => {
      log(colors.blue, '  ✓', `태블릿 3 연결됨`);
      checkAllConnected();
    });

    tablet1.on('monitor-assigned', (data) => {
      log(colors.green, '  ✓', `태블릿 1 할당됨: ${data.monitorId}`);
    });

    tablet2.on('monitor-assigned', (data) => {
      log(colors.green, '  ✓', `태블릿 2 할당됨: ${data.monitorId}`);
    });

    tablet3.on('monitor-assigned', (data) => {
      log(colors.green, '  ✓', `태블릿 3 할당됨: ${data.monitorId}`);
    });

    tablet3.on('please-wait', (data) => {
      log(colors.yellow, '  !', `태블릿 3 대기 중: ${data.queuePosition}번째`);
      log(colors.yellow, '    ', data.message);

      // 정리
      setTimeout(() => {
        tablet1.close();
        tablet2.close();
        tablet3.close();
        resolve();
      }, 1000);
    });
  });
}

// ============================================
// 시나리오 4: 체험 완료 → 다음 사용자 자동 할당
// ============================================
function testCompleteAndReassign() {
  return new Promise((resolve) => {
    log(colors.cyan, '\n[테스트 4]', '체험 완료 → 자동 재할당');

    const monitor = io(SERVER_URL);
    const tablet1 = io(SERVER_URL);
    const tablet2 = io(SERVER_URL);

    let assignedMonitor = null;

    // 모니터 등록
    monitor.on('connect', () => {
      log(colors.blue, '  ✓', '모니터 연결됨');
      monitor.emit('register-device', 'monitor-1');
    });

    monitor.on('registered', () => {
      log(colors.green, '  ✓', '모니터 등록 완료');

      // 첫 번째 태블릿 요청
      setTimeout(() => {
        tablet1.emit('request-monitor', { worryId: 'worry-A' });
        log(colors.yellow, '  →', '태블릿 1: 모니터 요청');
      }, 100);
    });

    tablet1.on('connect', () => {
      log(colors.blue, '  ✓', '태블릿 1 연결됨');
    });

    tablet1.on('monitor-assigned', (data) => {
      assignedMonitor = data.monitorId;
      log(colors.green, '  ✓', `태블릿 1 할당됨: ${assignedMonitor}`);

      // 두 번째 태블릿 요청 (대기)
      setTimeout(() => {
        tablet2.emit('request-monitor', { worryId: 'worry-B' });
        log(colors.yellow, '  →', '태블릿 2: 모니터 요청 (대기 예상)');
      }, 100);
    });

    tablet2.on('connect', () => {
      log(colors.blue, '  ✓', '태블릿 2 연결됨');
    });

    tablet2.on('please-wait', (data) => {
      log(colors.yellow, '  !', `태블릿 2 대기 중: ${data.queuePosition}번째`);

      // 체험 완료
      setTimeout(() => {
        monitor.emit('experience-complete', assignedMonitor);
        log(colors.magenta, '  →', `모니터 체험 완료: ${assignedMonitor}`);
      }, 500);
    });

    tablet2.on('monitor-assigned', (data) => {
      log(colors.green, '  ✓', `태블릿 2 자동 할당됨: ${data.monitorId}`);
      log(colors.green, '    ', '🎉 자동 재할당 성공!');

      // 정리
      setTimeout(() => {
        monitor.close();
        tablet1.close();
        tablet2.close();
        resolve();
      }, 500);
    });
  });
}

// ============================================
// 메인 실행
// ============================================
async function runTests() {
  console.log('\n' + '='.repeat(50));
  log(colors.bright, '🚀', '껌딱지월드 서버 테스트 시작');
  console.log('='.repeat(50));

  try {
    await testMonitorRegistration();
    await new Promise(resolve => setTimeout(resolve, 500));

    await testMonitorAssignment();
    await new Promise(resolve => setTimeout(resolve, 500));

    await testQueue();
    await new Promise(resolve => setTimeout(resolve, 500));

    await testCompleteAndReassign();

    console.log('\n' + '='.repeat(50));
    log(colors.green, '✅', '모든 테스트 완료!');
    console.log('='.repeat(50) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 에러 발생:', error);
    process.exit(1);
  }
}

// 서버 연결 확인
const testConnection = io(SERVER_URL);
testConnection.on('connect', () => {
  log(colors.green, '✓', '서버 연결 성공!');
  testConnection.close();

  // 테스트 시작
  setTimeout(runTests, 500);
});

testConnection.on('connect_error', (error) => {
  console.error('\n❌ 서버 연결 실패!');
  console.error('서버가 실행 중인지 확인하세요: npm run dev');
  console.error('에러:', error.message);
  process.exit(1);
});
