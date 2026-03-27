# tablet-entry-card 변경사항 (REST 기반 모니터 배정 요청)

이 문서는 `gumgumgum-official/tablet-entry-card` 레포에서, Edge Function 제출 이후 **`gum_server`에 모니터 예약만 요청**하는 흐름을 정리합니다.

> gum_server는 **`POST /api/request-monitor`만 태블릿이 호출**합니다. 모니터의 `start` / `complete`는 **gum-frontend(모니터 앱)** 가 담당합니다.  
> 서버 동작 요약: [docs/MONITOR_USER_FLOW.md](./docs/MONITOR_USER_FLOW.md)

## 현재 흐름(확인됨)

- 태블릿은 strokes를 **Edge Function(`handwriting-to-svg`)** 에 POST
- Edge Function: Storage 업로드, Realtime broadcast, `strokes` insert
- 응답(기존): `SubmitResponse { id, storagePathSvg, broadcasted }` (확장 시 `seq` 포함)

## 목표

- `seq`(N번째 번호)를 안정적으로 쓰기
- 제출 성공 직후 **`POST /api/request-monitor`** 로 해당 모니터에 **고민 예약**(서버는 즉시 `busy`가 아니라 `reservedWorry`; 같은 모니터에 다른 고민이 동시에 못 붙게 막음)

## 변경 요약

1. `strokes`에 `seq` (IDENTITY 등)  
2. Edge Function 응답에 `seq` 포함  
3. 태블릿: 제출 성공 후 `request-monitor` 호출

## 상세 변경 (파일 단위)

### 1) Supabase DB 스키마/마이그레이션

- `strokes`에 `seq BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE` (또는 프로젝트에 맞는 동일 목적 컬럼)

### 2) Edge Function (`handwriting-to-svg`)

- insert 후 `seq` 반환, idempotency 경로에서도 동일 `seq` 반환
- 응답 예: `{ id, storagePathSvg, broadcasted, seq }`

### 3) 프론트 타입

- `SubmitResponse`에 `seq: number` (또는 string 정책에 맞춤)

### 4) 제출 성공 후 (`EntryCardCanvas` / `WorrySection`)

- UI: `${seq}번째 고민이 추가되었습니다` 표시
- gum_server 호출:

```ts
await fetch(`${GUM_SERVER_URL}/api/request-monitor`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    worryId: String(seq),
    svgUrl: storagePathSvg,
    sessionId,
    clientId,
  }),
});
```

- 응답:
  - `assigned: true` → 왼쪽/오른쪽 모니터 안내 메시지
  - `assigned: false` → 대기 순번 + `clientId`로 `GET /api/queue/position` 폴링 가능

## 태블릿이 하지 않는 것

- **`POST /api/monitors/:id/start`**, **`POST /api/monitors/:id/complete`** — 모니터(gum-frontend) 전용

## 기대 결과

- 태블릿·모니터 문구에 동일 `seq` 사용
- 태블릿은 Socket.io 없이 **REST `request-monitor`만**으로 모니터 슬롯 예약
