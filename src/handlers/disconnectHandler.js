/**
 * 연결 끊김 핸들러
 */

const logger = require('../utils/logger');
const { updateQueuePositions } = require('./monitorHandler');

/**
 * 연결 끊김 처리
 * @param {object} socket - Socket.io socket 객체
 * @param {object} monitorManager - MonitorManager 인스턴스
 * @param {object} queueManager - QueueManager 인스턴스
 * @param {object} io - Socket.io 서버 인스턴스
 */
function handleDisconnect(socket, monitorManager, queueManager, io) {
  logger.info('클라이언트 연결 끊김:', socket.id);

  // 모니터 연결 끊김 확인
  const monitorId = monitorManager.findBySocketId(socket.id);
  if (monitorId) {
    logger.warn(`모니터 연결 끊김: ${monitorId}`);
    monitorManager.release(monitorId);
    // 주의: 대기열에서 할당하지 않음 (모니터 없음)
  }

  // 대기열에서 제거
  const removed = queueManager.remove(socket.id);
  if (removed) {
    logger.info(`대기열에서 제거: ${socket.id}`);
    // 남은 대기자들에게 순서 업데이트
    updateQueuePositions(queueManager, io);
  }
}

module.exports = {
  handleDisconnect
};
