
# 2026 글로벌미디어학부 졸업전시회 팀 다인이네 서버 레포

## 📋 프로젝트 개요

졸업전시 "껌딱지월드"의 백엔드 서버

* **역할** : 모니터 할당 및 상태 관리
* **기술** : Node.js + Express (REST API)
* **배포** : Railway
* **DB** : Supabase (PostgreSQL)

---

## 🚀 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. Supabase 설정

Supabase 데이터베이스 설정이 필요합니다.

👉 **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** 파일을 참고하여 설정하세요.

주요 단계:

1. Supabase 프로젝트 생성
2. `worries` 테이블 생성
3. `worry-images` Storage 버킷 생성
4. API 키 확인

### 3. 환경변수 설정

`.env` 파일을 생성하고 Supabase 정보를 입력:

```bash
# .env
PORT=3000
NODE_ENV=development

# Supabase (https://supabase.com에서 확인)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# (권장) 서버 전용 키 — RLS(Row Level Security) 정책에 막히지 않게 서버에서만 사용
# 주의: 절대 프론트엔드에 노출 금지
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. 서버 실행

```bash
# 개발 모드 (nodemon - 자동 재시작)
npm run dev

# 프로덕션 모드
npm start
```

서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

### 5. 테스트 실행

```bash
# 단위/통합 테스트 실행
npm test

# 테스트 watch 모드
npm run test:watch

# 커버리지 리포트
npm run test:coverage
```

### 6. 실제 서버 테스트 (더미 데이터)

실제 서버를 실행하고 더미 데이터로 테스트할 수 있습니다.

**터미널 1 - 서버 실행:**

```bash
npm run dev
```

**터미널 2 - 테스트 클라이언트:**

```bash
# REST 시나리오 스크립트 (서버 실행 후)
npm run test:client

# REST 헬스/상태만 빠르게
npm run test:api
```

자세한 내용은 👉 **[TESTING.md](./TESTING.md)** 참고

---

## 📁 프로젝트 구조

```
server/
├── .env                      # 환경변수 (git 제외)
├── .env.template             # 환경변수 템플릿
├── .gitignore
├── package.json
├── jest.config.js            # Jest 설정
├── README.md                 # 이 파일
├── SUPABASE_SETUP.md         # Supabase 설정 가이드
├── API.md                    # API 명세서
├── server.js                 # 메인 진입점
├── src/
│   ├── config/
│   │   └── supabase.js       # Supabase 클라이언트 설정
│   ├── managers/
│   │   ├── MonitorManager.js # 모니터 상태 관리
│   │   ├── QueueManager.js   # 대기열 관리
│   │   └── __tests__/        # 단위 테스트
│   │       ├── MonitorManager.test.js
│   │       └── QueueManager.test.js
│   └── utils/
│       ├── logger.js         # 로깅 유틸
│       └── constants.js      # 상수 정의
└── __tests__/
    └── integration.test.js   # 통합 테스트
```

---

## 🔌 API 문서

### REST API (요약)

- `GET /health`, `GET /ping`, `GET /status`
- `POST /api/request-monitor` — 태블릿 모니터 요청(예약). 선택 필드 `monitorId`(UUID 또는 monitor-1/2)로 특정 키오스크 슬롯에 예약 가능
- `POST /api/monitors/:monitorId/start` — Stage3 시작 → busy
- `GET /api/monitors/:monitorId/current` — 모니터 폴링
- `POST /api/monitors/:monitorId/complete` — Stage6 종료 → idle
- `GET /api/queue/position?clientId=...` — 대기 순번
- `POST /api/votes` — 투표 등록 + 반영된 누적 집계 반환
- `GET /api/votes/results` — 현재 투표 누적 집계 조회

자세한 명세는 👉 **[API.md](./API.md)**

---

## 🧪 테스트

### 단위 테스트

- **MonitorManager**: 모니터 상태 관리 테스트
- **QueueManager**: 대기열 관리 테스트

### 통합 테스트

- REST 엔드포인트(supertest): 할당, start, 폴링, complete, 대기열

### 테스트 커버리지

```bash
npm run test:coverage
```

---

## 🌐 배포

### Railway 배포

1. [Railway](https://railway.app) 계정 생성
2. GitHub 레포지토리 연결
3. 환경변수 설정:
   ```
   PORT=3000
   NODE_ENV=production
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=your-key-here
   ```
4. 자동 배포 완료

### 배포 URL

프로덕션: `https://ggumddi-server.up.railway.app`

---

## 🔧 개발

### 로컬 테스트

```bash
npm run dev
# 다른 터미널
npm run test:client
```

### 로그 확인

서버 실행 시 콘솔에서 모니터 할당·해제, 대기열, 요청 로그를 확인할 수 있습니다.

---

## 📚 추가 문서

- **[기능명세서.md](./기능명세서.md)** - 전체 기능 명세 및 구현 가이드
- **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** - Supabase 설정 단계별 가이드
- **[API.md](./API.md)** - REST API 상세 명세
- **[docs/RENDER_DEPLOY.md](./docs/RENDER_DEPLOY.md)** - Render 배포, `/health`·`/ping`, GitHub 워크플로 요약
- **[docs/GITHUB_ACTIONS_SETUP.md](./docs/GITHUB_ACTIONS_SETUP.md)** - Actions 시크릿, ping·헬스·Discord 설정 전체
- **[docs/POSTMAN_GUIDE.md](./docs/POSTMAN_GUIDE.md)** - Postman으로 REST API 단계별 테스트
- **[docs/MONITOR_USER_FLOW.md](./docs/MONITOR_USER_FLOW.md)** - 사용자·태블릿·모니터·서버 흐름 요약
- **Postman 파일**: [`postman/gum_server.postman_collection.json`](./postman/gum_server.postman_collection.json), [`postman/gum_server.postman_environment.json`](./postman/gum_server.postman_environment.json)

---

## ⚠️ 주의사항

### CORS 설정

현재 CORS는 임시로 **모든 도메인(`*`)**을 허용하고 있습니다.

**프론트엔드 개발 완료 후 반드시 특정 도메인으로 제한하세요:**

```javascript
// server.js
app.use(cors({
  origin: 'https://ggumddi.vercel.app',  // 실제 프론트 도메인
  credentials: true
}));
```

### 환경변수 보안

- `.env` 파일은 **절대 Git에 커밋하지 마세요**
- Railway 배포 시 환경변수는 대시보드에서 직접 설정
- Supabase 키는 안전하게 보관

## 📞 문의

문제가 발생하거나 질문이 있으면 이슈를 등록해주세요.

**마지막 업데이트**: 2025-12-29
