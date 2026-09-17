# 스픽코칭 이름 및 주소 전환 검토

## 변경 범위

화면 헤더·푸터·브라우저 제목·로딩·서비스 안내·복기 내려받기 제목·용어 파일 오류 안내를 스픽코칭으로 통일했습니다. 현재 IA와 제출 문안도 갱신했습니다. 소개는 “대화 중 다음 한마디”를 중심으로 실전 도움, 평소 연습, 녹음 분석·코칭의 세 가지를 유지합니다.

내부 패키지명, Render 서비스명, 데이터베이스 이름·저장 키·내보내기 형식은 변경하지 않았습니다. 같은 주소에서 기존 데이터를 계속 읽을 수 있습니다. 과거 검증 문서는 당시 이름을 유지합니다.

## 주소와 배포 상태

새 주소 https://speakcoaching.onrender.com 을 무료 웹 서비스로 생성했습니다. 기존 주소 https://ddeundeun-call-render.onrender.com/ 는 유지합니다. 두 서비스 모두 deploy-render-20260917 브랜치, 수동 배포입니다. render.yaml은 기존 서비스 설정이므로 새 서비스의 설정 변경에는 대시보드를 사용합니다. 새 서비스에는 GEMINI_API_KEY가 자동 복사되지 않습니다.

보유 도메인은 기존 서비스에 연결할 수 있고 기존 onrender 주소도 유지할 수 있습니다. Render 공식 안내: https://render.com/docs/custom-domains

주소가 달라지면 localStorage와 IndexedDB 기록은 자동 이동하지 않습니다. 현재 전체 기록 일괄 백업·복원은 제공하지 않습니다. 전환 시 이전 주소를 유지해 기존 기록을 열 수 있도록 하고, 새 주소로의 강제 리다이렉트는 걸지 않습니다.

사용자가 J.C's workspace를 확인해 해당 작업 공간에 배포했습니다. 소스 커밋은 e217a3c입니다. 기존 서비스 srv-dalmde65vjqs73ftpgog 배포 dep-dalp7h65vjqs738701ug는 live입니다. 새 서비스는 srv-dalp7re5vjqs73870v20, 배포는 dep-dalp7ru5vjqs738710b0입니다.

새 서비스 환경변수 등록: https://dashboard.render.com/web/srv-dalp7re5vjqs73870v20/env 에서 GEMINI_API_KEY를 비밀 값으로 등록하고 재배포합니다. 키를 GitHub나 채팅에 남기지 않습니다. 새 서비스는 무료 플랜입니다.

## 검증

새 이름을 사용하는 홈 복귀·온보딩을 포함한 기존 UI 테스트 70개 통과, 프로덕션 빌드·타입 검사 통과, git diff 공백 검사 통과. 테스트는 JSDOM 및 대역 기반이며 실제 모바일 렌더링·마이크·운영 배포 검증을 대체하지 않습니다.

## 운영 확인 결과

2026-09-17 07:19 UTC 확인: 두 배포 모두 live. 두 주소의 홈에서 HTTP 200과 “스픽코칭 · 대화 중 다음 한마디” 제목을 확인했습니다. 새 주소의 /evidence도 HTTP 200입니다. 새 /api/coach는 HTTP 200, configurationStatus=missing_key, available=false이며 기존 주소는 configured, available=true입니다. 설정 상태 확인이며 실제 Gemini 응답 성공을 의미하지 않습니다. 배포 시작 이후 조회한 오류 수준 로그는 0건입니다.
