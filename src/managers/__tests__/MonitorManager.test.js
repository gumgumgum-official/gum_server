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
    test('2개의 모니터가 idle 상태로 초기화되어야 함', () => {
      expect(monitorManager.monitors['monitor-1'].status).toBe('idle');
      expect(monitorManager.monitors['monitor-2'].status).toBe('idle');
      expect(monitorManager.monitors['monitor-1'].currentWorry).toBeNull();
      expect(monitorManager.monitors['monitor-2'].currentWorry).toBeNull();
    });
  });

  describe('findAvailable()', () => {
    test('모든 모니터가 idle일 때 첫 번째 모니터를 반환해야 함', () => {
      const available = monitorManager.findAvailable();
      expect(available).toBe('monitor-1');
    });

    test('monitor-1이 busy일 때 monitor-2를 반환해야 함', () => {
      monitorManager.monitors['monitor-1'].status = 'busy';
      const available = monitorManager.findAvailable();
      expect(available).toBe('monitor-2');
    });

    test('모든 모니터가 busy일 때 null을 반환해야 함', () => {
      monitorManager.monitors['monitor-1'].status = 'busy';
      monitorManager.monitors['monitor-2'].status = 'busy';
      const available = monitorManager.findAvailable();
      expect(available).toBeNull();
    });
  });

  describe('assign()', () => {
    test('모니터를 busy 상태로 변경하고 고민 정보를 저장해야 함', () => {
      const worryData = {
        worryId: 'worry-123',
        clientId: 'client-abc'
      };

      monitorManager.assign('monitor-1', worryData);

      expect(monitorManager.monitors['monitor-1'].status).toBe('busy');
      expect(monitorManager.monitors['monitor-1'].currentWorry.worryId).toBe('worry-123');
      expect(monitorManager.monitors['monitor-1'].currentWorry.assignedAt).toBeDefined();
      expect(monitorManager.monitors['monitor-1'].clientId).toBe('client-abc');
    });

    test('할당 시간이 기록되어야 함', () => {
      const beforeTime = Date.now();
      monitorManager.assign('monitor-1', {
        worryId: 'worry-123',
        clientId: 'client-abc'
      });
      const afterTime = Date.now();

      const assignedAt = monitorManager.monitors['monitor-1'].currentWorry.assignedAt;
      expect(assignedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(assignedAt).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('release()', () => {
    test('모니터를 idle 상태로 변경하고 고민 정보를 null로 초기화해야 함', () => {
      monitorManager.assign('monitor-1', {
        worryId: 'worry-123',
        clientId: 'client-abc'
      });

      monitorManager.release('monitor-1');

      expect(monitorManager.monitors['monitor-1'].status).toBe('idle');
      expect(monitorManager.monitors['monitor-1'].currentWorry).toBeNull();
    });

    test('clientId는 release 후에도 유지되어야 함', () => {
      monitorManager.assign('monitor-1', {
        worryId: 'worry-123',
        clientId: 'client-abc'
      });

      monitorManager.release('monitor-1');

      expect(monitorManager.monitors['monitor-1'].clientId).toBe('client-abc');
    });
  });

  describe('getStatus()', () => {
    test('모든 모니터의 상태를 반환해야 함', () => {
      monitorManager.monitors['monitor-1'].status = 'busy';
      monitorManager.monitors['monitor-2'].status = 'idle';

      const status = monitorManager.getStatus();

      expect(status).toEqual({
        'monitor-1': 'busy',
        'monitor-2': 'idle'
      });
    });
  });

  describe('복합 시나리오', () => {
    test('할당 → 해제 → 재할당이 정상적으로 작동해야 함', () => {
      monitorManager.assign('monitor-1', {
        worryId: 'worry-1',
        clientId: 'client-1'
      });
      expect(monitorManager.monitors['monitor-1'].status).toBe('busy');

      monitorManager.release('monitor-1');
      expect(monitorManager.monitors['monitor-1'].status).toBe('idle');

      monitorManager.assign('monitor-1', {
        worryId: 'worry-2',
        clientId: 'client-1'
      });
      expect(monitorManager.monitors['monitor-1'].status).toBe('busy');
      expect(monitorManager.monitors['monitor-1'].currentWorry.worryId).toBe('worry-2');
    });

    test('2개의 모니터를 동시에 사용할 수 있어야 함', () => {
      monitorManager.assign('monitor-1', {
        worryId: 'worry-1',
        clientId: 'client-1'
      });
      monitorManager.assign('monitor-2', {
        worryId: 'worry-2',
        clientId: 'client-2'
      });

      expect(monitorManager.monitors['monitor-1'].status).toBe('busy');
      expect(monitorManager.monitors['monitor-2'].status).toBe('busy');
      expect(monitorManager.findAvailable()).toBeNull();
    });
  });
});
