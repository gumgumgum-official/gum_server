/**
 * QueueManager 단위 테스트
 *
 * 테스트 대상: src/managers/QueueManager.js
 * 테스트 범위:
 * - 대기열 추가/제거/조회
 * - FIFO 순서 보장
 * - 타임아웃 관리 (5분)
 * - 순서 업데이트
 */

const QueueManager = require('../QueueManager');

describe('QueueManager', () => {
  let queueManager;

  beforeEach(() => {
    queueManager = new QueueManager();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('초기화', () => {
    test('빈 대기열로 초기화되어야 함', () => {
      expect(queueManager.getLength()).toBe(0);
    });

    test('타임아웃은 5분으로 설정되어야 함', () => {
      expect(queueManager.TIMEOUT_MS).toBe(5 * 60 * 1000);
    });
  });

  describe('add()', () => {
    test('대기열에 아이템을 추가하고 순서를 반환해야 함', () => {
      // Given: 빈 대기열
      // When: 아이템 추가
      const position = queueManager.add('socket-1', 'worry-1', jest.fn());

      // Then: 순서 1을 반환하고 길이가 1이어야 함
      expect(position).toBe(1);
      expect(queueManager.getLength()).toBe(1);
    });

    test('여러 아이템을 추가하면 순서대로 순서를 반환해야 함', () => {
      // Given: 빈 대기열
      // When: 3개 아이템 순차 추가
      const pos1 = queueManager.add('socket-1', 'worry-1', jest.fn());
      const pos2 = queueManager.add('socket-2', 'worry-2', jest.fn());
      const pos3 = queueManager.add('socket-3', 'worry-3', jest.fn());

      // Then: 각각 1, 2, 3번 순서를 반환해야 함
      expect(pos1).toBe(1);
      expect(pos2).toBe(2);
      expect(pos3).toBe(3);
      expect(queueManager.getLength()).toBe(3);
    });

    test('타임아웃 발생 시 콜백이 호출되어야 함', () => {
      // Given: 타임아웃 콜백이 있는 아이템 추가
      const onTimeout = jest.fn();
      queueManager.add('socket-1', 'worry-1', onTimeout);

      // When: 5분 경과 (타임아웃)
      jest.advanceTimersByTime(5 * 60 * 1000);

      // Then: 콜백이 호출되고 대기열에서 제거됨
      expect(onTimeout).toHaveBeenCalledWith('socket-1');
      expect(queueManager.getLength()).toBe(0);
    });
  });

  describe('remove()', () => {
    test('대기열에서 아이템을 제거할 수 있어야 함', () => {
      // Given: 2개 아이템이 있는 대기열
      queueManager.add('socket-1', 'worry-1', jest.fn());
      queueManager.add('socket-2', 'worry-2', jest.fn());

      // When: 첫 번째 아이템 제거
      const removed = queueManager.remove('socket-1');

      // Then: 제거 성공하고 길이가 1로 감소
      expect(removed).toBe(true);
      expect(queueManager.getLength()).toBe(1);
    });

    test('존재하지 않는 소켓은 false를 반환해야 함', () => {
      // Given: 빈 대기열
      // When: 존재하지 않는 소켓 제거 시도
      const removed = queueManager.remove('socket-999');

      // Then: false 반환
      expect(removed).toBe(false);
    });

    test('제거 후에도 남은 아이템은 유지되어야 함', () => {
      // Given: 3개 아이템이 있는 대기열
      queueManager.add('socket-1', 'worry-1', jest.fn());
      queueManager.add('socket-2', 'worry-2', jest.fn());
      queueManager.add('socket-3', 'worry-3', jest.fn());

      // When: 중간 아이템 제거
      queueManager.remove('socket-2');

      // Then: 나머지 아이템은 유지되고 순서도 유지됨
      expect(queueManager.getLength()).toBe(2);
      expect(queueManager.getPosition('socket-1')).toBe(1);
      expect(queueManager.getPosition('socket-3')).toBe(2);
    });
  });

  describe('dequeue()', () => {
    test('FIFO 순서로 아이템을 가져와야 함', () => {
      // Given: 3개 아이템이 순차적으로 추가된 대기열
      queueManager.add('socket-1', 'worry-1', jest.fn());
      queueManager.add('socket-2', 'worry-2', jest.fn());
      queueManager.add('socket-3', 'worry-3', jest.fn());

      // When: dequeue 2번 실행
      const first = queueManager.dequeue();
      const second = queueManager.dequeue();

      // Then: 먼저 추가된 순서대로 반환됨 (FIFO)
      expect(first.socketId).toBe('socket-1');
      expect(first.worryId).toBe('worry-1');
      expect(second.socketId).toBe('socket-2');
      expect(second.worryId).toBe('worry-2');
    });

    test('빈 대기열에서 dequeue하면 null을 반환해야 함', () => {
      // Given: 빈 대기열
      // When: dequeue 실행
      const result = queueManager.dequeue();

      // Then: null 반환
      expect(result).toBeNull();
    });

    test('dequeue 시 대기열 길이가 감소해야 함', () => {
      // Given: 2개 아이템이 있는 대기열
      queueManager.add('socket-1', 'worry-1', jest.fn());
      queueManager.add('socket-2', 'worry-2', jest.fn());
      expect(queueManager.getLength()).toBe(2);

      // When: dequeue 실행
      queueManager.dequeue();

      // Then: 길이가 1로 감소
      expect(queueManager.getLength()).toBe(1);
    });

    test('dequeue 후에도 타임아웃은 계속 작동해야 함', () => {
      // Given: 2개 아이템이 있는 대기열
      const onTimeout = jest.fn();
      queueManager.add('socket-1', 'worry-1', jest.fn());
      queueManager.add('socket-2', 'worry-2', onTimeout);

      // When: 첫 번째 아이템 dequeue 후 5분 경과
      queueManager.dequeue();
      jest.advanceTimersByTime(5 * 60 * 1000);

      // Then: 두 번째 아이템의 타임아웃이 호출됨
      expect(onTimeout).toHaveBeenCalledWith('socket-2');
    });
  });

  describe('getPosition()', () => {
    test('소켓의 순서를 조회할 수 있어야 함', () => {
      queueManager.add('socket-1', 'worry-1', jest.fn());
      queueManager.add('socket-2', 'worry-2', jest.fn());
      queueManager.add('socket-3', 'worry-3', jest.fn());

      expect(queueManager.getPosition('socket-1')).toBe(1);
      expect(queueManager.getPosition('socket-2')).toBe(2);
      expect(queueManager.getPosition('socket-3')).toBe(3);
    });

    test('존재하지 않는 소켓은 null을 반환해야 함', () => {
      expect(queueManager.getPosition('socket-999')).toBeNull();
    });
  });

  describe('getAllSocketIds()', () => {
    test('모든 소켓 ID를 배열로 반환해야 함', () => {
      queueManager.add('socket-1', 'worry-1', jest.fn());
      queueManager.add('socket-2', 'worry-2', jest.fn());
      queueManager.add('socket-3', 'worry-3', jest.fn());

      const socketIds = queueManager.getAllSocketIds();
      expect(socketIds).toEqual(['socket-1', 'socket-2', 'socket-3']);
    });

    test('빈 대기열은 빈 배열을 반환해야 함', () => {
      const socketIds = queueManager.getAllSocketIds();
      expect(socketIds).toEqual([]);
    });
  });

  describe('clear()', () => {
    test('모든 아이템을 제거해야 함', () => {
      // Given: 3개 아이템이 있는 대기열
      queueManager.add('socket-1', 'worry-1', jest.fn());
      queueManager.add('socket-2', 'worry-2', jest.fn());
      queueManager.add('socket-3', 'worry-3', jest.fn());

      // When: clear 실행
      queueManager.clear();

      // Then: 대기열이 비어야 함
      expect(queueManager.getLength()).toBe(0);
    });

    test('clear 후에는 타임아웃이 발생하지 않아야 함', () => {
      // Given: 타임아웃 콜백이 있는 아이템 추가
      const onTimeout1 = jest.fn();
      const onTimeout2 = jest.fn();
      queueManager.add('socket-1', 'worry-1', onTimeout1);
      queueManager.add('socket-2', 'worry-2', onTimeout2);

      // When: clear 실행 후 5분 경과
      queueManager.clear();
      jest.advanceTimersByTime(5 * 60 * 1000);

      // Then: 타임아웃 콜백이 호출되지 않아야 함
      expect(onTimeout1).not.toHaveBeenCalled();
      expect(onTimeout2).not.toHaveBeenCalled();
    });
  });

  describe('복합 시나리오', () => {
    test('추가 → 제거 → 순서 업데이트가 정상적으로 작동해야 함', () => {
      queueManager.add('socket-1', 'worry-1', jest.fn());
      queueManager.add('socket-2', 'worry-2', jest.fn());
      queueManager.add('socket-3', 'worry-3', jest.fn());

      // 중간 제거
      queueManager.remove('socket-2');

      // 순서 확인
      expect(queueManager.getPosition('socket-1')).toBe(1);
      expect(queueManager.getPosition('socket-3')).toBe(2);
      expect(queueManager.getPosition('socket-2')).toBeNull();
    });

    test('dequeue → add → dequeue가 정상적으로 작동해야 함', () => {
      queueManager.add('socket-1', 'worry-1', jest.fn());
      queueManager.add('socket-2', 'worry-2', jest.fn());

      const first = queueManager.dequeue();
      expect(first.socketId).toBe('socket-1');

      queueManager.add('socket-3', 'worry-3', jest.fn());

      const second = queueManager.dequeue();
      expect(second.socketId).toBe('socket-2');

      const third = queueManager.dequeue();
      expect(third.socketId).toBe('socket-3');
    });

    test('타임아웃 동시 발생 시 모두 처리되어야 함', () => {
      const onTimeout1 = jest.fn();
      const onTimeout2 = jest.fn();

      queueManager.add('socket-1', 'worry-1', onTimeout1);
      queueManager.add('socket-2', 'worry-2', onTimeout2);

      // 5분 경과
      jest.advanceTimersByTime(5 * 60 * 1000);

      expect(onTimeout1).toHaveBeenCalled();
      expect(onTimeout2).toHaveBeenCalled();
      expect(queueManager.getLength()).toBe(0);
    });
  });
});
