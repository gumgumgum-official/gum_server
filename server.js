const express = require('express');
const http = require('http');
const cors = require('cors');
require('dotenv').config();

const MonitorManager = require('./src/managers/MonitorManager');
const QueueManager = require('./src/managers/QueueManager');
const logger = require('./src/utils/logger');
const constants = require('./src/utils/constants');

/**
 * Express 앱과 매니저 인스턴스를 생성합니다. (테스트에서 격리된 인스턴스 사용)
 */
function createApp() {
  const monitorManager = new MonitorManager();
  const queueManager = new QueueManager();

  const app = express();

  app.use(cors({
    origin: '*',
    credentials: true
  }));

  app.use(express.json());

  function isValidMonitorId(monitorId) {
    return constants.MONITOR_IDS.includes(monitorId);
  }

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

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      monitors: monitorManager.getStatus(),
      queueLength: queueManager.getLength(),
      uptime: process.uptime()
    });
  });

  app.get('/ping', (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get('/status', (req, res) => {
    res.json({
      monitors: monitorManager.monitors,
      queueLength: queueManager.getLength()
    });
  });

  app.post('/api/request-monitor', (req, res) => {
    const { worryId, svgUrl = null, sessionId = null, clientId = null } = req.body || {};

    if (!worryId) {
      return res.status(400).json({
        error: 'worryId is required'
      });
    }

    const availableMonitor = monitorManager.findAvailable();

    if (availableMonitor) {
      monitorManager.assign(availableMonitor, {
        worryId,
        clientId: clientId ?? null,
        svgUrl,
        sessionId
      });

      return res.json({
        assigned: true,
        ...createAssignedResponse(availableMonitor)
      });
    }

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

  app.post('/api/monitors/:monitorId/complete', (req, res) => {
    const { monitorId } = req.params;

    if (!isValidMonitorId(monitorId)) {
      return res.status(400).json({
        error: 'invalid monitorId'
      });
    }

    monitorManager.release(monitorId);

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

  app.get('/api/queue/position', (req, res) => {
    const { clientId } = req.query;
    if (!clientId || typeof clientId !== 'string') {
      return res.status(400).json({
        error: 'clientId is required'
      });
    }

    const pos = queueManager.getPosition(clientId);
    return res.json({
      queuePosition: pos == null ? 0 : pos
    });
  });

  return { app, monitorManager, queueManager };
}

module.exports = { createApp };

if (require.main === module) {
  const { app } = createApp();
  const server = http.createServer(app);
  const PORT = process.env.PORT || 3000;

  server.listen(PORT, () => {
    logger.info(`✅ 서버 시작: http://localhost:${PORT}`);
    logger.info(`환경: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`CORS: ${process.env.CORS_ORIGIN || '*'}`);
  });

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
}
