const express = require('express');
const http = require('http');
const cors = require('cors');
require('dotenv').config();

const MonitorManager = require('./src/managers/MonitorManager');
const MonitorBindingManager = require('./src/managers/MonitorBindingManager');
const QueueManager = require('./src/managers/QueueManager');
const VoteService = require('./src/services/VoteService');
const ScoreService = require('./src/services/ScoreService');
const PostService = require('./src/services/PostService');
const supabase = require('./src/config/supabase');
const logger = require('./src/utils/logger');
const constants = require('./src/utils/constants');
const { isValidMonitorIdParam, normalizeMonitorIdParam } = require('./src/utils/monitorId');

/**
 * Express 앱과 매니저 인스턴스를 생성합니다. (테스트에서 격리된 인스턴스 사용)
 */
function createApp(options = {}) {
  const monitorManager = new MonitorManager();
  const monitorBindingManager = options.monitorBindingManager || new MonitorBindingManager();
  const queueManager = new QueueManager();
  const voteService = options.voteService || new VoteService(supabase);
  const scoreService = options.scoreService || new ScoreService(supabase);
  const postService = options.postService || new PostService(supabase);

  const app = express();

  app.use(cors({
    origin: '*',
    credentials: true
  }));

  app.use(express.json());

  function createAssignedResponse(monitorId) {
    const legacy = constants.MONITOR_IDS.includes(monitorId);
    const monitorNumber = legacy
      ? (monitorId === constants.DEVICE_TYPES.MONITOR_1 ? 1 : 2)
      : null;
    return {
      monitorId,
      monitorNumber,
      message: legacy
        ? (monitorNumber === 1
          ? '👈 왼쪽 껌딱지월드로 가세요'
          : '👉 오른쪽 껌딱지월드로 가세요')
        : '👉 할당된 모니터로 이동해 주세요'
    };
  }

  /** 태블릿·모니터 UI용 순번 (1~). 없으면 worryId만으로 문구 구성 */
  function parseDisplaySeq(raw) {
    if (raw === undefined || raw === null) return null;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(n) || n < 1) return null;
    return n;
  }

  function worryJsonFromCurrent(w) {
    if (!w) return null;
    const out = {
      worryId: w.worryId,
      svgUrl: w.svgUrl ?? null,
      sessionId: w.sessionId ?? null
    };
    if (w.displaySeq != null) {
      out.displaySeq = w.displaySeq;
    }
    return out;
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

  /**
   * 동일 URL로 띄운 각 모니터 브라우저에 monitor-1 / monitor-2 슬롯 배정 (instanceId는 클라이언트 UUID·localStorage)
   */
  app.post('/api/monitor-instance/bind', (req, res) => {
    const { instanceId } = req.body || {};
    if (!instanceId || typeof instanceId !== 'string' || !instanceId.trim()) {
      return res.status(400).json({ error: 'instanceId is required' });
    }
    const id = instanceId.trim();
    const result = monitorBindingManager.bind(id);
    if (!result) {
      return res.status(409).json({ error: 'all monitor slots are claimed' });
    }
    return res.json({
      ok: true,
      monitorId: result.monitorId,
      monitorNumber: result.monitorNumber,
      instanceId: id
    });
  });

  app.get('/api/monitor-instance/bind', (req, res) => {
    const { instanceId } = req.query;
    if (!instanceId || typeof instanceId !== 'string' || !String(instanceId).trim()) {
      return res.status(400).json({ error: 'instanceId is required' });
    }
    const id = String(instanceId).trim();
    const monitorId = monitorBindingManager.getMonitorId(id);
    if (!monitorId) {
      return res.status(404).json({ error: 'instance not bound' });
    }
    const monitorNumber = monitorId === constants.DEVICE_TYPES.MONITOR_1 ? 1 : 2;
    return res.json({
      ok: true,
      monitorId,
      monitorNumber,
      instanceId: id
    });
  });

  app.post('/api/monitor-instance/release', (req, res) => {
    const { instanceId } = req.body || {};
    if (!instanceId || typeof instanceId !== 'string' || !instanceId.trim()) {
      return res.status(400).json({ error: 'instanceId is required' });
    }
    monitorBindingManager.release(instanceId.trim());
    return res.json({ ok: true });
  });

  app.post('/api/request-monitor', (req, res) => {
    const {
      worryId,
      svgUrl = null,
      sessionId = null,
      clientId = null,
      displaySeq: rawDisplaySeq,
      monitorId: rawTargetMonitorId
    } = req.body || {};
    const displaySeq = parseDisplaySeq(rawDisplaySeq);

    if (!worryId) {
      return res.status(400).json({
        error: 'worryId is required'
      });
    }

    const targetMonitorId = normalizeMonitorIdParam(rawTargetMonitorId);

    /** @type {string|null} */
    let availableMonitor = null;

    if (targetMonitorId) {
      try {
        monitorManager.ensureMonitor(targetMonitorId);
        const m = monitorManager.monitors[targetMonitorId];
        if (m.status === constants.MONITOR_STATUS.IDLE && !m.reservedWorry) {
          availableMonitor = targetMonitorId;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === 'monitor registry full') {
          return res.status(503).json({ error: 'monitor registry full' });
        }
        throw e;
      }
    }

    if (!availableMonitor) {
      availableMonitor = monitorManager.findAvailable();
    }

    if (availableMonitor) {
      const reservePayload = {
        worryId,
        clientId: clientId ?? null,
        svgUrl,
        sessionId
      };
      if (displaySeq != null) {
        reservePayload.displaySeq = displaySeq;
      }
      try {
        monitorManager.reserve(availableMonitor, reservePayload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === 'monitor registry full') {
          return res.status(503).json({ error: 'monitor registry full' });
        }
        throw e;
      }

      return res.json({
        assigned: true,
        ...createAssignedResponse(availableMonitor)
      });
    }

    const queueClientId = clientId || `anonymous-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const queueMeta = { svgUrl, sessionId };
    if (displaySeq != null) {
      queueMeta.displaySeq = displaySeq;
    }
    const position = queueManager.add(
      queueClientId,
      worryId,
      (expiredClientId) => {
        logger.warn(`대기 시간 초과: clientId=${expiredClientId}`);
      },
      queueMeta
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

    if (!isValidMonitorIdParam(monitorId)) {
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
      worry: worryJsonFromCurrent(monitor.currentWorry)
    });
  });

  app.post('/api/monitors/:monitorId/start', (req, res) => {
    const { monitorId } = req.params;

    if (!isValidMonitorIdParam(monitorId)) {
      return res.status(400).json({
        error: 'invalid monitorId'
      });
    }

    try {
      monitorManager.start(monitorId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'no reservation') {
        return res.status(409).json({ error: 'no reservation for this monitor' });
      }
      if (msg === 'already busy') {
        return res.status(409).json({ error: 'monitor already busy' });
      }
      if (msg === 'monitor registry full') {
        return res.status(503).json({ error: 'monitor registry full' });
      }
      throw e;
    }

    const m = monitorManager.monitors[monitorId];
    return res.json({
      ok: true,
      status: constants.MONITOR_STATUS.BUSY,
      worry: worryJsonFromCurrent(m.currentWorry)
    });
  });

  app.post('/api/monitors/:monitorId/complete', (req, res) => {
    const { monitorId } = req.params;

    if (!isValidMonitorIdParam(monitorId)) {
      return res.status(400).json({
        error: 'invalid monitorId'
      });
    }

    monitorManager.release(monitorId);

    const nextUser = queueManager.dequeue();
    if (nextUser) {
      monitorManager.reserve(monitorId, nextUser);
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

  app.post('/api/votes', async (req, res) => {
    const { candidate, sessionId = null, clientId } = req.body || {};

    if (!clientId || typeof clientId !== 'string' || !clientId.trim()) {
      return res.status(400).json({ error: 'clientId is required' });
    }

    const candidateNo = Number(candidate);
    const isValidCandidate = Number.isInteger(candidateNo) && [1, 2, 3].includes(candidateNo);

    if (!isValidCandidate) {
      return res.status(400).json({
        error: 'candidate must be one of 1, 2, 3'
      });
    }

    const trimmedClientId = clientId.trim();

    try {
      const result = await voteService.createVoteAndGetResults({
        candidate: candidateNo,
        sessionId,
        clientId: trimmedClientId
      });
      return res.status(200).json({ ...result, clientId: trimmedClientId });
    } catch (error) {
      if (error?.code === '23505') {
        return res.status(409).json({ error: 'duplicate vote' });
      }
      logger.error('투표 저장/집계 실패:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.delete('/api/votes/my', async (req, res) => {
    const { clientId } = req.body || {};
    if (!clientId || typeof clientId !== 'string' || !clientId.trim()) {
      return res.status(400).json({ error: 'clientId is required' });
    }
    try {
      const result = await voteService.cancelVote(clientId.trim());
      return res.json({ ok: true, ...result });
    } catch (error) {
      logger.error('투표 취소 실패:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.put('/api/votes/my', async (req, res) => {
    const { clientId, candidate } = req.body || {};
    if (!clientId || typeof clientId !== 'string' || !clientId.trim()) {
      return res.status(400).json({ error: 'clientId is required' });
    }
    const candidateNo = Number(candidate);
    if (!Number.isInteger(candidateNo) || ![1, 2, 3].includes(candidateNo)) {
      return res.status(400).json({ error: 'candidate must be one of 1, 2, 3' });
    }
    try {
      const result = await voteService.changeVote(clientId.trim(), candidateNo);
      return res.json({ ok: true, ...result });
    } catch (error) {
      if (error?.code === 'NO_VOTE') {
        return res.status(404).json({ error: 'no vote to change' });
      }
      logger.error('투표 변경 실패:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/votes/my', async (req, res) => {
    const { clientId } = req.query;
    if (!clientId || typeof clientId !== 'string') {
      return res.status(400).json({ error: 'clientId is required' });
    }
    try {
      const vote = await voteService.getMyVote(clientId.trim());
      return res.json({ candidate: vote ? vote.candidate_no : null });
    } catch (error) {
      logger.error('내 투표 조회 실패:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/votes/results', async (req, res) => {
    try {
      const result = await voteService.getResults();
      return res.status(200).json(result);
    } catch (error) {
      logger.error('투표 집계 조회 실패:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/scores', async (req, res) => {
    const { userId, score } = req.body || {};

    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const parsedScore = Number(score);
    if (!Number.isInteger(parsedScore) || parsedScore < 0) {
      return res.status(400).json({ error: 'score must be a non-negative integer' });
    }

    try {
      const resolvedUserId = await scoreService.addScore({ userId: userId.trim(), score: parsedScore });
      return res.status(201).json({ ok: true, userId: resolvedUserId, score: parsedScore });
    } catch (error) {
      logger.error('점수 등록 실패:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/scores/leaderboard', async (req, res) => {
    try {
      const leaderboard = await scoreService.getLeaderboard();
      return res.status(200).json({ leaderboard });
    } catch (error) {
      logger.error('리더보드 조회 실패:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/posts', async (req, res) => {
    const { nickname, content } = req.body || {};

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    const trimmedNickname = (nickname && typeof nickname === 'string') ? nickname.trim() || null : null;

    try {
      const post = await postService.createPost({ nickname: trimmedNickname, content: content.trim() });
      return res.status(201).json({ ok: true, post });
    } catch (error) {
      logger.error('게시글 등록 실패:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/posts', async (req, res) => {
    try {
      const posts = await postService.getPosts();
      return res.status(200).json({ posts });
    } catch (error) {
      logger.error('게시글 조회 실패:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return { app, monitorManager, monitorBindingManager, queueManager, voteService, scoreService, postService };
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
