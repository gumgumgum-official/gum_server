const constants = require('../utils/constants');

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
 *
 * UUID 등 추가 ID는 reserve/start 전 ensureMonitor 로 슬롯을 만든다.
 */

class MonitorManager {
  emptyMonitorState() {
    return {
      status: 'idle',
      currentWorry: null,
      reservedWorry: null,
      clientId: null
    };
  }

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
   * 동적 모니터 슬롯 생성 (UUID 키오스크 등). 레지스트리 상한 초과 시 에러.
   * @param {string} monitorId
   * @throws {Error} registry full
   */
  ensureMonitor(monitorId) {
    if (this.monitors[monitorId]) return;
    const max = constants.MAX_MONITOR_REGISTRY_SIZE;
    if (Object.keys(this.monitors).length >= max) {
      throw new Error('monitor registry full');
    }
    this.monitors[monitorId] = this.emptyMonitorState();
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
    this.ensureMonitor(monitorId);
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
    this.ensureMonitor(monitorId);
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
   * 강제 배정 — 예약 단계를 건너뛰고 즉시 busy + currentWorry로 만든다.
   * 운영자 URL 파라미터(emergency-assign)용. 이미 busy(다른 currentWorry)여도 덮어쓴다.
   * @param {object} worryData - { worryId, clientId?, svgUrl?, sessionId?, displaySeq? }
   */
  forceAssign(monitorId, worryData) {
    this.ensureMonitor(monitorId);
    const m = this.monitors[monitorId];
    m.currentWorry = {
      worryId: worryData.worryId,
      assignedAt: Date.now(),
      svgUrl: worryData.svgUrl ?? null,
      sessionId: worryData.sessionId ?? null
    };
    if (
      worryData.displaySeq != null &&
      Number.isInteger(worryData.displaySeq) &&
      worryData.displaySeq >= 1
    ) {
      m.currentWorry.displaySeq = worryData.displaySeq;
    }
    m.reservedWorry = null;
    m.status = 'busy';
    m.clientId = worryData.clientId ?? null;
  }

  /**
   * Stage6 종료 등 — 체험만 종료, 예약은 건드리지 않음(complete 직후 dequeue·reserve에서 설정)
   */
  release(monitorId) {
    if (!this.monitors[monitorId]) return;
    this.monitors[monitorId].status = 'idle';
    this.monitors[monitorId].currentWorry = null;
  }

  /**
   * 강제 초기화 — 진행 중이든 예약 상태든 즉시 모든 배정을 취소하고 idle로 되돌린다.
   * monitorId만 보내면 38번째 배정이라도 그 자리에서 비운다.
   * @returns {boolean} 비울 배정이 있었으면 true (없었으면 false)
   */
  clear(monitorId) {
    const m = this.monitors[monitorId];
    if (!m) return false;
    const hadAssignment = m.status === 'busy' || !!m.currentWorry || !!m.reservedWorry;
    m.status = 'idle';
    m.currentWorry = null;
    m.reservedWorry = null;
    m.clientId = null;
    return hadAssignment;
  }

  getStatus() {
    /** @type {Record<string, string>} */
    const out = {};
    for (const [id, m] of Object.entries(this.monitors)) {
      out[id] = m.status;
    }
    return out;
  }
}

module.exports = MonitorManager;
