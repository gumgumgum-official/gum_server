const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const MonitorManager = require('./src/managers/MonitorManager');
const QueueManager = require('./src/managers/QueueManager');
const logger = require('./src/utils/logger');
const { handleDeviceRegistration } = require('./src/handlers/deviceHandler');
const { handleMonitorRequest, handleExperienceComplete, updateQueuePositions } = require('./src/handlers/monitorHandler');
const { handleDisconnect } = require('./src/handlers/disconnectHandler');
const constants = require('./src/utils/constants');

// Express 앱 설정
const app = express();
const server = http.createServer(app);

// CORS 설정 (임시: 프론트 개발 전까지 모두 허용)
app.use(cors({
  origin: '*', // TODO: 프론트 개발 완료 후 특정 도메인으로 제한
  credentials: true
}));

app.use(express.json());

// Socket.io 설정 (임시: 프론트 개발 전까지 모두 허용)
const io = socketIo(server, {
  cors: {
    origin: '*', // TODO: 프론트 개발 완료 후 특정 도메인으로 제한
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// 매니저 초기화
const monitorManager = new MonitorManager();
const queueManager = new QueueManager();

// ============================================
// REST API
// ============================================

/**
 * 모니터 ID 유효성 검사
 * @param {string} monitorId
 * @returns {boolean}
 */
function isValidMonitorId(monitorId) {
  return constants.MONITOR_IDS.includes(monitorId);
}

/**
 * 모니터 할당 응답 생성
 * @param {string} monitorId
 * @returns {{monitorId: string, monitorNumber: number, message: string}}
 */
function createAssignedResponse(monitorId) {
  const monitorNumber = monitorId === constants.DEVICE_TYPES.MONITOR_1 ? 1 : 2;
  return {
    monitorId,
    monitorNumber,
    message: monitorNumber === 1
      ? '👈 왼쪽 껌딱지월드로 가세요'
      : '👉 오른쪽 껌딱지월드로 가세요'
  };
}

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    monitors: monitorManager.getStatus(),
    queueLength: queueManager.getLength(),
    uptime: process.uptime()
  });
});

// 상태 조회 (디버깅용)
app.get('/status', (req, res) => {
  res.json({
    monitors: monitorManager.monitors,
    queueLength: queueManager.getLength(),
    connectedClients: io.sockets.sockets.size
  });
});

// 모니터 할당 요청 (태블릿)
app.post('/api/request-monitor', (req, res) => {
  const { worryId, svgUrl = null, sessionId = null, clientId = null } = req.body || {};

  if (!worryId) {
    return res.status(400).json({
      error: 'worryId is required'
    });
  }

  // 빈 모니터 찾기
  const availableMonitor = monitorManager.findAvailable();

  if (availableMonitor) {
    monitorManager.assign(availableMonitor, {
      worryId,
      socketId: clientId,
      svgUrl,
      sessionId
    });

    return res.json({
      assigned: true,
      ...createAssignedResponse(availableMonitor)
    });
  }

  // 모두 사용 중이면 대기열 추가
  const queueClientId = clientId || `anonymous-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const position = queueManager.add(
    queueClientId,
    worryId,
    (expiredClientId) => {
      logger.warn(`대기 시간 초과: clientId=${expiredClientId}`);
    },
    { svgUrl, sessionId }
  );

  return res.json({
    assigned: false,
    queuePosition: position,
    clientId: queueClientId,
    message: `${position}번째로 대기 중입니다`
  });
});

// 모니터 현재 상태 조회 (폴링)
app.get('/api/monitors/:monitorId/current', (req, res) => {
  const { monitorId } = req.params;

  if (!isValidMonitorId(monitorId)) {
    return res.status(400).json({
      error: 'invalid monitorId'
    });
  }

  const monitor = monitorManager.monitors[monitorId];
  if (!monitor || monitor.status === constants.MONITOR_STATUS.IDLE || !monitor.currentWorry) {
    return res.json({
      status: constants.MONITOR_STATUS.IDLE
    });
  }

  return res.json({
    status: constants.MONITOR_STATUS.BUSY,
    worry: {
      worryId: monitor.currentWorry.worryId,
      svgUrl: monitor.currentWorry.svgUrl ?? null,
      sessionId: monitor.currentWorry.sessionId ?? null
    }
  });
});

// 모니터 체험 완료
app.post('/api/monitors/:monitorId/complete', (req, res) => {
  const { monitorId } = req.params;

  if (!isValidMonitorId(monitorId)) {
    return res.status(400).json({
      error: 'invalid monitorId'
    });
  }

  // 모니터 해제
  monitorManager.release(monitorId);

  // 다음 대기자 자동 할당
  const nextUser = queueManager.dequeue();
  if (nextUser) {
    monitorManager.assign(monitorId, nextUser);
    return res.json({
      ok: true,
      assignedNext: true
    });
  }

  return res.json({
    ok: true,
    assignedNext: false
  });
});

// 대기 순번 조회 (선택)
app.get('/api/queue/position', (req, res) => {
  const { clientId } = req.query;
  if (!clientId || typeof clientId !== 'string') {
    return res.status(400).json({
      error: 'clientId is required'
    });
  }

  const queuePosition = queueManager.getPosition(clientId);
  return res.json({
    queuePosition
  });
});

// ============================================
// Socket.io 이벤트 핸들러
// ============================================

io.on('connection', (socket) => {
  logger.info('클라이언트 연결:', socket.id);

  // 1. 디바이스 등록
  socket.on(constants.EVENT_NAMES.REGISTER_DEVICE, (deviceType) => {
    handleDeviceRegistration(socket, deviceType, monitorManager);
  });

  // 2. 모니터 할당 요청 (태블릿)
  socket.on(constants.EVENT_NAMES.REQUEST_MONITOR, (data) => {
    handleMonitorRequest(socket, data, monitorManager, queueManager, io);
  });

  // 3. 체험 완료 (모니터)
  socket.on(constants.EVENT_NAMES.EXPERIENCE_COMPLETE, (monitorId) => {
    handleExperienceComplete(socket, monitorId, monitorManager, queueManager, io);
  });

  // 4. 연결 끊김
  socket.on('disconnect', () => {
    handleDisconnect(socket, monitorManager, queueManager, io);
  });
});

// ============================================
// 서버 시작
// ============================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.info(`✅ 서버 시작: http://localhost:${PORT}`);
  logger.info(`환경: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`CORS: ${process.env.CORS_ORIGIN || '*'}`);
});

// 프로세스 종료 처리
process.on('SIGTERM', () => {
  logger.info('SIGTERM 수신, 서버 종료 중...');
  server.close(() => {
    logger.info('서버 종료 완료');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT 수신, 서버 종료 중...');
  server.close(() => {
    logger.info('서버 종료 완료');
    process.exit(0);
  });
});
