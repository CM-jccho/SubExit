# 든든콜 · 대화 연습과 근거를 확인하는 복기

**대화 연습 → 실제 발화를 근거로 복기 → 같은 장면 다시 연습**이 핵심 흐름입니다.

운영 주소: https://ddeundeun-call-render.onrender.com/

관심 상황을 고르면 홈에는 추천 장면 하나와 ‘내 상황 만들기’가 표시됩니다. 전체 상황은 별도 목록에서 봅니다. 상대·목표·지킬 선을 담은 카드로 AI 역할 상대와 연습하며, 후보 선택 또는 음성·문자 입력을 이용합니다. 메시지 답장, 외부 녹음 분석, 용어 노트, 기초 훈련, 일상 대화, AI 요청 연습을 지원합니다.

카드와 관심 설정은 localStorage, 저장한 대화·음성 원본·용어·답장 등은 IndexedDB를 사용합니다. 모두 해당 주소의 브라우저 안에 저장되며 계정·기기·호스팅 주소 간 자동 이전은 없습니다. 카드 설정 대화 전문은 저장하지 않습니다. 기능별 내려받기를 지원하지만 전체 일괄 백업·복원은 지원하지 않습니다.

API 키 없이도 샘플·수동 작성·일부 훈련을 이용할 수 있습니다. 실제 AI 처리와 사전 작성 예시는 구분합니다. 키가 설정돼도 할당량이나 응답 검증 오류로 AI 요청이 실패할 수 있습니다.

- [최신 전체 적용 점검](docs/validation/full-request-audit-2026-09-17.md)
- [Render 배포 및 이전 안내](docs/deployment/render-migration.md)
- [현재 제출 문안](docs/submission/08-final-submission.md)

## 실행

Node.js 20.9 이상에서:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

- `/`: 관심 상황 선택 → 추천 장면 → 대화 연습
- `/?demo=1`: 카드 맥락과 코칭 문장의 관계를 보여주는 샘플
- `/?live=1`: 코칭에 사용할 카드 선택부터 시작
- `/evidence`: 구현 범위·데이터 처리 설명

API 키 없이 샘플과 직접 연습을 사용할 수 있습니다.

## Gemini 무료 API 연결

[Google AI Studio](https://aistudio.google.com/)에서 API 키를 발급받고 서버 환경변수에만 설정합니다. 키를 채팅·GitHub·브라우저에 붙여 넣지 마세요.

최소 설정은 Production의 비밀 환경변수 `GEMINI_API_KEY` 하나입니다. 키가 있으면 카드 정리·코칭·짧은 음성을 활성화합니다. 아래 나머지 값은 선택 설정이며, 기존 `COACH_AI_ENABLED=false` 또는 `COACH_VOICE_ENABLED=false`가 있으면 해당 비활성화 설정을 존중합니다. 사용자의 전송 확인 조건은 계속 적용됩니다.

```dotenv
GEMINI_API_KEY=서버에만_설정
GEMINI_MODEL=gemini-2.5-flash
COACH_AI_ENABLED=true
COACH_VOICE_ENABLED=true
GEMINI_DATA_MODE=free
```

로컬은 `.env.local` 저장 후 재시작하고, Render는 서비스의 Environment에서 키를 설정한 뒤 재배포합니다. 기존 Vercel 환경변수는 Render로 자동 복사되지 않습니다. 모델 접근 여부·할당량은 해당 AI Studio 계정에서 확인해야 합니다. 무료 모델의 한도와 정책은 변할 수 있습니다.

`GET /api/coach`의 `configurationStatus`로 설정 상태만 확인할 수 있습니다. `missing_key`는 해당 배포에 키 없음, `disabled`는 키가 있지만 AI 비활성화, `configured`는 설정 완료입니다. 키 값은 반환하지 않습니다. `configured`만으로 유효한 키·할당량·AI 응답이 검증된 것은 아니며, 실제 자작 샘플 요청으로 확인해야 합니다.

무료 모드는 **만 18세 이상, 개인정보·기밀 없는 자작·샘플 대화**에만 사용합니다. Google 무료 API 입력·출력은 제품 개선과 검토에 이용될 수 있습니다. `GEMINI_DATA_MODE=paid`는 화면 안내와 서버 확인 조건을 바꾸는 값으로, 실제 Google 과금 등급을 변경하지 않습니다. 실제 대화 적용 전 계정의 데이터 처리 조건과 참여자 동의를 확인하세요.

## 카드 선택 후 코칭 동작

1. 저장한 카드의 목표와 말투, 전송 안내 확인.
2. 상대 말 최대 8초 입력. 사용자가 먼저 멈출 수도 있음.
3. 원음을 Gemini에 전송해 글로 변환. 이때 마이크는 꺼짐.
4. 상대 말만 남겼는지 확인 후 코칭 요청. 선택적으로 자동 요청 가능.
5. 제안 한 문장과 실제 인용 근거, 모델, 코칭 처리 시간 표시.

대면 또는 **다른 기기의 스피커폰 옆**에서 사용합니다. 같은 휴대폰의 전화 음성을 직접 가져오지 않으며, 상시 스트리밍이나 화자 분리는 지원하지 않습니다. API 처리 동안 대화 입력이 없으므로 '끊김 없는 실시간'이라고 홍보하지 않습니다.

주요 연습 화면의 보상은 직접 답하기 → 고쳐 쓰기 → 같은 장면 재연습에 따른 꾸미기 티켓·장면 스탬프·기념품입니다. 반복 저장·샘플 열람으로 보상을 중복 지급하지 않습니다. 이전 `/practice`의 XP는 별도 레거시 화면이며 현재 핵심 보상 체계를 설명하지 않습니다.

## 검증 및 문서

```bash
npm test
npm run typecheck
npm run build
```

`lint` 스크립트는 타입 검사 별칭이며 별도의 ESLint 검증이 아닙니다.

- [전체 제품 검토](docs/submission/01-product-review.md)
- [최신 제출 문안](docs/submission/08-final-submission.md)
- [60초 시연 대본](docs/submission/03-demo-script.md)
- [최신 검증 결과와 남은 항목](docs/validation/full-request-audit-2026-09-17.md)
- [Gemini 무료 API 운영안](docs/submission/05-gemini.md)
- [PR 설명 초안](docs/submission/06-pr-description.md)

## 호환성과 운영 범위

기존 `UploadForm` 등은 비교용으로 남겨두었지만 새 루트에서는 사용하지 않습니다. `/api/analyze-call`은 실제 파일 분석 대신 501을 반환하고 명시적인 샘플 안내만 지원합니다. 현재 외부 녹음 분석은 `/api/transcribe`와 `/api/recording-review`를 사용하며 2분·2.4MB 이하의 파일, 문자 수정, 화자 확인을 거칩니다. 이전 분석 응답 계약과 다릅니다. `/api/analyze`는 구독 화면 분석의 기존 코드이며 새 코칭 경로에서 호출하지 않습니다.

음성·코칭 API는 Gemini만 호출합니다. 실패 시 다른 유료 제공사로 전환하지 않습니다. 서버 요청은 크기 제한, 시간 제한, 원문 인용 검증을 적용합니다. 요청 제한은 인스턴스별 IP당 분당 12회이며 분산 배포 전체의 한도를 보장하지 않습니다. 공개 트래픽 전에는 중앙 제한/일별 예산 관리가 필요합니다.
