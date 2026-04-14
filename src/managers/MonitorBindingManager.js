/**
 * 동일 URL로 띄운 모니터 브라우저마다 monitor-1 / monitor-2 슬롯을 안정적으로 배정합니다.
 * instanceId(클라이언트가 UUID로 생성·localStorage 보관) → monitorId 고정 매핑.
 */
const constants = require('../utils/constants');

class MonitorBindingManager {
  constructor() {
    /** @type {Map<string, string>} instanceId -> monitorId */
    this.bindings = new Map();
  }

  /**
   * @param {string} instanceId
   * @returns {{ monitorId: string, monitorNumber: number } | null} null 이멀 두 슬롯 모두 다른 instance에 점유됨
   */
  bind(instanceId) {
    if (this.bindings.has(instanceId)) {
      const monitorId = this.bindings.get(instanceId);
      return {
        monitorId,
        monitorNumber: monitorId === constants.DEVICE_TYPES.MONITOR_1 ? 1 : 2
      };
    }

    const used = new Set(this.bindings.values());
    for (const monitorId of constants.MONITOR_IDS) {
      if (!used.has(monitorId)) {
        this.bindings.set(instanceId, monitorId);
        return {
          monitorId,
          monitorNumber: monitorId === constants.DEVICE_TYPES.MONITOR_1 ? 1 : 2
        };
      }
    }
    return null;
  }

  /**
   * @param {string} instanceId
   * @returns {string|undefined}
   */
  getMonitorId(instanceId) {
    return this.bindings.get(instanceId);
  }

  /**
   * @param {string} instanceId
   * @returns {boolean}
   */
  release(instanceId) {
    return this.bindings.delete(instanceId);
  }

  /** 테스트·관리용 */
  clear() {
    this.bindings.clear();
  }
}

module.exports = MonitorBindingManager;
