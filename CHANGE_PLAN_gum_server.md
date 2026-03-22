# gum_server 변경사항 (REST + 폴링 기반 모니터 배정)

이 문서는 `gum_server`에서 **Socket.io 중심 구조를 제거하고, REST API + 폴링**으로 모니터 할당/대기열/체험 완료를 처리하기 위한 변경사항을 정리합니다.

## 목표

- 모니터(Stage3)가 “글로벌 최신 1개”가 아니라 **서버가 배정한 특정 SVG 1개**를 표시하게 만들기
- 태블릿 제출 결과(Edge Function 응답)에서 받은 **`seq`(N번째 번호) + `svgUrl`**을 서버에 REST로 전달
- 모니터는 **주기적인 REST 폴링**으로 “지금 나에게 할당된 고민”을 확인하고, 있으면 `N번째 고민이 도착했습니다`와 함께 해당 SVG를 표시

## REST API 설계

### 1) 태블릿 → 모니터 할당 요청

- **엔드포인트**: `POST /api/request-monitor`
- **Request JSON**:

```json
{
  "worryId": "75",                 // N번째 번호 (string)
  "svgUrl": "https://...",         // Edge Function 응답 storagePathSvg
  "sessionId": "exhibition-2026",  // 선택
  "clientId": "tablet-uuid"        // 선택(대기열 추적용)
}
```

- **Response JSON**:
  - 즉시 할당된 경우:

```json
{
  "assigned": true,
  "monitorId": "monitor-1",
  "monitorNumber": 1,
  "message": "왼쪽 모니터로 가세요"
}
```

  - 대기열에 들어간 경우:

```json
{
  "assigned": false,
  "queuePosition": 2,
  "message": "2번째로 대기 중입니다"
}
```

### 2) 모니터 → 현재 할당 상태 폴링

- **엔드포인트**: `GET /api/monitors/:monitorId/current`
- 예: `GET /api/monitors/monitor-1/current`
- **Response JSON**:
  - 아무것도 할당 안 된 경우 (idle):

```json
{ "status": "idle" }
```

  - 고민이 배정된 경우 (busy):

```json
{
  "status": "busy",
  "worry": {
    "worryId": "75",
    "svgUrl": "https://...",
    "sessionId": "exhibition-2026"
  }
}
```

### 3) 모니터 → 체험 완료 알림

- **엔드포인트**: `POST /api/monitors/:monitorId/complete`
- **Request JSON** (옵션):

```json
{
  "worryId": "75"  // 선택, 로그/검증용
}
```

- **동작**:
  - `MonitorManager.release(monitorId)`로 해당 모니터를 idle로 전환
  - `QueueManager.dequeue()`로 대기열에서 다음 사용자를 꺼내 `MonitorManager.assign(monitorId, nextUser)`로 즉시 할당
  - 새로 할당된 `currentWorry`는 **다음 폴링에서 모니터가 감지**
- **Response JSON**:

```json
{ "ok": true }
```

### 4) (선택) 태블릿 → 내 대기 순번 조회

- **엔드포인트**: `GET /api/queue/position?clientId=...`
- **Response JSON**:

```json
{ "queuePosition": 2 }
```

> UX 요구가 크지 않다면 이 엔드포인트는 생략 가능.

## 내부 구현 방향 (파일 단위)

### 1) `server.js`

- `MonitorManager` / `QueueManager` 인스턴스를 재사용.
- 기존 `/health`, `/status` 외에 다음 라우트를 추가:
  - `POST /api/request-monitor`
    - `monitorManager.findAvailable()`로 빈 모니터를 찾고, 있으면 즉시 `assign` 후 `assigned: true` 응답.
    - 없으면 `queueManager.add(clientId || socketId 대체값, worryId, onTimeout, { svgUrl, sessionId })`로 대기열 추가 후 `assigned: false` + `queuePosition` 응답.
  - `GET /api/monitors/:monitorId/current`
    - `monitorManager.monitors[monitorId]`를 조회해 `status`와 `currentWorry`를 기반으로 위 JSON 반환.
  - `POST /api/monitors/:monitorId/complete`
    - `MonitorManager.release(monitorId)` 호출 후, `QueueManager.dequeue()`로 다음 사용자 자동 할당.
- Socket.io 설정 블록은 **기존 클라이언트 호환용으로 남겨두되**, 새로운 플로우는 REST만 사용하도록 문서에 명시.

### 2) `src/managers/QueueManager.js`

- 이미 `svgUrl`, `sessionId`를 추가로 보관할 수 있도록 확장한 상태라면 그대로 사용.
- REST 플로우에서는 `socketId` 자리에 `clientId`(또는 요청 시 생성한 임시 ID)를 넣어도 무방.

### 3) `src/managers/MonitorManager.js`

- `currentWorry`에 `{ worryId, assignedAt, svgUrl, sessionId }`를 저장하도록 확장해 두면, `/status`나 디버깅 시 어떤 SVG가 배정됐는지 쉽게 확인 가능.

## 서버-프론트 계약(요약)

- `worryId`는 “N번째 번호(예: `strokes.seq` )”를 문자열로 전달.
- 태블릿:
  - Edge Function 응답에서 `seq`, `storagePathSvg`를 받은 후 `POST /api/request-monitor` 호출.
- 모니터:
  - 1~2초 간격으로 `GET /api/monitors/:id/current` 폴링.
  - `status === 'busy' && worry`가 보이면:
    - \"`${worry.worryId}번째 고민이 도착했습니다`\" 문구 표시.
    - `worry.svgUrl`을 사용해 SVG 렌더.
  - 체험 종료 시 `POST /api/monitors/:id/complete` 호출.

