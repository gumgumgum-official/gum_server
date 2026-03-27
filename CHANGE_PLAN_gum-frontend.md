# gum-frontend 변경사항 (모니터 · gum_server REST)

이 문서는 `gumgumgum-official/gum-frontend` 레포에서 **모니터 쪽**이 `gum_server`와 맞춰야 하는 동작을 정리합니다. (서버는 Socket.io 없음.)

> 레포 구조·라우트는 [gum-frontend](https://github.com/gumgumgum-official/gum-frontend) README 기준.  
> **Stage3·Stage6** 같은 이름은 **프론트 화면 단계**일 뿐, 서버는 `start` / `complete` 호출만 알면 됩니다.  
> 흐름 요약: [docs/MONITOR_USER_FLOW.md](./docs/MONITOR_USER_FLOW.md) (다른 레포에서 볼 때는 gum_server의 동일 경로 파일)

## 목표

- Stage2(빔): 기존 유지 (Storage·Realtime 등)
- **모니터 라우트**: gum_server만으로 할당·표시·complete
  - 태블릿이 이미 `request-monitor`로 **모니터를 예약**해 둠 → 서버는 **모니터별로 슬롯 점유**(다른 고민 동시 할당 불가)
  - 모니터는 **체험을 실제로 시작할 때** `POST /api/monitors/:id/start` → 그때부터 `GET .../current`가 `busy` + `worry`
  - 체험 종료·시작 화면 복귀 시 `POST .../complete` → 다음 대기자는 서버에 **예약만** 붙음 → **다시 `start`** 할 때까지 폴링은 `idle`
- 문구: `${worryId}번째 고민이 도착했습니다` (`worryId` = `seq` 문자열)

## 변경 요약

1. **데이터 소스 (모니터)**  
   - 1순위: `GET .../current` 폴링에서 `status === 'busy'`일 때 `worry.svgUrl`  
   - 2순위: 기존 fallback(Storage list 등) — 필요 시만

2. **호출 순서 (모니터)**  
   1. 체험 시작 직전(프론트가 정한 타이밍)에 **`POST .../start`**  
   2. 1~2초 간격 **`GET .../current`** — `busy` + `worry`면 SVG·문구 표시  
   3. 체험 끝·시작 화면으로 돌아올 때 **`POST .../complete`**

3. **폴링에서 `idle`인 경우**  
   - 예약만 있고 아직 `start` 안 했으면 서버는 **`idle`**만 줌 → 시작 화면 유지  
   - `complete` 직후 다음 사람 예약만 있으면 역시 **`idle`** → 다시 `start` 전까지 대기

## 코드 스케치

### `start` + 폴링

```ts
await fetch(`${GUM_SERVER_URL}/api/monitors/${monitorId}/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});

const res = await fetch(`${GUM_SERVER_URL}/api/monitors/${monitorId}/current`);
const data = await res.json();
// data.status === 'busy' && data.worry → svgUrl, worryId
```

### `complete`

```ts
await fetch(`${GUM_SERVER_URL}/api/monitors/${monitorId}/complete`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
```

- 다음 세션도 **다시 `start` → 폴링 → `complete`**

## Fallback

- Realtime/Storage fallback은 **보조**로만 두고, 정상 경로는 **gum_server 폴링 + `start`/`complete`** 와 일치시키는 것이 좋음
