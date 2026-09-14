# SideCue

> 후원·구독 해지 커뮤니케이션 코치 — Wanted AI Championship 2026 Hackathon Project

**SideCue**는 구독 관리 화면 스크린샷 또는 서비스명을 입력하면 AI가 결제 채널을 추정하고, 해지 경로를 단계별로 안내하며, 해지 대화 연습 멘트와 주의사항을 알려주는 서비스입니다.

## ⚠️ 중요 고지사항

- 본 서비스는 **구독 해지 경로 이해를 돕는 참고 자료**입니다
- **법률 자문이 아니며**, 환불이나 위약금 면제를 보장하지 않습니다
- 실제 해지는 각 서비스 정책에 따라 **직접 진행**하셔야 합니다
- 업로드 이미지는 **분석 후 저장하지 않습니다**
- 서비스 UI는 수시로 변경될 수 있으므로 공식 앱/웹에서 최종 확인하세요

## 주요 기능

### 🎨 모바일 최적화 UI (NEW!)
- **모바일 퍼스트 디자인**: 375-430px 기준, 터치 친화적
- **현대적 한국 소비자 앱 스타일**: 부드러운 그라데이션, 큰 radius, 깔끔한 카드
- **Tailwind CSS**: 일관된 디자인 시스템
- **멀티 채널 탭 인터페이스**: 여러 결제 경로를 탭으로 전환
- **컴팩트한 면책사항**: 중요하지만 압도적이지 않게

### 📷 스크린샷으로 찾기
1. **결제 채널 추정**: 웹, App Store, Google Play, 가맹점 직접 등을 구분
2. **해지 경로 안내**: 단계별로 명확한 한국어 가이드 제공
3. **주의사항 태그**: 다크 패턴, 환불 불가, 다음 갱신일 등 주의할 점 표시
4. **데모 모드**: API 키 없이도 샘플 시나리오로 체험 가능

### 🔍 서비스명으로 찾기 (NEW!)
1. **브랜드 카탈로그**: 티빙, 넷플릭스, 디즈니+, 유튜브 프리미엄, 쿠팡플레이, 멜론, 스포티파이 등 주요 서비스 지원
2. **멀티 채널 안내**: 여러 결제 방법이 가능한 경우 모든 경로 제공
3. **즉시 결과**: 스크린샷 없이 서비스명만으로 빠르게 안내
4. **일반 가이드**: 등록되지 않은 서비스도 일반적인 해지 절차 안내

## 기술 스택

- **프레임워크**: Next.js 14 (App Router)
- **언어**: TypeScript
- **Vision LLM**: Anthropic Claude 또는 OpenAI GPT-4o
- **배포**: Vercel

## 로컬 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정 (선택사항)

Vision LLM API를 사용하려면 `.env.local` 파일을 생성하고 아래 중 하나를 설정하세요:

```bash
# Anthropic Claude (권장)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# 또는 OpenAI GPT-4o
# OPENAI_API_KEY=your_openai_api_key_here
```

`.env.example` 파일을 참고하세요.

**참고**: API 키가 없어도 데모 모드로 전체 기능을 체험할 수 있습니다!

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 을 열어 확인하세요.

### 4. 프로덕션 빌드

```bash
npm run build
npm start
```

## 사용 방법

### 📷 스크린샷으로 찾기
1. "스크린샷으로 찾기" 탭 선택
2. 구독 관리 화면 캡처 이미지 업로드 (1-3개)
3. "해지 경로 분석하기" 버튼 클릭
4. AI 분석 결과 확인

### 🔍 서비스명으로 찾기
1. "서비스명으로 찾기" 탭 선택
2. 서비스명 입력 (예: 티빙, 넷플릭스, 유튜브 프리미엄)
3. "이름으로 찾기" 버튼 클릭
4. 결제 채널별 해지 경로 확인

#### 지원 서비스
- **티빙**: 웹, App Store, Google Play (3가지 경로)
- **넷플릭스**: 웹
- **디즈니+**: 웹
- **유튜브 프리미엄**: 웹, App Store, Google Play (3가지 경로)
- **쿠팡플레이**: 웹
- **멜론**: 웹
- **스포티파이**: 웹
- **기타**: 일반적인 해지 가이드 제공

## 데모 모드 사용법

API 키 없이 체험하는 방법:

### 스크린샷 모드 데모
1. **UI 버튼**: "📱 샘플로 체험하기" 버튼 클릭
2. **URL 쿼리**: `?demo=1` 파라미터 추가

