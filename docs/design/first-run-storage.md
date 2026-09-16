# 첫 실행 가이드와 데이터 보관 검토

## 현재 저장 범위

- 대화 카드: 기존 localStorage 키 `ddeundeun-conversation-cards-v1`. 새로고침·탭 종료 후 동일 출처/브라우저에서 재사용.
- 저장한 음성 원본, 전사문, 연습 대화, 용어·메모: 기존 IndexedDB `ddeundeun-voice-notebook-v1`. DB 버전 2에서 초기화 메타 저장소만 추가. 기존 두 저장소와 Blob 유지.
- 카드 만들기의 미저장 입력과 실시간 코칭 결과는 임시 상태. 음성 기록에서는 저장, 연습에서는 사용자 발화 저장 후 AI 요청.
- 계정 기반 서버 보관/기기 간 동기화는 없음. 시크릿 모드 종료, 사이트 데이터 삭제, 브라우저 공간 정리로 소실 가능. 출처가 다른 운영 주소/미리보기 주소끼리 기록이 공유되지 않음.
- 보관 보호 요청은 `navigator.storage.persist()` 결과를 그대로 표시. 거절·미지원·오류를 성공으로 표시하지 않음. 직접 데이터 삭제와 클라우드 백업을 대신하지 않음.
- 카드 JSON, 개별 음성 원본·대화 텍스트, 용어 JSON/가이드 다운로드를 구분. 카드 다운로드를 전체 데이터 백업으로 안내하지 않음.

## 샘플 정책

- 고정 ID의 카드 2개, 텍스트 대화 1개, 용어 3개. 가상/사전 작성 샘플로 표시. 음성 원본이 있다고 표시하지 않음. 기기의 읽어주기는 사용 가능.
- 최초 한 번만 추가. 카드 초기화 표식을 카드 envelope에 함께 기록. 음성/용어 표식은 데이터와 같은 IDB transaction에서 커밋.
- 기존 개인 기록을 유지. 카드 100개일 때 샘플 때문에 기록을 제거하지 않음.
- 수정한 샘플 유지. 삭제한 샘플은 새로고침이나 다음 방문에 부활하지 않음.
- ‘샘플 다시 넣기’만 누락된 ID를 추가. 기존 샘플·개인 기록을 덮어쓰지 않음.
- 내 기록 수에서 샘플 제외. 샘플 카드를 복사하거나 샘플 대화에서 새 연습 시작 시 별도 개인 기록 생성.
- 카드 원본이 파손됐거나 알 수 없는 버전이면 덮어쓰지 않고 오류를 표시.

## 화면 안내

- 첫 실행/`?tour=1`/상단 도움말: 실제 카드 → 실제 목표 → 연습 버튼 → 연습 시작 위치를 비추는 4단계.
- 어두운 배경, 대상 영역 테두리, 스케치 화살표, 한글 손글씨, 곁이.
- 강조한 버튼과 안내의 다음 버튼 모두 실제 화면으로 이동. AI 호출이나 동의 체크 자동 실행 없음.
- 이전, 건너뛰기, Escape, 완료 후 재방문 시 숨김. 삭제한 모든 샘플을 다시 보기 가이드가 영구 저장하지 않음.
- viewport/scroll/요소 크기 변화 시 위치 갱신. 네이티브 dialog 포커스 제한 및 닫힌 뒤 복원.
- 손글씨는 Nanum Pen Script의 제목 글자만 포함한 OFL 서브셋. 수정 이름 Ddeundeun Guide Pen. 원 라이선스 `public/licenses/nanum-pen-OFL.txt` 포함.

## 검증

- 데이터 보존/삭제 후 재생성 방지/명시 복원/동시 초기화/기존 DB v1 음성 Blob 유지/파손 데이터 보존/100개 상한/쓰기 실패 후 재시도 테스트.
- 실제 앱 컴포넌트에서 첫 진입 가이드 전체 이동, API 자동 요청 없음, 완료 후 재방문 숨김, 도움말 재실행, 취소 테스트.
- 기존 음성·연습·API 테스트를 포함해 43개 테스트 통과. Next.js 프로덕션 빌드 통과.
- 실제 운영 화면 검증은 배포 후 기록.

## 참고

- [MDN: Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [MDN 日本語: StorageManager.persist()](https://developer.mozilla.org/ja/docs/Web/API/StorageManager/persist)
- [Google Fonts: Nanum Pen Script](https://github.com/google/fonts/tree/main/ofl/nanumpenscript)
