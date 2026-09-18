# 스픽코칭 배포·검증 결과 및 Vercel 설정

확인 시점: 2026-09-18 12시 전후 KST. 실제 확인과 미검증을 구분한 보고서입니다.

## 결론

최신 코드의 Render 배포를 완료했습니다. 새 Vercel 주소는 구버전이며 Gemini 키가 없습니다. 실제 AI 성공과 실제 기기의 화면·음성 검증이 남아 있어 최종 제출 검증 완료로 판정하지 않습니다.

| 구분 | 확인 결과 |
|---|---|
| 최신 앱 코드 | GitHub `CM-jccho/SubExit`, `deploy-render-20260917`, `155542bd32f99f0b9003ae31748009746e9e5cff` |
| Render 대표 주소 | https://speakcoaching.onrender.com/ — 위 커밋 live 확인 |
| Render 기존 주소 | https://ddeundeun-call-render.onrender.com/ — 같은 커밋 live 확인 |
| 새 Vercel 주소 | https://speakcoaching-one.vercel.app/ — HTTP 200이지만 문서 제목 ‘든든콜 · 대화 연습과 복기’ |
| Vercel API | `/api/coach` HTTP 200; available=false, voiceAvailable=false, configurationStatus=missing_key, model=gemini-2.5-flash, sampleOnly=true |
| GitHub main | `16c05385193052b809eda60b069f5730f1f240c1`. 최신 배포 브랜치보다 38커밋 뒤, 분기된 추가 커밋은 없음 |
| Vercel 배포 기록 | 위 main 커밋에 `Vercel – speakcoaching` 성공 상태. 대상 `https://vercel.com/platfos/speakcoaching/EHYctZ4xrCVS5JsX7fdTNL7jxVJ5` |
| 연결 계정 이메일 | 직접 조회 불가. 팀 이름 platfos만으로 jccho@platfos.com이라고 확정하지 않음 |

공개 페이지 제목과 GitHub 배포 기록은 새 주소가 최신 기능 분리 소스를 배포하지 않았다는 근거입니다. Vercel 관리 연결이 고장 나 도메인 설정과 프로젝트 설정을 직접 조회하지는 못했습니다.

## 완료된 검증

1. 자동 테스트 198개 통과, 실패·건너뜀 0. 프로덕션 빌드·타입 검사 성공. 코드 검증 시점 이후 앱 코드 변경 없이 동일 트리를 게시했습니다.
2. 즉시 도움의 직접 입력, 연습 목록과 분리, 동의 전 작성/전송 차단, 입력을 보존하는 목표 변경, 설정 조회 재시도, 마이크 거절, 화면 이탈 취소를 자동 테스트했습니다. 외부 AI·미디어·저장소 모의 구현을 포함하며 실제 모바일 E2E가 아닙니다.
3. Render 두 서비스 모두 최신 앱 커밋 live. 대표 주소가 제공하는 JS에 새 ‘다음 한마디 받기’ 동작이 포함됨을 확인했습니다. JS 문자열 확인은 클릭·화면 레이아웃 검증이 아닙니다.
4. 배포 후 대표 주소의 서버 검사 6개 통과: 설정 조회 200, 동의 없음 400, 빈 문장 400, 초과 길이 400, 잘못된 역할 대화 순서 400, 미확인 화자 복기 400.
5. 배포 직후 두 서비스의 error 수준 로그 조회에서 0건. 짧은 조회 구간 결과이며 모든 오류가 없다는 보장은 아닙니다.

## 실패·미검증

- 실제 친구 약속 코칭 요청: HTTP 429, `provider_rate_limit`, `quotaKind=daily`. 약 12.36초 후 오류 응답. 추가 역할 대화/후보/용어/복기 요청은 반복 한도 소모를 피하려고 실행하지 않았습니다.
- 서비스가 제시한 재시도 시각은 9월 18일 16:00 KST입니다. 이 시각 이후 실제 성공을 다시 확인해야 하며 자동 복구 보장이 아닙니다. 호스팅 변경 또는 같은 프로젝트의 다른 키 사용은 한도 해소로 검증되지 않았습니다.
- 배포 전 첫 설정 조회가 30초 시간 초과. 후속 잘못된 입력 검사 성공. 배포 후 설정 조회 성공에 약 16.31초가 걸렸습니다. 이 실행 환경의 네트워크 경유 시간이 포함돼 서버 자체 지연으로 단정할 수 없으나 속도 검증 통과도 아닙니다.
- 브라우저 제어는 CDP refresh 20초 시간 초과로 실패했습니다. 이번 배포 이후 PC 화면 조작·모바일 화면 캡처·iPhone 키보드·오디오·마이크 및 카카오 인앱의 실제 검증은 미완료입니다.
- 실제 음성 변환, 큰 파일 업로드, 용어 노트 저장 후 UI 재조회는 사람이 확인할 목록에 남겼습니다.

