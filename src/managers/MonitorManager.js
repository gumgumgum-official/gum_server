/**
 * 모니터 상태 관리 클래스
 *
 * 역할:
 * - 2개 모니터의 상태 (idle/busy) 관리
 * - 사용 가능한 모니터 찾기
 * - 모니터 할당 및 해제
 *
 * 상태 구조:
 * {
 *   'monitor-1': {
 *     status: 'idle' | 'busy',
 *     currentWorry: { worryId, assignedAt, svgUrl?, sessionId? } | null,
 *     clientId: string | null
 *   },
 *   'monitor-2': { ... }
 * }
 */

class MonitorManager {
  constructor() {
    this.monitors = {
      'monitor-1': {
        status: 'idle',
        currentWorry: null,
        clientId: null
      },
      'monitor-2': {
        status: 'idle',
        currentWorry: null,
        clientId: null
      }
    };
  }

  /**
   * @returns {string|null} 'monitor-1' | 'monitor-2' | null
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
   * @param {string} monitorId
   * @param {object} worryData - { worryId, clientId?, svgUrl?, sessionId? }
   */
  assign(monitorId, worryData) {
    this.monitors[monitorId].status = 'busy';
    this.monitors[monitorId].currentWorry = {
      worryId: worryData.worryId,
      assignedAt: Date.now(),
      svgUrl: worryData.svgUrl ?? null,
      sessionId: worryData.sessionId ?? null
    };
    this.monitors[monitorId].clientId = worryData.clientId ?? null;
  }

  /**
   * 상태를 idle로, currentWorry 제거. clientId는 유지(디버깅·다음 할당 시 덮어씀).
   */
  release(monitorId) {
    this.monitors[monitorId].status = 'idle';
    this.monitors[monitorId].currentWorry = null;
  }

  /**
   * @returns {object} 모니터별 status 요약
   */
  getStatus() {
    return {
      'monitor-1': this.monitors['monitor-1'].status,
      'monitor-2': this.monitors['monitor-2'].status
    };
  }
}

module.exports = MonitorManager;
