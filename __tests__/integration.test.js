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

  function startStage3(monitorId) {
    return request(app).post(`/api/monitors/${monitorId}/start`).send({});
  }

  describe('POST /api/request-monitor', () => {
    test('빈 모니터가 있으면 즉시 태블릿 할당(예약) — 서버는 아직 idle', async () => {
      const res = await request(app)
        .post('/api/request-monitor')
        .send({ worryId: 'worry-123', clientId: 'tab-1' })
        .expect(200);

      expect(res.body.assigned).toBe(true);
      expect(res.body.monitorId).toBe('monitor-1');
      expect(monitorManager.monitors['monitor-1'].status).toBe('idle');
      expect(monitorManager.monitors['monitor-1'].reservedWorry.worryId).toBe('worry-123');
    });

    test('모든 모니터가 사용 중이면 대기열 (busy 또는 예약만)', async () => {
      monitorManager.reserve('monitor-1', { worryId: 'a' });
      monitorManager.start('monitor-1');
      monitorManager.reserve('monitor-2', { worryId: 'b' });
      monitorManager.start('monitor-2');

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

    test('body.monitorId 가 UUID면 해당 슬롯에 예약', async () => {
      const uuid = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';
      const res = await request(app)
        .post('/api/request-monitor')
        .send({ worryId: 'w-uuid', clientId: 'tab-u', monitorId: uuid })
        .expect(200);

      expect(res.body.assigned).toBe(true);
      expect(res.body.monitorId).toBe(uuid);
      expect(res.body.monitorNumber).toBeNull();
      expect(monitorManager.monitors[uuid].reservedWorry.worryId).toBe('w-uuid');
      expect(monitorManager.monitors['monitor-1'].reservedWorry).toBeNull();
    });
  });

  describe('GET /api/monitors/:monitorId/current', () => {
    test('idle이면 status idle', async () => {
      const res = await request(app)
        .get('/api/monitors/monitor-1/current')
        .expect(200);

      expect(res.body.status).toBe('idle');
    });

    test('예약만 있을 때는 idle (Stage3 전)', async () => {
      await request(app)
        .post('/api/request-monitor')
        .send({ worryId: '99', svgUrl: 'https://x/s.svg', sessionId: 's1' });

      const res = await request(app)
        .get('/api/monitors/monitor-1/current')
        .expect(200);

      expect(res.body.status).toBe('idle');
    });

    test('start 후 busy와 worry 반환', async () => {
      await request(app)
        .post('/api/request-monitor')
        .send({ worryId: '99', svgUrl: 'https://x/s.svg', sessionId: 's1' });

      await startStage3('monitor-1').expect(200);

      const res = await request(app)
        .get('/api/monitors/monitor-1/current')
        .expect(200);

      expect(res.body.status).toBe('busy');
      expect(res.body.worry.worryId).toBe('99');
      expect(res.body.worry.svgUrl).toBe('https://x/s.svg');
      expect(res.body.worry.sessionId).toBe('s1');
    });

    test('displaySeq는 worry에 포함(긴 worryId와 분리)', async () => {
      await request(app)
        .post('/api/request-monitor')
        .send({
          worryId: '7euduofu-long-id',
          displaySeq: 78,
          svgUrl: 'https://x/s.svg'
        });

      await startStage3('monitor-1').expect(200);

      const res = await request(app)
        .get('/api/monitors/monitor-1/current')
        .expect(200);

      expect(res.body.worry.worryId).toBe('7euduofu-long-id');
      expect(res.body.worry.displaySeq).toBe(78);
    });

    test('잘못된 monitorId면 400', async () => {
      await request(app)
        .get('/api/monitors/monitor-99/current')
        .expect(400);
    });

    test('등록 전 UUID 슬롯 조회는 idle (슬롯 생성 없음)', async () => {
      const uuid = '11111111-2222-4333-8444-555555555555';
      const res = await request(app)
        .get(`/api/monitors/${uuid}/current`)
        .expect(200);
      expect(res.body.status).toBe('idle');
      expect(monitorManager.monitors[uuid]).toBeUndefined();
    });

    test('UUID 슬롯 예약·start 후 current busy', async () => {
      const uuid = '22222222-3333-4444-8555-666666666666';
      await request(app)
        .post('/api/request-monitor')
        .send({
          worryId: 'w-u2',
          svgUrl: 'https://ex/u.svg',
          monitorId: uuid
        });

      await request(app).post(`/api/monitors/${uuid}/start`).send({}).expect(200);

      const res = await request(app)
        .get(`/api/monitors/${uuid}/current`)
        .expect(200);
      expect(res.body.status).toBe('busy');
      expect(res.body.worry.worryId).toBe('w-u2');
    });
  });

  describe('POST /api/monitors/:monitorId/start', () => {
    test('예약 없으면 409', async () => {
      const res = await request(app)
        .post('/api/monitors/monitor-1/start')
        .send({})
        .expect(409);
      expect(res.body.error).toBeDefined();
    });

    test('응답에 worry 포함', async () => {
      await request(app)
        .post('/api/request-monitor')
        .send({ worryId: '7', svgUrl: 'https://z.svg' });

      const res = await startStage3('monitor-1').expect(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.worry.worryId).toBe('7');
    });
  });

  describe('POST /api/monitors/:monitorId/complete', () => {
    test('complete 후 대기자 없으면 idle', async () => {
      await request(app)
        .post('/api/request-monitor')
        .send({ worryId: 'w1' });

      await startStage3('monitor-1');

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

    test('complete 후 대기자 있으면 예약만 — busy는 start 때', async () => {
      monitorManager.reserve('monitor-1', { worryId: 'first', clientId: null });
      monitorManager.start('monitor-1');
      monitorManager.reserve('monitor-2', { worryId: 'second', clientId: null });
      monitorManager.start('monitor-2');

      queueManager.add('client-wait', 'worry-waiting', jest.fn());

      const res = await request(app)
        .post('/api/monitors/monitor-1/complete')
        .expect(200);

      expect(res.body.assignedNext).toBe(true);
      expect(queueManager.getLength()).toBe(0);
      expect(monitorManager.monitors['monitor-1'].status).toBe('idle');
      expect(monitorManager.monitors['monitor-1'].reservedWorry.worryId).toBe('worry-waiting');
      expect(monitorManager.monitors['monitor-1'].currentWorry).toBeNull();

      let cur = await request(app)
        .get('/api/monitors/monitor-1/current')
        .expect(200);
      expect(cur.body.status).toBe('idle');

      await startStage3('monitor-1').expect(200);

      cur = await request(app)
        .get('/api/monitors/monitor-1/current')
        .expect(200);
      expect(cur.body.status).toBe('busy');
      expect(cur.body.worry.worryId).toBe('worry-waiting');
    });
  });

  describe('GET /api/queue/position', () => {
    test('대기 중이면 순번, 아니면 0', async () => {
      monitorManager.reserve('monitor-1', { worryId: 'a' });
      monitorManager.start('monitor-1');
      monitorManager.reserve('monitor-2', { worryId: 'b' });
      monitorManager.start('monitor-2');

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

  describe('모니터 인스턴스 bind (동일 URL)', () => {
    test('첫 bind는 monitor-1, 둘째는 monitor-2', async () => {
      const r1 = await request(app)
        .post('/api/monitor-instance/bind')
        .send({ instanceId: 'inst-a' })
        .expect(200);
      expect(r1.body.monitorId).toBe('monitor-1');

      const r2 = await request(app)
        .post('/api/monitor-instance/bind')
        .send({ instanceId: 'inst-b' })
        .expect(200);
      expect(r2.body.monitorId).toBe('monitor-2');
    });

    test('같은 instanceId는 동일 monitor', async () => {
      await request(app)
        .post('/api/monitor-instance/bind')
        .send({ instanceId: 'same' })
        .expect(200);
      const again = await request(app)
        .post('/api/monitor-instance/bind')
        .send({ instanceId: 'same' })
        .expect(200);
      expect(again.body.monitorId).toBe('monitor-1');
    });

    test('세 번째 instanceId는 409', async () => {
      await request(app).post('/api/monitor-instance/bind').send({ instanceId: '1' }).expect(200);
      await request(app).post('/api/monitor-instance/bind').send({ instanceId: '2' }).expect(200);
      await request(app)
        .post('/api/monitor-instance/bind')
        .send({ instanceId: '3' })
        .expect(409);
    });

    test('GET bind로 조회', async () => {
      await request(app).post('/api/monitor-instance/bind').send({ instanceId: 'q' }).expect(200);
      const res = await request(app)
        .get('/api/monitor-instance/bind')
        .query({ instanceId: 'q' })
        .expect(200);
      expect(res.body.monitorId).toBe('monitor-1');
    });

    test('instanceId 없으면 400', async () => {
      await request(app).post('/api/monitor-instance/bind').send({}).expect(400);
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

    test('GET /status에 예약 단계 reservedWorry가 노출됨(시작 화면 토스트·API 계약)', async () => {
      await request(app)
        .post('/api/request-monitor')
        .send({
          worryId: 'seq-9',
          displaySeq: 9,
          svgUrl: 'https://example.com/u.svg',
          sessionId: 'sess-x',
          clientId: 'tab-1'
        })
        .expect(200);

      const res = await request(app).get('/status').expect(200);
      const m1 = res.body.monitors['monitor-1'];
      expect(m1.reservedWorry).toMatchObject({
        worryId: 'seq-9',
        displaySeq: 9,
        svgUrl: 'https://example.com/u.svg',
        sessionId: 'sess-x'
      });
    });
  });

  describe('투표 API', () => {
    test('POST /api/votes - 유효한 후보면 반영된 누적 결과 반환', async () => {
      const mockVoteService = {
        createVoteAndGetResults: jest.fn().mockResolvedValue({
          ok: true,
          selectedCandidate: 2,
          totalVotes: 10,
          results: {
            candidate1: 3,
            candidate2: 4,
            candidate3: 3
          },
          updatedAt: '2026-03-31T09:10:11.123Z'
        }),
        getResults: jest.fn()
      };

      const { app: voteApp } = createApp({ voteService: mockVoteService });
      const res = await request(voteApp)
        .post('/api/votes')
        .send({ candidate: 2, sessionId: 's-1', clientId: 'c-1' })
        .expect(200);

      expect(mockVoteService.createVoteAndGetResults).toHaveBeenCalledWith({
        candidate: 2,
        sessionId: 's-1',
        clientId: 'c-1'
      });
      expect(res.body.ok).toBe(true);
      expect(res.body.totalVotes).toBe(10);
      expect(res.body.results.candidate2).toBe(4);
    });

    test('POST /api/votes - 후보 범위 오류면 400', async () => {
      const mockVoteService = {
        createVoteAndGetResults: jest.fn(),
        getResults: jest.fn()
      };
      const { app: voteApp } = createApp({ voteService: mockVoteService });

      await request(voteApp)
        .post('/api/votes')
        .send({ candidate: 4 })
        .expect(400);
    });

    test('POST /api/votes - 중복 투표 오류는 409', async () => {
      const duplicateError = new Error('duplicate key value violates unique constraint');
      duplicateError.code = '23505';
      const mockVoteService = {
        createVoteAndGetResults: jest.fn().mockRejectedValue(duplicateError),
        getResults: jest.fn()
      };
      const { app: voteApp } = createApp({ voteService: mockVoteService });

      const res = await request(voteApp)
        .post('/api/votes')
        .send({ candidate: 1 })
        .expect(409);

      expect(res.body.error).toBe('duplicate vote');
    });

    test('GET /api/votes/results - 누적 집계 조회', async () => {
      const mockVoteService = {
        createVoteAndGetResults: jest.fn(),
        getResults: jest.fn().mockResolvedValue({
          totalVotes: 20,
          results: {
            candidate1: 6,
            candidate2: 8,
            candidate3: 6
          },
          updatedAt: '2026-03-31T09:10:11.123Z'
        })
      };
      const { app: voteApp } = createApp({ voteService: mockVoteService });

      const res = await request(voteApp)
        .get('/api/votes/results')
        .expect(200);

      expect(mockVoteService.getResults).toHaveBeenCalledTimes(1);
      expect(res.body.totalVotes).toBe(20);
      expect(res.body.results.candidate1).toBe(6);
      expect(res.body.results.candidate2).toBe(8);
      expect(res.body.results.candidate3).toBe(6);
    });
  });
});
