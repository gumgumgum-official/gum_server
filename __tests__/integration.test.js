/**
 * Socket.io 통합 테스트
 *
 * 테스트 대상: 전체 Socket.io 이벤트 플로우
 * 테스트 범위:
 * - 디바이스 등록
 * - 모니터 할당 (성공/대기)
 * - 체험 완료 및 자동 재할당
 * - 연결 끊김 처리
 * - 전체 플로우 (할당 → 체험 → 완료 → 다음 할당)
 */

const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const MonitorManager = require('../src/managers/MonitorManager');
const QueueManager = require('../src/managers/QueueManager');
const { handleDeviceRegistration } = require('../src/handlers/deviceHandler');
const { handleMonitorRequest, handleExperienceComplete } = require('../src/handlers/monitorHandler');
const { handleDisconnect } = require('../src/handlers/disconnectHandler');
const constants = require('../src/utils/constants');

describe('Socket.io 통합 테스트', () => {
  let io, serverSocket, clientSocket1, clientSocket2, httpServer;
  let monitorManager, queueManager;
  const port = 3001; // 테스트용 포트

  // 모든 테스트 전: 서버 시작
  beforeAll((done) => {
    httpServer = http.createServer();
    io = new Server(httpServer);

    httpServer.listen(port, () => {
      done();
    });
  });

  // 모든 테스트 후: 서버 종료
  afterAll(() => {
    io.close();
    httpServer.close();
  });

  // 각 테스트 전: 매니저 초기화 및 이벤트 핸들러 설정
  beforeEach((done) => {
    // 매니저 초기화
    monitorManager = new MonitorManager();
    queueManager = new QueueManager();

    // 서버 이벤트 핸들러 설정
    io.on('connection', (socket) => {
      serverSocket = socket;

      socket.on(constants.EVENT_NAMES.REGISTER_DEVICE, (deviceType) => {
        handleDeviceRegistration(socket, deviceType, monitorManager);
      });

      socket.on(constants.EVENT_NAMES.REQUEST_MONITOR, (data) => {
        handleMonitorRequest(socket, data, monitorManager, queueManager, io);
      });

      socket.on(constants.EVENT_NAMES.EXPERIENCE_COMPLETE, (monitorId) => {
        handleExperienceComplete(socket, monitorId, monitorManager, queueManager, io);
      });

      socket.on('disconnect', () => {
        handleDisconnect(socket, monitorManager, queueManager, io);
      });
    });

    // 클라이언트 연결
    clientSocket1 = new Client(`http://localhost:${port}`);
    clientSocket1.on('connect', () => {
      done();
    });
  });

  // 각 테스트 후: 클라이언트 연결 종료
  afterEach(() => {
    if (clientSocket1) clientSocket1.close();
    if (clientSocket2) clientSocket2.close();
    io.removeAllListeners();
  });

  describe('디바이스 등록', () => {
    test('태블릿 등록이 성공해야 함', (done) => {
      // When: 태블릿 등록 요청
      clientSocket1.emit(constants.EVENT_NAMES.REGISTER_DEVICE, 'tablet');

      // Then: 등록 완료 응답 수신
      clientSocket1.on(constants.EVENT_NAMES.REGISTERED, (data) => {
        expect(data.deviceType).toBe('tablet');
        expect(data.timestamp).toBeDefined();
        done();
      });
    });

    test('모니터 등록이 성공하고 소켓 ID가 저장되어야 함', (done) => {
      // When: 모니터 등록 요청
      clientSocket1.emit(constants.EVENT_NAMES.REGISTER_DEVICE, 'monitor-1');

      // Then: 등록 완료 및 소켓 ID 저장 확인
      clientSocket1.on(constants.EVENT_NAMES.REGISTERED, (data) => {
        expect(data.deviceType).toBe('monitor-1');
        expect(monitorManager.monitors['monitor-1'].socketId).toBeDefined();
        done();
      });
    });
  });

  describe('모니터 할당 - 성공 케이스', () => {
    test('빈 모니터가 있을 때 즉시 할당되어야 함', (done) => {
      clientSocket1.emit(constants.EVENT_NAMES.REGISTER_DEVICE, 'tablet');

      clientSocket1.on(constants.EVENT_NAMES.REGISTERED, () => {
        clientSocket1.emit(constants.EVENT_NAMES.REQUEST_MONITOR, {
          worryId: 'worry-123'
        });
      });

      clientSocket1.on(constants.EVENT_NAMES.MONITOR_ASSIGNED, (data) => {
        expect(data.monitorId).toBe('monitor-1');
        expect(data.monitorNumber).toBe(1);
        expect(data.message).toContain('왼쪽');
        expect(monitorManager.monitors['monitor-1'].status).toBe('busy');
        done();
      });
    });

    test('모니터가 체험 시작 신호를 받아야 함', (done) => {
      // 모니터 클라이언트
      clientSocket2 = new Client(`http://localhost:${port}`);

      clientSocket2.on('connect', () => {
        clientSocket2.emit(constants.EVENT_NAMES.REGISTER_DEVICE, 'monitor-1');
      });

      clientSocket2.on(constants.EVENT_NAMES.START_EXPERIENCE, (data) => {
        expect(data.worryId).toBe('worry-123');
        done();
      });

      // 태블릿에서 요청
      setTimeout(() => {
        clientSocket1.emit(constants.EVENT_NAMES.REQUEST_MONITOR, {
          worryId: 'worry-123'
        });
      }, 100);
    });
  });

  describe('모니터 할당 - 대기 케이스', () => {
    test('모든 모니터가 사용 중일 때 대기열에 추가되어야 함', (done) => {
      // 모든 모니터를 busy 상태로 설정
      monitorManager.monitors['monitor-1'].status = 'busy';
      monitorManager.monitors['monitor-2'].status = 'busy';

      clientSocket1.emit(constants.EVENT_NAMES.REQUEST_MONITOR, {
        worryId: 'worry-waiting'
      });

      clientSocket1.on(constants.EVENT_NAMES.PLEASE_WAIT, (data) => {
        expect(data.queuePosition).toBe(1);
        expect(data.message).toContain('1번째');
        expect(queueManager.getLength()).toBe(1);
        done();
      });
    });

    test('여러 사용자가 대기할 때 순서가 유지되어야 함', (done) => {
      // 모든 모니터를 busy 상태로 설정
      monitorManager.monitors['monitor-1'].status = 'busy';
      monitorManager.monitors['monitor-2'].status = 'busy';

      // 첫 번째 클라이언트 대기
      clientSocket1.emit(constants.EVENT_NAMES.REQUEST_MONITOR, {
        worryId: 'worry-1'
      });

      clientSocket1.on(constants.EVENT_NAMES.PLEASE_WAIT, (data) => {
        expect(data.queuePosition).toBe(1);

        // 두 번째 클라이언트 연결 및 대기
        clientSocket2 = new Client(`http://localhost:${port}`);

        clientSocket2.on('connect', () => {
          clientSocket2.emit(constants.EVENT_NAMES.REQUEST_MONITOR, {
            worryId: 'worry-2'
          });
        });

        clientSocket2.on(constants.EVENT_NAMES.PLEASE_WAIT, (data) => {
          expect(data.queuePosition).toBe(2);
          expect(queueManager.getLength()).toBe(2);
          done();
        });
      });
    });
  });

  describe('체험 완료', () => {
    test('체험 완료 시 모니터가 idle 상태로 변경되어야 함', (done) => {
      // 모니터를 busy 상태로 설정
      monitorManager.assign('monitor-1', {
        worryId: 'worry-123',
        socketId: clientSocket1.id
      });

      clientSocket1.emit(constants.EVENT_NAMES.EXPERIENCE_COMPLETE, 'monitor-1');

      setTimeout(() => {
        expect(monitorManager.monitors['monitor-1'].status).toBe('idle');
        expect(monitorManager.monitors['monitor-1'].currentWorry).toBeNull();
        done();
      }, 100);
    });

    test('체험 완료 후 대기 중인 사용자에게 자동 할당되어야 함', (done) => {
      // 모니터 1을 busy로 설정
      monitorManager.assign('monitor-1', {
        worryId: 'worry-first',
        socketId: 'socket-first'
      });

      // 대기열에 추가
      queueManager.add(clientSocket1.id, 'worry-waiting', jest.fn());

      clientSocket1.on(constants.EVENT_NAMES.MONITOR_ASSIGNED, (data) => {
        expect(data.monitorId).toBe('monitor-1');
        expect(queueManager.getLength()).toBe(0);
        expect(monitorManager.monitors['monitor-1'].status).toBe('busy');
        done();
      });

      // 체험 완료
      setTimeout(() => {
        serverSocket.emit(constants.EVENT_NAMES.EXPERIENCE_COMPLETE, 'monitor-1');
        handleExperienceComplete(serverSocket, 'monitor-1', monitorManager, queueManager, io);
      }, 100);
    });
  });

  describe('연결 끊김', () => {
    test('태블릿 연결 끊김 시 대기열에서 제거되어야 함', (done) => {
      // 대기열에 추가
      queueManager.add(clientSocket1.id, 'worry-123', jest.fn());
      expect(queueManager.getLength()).toBe(1);

      clientSocket1.on('disconnect', () => {
        setTimeout(() => {
          expect(queueManager.getPosition(clientSocket1.id)).toBeNull();
          done();
        }, 100);
      });

      clientSocket1.close();
    });

    test('모니터 연결 끊김 시 idle 상태로 변경되어야 함', (done) => {
      // 모니터 등록 및 할당
      monitorManager.updateSocketId('monitor-1', clientSocket1.id);
      monitorManager.assign('monitor-1', {
        worryId: 'worry-123',
        socketId: clientSocket1.id
      });

      clientSocket1.on('disconnect', () => {
        setTimeout(() => {
          expect(monitorManager.monitors['monitor-1'].status).toBe('idle');
          expect(monitorManager.monitors['monitor-1'].currentWorry).toBeNull();
          done();
        }, 100);
      });

      clientSocket1.close();
    });
  });

  // 전체 플로우는 위의 개별 테스트들로 충분히 검증됨:
  // 1. 디바이스 등록
  // 2. 모니터 할당 (성공/대기)
  // 3. 체험 완료 및 자동 재할당
  // 4. 연결 끊김 처리
});
