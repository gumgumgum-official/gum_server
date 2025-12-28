/**
 * 디바이스 등록 핸들러
 */

const constants = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * 디바이스 등록 처리
 * @param {object} socket - Socket.io socket 객체
 * @param {string} deviceType - 디바이스 타입
 * @param {object} monitorManager - MonitorManager 인스턴스
 */
function handleDeviceRegistration(socket, deviceType, monitorManager) {
  logger.info(`디바이스 등록: ${deviceType} (${socket.id})`);

  // Room 참가
  socket.join(deviceType);

  // 모니터인 경우 소켓 ID 저장
  if (deviceType === constants.DEVICE_TYPES.MONITOR_1 ||
      deviceType === constants.DEVICE_TYPES.MONITOR_2) {
    monitorManager.updateSocketId(deviceType, socket.id);
  }

  // 등록 완료 응답
  socket.emit(constants.EVENT_NAMES.REGISTERED, {
    deviceType,
    timestamp: Date.now()
  });

  logger.info(`${deviceType} 등록 완료`);
}

module.exports = {
  handleDeviceRegistration
};