샘플 시나리오:
- `appstore`: App Store 구독 해지
- `play`: Google Play 구독 해지
- `web_dark`: 웹 기반 다크 패턴 케이스
- `email_renewal`: 청구서 이메일 기반

### 브랜드명 모드 데모
1. "서비스명으로 찾기" 탭 선택
2. **UI 버튼**: "📱 샘플: 티빙" 버튼 클릭
3. **URL 쿼리**: `?demo=1&scenario=brand_tving`

샘플 브랜드:
- `brand_tving`: 티빙 (멀티 채널)
- `brand_netflix`: 넷플릭스

## Vercel 배포

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/YOUR_REPO)

1. 위 버튼을 클릭하거나 Vercel 대시보드에서 Import Project
2. 환경 변수 설정 (선택사항):
   - `ANTHROPIC_API_KEY` 또는 `OPENAI_API_KEY`
3. 배포 완료!

API 키를 설정하지 않아도 데모 모드로 작동하므로 판단용 배포는 즉시 가능합니다.

## 프로젝트 구조

```
.
├── app/
│   ├── layout.tsx          # 루트 레이아웃
│   ├── page.tsx             # 랜딩 페이지
│   └── api/
│       └── analyze/
│           └── route.ts     # 분석 API 엔드포인트
├── components/
│   ├── UploadForm.tsx       # 이미지 업로드 & 브랜드 검색 폼
│   └── ResultDisplay.tsx    # 결과 표시 (단일/멀티 채널 지원)
├── lib/
│   └── brand-catalog.ts     # 브랜드 카탈로그 & 검색 로직
├── fixtures/
│   ├── appstore.json        # App Store 샘플 데이터
│   ├── play.json            # Google Play 샘플 데이터
│   ├── web_dark.json        # 웹 다크 패턴 샘플 데이터
│   ├── email_renewal.json   # 이메일 청구서 샘플 데이터
│   └── brands/
│       ├── brand_tving.json    # 티빙 브랜드 데이터
│       └── brand_netflix.json  # 넷플릭스 브랜드 데이터
├── package.json
├── tsconfig.json
├── next.config.js
└── README.md
```

## API 스펙

### POST `/api/analyze`

#### 실제 분석 요청 (스크린샷):

```javascript
const formData = new FormData()
formData.append('files', imageFile1)
formData.append('files', imageFile2)

fetch('/api/analyze', {
  method: 'POST',
  body: formData,
})
```

#### 브랜드명 검색 (NEW!):

```javascript
fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: '티빙', mode: 'brand' }),
})
```

#### 데모 모드 요청:

```javascript
// 방법 1: URL 쿼리
fetch('/api/analyze?demo=1', { method: 'POST' })

// 방법 2: JSON body
fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ demo: true, scenario: 'brand_tving' }),
})
```

#### 응답 형식 (단일 채널):

```typescript
{
  service?: {
    nameKo: string,
    nameAliases?: string[],
    matched: boolean
  },
  channel: {
    type: 'web' | 'app_store' | 'google_play' | 'merchant' | 'unknown',
    confidence: 'high' | 'medium' | 'low',
    evidence: string[]
  },
  steps: {
    order: number,
    title: string,
    detailKo: string
  }[],
  tags: {
    kind: 'dark_pattern' | 'cancel_ne_refund' | 'next_renewal' | 'other_caution',
    labelKo: string,
    evidence?: string
  }[],
  disclaimer: string
}
```

#### 응답 형식 (멀티 채널):

```typescript
{
  service: {
    nameKo: string,
    nameAliases: string[],
    matched: boolean
  },
  multiChannel: true,
  channels: {
    channel: {
      type: 'web' | 'app_store' | 'google_play' | 'merchant' | 'unknown',
      confidence: 'high' | 'medium' | 'low',
      evidence: string[]
    },
    channelLabel: string,
    steps: {
      order: number,
      title: string,
      detailKo: string
    }[],
    tags: {
      kind: 'dark_pattern' | 'cancel_ne_refund' | 'next_renewal' | 'other_caution',
      labelKo: string,
      evidence?: string
    }[]
  }[],
  disclaimer: string
}
```

## 면책사항

본 서비스는 다음을 보장하지 않습니다:

- ❌ 환불 성공
- ❌ 위약금 면제
- ❌ 자동 해지 완료
- ❌ 법률 자문

실제 구독 해지는 각 서비스의 약관과 정책에 따라 사용자가 직접 진행해야 하며, 본 서비스는 참고 정보만 제공합니다.

## 개발자

Wanted AI Championship 2026 Hackathon Project

## 라이선스

MIT
