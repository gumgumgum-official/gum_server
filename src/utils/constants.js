/**
 * 상수 정의
 */

module.exports = {
  MONITOR_IDS: ['monitor-1', 'monitor-2'],
  /** ensureMonitor로 추가 가능한 슬롯 상한 (monitor-1/2 포함 총 개수) */
  MAX_MONITOR_REGISTRY_SIZE: Number(process.env.MAX_MONITOR_REGISTRY_SIZE) || 64,
  DEVICE_TYPES: {
    MONITOR_1: 'monitor-1',
    MONITOR_2: 'monitor-2'
  },
  MONITOR_STATUS: {
    IDLE: 'idle',
    BUSY: 'busy'
  },
  QUEUE_TIMEOUT_MS: 5 * 60 * 1000 // 5분
};
