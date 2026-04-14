/**
 * 모니터 상태 관리 클래스
 *
 * - idle + reservedWorry: 태블릿/대기열에서 이 모니터에 붙었으나 Stage3 미시작(모니터 관점 대기)
 * - busy + currentWorry: Stage3 진행 중
 *
 * 상태 구조:
 * {
 *   'monitor-1': {
 *     status: 'idle' | 'busy',
 *     currentWorry: { worryId, assignedAt, svgUrl?, sessionId?, displaySeq? } | null,
 *     reservedWorry: { worryId, svgUrl?, sessionId?, displaySeq? } | null,
 *     clientId: string | null
 *   },
 *   ...
 * }
 */

class MonitorManager {
  constructor() {
    this.monitors = {
      'monitor-1': {
        status: 'idle',
        currentWorry: null,
        reservedWorry: null,
        clientId: null
      },
      'monitor-2': {
        status: 'idle',
        currentWorry: null,
        reservedWorry: null,
        clientId: null
      }
    };
  }

  /**
   * 사용 가능: idle 이고 예약도 없음 (다른 태블릿에 넘길 수 있음)
   * @returns {string|null}
   */
  findAvailable() {
    for (const [id, monitor] of Object.entries(this.monitors)) {
      if (monitor.status === 'idle' && !monitor.reservedWorry) {
        return id;
      }
    }
    return null;
  }

  /**
   * 태블릿 할당 또는 complete 후 대기열 dequeue — Stage3 전까지 busy 아님
   * @param {object} worryData - { worryId, clientId?, svgUrl?, sessionId?, displaySeq? }
   */
  reserve(monitorId, worryData) {
    const row = {
      worryId: worryData.worryId,
      svgUrl: worryData.svgUrl ?? null,
      sessionId: worryData.sessionId ?? null
    };
    if (
      worryData.displaySeq != null &&
      Number.isInteger(worryData.displaySeq) &&
      worryData.displaySeq >= 1
    ) {
      row.displaySeq = worryData.displaySeq;
    }
    this.monitors[monitorId].reservedWorry = row;
    this.monitors[monitorId].clientId = worryData.clientId ?? null;
  }

  /**
   * Stage3 시작 — 예약을 current로 옮기고 busy
   * @throws {Error} 예약 없음 또는 이미 busy
   */
  start(monitorId) {
    const m = this.monitors[monitorId];
    if (m.status === 'busy') {
      throw new Error('already busy');
    }
    if (!m.reservedWorry) {
      throw new Error('no reservation');
    }
    m.currentWorry = {
      worryId: m.reservedWorry.worryId,
      assignedAt: Date.now(),
      svgUrl: m.reservedWorry.svgUrl,
      sessionId: m.reservedWorry.sessionId
    };
    if (m.reservedWorry.displaySeq != null) {
      m.currentWorry.displaySeq = m.reservedWorry.displaySeq;
    }
    m.reservedWorry = null;
    m.status = 'busy';
  }

  /**
   * Stage6 종료 등 — 체험만 종료, 예약은 건드리지 않음(complete 직후 dequeue·reserve에서 설정)
   */
  release(monitorId) {
    this.monitors[monitorId].status = 'idle';
    this.monitors[monitorId].currentWorry = null;
  }

  getStatus() {
    return {
      'monitor-1': this.monitors['monitor-1'].status,
      'monitor-2': this.monitors['monitor-2'].status
    };
  }
}

module.exports = MonitorManager;
