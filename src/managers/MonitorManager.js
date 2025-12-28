/**
 * 모니터 상태 관리 클래스
 *
 * 역할:
 * - 2개 모니터의 상태 (idle/busy) 관리
 * - 사용 가능한 모니터 찾기
 * - 모니터 할당 및 해제
 * - 소켓 ID로 모니터 찾기
 *
 * 상태 구조:
 * {
 *   'monitor-1': {
 *     status: 'idle' | 'busy',
 *     currentWorry: { worryId, assignedAt } | null,
 *     socketId: string | null
 *   },
 *   'monitor-2': { ... }
 * }
 */

class MonitorManager {
  constructor() {
    // 2개 모니터 초기화 (모두 idle 상태)
    this.monitors = {
      'monitor-1': {
        status: 'idle',        // 현재 상태
        currentWorry: null,    // 할당된 고민 정보
        socketId: null         // 연결된 소켓 ID
      },
      'monitor-2': {
        status: 'idle',
        currentWorry: null,
        socketId: null
      }
    };
  }

  /**
   * 사용 가능한 모니터 찾기
   *
   * @returns {string|null} 모니터 ID ('monitor-1' or 'monitor-2') 또는 null
   *
   * 동작:
   * 1. monitor-1부터 순차적으로 확인
   * 2. status가 'idle'인 첫 번째 모니터 반환
   * 3. 모두 busy면 null 반환
   */
  findAvailable() {
    for (const [id, monitor] of Object.entries(this.monitors)) {
      if (monitor.status === 'idle') {
        return id;
      }
    }
    return null;
  }

  /**
   * 모니터 할당
   *
   * @param {string} monitorId - 'monitor-1' or 'monitor-2'
   * @param {object} worryData - { worryId, socketId }
   *
   * 동작:
   * 1. 모니터 상태를 busy로 변경
   * 2. 현재 고민 정보 저장 (worryId, assignedAt)
   * 3. 소켓 ID 저장
   */
  assign(monitorId, worryData) {
    this.monitors[monitorId].status = 'busy';
    this.monitors[monitorId].currentWorry = {
      worryId: worryData.worryId,
      assignedAt: Date.now()  // 할당 시간 기록
    };
    this.monitors[monitorId].socketId = worryData.socketId;
  }

  /**
   * 모니터 해제
   *
   * @param {string} monitorId
   *
   * 동작:
   * 1. 모니터 상태를 idle로 변경
   * 2. 현재 고민 정보를 null로 초기화
   * 3. socketId는 유지 (재할당 시 필요)
   */
  release(monitorId) {
    this.monitors[monitorId].status = 'idle';
    this.monitors[monitorId].currentWorry = null;
    // socketId는 유지 (모니터 재연결 없이 다음 할당 가능)
  }

  /**
   * 소켓 ID로 모니터 찾기
   * @param {string} socketId
   * @returns {string|null} 모니터 ID 또는 null
   */
  findBySocketId(socketId) {
    for (const [id, monitor] of Object.entries(this.monitors)) {
      if (monitor.socketId === socketId) {
        return id;
      }
    }
    return null;
  }

  /**
   * 모니터 소켓 ID 업데이트
   * @param {string} monitorId
   * @param {string} socketId
   */
  updateSocketId(monitorId, socketId) {
    this.monitors[monitorId].socketId = socketId;
  }

  /**
   * 전체 상태 조회
   * @returns {object} 모니터 상태 객체
   */
  getStatus() {
    return {
      'monitor-1': this.monitors['monitor-1'].status,
      'monitor-2': this.monitors['monitor-2'].status
    };
  }
}

module.exports = MonitorManager;
