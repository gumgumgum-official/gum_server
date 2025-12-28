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
