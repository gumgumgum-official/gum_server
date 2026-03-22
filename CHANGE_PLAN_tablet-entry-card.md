# tablet-entry-card 변경사항 (REST 기반 모니터 배정 요청)

이 문서는 `gumgumgum-official/tablet-entry-card` 레포에서, Edge Function 제출 이후 `gum_server`를 **REST API로 호출**하도록 바꾸는 변경사항을 정리합니다.

## 현재 흐름(확인됨)

- 태블릿은 strokes(SubmitPoint[][])를 **Edge Function(`handwriting-to-svg`)에 HTTP POST**로 제출
- Edge Function은:
  - Storage에 `${sessionId}/${idempotencyKey}.svg` 업로드
  - Realtime broadcast(`new_handwriting`) 전송
  - `strokes` 테이블에 기록(insert)
- 프론트 응답 타입(기존):
  - `SubmitResponse { id, storagePathSvg, broadcasted }`

## 목표

- “N번째 고민”의 N을 안정적으로 생성
- 제출 성공 직후, 태블릿이 `gum_server`에 **REST `POST /api/request-monitor`**를 호출해 모니터 배정을 요청

## 변경 요약

1) `strokes` 테이블에 순번 컬럼 추가: `seq BIGINT IDENTITY UNIQUE`  
2) Edge Function이 `seq`를 응답에 포함  
3) 태블릿은 제출 성공 후:
   - `${seq}번째 고민이 추가되었습니다` 표시
   - `POST /api/request-monitor` 호출로 배정 요청

## 상세 변경 (파일 단위)

### 1) Supabase DB 스키마/마이그레이션

- 대상: `strokes`
- 변경:
  - `seq BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE`
  - 필요 시 `idempotencyKey` 조회 인덱스 보강

### 2) Edge Function (`supabase/functions/handwriting-to-svg/index.ts`)

- 정상 insert 경로에서 `seq` 확보:
  - `.insert(...).select('seq').single()` 형태로 반환값 사용
- idempotency 경로에서도 기존 row를 조회해 같은 `seq` 반환
- 응답 확장:
  - 기존: `{ id, storagePathSvg, broadcasted }`
  - 변경: `{ id, storagePathSvg, broadcasted, seq }`
- broadcast payload도 `seq` 포함 가능:
  - `{ id, seq, storagePathSvg, createdAt, clientId }`

### 3) 프론트 타입 (`src/lib/submit/types.ts`)

- `SubmitResponse`에 `seq: number` 추가

### 4) 제출 성공 후 동작 (`EntryCardCanvas` / `WorrySection`)

제출 성공(`submitStrokes().success === true`) 시:

- UI 문구:
  - `${seq}번째 고민이 추가되었습니다`
- 이어서 gum_server REST 호출:

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

- 응답 처리:
  - `assigned: true` -> “왼쪽/오른쪽 모니터로 가세요”
  - `assigned: false` -> “N번째로 대기 중입니다”

## 기대 결과

- 태블릿/모니터가 동일한 `seq` 번호를 문구에 사용
- 태블릿은 모니터 배정을 **`POST /api/request-monitor`** REST 호출만으로 처리 (`gum_server`는 Socket.io 미사용)

