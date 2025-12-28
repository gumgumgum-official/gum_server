/**
 * MonitorManager 단위 테스트
 *
 * 테스트 대상: src/managers/MonitorManager.js
 * 테스트 범위:
 * - 모니터 상태 관리 (idle/busy)
 * - 모니터 찾기 및 할당
 * - 소켓 ID 관리
 * - 상태 조회
 */

const MonitorManager = require('../MonitorManager');

describe('MonitorManager', () => {
  let monitorManager;

  // 각 테스트 전에 새로운 MonitorManager 인스턴스 생성
  beforeEach(() => {
    monitorManager = new MonitorManager();
  });

  describe('초기화', () => {
    test('2개의 모니터가 idle 상태로 초기화되어야 함', () => {
      // Then: 초기 상태 확인
      expect(monitorManager.monitors['monitor-1'].status).toBe('idle');
      expect(monitorManager.monitors['monitor-2'].status).toBe('idle');
      expect(monitorManager.monitors['monitor-1'].currentWorry).toBeNull();
      expect(monitorManager.monitors['monitor-2'].currentWorry).toBeNull();
    });
  });

  describe('findAvailable()', () => {
    test('모든 모니터가 idle일 때 첫 번째 모니터를 반환해야 함', () => {
      // Given: 모든 모니터가 idle 상태 (초기 상태)
      // When: 사용 가능한 모니터 찾기
      const available = monitorManager.findAvailable();

      // Then: monitor-1 반환
      expect(available).toBe('monitor-1');
    });

    test('monitor-1이 busy일 때 monitor-2를 반환해야 함', () => {
      // Given: monitor-1이 busy 상태
      monitorManager.monitors['monitor-1'].status = 'busy';

      // When: 사용 가능한 모니터 찾기
      const available = monitorManager.findAvailable();

      // Then: monitor-2 반환
      expect(available).toBe('monitor-2');
    });

    test('모든 모니터가 busy일 때 null을 반환해야 함', () => {
      // Given: 모든 모니터가 busy 상태
      monitorManager.monitors['monitor-1'].status = 'busy';
      monitorManager.monitors['monitor-2'].status = 'busy';

      // When: 사용 가능한 모니터 찾기
      const available = monitorManager.findAvailable();

      // Then: null 반환 (사용 가능한 모니터 없음)
      expect(available).toBeNull();
    });
  });

  describe('assign()', () => {
    test('모니터를 busy 상태로 변경하고 고민 정보를 저장해야 함', () => {
      const worryData = {
        worryId: 'worry-123',
        socketId: 'socket-abc'
      };

      monitorManager.assign('monitor-1', worryData);

      expect(monitorManager.monitors['monitor-1'].status).toBe('busy');
      expect(monitorManager.monitors['monitor-1'].currentWorry.worryId).toBe('worry-123');
      expect(monitorManager.monitors['monitor-1'].currentWorry.assignedAt).toBeDefined();
      expect(monitorManager.monitors['monitor-1'].socketId).toBe('socket-abc');
    });

    test('할당 시간이 기록되어야 함', () => {
      const beforeTime = Date.now();
      monitorManager.assign('monitor-1', {
        worryId: 'worry-123',
        socketId: 'socket-abc'
      });
      const afterTime = Date.now();

      const assignedAt = monitorManager.monitors['monitor-1'].currentWorry.assignedAt;
      expect(assignedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(assignedAt).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('release()', () => {
    test('모니터를 idle 상태로 변경하고 고민 정보를 null로 초기화해야 함', () => {
      // 먼저 할당
      monitorManager.assign('monitor-1', {
        worryId: 'worry-123',
        socketId: 'socket-abc'
      });

      // 해제
      monitorManager.release('monitor-1');

      expect(monitorManager.monitors['monitor-1'].status).toBe('idle');
      expect(monitorManager.monitors['monitor-1'].currentWorry).toBeNull();
    });

    test('socketId는 유지되어야 함', () => {
      monitorManager.assign('monitor-1', {
        worryId: 'worry-123',
        socketId: 'socket-abc'
      });

      monitorManager.release('monitor-1');

      expect(monitorManager.monitors['monitor-1'].socketId).toBe('socket-abc');
    });
  });

  describe('findBySocketId()', () => {
    test('소켓 ID로 모니터를 찾을 수 있어야 함', () => {
      monitorManager.updateSocketId('monitor-1', 'socket-123');
      monitorManager.updateSocketId('monitor-2', 'socket-456');

      expect(monitorManager.findBySocketId('socket-123')).toBe('monitor-1');
      expect(monitorManager.findBySocketId('socket-456')).toBe('monitor-2');
    });

    test('존재하지 않는 소켓 ID는 null을 반환해야 함', () => {
      expect(monitorManager.findBySocketId('socket-999')).toBeNull();
    });
  });

  describe('updateSocketId()', () => {
    test('모니터의 소켓 ID를 업데이트할 수 있어야 함', () => {
      monitorManager.updateSocketId('monitor-1', 'socket-new');
      expect(monitorManager.monitors['monitor-1'].socketId).toBe('socket-new');
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
      // 1차 할당
      monitorManager.assign('monitor-1', {
        worryId: 'worry-1',
        socketId: 'socket-1'
      });
      expect(monitorManager.monitors['monitor-1'].status).toBe('busy');

      // 해제
      monitorManager.release('monitor-1');
      expect(monitorManager.monitors['monitor-1'].status).toBe('idle');

      // 2차 할당
      monitorManager.assign('monitor-1', {
        worryId: 'worry-2',
        socketId: 'socket-1'
      });
      expect(monitorManager.monitors['monitor-1'].status).toBe('busy');
      expect(monitorManager.monitors['monitor-1'].currentWorry.worryId).toBe('worry-2');
    });

    test('2개의 모니터를 동시에 사용할 수 있어야 함', () => {
      monitorManager.assign('monitor-1', {
        worryId: 'worry-1',
        socketId: 'socket-1'
      });
      monitorManager.assign('monitor-2', {
        worryId: 'worry-2',
        socketId: 'socket-2'
      });

      expect(monitorManager.monitors['monitor-1'].status).toBe('busy');
      expect(monitorManager.monitors['monitor-2'].status).toBe('busy');
      expect(monitorManager.findAvailable()).toBeNull();
    });
  });
});
