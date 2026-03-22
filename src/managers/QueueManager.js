/**
 * 대기열 관리 클래스
 *
 * 역할:
 * - FIFO 대기열
 * - 5분 타임아웃
 * - 대기 순서 조회
 */

class QueueItem {
  constructor(clientId, worryId, { svgUrl = null, sessionId = null } = {}) {
    this.clientId = clientId;
    this.worryId = worryId;
    this.timestamp = Date.now();
    this.timeoutId = null;
    this.svgUrl = svgUrl;
    this.sessionId = sessionId;
  }
}

class QueueManager {
  constructor() {
    this.queue = [];
    this.TIMEOUT_MS = 5 * 60 * 1000;
  }

  /**
   * @param {string} clientId
   * @param {string} worryId
   * @param {function} onTimeout - (clientId) => void
   * @returns {number} 대기 순서 (1부터)
   */
  add(clientId, worryId, onTimeout, { svgUrl = null, sessionId = null } = {}) {
    const item = new QueueItem(clientId, worryId, { svgUrl, sessionId });

    item.timeoutId = setTimeout(() => {
      this.remove(clientId);
      onTimeout(clientId);
    }, this.TIMEOUT_MS);

    this.queue.push(item);
    return this.queue.length;
  }

  /**
   * @param {string} clientId
   * @returns {boolean}
   */
  remove(clientId) {
    const index = this.queue.findIndex(item => item.clientId === clientId);
    if (index !== -1) {
      const item = this.queue[index];
      clearTimeout(item.timeoutId);
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * @returns {object|null} { clientId, worryId, svgUrl, sessionId }
   */
  dequeue() {
    if (this.queue.length === 0) {
      return null;
    }

    const item = this.queue.shift();
    clearTimeout(item.timeoutId);

    return {
      clientId: item.clientId,
      worryId: item.worryId,
      svgUrl: item.svgUrl,
      sessionId: item.sessionId
    };
  }

  getLength() {
    return this.queue.length;
  }

  /**
   * @param {string} clientId
   * @returns {number|null} 순서(1~) 또는 null
   */
  getPosition(clientId) {
    const index = this.queue.findIndex(item => item.clientId === clientId);
    return index !== -1 ? index + 1 : null;
  }

  /**
   * @returns {string[]}
   */
  getAllClientIds() {
    return this.queue.map(item => item.clientId);
  }

  clear() {
    this.queue.forEach(item => clearTimeout(item.timeoutId));
    this.queue = [];
  }
}

module.exports = QueueManager;
