# 든든콜 · 옆자리 대화 코치

부담스러운 대화에서 내가 직접 말할 다음 한 문장을 제안합니다.

**현재 상태:** 예선용 프로토타입. 코드 테스트·빌드 완료. 실제 Gemini 키, 음성 품질, 휴대폰 호환성, 새 화면 시각 QA는 미검증입니다. 기존 운영 사이트에 이 변경본이 배포된 상태가 아닙니다.

## 실행

Node.js 20.9 이상에서:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

- `/`: 지금 대화 중심 홈, 직접 연습, 내 기록
- `/?demo=1`: 3개 사전 작성 샘플 자동 시연 (개인 평가·XP 없음)
- `/?live=1`: 짧은 음성/텍스트 기반 AI 코칭
- `/evidence`: 구현 범위·데이터 처리 설명

API 키 없이 샘플과 직접 연습을 사용할 수 있습니다.

## Gemini 무료 API 연결

[Google AI Studio](https://aistudio.google.com/)에서 API 키를 발급받고 서버 환경변수에만 설정합니다. 키를 채팅·GitHub·브라우저에 붙여 넣지 마세요.

```dotenv
GEMINI_API_KEY=서버에만_설정
GEMINI_MODEL=gemini-2.5-flash
COACH_AI_ENABLED=true
COACH_VOICE_ENABLED=true
GEMINI_DATA_MODE=free
```

로컬은 `.env.local` 저장 후 재시작, Vercel은 프로젝트 환경변수의 Preview 대상에 설정 후 재배포합니다. 모델 접근 여부·할당량은 해당 AI Studio 계정에서 확인해야 합니다. 무료 모델의 한도와 정책은 변할 수 있습니다.

무료 모드는 **만 18세 이상, 개인정보·기밀 없는 자작·샘플 대화**에만 사용합니다. Google 무료 API 입력·출력은 제품 개선과 검토에 이용될 수 있습니다. `GEMINI_DATA_MODE=paid`는 화면 안내와 서버 확인 조건을 바꾸는 값으로, 실제 Google 과금 등급을 변경하지 않습니다. 실제 대화 적용 전 계정의 데이터 처리 조건과 참여자 동의를 확인하세요.

## 실제 동작

1. 상황과 말투 선택, 전송 안내 확인.
2. 상대 말 최대 8초 입력. 사용자가 먼저 멈출 수도 있음.
3. 원음을 Gemini에 전송해 글로 변환. 이때 마이크는 꺼짐.
4. 상대 말만 남겼는지 확인 후 코칭 요청. 선택적으로 자동 요청 가능.
5. 제안 한 문장과 실제 인용 근거, 모델, 코칭 처리 시간 표시.

대면 또는 **다른 기기의 스피커폰 옆**에서 사용합니다. 같은 휴대폰의 전화 음성을 직접 가져오지 않으며, 상시 스트리밍이나 화자 분리는 지원하지 않습니다. API 처리 동안 대화 입력이 없으므로 '끊김 없는 실시간'이라고 홍보하지 않습니다.

직접 연습은 답변 → 자기 점검 → 고쳐 쓰기 → 복기 구조입니다. 완료 10 XP, 다른 문장으로 수정 5 XP이며 같은 현지 날짜/구간/종류에 한 번만 지급합니다. XP는 참여 기록입니다. 대화 원문은 localStorage에 저장하지 않습니다.

## 검증 및 문서

```bash
npm test
npm run typecheck
npm run build
```

`lint` 스크립트는 타입 검사 별칭이며 별도의 ESLint 검증이 아닙니다.

- [전체 제품 검토](docs/submission/01-product-review.md)
- [제출 문안](docs/submission/02-submission.md)
- [90초 시연 대본](docs/submission/03-demo-script.md)
- [검증 결과와 남은 항목](docs/submission/04-validation.md)
- [Gemini 무료 API 운영안](docs/submission/05-gemini.md)
- [PR 설명 초안](docs/submission/06-pr-description.md)

## 호환성과 운영 범위

main `8e8ca4b` (#23)의 직접 진입 의도를 유지하며 홈 구현을 교체했습니다. 기존 `UploadForm` 등은 비교용으로 남겨두었지만 새 루트에서는 사용하지 않습니다. `/api/analyze-call`은 실제 파일 분석 대신 501을 반환하고 명시적인 샘플 안내만 지원합니다. 이전 분석 응답 계약은 호환하지 않습니다. `/api/analyze`는 구독 화면 분석의 기존 코드이며 새 코칭 경로에서 호출하지 않습니다.

음성·코칭 API는 Gemini만 호출합니다. 실패 시 다른 유료 제공사로 전환하지 않습니다. 서버 요청은 크기 제한, 시간 제한, 원문 인용 검증을 적용합니다. 요청 제한은 인스턴스별 IP당 분당 12회이며 분산 배포 전체의 한도를 보장하지 않습니다. 공개 트래픽 전에는 중앙 제한/일별 예산 관리가 필요합니다.
