# gum-frontend 변경사항 (Stage3 REST + 폴링 전환)

이 문서는 `gumgumgum-official/gum-frontend` 레포에서, Stage3(모니터)를 **`gum_server` REST API + 폴링**만으로 동작하게 바꾸는 변경사항을 정리합니다. (서버 쪽 Socket.io는 제거됨.)

> 참고: 레포 소개/라우트 구조는 [`gumgumgum-official/gum-frontend`](https://github.com/gumgumgum-official/gum-frontend) README 기준입니다.

## 목표

- Stage2(빔): 기존 구조 유지
  - Storage list + Realtime `new_handwriting` 구독
- Stage3(모니터): gum_server REST API만 사용
  - `POST /api/monitors/:id/start` — Stage3 진입 시(이때 서버가 `busy` + `worry` 공개)
  - `GET /api/monitors/:id/current` 폴링 — `busy`일 때 `worry.svgUrl` 등 표시
  - `POST /api/monitors/:id/complete` — Stage6 종료·시작 화면 복귀 시 `idle` (다음 대기자는 서버 예약만, 다시 `start`로 busy)
- 문구:
  - `${worryId}번째 고민이 도착했습니다` (worryId = seq)

## 변경 요약

1) Stage3의 데이터 소스 우선순위
   - 1순위: REST 폴링 응답의 `worry.svgUrl`
   - 2순위: 기존 Stage3 fallback(Realtime 없이 Storage list -> 실패 시 테이블 최신 1개)

2) Stage3의 도착 문구 표시
   - `worry.worryId` 값을 그대로 `N번째` 문구로 출력

## 상세 변경(개념/모듈 단위)

### 1) Stage3 시작 + 모니터 상태 폴링

- Stage3 진입 시 한 번:

```ts
await fetch(`${GUM_SERVER_URL}/api/monitors/monitor-1/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
```

- 이후 1~2초 간격:

```ts
const res = await fetch(`${GUM_SERVER_URL}/api/monitors/monitor-1/current`);
const data = await res.json();
```

- 응답 처리:
  - `data.status === 'idle'` -> 대기/시작 화면(예약만 있어도 서버는 idle 응답)
  - `data.status === 'busy' && data.worry` ->
    - `arrivalText = `${data.worry.worryId}번째 고민이 도착했습니다``
    - `assignedSvgUrl = data.worry.svgUrl`
    - `assignedSvgUrl`로 SVG 렌더

### 2) 체험 완료 처리

- Stage3 흐름 종료 시점에 호출:

```ts
await fetch(`${GUM_SERVER_URL}/api/monitors/monitor-1/complete`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ worryId: currentWorryId }),
});
```

- 이후 폴링 루프에서 상태가 다시 `idle` 또는 다음 `busy`로 전환됨

### 3) 기존 Stage3 fallback 유지

- 기존 로직은 fallback으로 유지:
  - Realtime 없이 Storage list 우선
  - 실패 시 테이블 최신 1개
  - 필요 시 재로드/재낙하
