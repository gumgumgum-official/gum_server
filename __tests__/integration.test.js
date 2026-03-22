/**
 * REST API 통합 테스트
 */

const request = require('supertest');
const { createApp } = require('../server');

describe('REST API 통합', () => {
  let app;
  let monitorManager;
  let queueManager;

  beforeEach(() => {
    ({ app, monitorManager, queueManager } = createApp());
  });

  describe('POST /api/request-monitor', () => {
    test('빈 모니터가 있으면 즉시 할당', async () => {
      const res = await request(app)
        .post('/api/request-monitor')
        .send({ worryId: 'worry-123', clientId: 'tab-1' })
        .expect(200);

      expect(res.body.assigned).toBe(true);
      expect(res.body.monitorId).toBe('monitor-1');
      expect(res.body.monitorNumber).toBe(1);
      expect(monitorManager.monitors['monitor-1'].status).toBe('busy');
    });

    test('모든 모니터가 busy면 대기열', async () => {
      monitorManager.monitors['monitor-1'].status = 'busy';
      monitorManager.monitors['monitor-2'].status = 'busy';

      const res = await request(app)
        .post('/api/request-monitor')
        .send({ worryId: 'worry-wait', clientId: 'tab-q' })
        .expect(200);

      expect(res.body.assigned).toBe(false);
      expect(res.body.queuePosition).toBe(1);
      expect(queueManager.getLength()).toBe(1);
    });

    test('worryId 없으면 400', async () => {
      await request(app)
        .post('/api/request-monitor')
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/monitors/:monitorId/current', () => {
    test('idle이면 status idle', async () => {
      const res = await request(app)
        .get('/api/monitors/monitor-1/current')
        .expect(200);

      expect(res.body.status).toBe('idle');
    });

    test('할당 후 busy와 worry 반환', async () => {
      await request(app)
        .post('/api/request-monitor')
        .send({ worryId: '99', svgUrl: 'https://x/s.svg', sessionId: 's1' });

      const res = await request(app)
        .get('/api/monitors/monitor-1/current')
        .expect(200);

      expect(res.body.status).toBe('busy');
      expect(res.body.worry.worryId).toBe('99');
      expect(res.body.worry.svgUrl).toBe('https://x/s.svg');
      expect(res.body.worry.sessionId).toBe('s1');
    });

    test('잘못된 monitorId면 400', async () => {
      await request(app)
        .get('/api/monitors/monitor-99/current')
        .expect(400);
    });
  });

  describe('POST /api/monitors/:monitorId/complete', () => {
    test('complete 후 대기자 없으면 idle', async () => {
      await request(app)
        .post('/api/request-monitor')
        .send({ worryId: 'w1' });

      await request(app)
        .post('/api/monitors/monitor-1/complete')
        .expect(200)
        .expect((res) => {
          expect(res.body.ok).toBe(true);
          expect(res.body.assignedNext).toBe(false);
        });

      const cur = await request(app)
        .get('/api/monitors/monitor-1/current')
        .expect(200);

      expect(cur.body.status).toBe('idle');
    });

    test('complete 후 대기자 있으면 같은 모니터에 재할당', async () => {
      monitorManager.assign('monitor-1', {
        worryId: 'first',
        clientId: null
      });
      monitorManager.assign('monitor-2', {
        worryId: 'second',
        clientId: null
      });

      queueManager.add('client-wait', 'worry-waiting', jest.fn());

      const res = await request(app)
        .post('/api/monitors/monitor-1/complete')
        .expect(200);

      expect(res.body.assignedNext).toBe(true);
      expect(queueManager.getLength()).toBe(0);
      expect(monitorManager.monitors['monitor-1'].status).toBe('busy');
      expect(monitorManager.monitors['monitor-1'].currentWorry.worryId).toBe('worry-waiting');

      const cur = await request(app)
        .get('/api/monitors/monitor-1/current')
        .expect(200);

      expect(cur.body.status).toBe('busy');
      expect(cur.body.worry.worryId).toBe('worry-waiting');
    });
  });

  describe('GET /api/queue/position', () => {
    test('대기 중이면 순번, 아니면 0', async () => {
      monitorManager.monitors['monitor-1'].status = 'busy';
      monitorManager.monitors['monitor-2'].status = 'busy';

      await request(app)
        .post('/api/request-monitor')
        .send({ worryId: 'q1', clientId: 'cid-pos' });

      const res = await request(app)
        .get('/api/queue/position')
        .query({ clientId: 'cid-pos' })
        .expect(200);

      expect(res.body.queuePosition).toBe(1);

      const res2 = await request(app)
        .get('/api/queue/position')
        .query({ clientId: 'not-in-queue' })
        .expect(200);

      expect(res2.body.queuePosition).toBe(0);
    });

    test('clientId 없으면 400', async () => {
      await request(app)
        .get('/api/queue/position')
        .expect(400);
    });
  });

  describe('GET /health, GET /status', () => {
    test('/health', async () => {
      const res = await request(app).get('/health').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.monitors).toBeDefined();
    });

    test('/status', async () => {
      const res = await request(app).get('/status').expect(200);
      expect(res.body.monitors).toBeDefined();
      expect(res.body.queueLength).toBeDefined();
    });
  });
});
