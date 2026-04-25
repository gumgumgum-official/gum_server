/**
 * 모니터 URL 파라미터 검증
 * - 기존: monitor-1, monitor-2
 * - 확장: UUID(하이픈 포함 표준 8-4-4-4-12) — 키오스크별 고정 ID·같은 빌드 URL 대응
 */

const constants = require('./constants');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {string} raw - req.params.monitorId 등
 * @returns {boolean}
 */
function isValidMonitorIdParam(raw) {
  if (raw == null) return false;
  const id = String(raw).trim();
  if (!id || id.length > 128) return false;
  if (constants.MONITOR_IDS.includes(id)) return true;
  return UUID_RE.test(id);
}

/**
 * @param {string} raw
 * @returns {string|null} 정규화된 id 또는 무효 시 null
 */
function normalizeMonitorIdParam(raw) {
  if (!isValidMonitorIdParam(raw)) return null;
  return String(raw).trim();
}

module.exports = {
  isValidMonitorIdParam,
  normalizeMonitorIdParam,
  UUID_RE
};
