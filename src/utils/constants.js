/**
 * 상수 정의
 */

module.exports = {
  MONITOR_IDS: ['monitor-1', 'monitor-2'],
  DEVICE_TYPES: {
    TABLET: 'tablet',
    MONITOR_1: 'monitor-1',
    MONITOR_2: 'monitor-2',
    PROJECTOR: 'projector'
  },
  MONITOR_STATUS: {
    IDLE: 'idle',
    BUSY: 'busy'
  },
  QUEUE_TIMEOUT_MS: 5 * 60 * 1000, // 5분
  EVENT_NAMES: {
    REGISTER_DEVICE: 'register-device',
    REGISTERED: 'registered',
    REQUEST_MONITOR: 'request-monitor',
    MONITOR_ASSIGNED: 'monitor-assigned',
    START_EXPERIENCE: 'start-experience',
    PLEASE_WAIT: 'please-wait',
    QUEUE_UPDATED: 'queue-updated',
    QUEUE_EXPIRED: 'queue-expired',
    EXPERIENCE_COMPLETE: 'experience-complete',
    ERROR: 'error'
  }
};
