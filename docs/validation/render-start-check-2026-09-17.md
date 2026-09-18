# Render 실행 명령 로컬 확인

2026-09-17. 기존 검증된 production build를 사용한 Node 서버 HTTP 점검.

- GET /api/coach: 200, missing_key, no external AI request
- GET /: 200
- POST /api/coach sample: 200, nonempty sample suggestion
- POST /api/coach malformed JSON: 400

실제 Render 배포·Gemini 키·브라우저 UI·마이크는 이 점검 범위에 포함되지 않습니다.
