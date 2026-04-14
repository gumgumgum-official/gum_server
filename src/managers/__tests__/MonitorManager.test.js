/**
 * MonitorManager 단위 테스트
 */

const MonitorManager = require('../MonitorManager');

describe('MonitorManager', () => {
  let monitorManager;

  beforeEach(() => {
    monitorManager = new MonitorManager();
  });

  describe('초기화', () => {
    test('2개의 모니터가 idle·예약 없이 초기화되어야 함', () => {
      expect(monitorManager.monitors['monitor-1'].status).toBe('idle');
      expect(monitorManager.monitors['monitor-2'].status).toBe('idle');
      expect(monitorManager.monitors['monitor-1'].currentWorry).toBeNull();
      expect(monitorManager.monitors['monitor-1'].reservedWorry).toBeNull();
    });
  });

  describe('findAvailable()', () => {
    test('모두 idle·예약 없을 때 monitor-1', () => {
      expect(monitorManager.findAvailable()).toBe('monitor-1');
    });

    test('monitor-1이 예약만 있으면 사용 불가 → monitor-2', () => {
      monitorManager.reserve('monitor-1', { worryId: 'w1', clientId: 'c1' });
      expect(monitorManager.findAvailable()).toBe('monitor-2');
    });

    test('monitor-1이 busy면 monitor-2', () => {
      monitorManager.reserve('monitor-1', { worryId: 'w1' });
      monitorManager.start('monitor-1');
      expect(monitorManager.findAvailable()).toBe('monitor-2');
    });

    test('둘 다 busy면 null', () => {
      monitorManager.reserve('monitor-1', { worryId: 'a' });
      monitorManager.start('monitor-1');
      monitorManager.reserve('monitor-2', { worryId: 'b' });
      monitorManager.start('monitor-2');
      expect(monitorManager.findAvailable()).toBeNull();
    });
  });

  describe('reserve() + start()', () => {
    test('reserve 후에는 idle·예약만 있음', () => {
      monitorManager.reserve('monitor-1', {
        worryId: 'worry-123',
        clientId: 'client-abc',
        svgUrl: 'https://x.svg',
        sessionId: 's1'
      });
      expect(monitorManager.monitors['monitor-1'].status).toBe('idle');
      expect(monitorManager.monitors['monitor-1'].reservedWorry.worryId).toBe('worry-123');
      expect(monitorManager.monitors['monitor-1'].currentWorry).toBeNull();
    });

    test('start 후 busy·currentWorry', () => {
      monitorManager.reserve('monitor-1', { worryId: 'w1', svgUrl: 'u', sessionId: 's' });
      monitorManager.start('monitor-1');
      expect(monitorManager.monitors['monitor-1'].status).toBe('busy');
      expect(monitorManager.monitors['monitor-1'].currentWorry.worryId).toBe('w1');
      expect(monitorManager.monitors['monitor-1'].reservedWorry).toBeNull();
    });

    test('displaySeq는 start 후 currentWorry에 복사', () => {
      monitorManager.reserve('monitor-1', {
        worryId: 'long-edge-id',
        displaySeq: 78
      });
      monitorManager.start('monitor-1');
      expect(monitorManager.monitors['monitor-1'].currentWorry.displaySeq).toBe(78);
    });

    test('유효하지 않은 displaySeq는 예약에 넣지 않음', () => {
      monitorManager.reserve('monitor-1', { worryId: 'w', displaySeq: 0 });
      expect(monitorManager.monitors['monitor-1'].reservedWorry.displaySeq).toBeUndefined();
    });

    test('예약 없이 start 하면 에러', () => {
      expect(() => monitorManager.start('monitor-1')).toThrow('no reservation');
    });
  });

  describe('release()', () => {
    test('busy 해제 시 idle·current만 제거', () => {
      monitorManager.reserve('monitor-1', { worryId: 'w1' });
      monitorManager.start('monitor-1');
      monitorManager.release('monitor-1');
      expect(monitorManager.monitors['monitor-1'].status).toBe('idle');
      expect(monitorManager.monitors['monitor-1'].currentWorry).toBeNull();
    });

    test('clientId는 reserve 시 갱신', () => {
      monitorManager.reserve('monitor-1', { worryId: 'w1', clientId: 'c1' });
      expect(monitorManager.monitors['monitor-1'].clientId).toBe('c1');
    });
  });

  describe('getStatus()', () => {
    test('busy 반영', () => {
      monitorManager.reserve('monitor-1', { worryId: 'w' });
      monitorManager.start('monitor-1');
      expect(monitorManager.getStatus()['monitor-1']).toBe('busy');
    });
  });

  describe('복합 시나리오', () => {
    test('reserve → start → release → reserve → start', () => {
      monitorManager.reserve('monitor-1', { worryId: 'w1' });
      monitorManager.start('monitor-1');
      monitorManager.release('monitor-1');
      monitorManager.reserve('monitor-1', { worryId: 'w2' });
      monitorManager.start('monitor-1');
      expect(monitorManager.monitors['monitor-1'].currentWorry.worryId).toBe('w2');
    });
  });
});
