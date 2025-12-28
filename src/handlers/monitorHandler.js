/**
 * 모니터 할당 핸들러
 */

const constants = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * 모니터 할당 요청 처리
 * @param {object} socket - Socket.io socket 객체
 * @param {object} data - { worryId }
 * @param {object} monitorManager - MonitorManager 인스턴스
 * @param {object} queueManager - QueueManager 인스턴스
 * @param {object} io - Socket.io 서버 인스턴스
 */
function handleMonitorRequest(socket, data, monitorManager, queueManager, io) {
  const { worryId } = data;
  logger.info(`모니터 요청: worryId=${worryId}, socket=${socket.id}`);

  // 빈 모니터 찾기
  const availableMonitor = monitorManager.findAvailable();

  if (availableMonitor) {
    // 할당 성공
    logger.info(`모니터 할당: ${availableMonitor} → worryId=${worryId}`);

    // 모니터 상태 변경
    monitorManager.assign(availableMonitor, {
      worryId,
      socketId: socket.id
    });

    // 태블릿에 할당 결과 전송
    socket.emit(constants.EVENT_NAMES.MONITOR_ASSIGNED, {
      monitorId: availableMonitor,
      monitorNumber: availableMonitor === constants.DEVICE_TYPES.MONITOR_1 ? 1 : 2,
      message: availableMonitor === constants.DEVICE_TYPES.MONITOR_1
        ? '👈 왼쪽 껌딱지월드로 가세요'
        : '👉 오른쪽 껌딱지월드로 가세요'
    });

    // 모니터에 체험 시작 신호
    io.to(availableMonitor).emit(constants.EVENT_NAMES.START_EXPERIENCE, {
      worryId
    });

  } else {
    // 모두 사용 중 → 대기열 추가
    logger.info(`대기열 추가: worryId=${worryId}`);

    const position = queueManager.add(
      socket.id,
      worryId,
      (expiredSocketId) => {
        // 타임아웃 콜백
        logger.warn(`대기 시간 초과: socket=${expiredSocketId}`);
        io.to(expiredSocketId).emit(constants.EVENT_NAMES.QUEUE_EXPIRED, {
          message: '⏰ 대기 시간이 초과되었어요. 다시 시도해주세요.'
        });
      }
    );

    // 대기 안내 전송
    socket.emit(constants.EVENT_NAMES.PLEASE_WAIT, {
      queuePosition: position,
      message: `🎈 잠시만 기다려주세요! (${position}번째)`
    });
  }
}

/**
 * 체험 완료 처리
 * @param {object} socket - Socket.io socket 객체
 * @param {string} monitorId - 모니터 ID
 * @param {object} monitorManager - MonitorManager 인스턴스
 * @param {object} queueManager - QueueManager 인스턴스
 * @param {object} io - Socket.io 서버 인스턴스
 */
function handleExperienceComplete(socket, monitorId, monitorManager, queueManager, io) {
  logger.info(`체험 완료: ${monitorId}`);

  // 모니터 해제
  monitorManager.release(monitorId);

  // 대기열 확인
  const nextUser = queueManager.dequeue();

  if (nextUser) {
    // 다음 사용자 할당
    logger.info(`다음 사용자 할당: ${monitorId} → worryId=${nextUser.worryId}`);

    monitorManager.assign(monitorId, nextUser);

    // 태블릿에 할당 알림
    io.to(nextUser.socketId).emit(constants.EVENT_NAMES.MONITOR_ASSIGNED, {
      monitorId,
      monitorNumber: monitorId === constants.DEVICE_TYPES.MONITOR_1 ? 1 : 2,
      message: monitorId === constants.DEVICE_TYPES.MONITOR_1
        ? '🌟 기다려주셔서 감사해요! 👈 왼쪽 껌딱지월드로 고고!'
        : '🌟 기다려주셔서 감사해요! 👉 오른쪽 껌딱지월드로 고고!'
    });

    // 모니터에 체험 시작 신호
    io.to(monitorId).emit(constants.EVENT_NAMES.START_EXPERIENCE, {
      worryId: nextUser.worryId
    });

    // 남은 대기자들에게 순서 업데이트
    updateQueuePositions(queueManager, io);
  } else {
    logger.info(`${monitorId} idle 상태로 전환 (대기열 없음)`);
  }
}

/**
 * 대기열 순서 업데이트 브로드캐스트
 * @param {object} queueManager - QueueManager 인스턴스
 * @param {object} io - Socket.io 서버 인스턴스
 */
function updateQueuePositions(queueManager, io) {
  const socketIds = queueManager.getAllSocketIds();
  socketIds.forEach((socketId, index) => {
    io.to(socketId).emit(constants.EVENT_NAMES.QUEUE_UPDATED, {
      queuePosition: index + 1
    });
  });
}

module.exports = {
  handleMonitorRequest,
  handleExperienceComplete,
  updateQueuePositions
};
