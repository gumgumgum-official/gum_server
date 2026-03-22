# Postman 테스트 가이드 (gum_server)

이 문서는 **Postman**으로 gum_server의 REST API를 끝까지 검증하는 절차를 단계별로 설명합니다.

## 준비

1. [Postman](https://www.postman.com/downloads/) 설치 또는 웹 앱 사용
2. 서버 실행  
   - 로컬: 프로젝트 루트에서 `npm start` → 기본 `http://localhost:3000`  
   - 배포: Render 등에서 받은 URL (예: `https://xxx.onrender.com`)
3. 이 레포의 파일 가져오기  
   - 컬렉션: [`postman/gum_server.postman_collection.json`](../postman/gum_server.postman_collection.json)  
   - 환경(선택): [`postman/gum_server.postman_environment.json`](../postman/gum_server.postman_environment.json)

### 컬렉션 가져오기

1. Postman → **Import**
2. `gum_server.postman_collection.json` 선택 → Import
3. (선택) `gum_server.postman_environment.json` Import 후 우측 상단 환경에서 **gum_server (로컬)** 선택

### `baseUrl` 설정

| 환경 | 값 예시 |
|------|---------|
| 로컬 | `http://localhost:3000` |
| Render | `https://your-service.onrender.com` |

- 컬렉션 변수 또는 환경 변수에서 **`baseUrl`**만 바꾸면 모든 요청에 반영됩니다.
- **끝에 `/` 를 붙이지 마세요.**

### 공통 변수 (모니터 시나리오용)

| 변수 | 용도 |
|------|------|
| `worryId` | 고민 ID (필수) |
| `clientId` | 대기열 식별 (태블릿이 고정 ID를 쓰면 같은 값으로 순번 조회) |
| `monitorId` | `monitor-1` 또는 `monitor-2` |
| `svgUrl`, `sessionId` | 선택 필드 |

---

## 1단계: 서버 살아 있는지 확인

### `GET /health`

1. 폴더 **01 - Health & Status** → **GET /health** 선택
2. **Send**
3. **기대 결과**
   - 상태 코드 **200**
   - 본문 JSON에 `"status": "ok"`
   - `monitors`, `queueLength`, `uptime` 포함

**Postman Tests 탭 예시** (자동 검증):

```javascript
pm.test("status 200", () => pm.response.to.have.status(200));
const j = pm.response.json();
pm.test("status ok", () => j.status === "ok");
```

### `GET /ping`

1. **GET /ping** → Send
2. **기대**: 200, `{ "ok": true }`  
   - GitHub Actions keepalive와 동일한 엔드포인트입니다.

### `GET /status`

1. **GET /status** → Send  
2. **기대**: `monitors`, `queueLength`  
   - `monitors[].clientId`는 할당 시 태블릿이 넘긴 `clientId`가 있을 때만 채워집니다.

---

## 2단계: 모니터 할당 (태블릿 시뮬레이션)

### `POST /api/request-monitor`

1. 폴더 **02 - Monitor flow** → **POST /api/request-monitor** 선택
2. Body는 **raw** + **JSON** (컬렉션에 샘플 있음)
3. `clientId`를 예: `postman-client-001` 로 고정해 두면 이후 대기열 조회에 동일 값 사용
4. **Send**

**케이스 A — 즉시 할당**

- 응답: `"assigned": true`, `monitorId`, `monitorNumber`, `message`
- **다음 단계**: 아래 `GET .../current`에서 **같은 `monitorId`**로 폴링

**케이스 B — 대기**

- 응답: `"assigned": false`, `queuePosition`, **`clientId`** (응답에 나온 값을 복사해 두세요. 서버가 생성한 `anonymous-...` 일 수 있음)
- **다음 단계**: `GET /api/queue/position?clientId=...` 로 순번 확인

### `GET /api/queue/position`

1. 쿼리 `clientId` = 직전 `request-monitor` 응답의 `clientId` (또는 요청에 넣은 고정 ID)
2. **기대**: `{ "queuePosition": N }` — 대기열에 없으면 **0**

---

## 3단계: 모니터 화면 폴링

### `GET /api/monitors/:monitorId/current`

1. 변수 `monitorId`를 `monitor-1` 또는 `monitor-2`로 설정 (할당 응답과 일치)
2. **Send** 여러 번 (실제 앱은 1~2초 간격 폴링)
3. **기대**
   - 유휴: `{ "status": "idle" }`
   - 사용 중: `{ "status": "busy", "worry": { "worryId", "svgUrl", "sessionId" } }`

---

## 4단계: 체험 완료

### `POST /api/monitors/:monitorId/complete`

1. 할당된 `monitorId`로 요청 (Body `{}` 또는 비워도 됨 — 서버는 바디 미사용)
2. **기대**: `{ "ok": true, "assignedNext": true|false }`
3. 대기자가 있으면 같은 모니터에 바로 붙으므로, 바로 이어서 **GET .../current**를내면 `busy`로 바뀔 수 있습니다.

---

## 5단계: 에러 케이스 (폴더 03)

| 요청 | 기대 |
|------|------|
| `POST /api/request-monitor` body `{}` | **400**, `worryId is required` |
| `GET .../monitor-99/current` | **400**, `invalid monitorId` |
| `GET /api/queue/position` (쿼리 없음) | **400**, `clientId is required` |

---

## 시나리오: 두 모니터 모두 점유 후 대기열

1. Postman에서 **서로 다른 `clientId`**로 요청을 두 번 보내기 어렵다면, **탭을 두 개** 열거나 Collection Runner에서 변수만 바꿔 두 번 실행합니다.
2. 첫 번째 `request-monitor` → `monitor-1` 할당 가정  
3. 두 번째는 다른 `worryId` + 다른 `clientId`로 다시 `request-monitor`  
4. 두 모니터가 busy면 세 번째 요청은 `assigned: false` + `queuePosition`  
5. 한 모니터에서 `complete` 호출 → `assignedNext: true` 이면 대기자가 그 모니터에 배정됨  
6. `GET /api/queue/position` 으로 남은 대기 순번 확인

---

## Collection Runner로 한 번에 돌리기

1. 컬렉션 **gum_server REST** 우클릭 → **Run collection**
2. 순서: **01 → 02 → 03** 폴더 순이 컬렉션 기본 순서와 맞음
3. 주의: **02** 안에서 `request-monitor` 직후 `current`는 할당 직후라 타이밍에 따라 `idle`일 수 있음 — 필요하면 Runner에서 해당 요청만 반복하거나 수동으로 재전송

---

## 배포 URL에서 주의할 점

- **첫 요청**은 Render 무료 티어에서 **콜드 스타트**로 30~50초 걸릴 수 있습니다. 타임아웃이 나면 잠시 후 재시도하세요.
- 슬립 방지는 [`render-ping.yml`](../.github/workflows/render-ping.yml) + [`GITHUB_ACTIONS_SETUP.md`](./GITHUB_ACTIONS_SETUP.md) 참고.

---

## 더 읽을 것

- [API.md](../API.md) — 필드·에러 전체 명세
- [RENDER_DEPLOY.md](./RENDER_DEPLOY.md) — Render 설정
