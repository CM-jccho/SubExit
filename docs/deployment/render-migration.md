# 든든콜 Render 이전 안내

2026-09-17. 이전 준비본이며 Render 계정 생성·연결 및 실제 배포는 별도 확인이 필요합니다.

## 배포 대상

`deploy-render-20260917` 브랜치는 PR #58의 최신 수정본(45fc3fd: 답장 복사·저장 피드백, 입력 팝업, 화면 이동 보호)에 Render 설정을 추가한 버전입니다. main의 이전 UI를 배포하지 않도록 브랜치를 확인하세요.

[Render에서 배포 설정 열기](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2FCM-jccho%2FSubExit%2Ftree%2Fdeploy-render-20260917)

1. Render에 로그인하고 필요한 경우 GitHub의 `CM-jccho/SubExit` 접근을 허용합니다.
2. 설정이 Node Web Service, Singapore, Free인지 확인합니다. Static Site는 서버 API가 작동하지 않습니다.
3. 비밀값 입력란 `GEMINI_API_KEY`에 키를 등록합니다. 키를 채팅이나 GitHub에 올리지 마세요. Vercel의 키는 자동 복사되지 않습니다.
4. Blueprint를 배포하고 Live 상태와 Render가 발급한 실제 HTTPS 주소를 확인합니다.
5. 아래 확인을 마친 뒤 해커톤 서비스 링크를 새 주소로 수정합니다. 기존 Vercel 프로젝트와 개인 기록은 삭제하지 않습니다.

## 실행 설정

- Node 24.19.0: 로컬 검증 환경과 동일한 버전.
- 빌드: `npm ci --include=dev && npm run build`
- 시작: `npm run start -- --hostname 0.0.0.0 --port $PORT`
- 상태 점검: `GET /api/coach`. 모델 호출 없이 서버의 설정 상태만 반환합니다. HTTP 200이 실제 Gemini 응답 성공을 의미하지 않습니다.
- 자동 배포: off. 이후 변경은 Render의 수동 배포로 적용합니다.
- 샘플 모드: `GEMINI_DATA_MODE=free`. 실제 결제 상태를 바꾸는 옵션이 아닙니다.

## 기존 개인 기록

이 앱의 개인 기록은 주소별 브라우저 저장소에 있습니다. 새 Render 주소에서는 기존 Vercel 주소의 카드·녹음·대화 기록이 자동으로 보이지 않습니다. 기존 Vercel 주소를 보존합니다.

기존 화면의 대화 카드 JSON 내려받기는 카드 설정만 포함합니다. 각 대화의 ‘대화 문자 내려받기’는 텍스트 Markdown이며 음성 파일을 포함하지 않습니다. 용어 노트의 JSON 내보내기는 선택한 용어를 내보내며 대화 인용과 연결 정보를 제거합니다. 이 내보내기들은 전체 데이터의 자동 이전이나 완전한 백업을 뜻하지 않습니다. 전체 기록·음성·설정의 일괄 이전은 이번 호스팅 설정에 포함되지 않습니다.

## 배포 후 확인

- 새 주소에서 홈, 내 대화, 용어 노트가 열리는지 확인.
- `/api/coach`의 configurationStatus가 configured인지 확인. 키 값은 응답에 포함되지 않아야 합니다.
- 가상의 대화로 실제 Gemini 응답 확인. AI 한도는 호스팅 이전으로 초기화되지 않습니다.
- 사전 작성 샘플 코칭, 메시지 답장, 저장 후 새로고침, 복사 성공·실패 안내 확인.
- 휴대폰 HTTPS에서 마이크 권한, 녹음 시작·중지·재생, 문자 변환 확인.
- 입력 팝업 열기·닫기, 키보드 표시, 미저장 이동 보호, 화면 깜빡임 확인.
- 배포 후 오류 로그와 메모리 사용량 확인. 로컬 성공은 Render의 자원 제한에서 성공을 보장하지 않습니다.

## 요금제 및 미완료 항목

Free는 15분 동안 요청이 없으면 잠들고 다시 켜지는 데 약 1분이 걸릴 수 있습니다. 월 사용 시간·빌드·트래픽 제한도 있습니다. 심사 기간에 즉시 접속이 중요하다면 결제 조건을 확인한 뒤 상시 실행 요금제를 선택해야 합니다. 이 설정은 유료 플랜을 자동 구매하지 않습니다.

실제 Render 배포, 새 주소의 Gemini 응답, 모바일 브라우저·실제 마이크 검증은 아직 완료되지 않았습니다. 기존 브라우저 검증은 자동 승인 검토 사용량 제한으로 실행되지 못했으며, 다른 브라우저 경로로 우회하지 않았습니다.

공식 근거: [Next.js 배포](https://render.com/docs/deploy-nextjs-app), [Blueprint](https://render.com/docs/blueprint-spec), [Deploy 버튼](https://render.com/docs/deploy-to-render), [Free 제한](https://render.com/docs/free), [Node 버전](https://render.com/docs/node-version).
