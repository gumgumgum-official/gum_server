/**
 * 대기열 관리 클래스
 *
 * 역할:
 * - FIFO (First In First Out) 순서로 대기열 관리
 * - 5분 타임아웃 자동 관리
 * - 대기 순서 조회 및 업데이트
 *
 * 사용 예:
 * const queue = new QueueManager();
 * const position = queue.add('socket-123', 'worry-456', (socketId) => {
 *   console.log('타임아웃:', socketId);
 * });
 */

/**
 * 대기열 아이템 클래스
 * - 각 대기 중인 사용자의 정보를 저장
 */
class QueueItem {
  constructor(socketId, worryId) {
    this.socketId = socketId;    // 소켓 ID
    this.worryId = worryId;      // 고민 ID
    this.timestamp = Date.now(); // 추가 시간
    this.timeoutId = null;       // 타임아웃 ID (취소 시 사용)
  }
}

class QueueManager {
  constructor() {
    this.queue = [];                      // 대기열 배열
    this.TIMEOUT_MS = 5 * 60 * 1000;     // 타임아웃: 5분
  }

  /**
   * 대기열 추가
   *
   * @param {string} socketId - 소켓 ID
   * @param {string} worryId - 고민 ID
   * @param {function} onTimeout - 타임아웃 콜백 함수
   * @returns {number} 대기 순서 (1부터 시작)
   *
   * 동작:
   * 1. 새로운 QueueItem 생성
   * 2. 5분 타임아웃 설정 (시간 초과 시 자동 제거 + 콜백 호출)
   * 3. 대기열에 추가 (맨 뒤)
   * 4. 현재 순서 반환
   */
  add(socketId, worryId, onTimeout) {
    const item = new QueueItem(socketId, worryId);

    // 5분 타임아웃 설정
    item.timeoutId = setTimeout(() => {
      this.remove(socketId);      // 대기열에서 제거
      onTimeout(socketId);         // 타임아웃 콜백 호출
    }, this.TIMEOUT_MS);

    this.queue.push(item);          // 대기열 맨 뒤에 추가
    return this.queue.length;       // 현재 순서 반환 (1부터)
  }

  /**
   * 대기열에서 제거
   *
   * @param {string} socketId - 제거할 소켓 ID
   * @returns {boolean} 제거 성공 여부
   *
   * 동작:
   * 1. 소켓 ID로 아이템 찾기
   * 2. 타임아웃 취소
   * 3. 대기열에서 제거
   */
  remove(socketId) {
    const index = this.queue.findIndex(item => item.socketId === socketId);
    if (index !== -1) {
      const item = this.queue[index];
      clearTimeout(item.timeoutId);  // 타임아웃 취소
      this.queue.splice(index, 1);   // 배열에서 제거
      return true;
    }
    return false;
  }

  /**
   * 다음 사용자 가져오기 (FIFO)
   *
   * @returns {object|null} { socketId, worryId } 또는 null
   *
   * 동작:
   * 1. 대기열 맨 앞에서 아이템 가져오기 (shift)
   * 2. 타임아웃 취소
   * 3. 소켓 ID와 고민 ID 반환
   */
  dequeue() {
    if (this.queue.length === 0) {
      return null;  // 빈 대기열
    }

    const item = this.queue.shift();  // 맨 앞 아이템 제거 및 반환
    clearTimeout(item.timeoutId);     // 타임아웃 취소

    return {
      socketId: item.socketId,
      worryId: item.worryId
    };
  }

  /**
   * 대기열 길이 조회
   * @returns {number} 현재 대기 중인 사용자 수
   */
  getLength() {
    return this.queue.length;
  }

  /**
   * 특정 소켓의 순서 조회
   *
   * @param {string} socketId - 조회할 소켓 ID
   * @returns {number|null} 순서 (1부터) 또는 null (없으면)
   *
   * 예: 3명이 대기 중일 때
   * - 첫 번째 사용자: 1
   * - 두 번째 사용자: 2
   * - 세 번째 사용자: 3
   */
  getPosition(socketId) {
    const index = this.queue.findIndex(item => item.socketId === socketId);
    return index !== -1 ? index + 1 : null;  // 배열 index(0부터) → 순서(1부터)
  }

  /**
   * 전체 소켓 ID 목록 조회
   *
   * @returns {string[]} 대기열의 모든 소켓 ID (순서대로)
   *
   * 용도: 대기열 변경 시 모든 대기자에게 순서 업데이트 알림
   */
  getAllSocketIds() {
    return this.queue.map(item => item.socketId);
  }

  /**
   * 대기열 전체 초기화
   *
   * 동작:
   * 1. 모든 타임아웃 취소
   * 2. 대기열 비우기
   *
   * 주의: 서버 재시작 또는 긴급 상황에만 사용
   */
  clear() {
    this.queue.forEach(item => clearTimeout(item.timeoutId));  // 모든 타임아웃 취소
    this.queue = [];  // 대기열 초기화
  }
}

module.exports = QueueManager;
