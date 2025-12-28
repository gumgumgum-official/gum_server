# API 명세서

껌딱지월드 서버 API 명세서

## 📋 목차

1. [REST API](#rest-api)
2. [Socket.io 이벤트](#socketio-이벤트)
3. [에러 응답](#에러-응답)
4. [예제](#예제)

---

## REST API

### Base URL

```
http://localhost:3000
```

프로덕션: `https://ggumddi-server.up.railway.app`

### 헤더

모든 요청은 JSON 형식:

```
Content-Type: application/json
```

---

### 1. 헬스 체크

서버 상태 확인

**요청**

```http
GET /health
```

**응답**

```json
{
  "status": "ok",
  "timestamp": 1735392000000,
  "monitors": {
    "monitor-1": "idle",
    "monitor-2": "busy"
  },
  "queueLength": 3,
  "uptime": 3600.5
}
```

**필드 설명**

| 필드 | 타입 | 설명 |
|------|------|------|
| `status` | string | 서버 상태 (`"ok"`) |
| `timestamp` | number | 현재 타임스탬프 (밀리초) |
| `monitors` | object | 모니터 상태 (`"idle"` 또는 `"busy"`) |
| `queueLength` | number | 대기열 길이 |
| `uptime` | number | 서버 가동 시간 (초) |

---

### 2. 상태 조회 (디버깅용)

상세 서버 상태 조회

**요청**

```http
GET /status
```

**응답**

```json
{
  "monitors": {
    "monitor-1": {
      "status": "idle",
      "currentWorry": null,
      "socketId": null
    },
    "monitor-2": {
      "status": "busy",
      "currentWorry": {
        "worryId": "67abc123...",
        "assignedAt": 1735392000000
      },
      "socketId": "socket-xyz789"
    }
  },
  "queueLength": 2,
  "connectedClients": 5
}
```

**필드 설명**

| 필드 | 타입 | 설명 |
|------|------|------|
| `monitors` | object | 모니터 상세 상태 |
| `monitors[].status` | string | 모니터 상태 |
| `monitors[].currentWorry` | object\|null | 현재 할당된 고민 정보 |
| `monitors[].socketId` | string\|null | 연결된 소켓 ID |
| `queueLength` | number | 대기열 길이 |
| `connectedClients` | number | 연결된 클라이언트 수 |

---

## Socket.io 이벤트

### 연결

```javascript
const socket = io('http://localhost:3000');
```

---

## 클라이언트 → 서버 이벤트

### 1. 디바이스 등록

디바이스 타입 등록 및 Room 참가

**이벤트명**: `register-device`

**요청 데이터**

```javascript
socket.emit('register-device', deviceType);
```

**파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `deviceType` | string | ✅ | `'tablet'`, `'monitor-1'`, `'monitor-2'`, `'projector'` 중 하나 |

**예제**

```javascript
// 태블릿 등록
socket.emit('register-device', 'tablet');

// 모니터 1 등록
socket.emit('register-device', 'monitor-1');

// 빔프로젝터 등록
socket.emit('register-device', 'projector');
```

**응답 이벤트**: `registered`

---

### 2. 모니터 할당 요청

태블릿에서 모니터 할당 요청

**이벤트명**: `request-monitor`

**요청 데이터**

```javascript
socket.emit('request-monitor', {
  worryId: '67abc123...'
});
```

**파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `worryId` | string | ✅ | 고민 ID (고유 식별자) |

**예제**

```javascript
socket.emit('request-monitor', {
  worryId: 'worry-12345'
});
```

**응답 이벤트**:
- 성공: `monitor-assigned`
- 대기: `please-wait`

---

### 3. 체험 완료

모니터에서 체험 완료 신호 전송

**이벤트명**: `experience-complete`

**요청 데이터**

```javascript
socket.emit('experience-complete', monitorId);
```

**파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `monitorId` | string | ✅ | 모니터 ID (`'monitor-1'` 또는 `'monitor-2'`) |

**예제**

```javascript
socket.emit('experience-complete', 'monitor-1');
```

**응답**: 없음 (다음 사용자에게 자동 할당)

---

## 서버 → 클라이언트 이벤트

### 1. 등록 완료

디바이스 등록 완료 응답

**이벤트명**: `registered`

**응답 데이터**

```json
{
  "deviceType": "monitor-1",
  "timestamp": 1735392000000
}
```

**필드 설명**

| 필드 | 타입 | 설명 |
|------|------|------|
| `deviceType` | string | 등록된 디바이스 타입 |
| `timestamp` | number | 등록 시간 (밀리초) |

**예제**

```javascript
socket.on('registered', (data) => {
  console.log('등록 완료:', data.deviceType);
});
```

---

### 2. 모니터 할당 완료

모니터 할당 성공 시 태블릿으로 전송

**이벤트명**: `monitor-assigned`

**응답 데이터**

```json
{
  "monitorId": "monitor-1",
  "monitorNumber": 1,
  "message": "👈 왼쪽 껌딱지월드로 가세요"
}
```

**필드 설명**

| 필드 | 타입 | 설명 |
|------|------|------|
| `monitorId` | string | 할당된 모니터 ID |
| `monitorNumber` | number | 모니터 번호 (1 또는 2) |
| `message` | string | 사용자 안내 메시지 |

**예제**

```javascript
socket.on('monitor-assigned', (data) => {
  console.log('모니터 할당:', data.monitorNumber, data.message);
  // UI 업데이트: "왼쪽으로 가세요" 안내
});
```

---

### 3. 체험 시작 신호

모니터로 체험 시작 신호 전송

**이벤트명**: `start-experience`

**응답 데이터**

```json
{
  "worryId": "67abc123..."
}
```

**필드 설명**

| 필드 | 타입 | 설명 |
|------|------|------|
| `worryId` | string | 체험할 고민 ID |

**예제**

```javascript
socket.on('start-experience', (data) => {
  console.log('체험 시작:', data.worryId);
  // 고민 데이터 로드 및 체험 시작
});
```

---

### 4. 대기 안내

모니터가 모두 사용 중일 때 태블릿으로 전송

**이벤트명**: `please-wait`

**응답 데이터**

```json
{
  "queuePosition": 1,
  "message": "🎈 잠시만 기다려주세요! (1번째)"
}
```

**필드 설명**

| 필드 | 타입 | 설명 |
|------|------|------|
| `queuePosition` | number | 대기 순서 (1부터 시작) |
| `message` | string | 사용자 안내 메시지 |

**예제**

```javascript
socket.on('please-wait', (data) => {
  console.log('대기 중:', data.queuePosition);
  // UI 업데이트: 대기 순서 표시
});
```

---

### 5. 대기열 순서 업데이트

대기열 변동 시 모든 대기 중인 태블릿으로 전송

**이벤트명**: `queue-updated`

**응답 데이터**

```json
{
  "queuePosition": 2
}
```

**필드 설명**

| 필드 | 타입 | 설명 |
|------|------|------|
| `queuePosition` | number | 업데이트된 대기 순서 |

**예제**

```javascript
socket.on('queue-updated', (data) => {
  console.log('순서 업데이트:', data.queuePosition);
  // UI 업데이트: 대기 순서 갱신
});
```

---

### 6. 대기 시간 초과

5분 대기 시간 초과 시 태블릿으로 전송

**이벤트명**: `queue-expired`

**응답 데이터**

```json
{
  "message": "⏰ 대기 시간이 초과되었어요. 다시 시도해주세요."
}
```

**필드 설명**

| 필드 | 타입 | 설명 |
|------|------|------|
| `message` | string | 만료 안내 메시지 |

**예제**

```javascript
socket.on('queue-expired', (data) => {
  console.log('대기 시간 초과');
  // UI 업데이트: 만료 안내 및 재시도 버튼 표시
});
```

---

### 7. 에러 발생

에러 발생 시 전송

**이벤트명**: `error`

**응답 데이터**

```json
{
  "code": "MONITOR_NOT_FOUND",
  "message": "모니터를 찾을 수 없어요."
}
```

**필드 설명**

| 필드 | 타입 | 설명 |
|------|------|------|
| `code` | string | 에러 코드 |
| `message` | string | 에러 메시지 |

**에러 코드**

| 코드 | 설명 |
|------|------|
| `MONITOR_NOT_FOUND` | 모니터를 찾을 수 없음 |
| `INVALID_DEVICE_TYPE` | 잘못된 디바이스 타입 |
| `MISSING_WORRY_ID` | worryId가 없음 |

**예제**

```javascript
socket.on('error', (error) => {
  console.error('에러:', error.code, error.message);
  // UI 업데이트: 에러 메시지 표시
});
```

---

## 에러 응답

### HTTP 에러

**404 Not Found**

```json
{
  "error": "Not Found"
}
```

**500 Internal Server Error**

```json
{
  "error": "Internal Server Error"
}
```

---

## 예제

### 전체 플로우 예제

#### 태블릿 클라이언트

```javascript
const socket = io('http://localhost:3000');

// 1. 디바이스 등록
socket.emit('register-device', 'tablet');

socket.on('registered', (data) => {
  console.log('등록 완료:', data.deviceType);
});

// 2. 모니터 할당 요청
socket.emit('request-monitor', {
  worryId: 'worry-12345'
});

// 3. 응답 처리
socket.on('monitor-assigned', (data) => {
  console.log('모니터 할당:', data);
  // "왼쪽으로 가세요" 안내
});

socket.on('please-wait', (data) => {
  console.log('대기 중:', data.queuePosition);
  // 대기 순서 표시
});

socket.on('queue-updated', (data) => {
  console.log('순서 업데이트:', data.queuePosition);
  // 대기 순서 갱신
});

socket.on('queue-expired', (data) => {
  console.log('대기 시간 초과');
  // 재시도 안내
});
```

#### 모니터 클라이언트

```javascript
const socket = io('http://localhost:3000');

// 1. 디바이스 등록
socket.emit('register-device', 'monitor-1');

socket.on('registered', (data) => {
  console.log('등록 완료:', data.deviceType);
});

// 2. 체험 시작 대기
socket.on('start-experience', (data) => {
  console.log('체험 시작:', data.worryId);
  // 고민 데이터 로드 및 체험 시작

  // 체험 완료 후
  setTimeout(() => {
    socket.emit('experience-complete', 'monitor-1');
  }, 60000); // 60초 후 완료
});
```

---

## 테스트

### cURL 예제

```bash
# 헬스 체크
curl http://localhost:3000/health

# 상태 조회
curl http://localhost:3000/status
```

### Socket.io 테스트

브라우저 콘솔에서:

```javascript
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('연결됨:', socket.id);

  // 디바이스 등록
  socket.emit('register-device', 'tablet');

  // 모니터 요청
  socket.emit('request-monitor', {
    worryId: 'test-123'
  });
});

socket.on('monitor-assigned', (data) => {
  console.log('할당됨:', data);
});
```

---

**마지막 업데이트**: 2025-01-01