## Vercel에서 필요한 설정

현재 도메인을 새로 만들 필요는 없습니다. 최신 소스 선택과 환경 변수 등록이 필요합니다.

### 소스 선택

프로젝트의 저장소가 `CM-jccho/SubExit`인지 확인합니다. 최신 코드는 `deploy-render-20260917`에 있습니다.

기본 main을 변경하지 않는 방법: Project Settings → Environments → Production → Branch Tracking에서 `deploy-render-20260917`을 선택합니다. 설정 저장 후 최신 커밋으로 새 Production 배포를 생성하고 위 커밋이 포함됐는지 확인합니다. 예전 배포의 Redeploy만 누르면 예전 소스를 재사용할 수 있으므로 소스 커밋을 반드시 봅니다. [Vercel 공식 Git 배포 안내](https://vercel.com/docs/git)

대안은 main에 최신 38커밋을 반영하는 것입니다. 이 작업은 기본 브랜치와 연결된 운영 배포에 영향을 주므로 이번 자동 승인 검토에서 명시적 승인 부족으로 거절됐습니다. main은 변경하지 않았고 다른 경로로 우회하지 않았습니다. 이 대안을 진행하려면 main 변경 범위에 대한 사용자 승인이 필요합니다.

### Gemini와 런타임

Project Settings → Environment Variables에서 **Production** 환경에 등록합니다. Preview에서 실제 AI를 시험할 경우 해당 환경에도 별도로 적용합니다.

| 변수/설정 | 값 | 필요 여부·설명 |
|---|---|---|
| GEMINI_API_KEY | 본인의 유효한 Gemini API 키 | **필수, 현재 누락**. Secret으로 보관. 키를 채팅·문서·클라이언트 코드에 넣지 않기 |
| GEMINI_MODEL | gemini-2.5-flash | 생략 시 현재 코드 기본값. 모델을 바꾸면 응답 스키마·음성 경로 재검증 필요 |
| COACH_AI_ENABLED | true | 선택. 미설정도 활성 기본값이나 기존 false 값은 제거/수정 필요 |
| COACH_VOICE_ENABLED | true | 선택. 미설정도 활성 기본값. 실제 브라우저 마이크 지원은 별도 |
| GEMINI_DATA_MODE | free 또는 paid | 실제 Google 프로젝트의 과금·데이터 조건에 맞춤. 미설정은 free 조건. paid로 문자열만 바꿔도 결제 활성화나 한도 증가는 되지 않음 |
| Framework Preset | Next.js | Next.js 서버 기능 포함 배포 |
| Install / Build | npm ci / npm run build | 저장소 루트 기준. Node는 package.json 요구 >=20.9를 충족하는 Vercel 지원 버전 |

환경 변수 변경은 기존 배포에 소급 적용되지 않습니다. 등록 후 새 배포가 필요합니다. [Vercel 공식 환경 변수 안내](https://vercel.com/docs/environment-variables)

API 키 생성·관리 및 서버에서 비밀로 보관하는 원칙: [Google 공식 안내·일본어](https://ai.google.dev/gemini-api/docs/api-key?hl=ja).

설정 후 `/api/coach`의 available=true, voiceAvailable=true, configurationStatus=configured를 확인합니다. 이는 키의 존재·기능 스위치 확인이며 키 유효성·요금·잔여 쿼터 검증이 아닙니다. 실제 코칭 요청이 source=ai와 답변을 반환해야 AI 성공입니다.

현재 앱의 기록은 브라우저 저장소에 있으므로 기본 동작에 별도 DB 등록은 필요하지 않습니다. 새 Vercel 주소에서는 기존 Render의 저장 기록이 자동으로 보이지 않습니다. Google 프로젝트 한도는 Vercel 설정과 별도로 확인해야 합니다.

## 사람이 할 마지막 점검

[28개 시뮬레이션](human-final-check-2026-09-18.md)에 실제 입력값, 클릭 순서, 합격 기준, 기록 양식을 정리했습니다. 첫 방문 → 즉시 도움 → 연습 → 녹음/문자 → 용어/노트 흐름을 먼저 확인한 뒤 키보드·권한 거절·네트워크 실패·초안 보호를 점검합니다.

핵심 AI 응답, 실제 기기 입력·저장·재생, 제출 주소의 최신 버전이 모두 확인되기 전에는 ‘전체 기능 검증 완료’라고 제출하지 않습니다.
