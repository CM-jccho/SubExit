export type BrandChannel = 'web' | 'app_store' | 'google_play' | 'merchant'

export type BrandCancelPath = {
  channel: BrandChannel
  channelLabel: string
  steps: {
    order: number
    title: string
    detailKo: string
  }[]
  tags: {
    kind: 'dark_pattern' | 'cancel_ne_refund' | 'next_renewal' | 'other_caution'
    labelKo: string
    evidence?: string
  }[]
}

export type BrandInfo = {
  nameKo: string
  nameAliases: string[]
  description: string
  cancelPaths: BrandCancelPath[]
  notes?: string
}

export const brandCatalog: Record<string, BrandInfo> = {
  '티빙': {
    nameKo: '티빙',
    nameAliases: ['tving', 'TVING', 'Tving', '티빙'],
    description: 'CJ ENM의 OTT 스트리밍 서비스',
    cancelPaths: [
      {
        channel: 'web',
        channelLabel: '웹으로 결제했을 때',
        steps: [
          {
            order: 1,
            title: '티빙 웹사이트 로그인',
            detailKo: '브라우저에서 tving.com에 접속하여 로그인하세요.',
          },
          {
            order: 2,
            title: '마이페이지 진입',
            detailKo: '우측 상단 프로필 아이콘을 클릭하고 "마이페이지"를 선택하세요.',
          },
          {
            order: 3,
            title: '이용권/결제 관리',
            detailKo: '"이용권 관리" 또는 "결제 관리" 메뉴를 찾아 클릭하세요.',
          },
          {
            order: 4,
            title: '구독 해지하기',
            detailKo: '현재 활성화된 이용권 옆의 "해지" 또는 "구독 해지" 버튼을 클릭하세요.',
          },
          {
            order: 5,
            title: '해지 확인',
            detailKo: '해지 사유를 선택하고 최종 확인 버튼을 눌러 해지를 완료하세요. 해지 후에도 남은 기간 동안은 이용 가능합니다.',
          },
        ],
        tags: [
          {
            kind: 'cancel_ne_refund',
            labelKo: '해지 ≠ 즉시 환불',
            evidence: '티빙은 해지 시 남은 기간에 대한 자동 환불을 제공하지 않습니다.',
          },
          {
            kind: 'next_renewal',
            labelKo: '다음 갱신일 확인 필요',
            evidence: '해지 후에도 다음 결제 예정일까지 서비스를 이용할 수 있습니다.',
          },
        ],
      },
      {
        channel: 'app_store',
        channelLabel: 'App Store로 결제했을 때',
        steps: [
          {
            order: 1,
            title: '설정 앱 열기',
            detailKo: 'iPhone 또는 iPad에서 "설정" 앱을 실행하세요.',
          },
          {
            order: 2,
            title: 'Apple ID 선택',
            detailKo: '상단에 표시된 본인의 이름(Apple ID)을 탭하세요.',
          },
          {
            order: 3,
            title: '구독 메뉴 진입',
            detailKo: '"구독" 항목을 선택하여 현재 활성화된 구독 목록을 확인하세요.',
          },
          {
            order: 4,
            title: '티빙 구독 선택',
            detailKo: '구독 목록에서 "티빙" 또는 "TVING"을 찾아 탭하세요.',
          },
          {
            order: 5,
            title: '구독 취소하기',
            detailKo: '화면 하단의 "구독 취소" 버튼을 탭하고 확인하세요.',
          },
        ],
        tags: [
          {
            kind: 'cancel_ne_refund',
            labelKo: '해지 ≠ 즉시 환불',
            evidence: 'App Store 정책상 구독 취소 시 남은 기간에 대한 환불은 제공되지 않습니다.',
          },
          {
            kind: 'next_renewal',
            labelKo: '다음 갱신일 확인 필요',
            evidence: '취소 시점이 아닌 다음 결제 예정일까지 서비스가 유지됩니다.',
          },
        ],
      },
      {
        channel: 'google_play',
        channelLabel: 'Google Play로 결제했을 때',
        steps: [
          {
            order: 1,
            title: 'Google Play 스토어 열기',
            detailKo: 'Android 기기에서 "Google Play 스토어" 앱을 실행하세요.',
          },
          {
            order: 2,
            title: '프로필 메뉴 진입',
            detailKo: '우측 상단의 프로필 아이콘을 탭하세요.',
          },
          {
            order: 3,
            title: '결제 및 구독 선택',
            detailKo: '메뉴에서 "결제 및 구독" → "구독"을 선택하세요.',
          },
          {
            order: 4,
            title: '티빙 구독 선택',
            detailKo: '구독 목록에서 "티빙" 또는 "TVING"을 찾아 탭하세요.',
          },
          {
            order: 5,
            title: '구독 해지하기',
            detailKo: '"구독 해지" 버튼을 탭하고 해지 사유를 선택한 후 확인하세요.',
          },
        ],
        tags: [
          {
            kind: 'cancel_ne_refund',
            labelKo: '해지 ≠ 즉시 환불',
            evidence: 'Google Play 정책상 구독 해지 시 남은 기간에 대한 자동 환불은 제공되지 않습니다.',
          },
          {
            kind: 'next_renewal',
            labelKo: '다음 갱신일 확인 필요',
            evidence: '해지 후에도 다음 결제 예정일까지 서비스가 유지됩니다.',
          },
        ],
      },
    ],
    notes: '티빙은 웹, App Store, Google Play 모두에서 구독이 가능합니다. 어디서 결제했는지에 따라 해지 방법이 다르므로, 결제 내역을 먼저 확인하세요.',
  },
  '넷플릭스': {
    nameKo: '넷플릭스',
    nameAliases: ['netflix', 'Netflix', '넷플릭스', '넷플', '넷플x'],
    description: '글로벌 OTT 스트리밍 서비스',
    cancelPaths: [
      {
        channel: 'web',
        channelLabel: '웹으로 결제했을 때',
        steps: [
          {
            order: 1,
            title: '넷플릭스 웹사이트 로그인',
            detailKo: '브라우저에서 netflix.com에 접속하여 로그인하세요.',
          },
          {
            order: 2,
            title: '계정 메뉴 진입',
            detailKo: '우측 상단 프로필 아이콘을 클릭하고 "계정"을 선택하세요.',
          },
          {
            order: 3,
            title: '멤버십 해지',
            detailKo: '"멤버십 및 결제" 섹션에서 "멤버십 해지" 버튼을 찾아 클릭하세요.',
          },
          {
            order: 4,
            title: '해지 확인',
            detailKo: '해지 확인 화면에서 "해지 완료" 버튼을 클릭하세요. 해지 후에도 남은 기간 동안은 시청 가능합니다.',
          },
        ],
        tags: [
          {
            kind: 'cancel_ne_refund',
            labelKo: '해지 ≠ 즉시 환불',
            evidence: '넷플릭스는 해지 시 남은 기간에 대한 환불을 제공하지 않습니다.',
          },
          {
            kind: 'next_renewal',
            labelKo: '다음 갱신일 확인 필요',
            evidence: '해지 후에도 다음 결제일까지 서비스 이용이 가능합니다.',
          },
        ],
      },
    ],
    notes: '넷플릭스는 주로 웹에서 직접 결제합니다. 일부 통신사나 제휴 결제의 경우 해당 통신사 고객센터를 통해 해지해야 할 수 있습니다.',
  },
  '디즈니+': {
    nameKo: '디즈니+',
    nameAliases: ['디즈니+', '디즈니플러스', 'Disney+', 'Disney Plus', 'disney+', 'disney plus'],
    description: 'Disney의 OTT 스트리밍 서비스',
    cancelPaths: [
      {
        channel: 'web',
        channelLabel: '웹으로 결제했을 때',
        steps: [
          {
            order: 1,
            title: '디즈니+ 웹사이트 로그인',
            detailKo: '브라우저에서 disneyplus.com에 접속하여 로그인하세요.',
          },
          {
            order: 2,
            title: '프로필 메뉴 진입',
            detailKo: '우측 상단 프로필 아이콘을 클릭하고 "계정"을 선택하세요.',
          },
          {
            order: 3,
            title: '구독 관리',
            detailKo: '"구독" 섹션에서 "구독 취소"를 클릭하세요.',
          },
          {
            order: 4,
            title: '취소 확인',
            detailKo: '안내에 따라 취소를 확정하세요. 해지 후에도 남은 기간 동안은 이용 가능합니다.',
          },
        ],
        tags: [
          {
            kind: 'cancel_ne_refund',
            labelKo: '해지 ≠ 즉시 환불',
          },
          {
            kind: 'next_renewal',
            labelKo: '다음 갱신일 확인 필요',
          },
        ],
      },
    ],
  },
  '유튜브 프리미엄': {
    nameKo: '유튜브 프리미엄',
    nameAliases: ['유튜브프리미엄', '유튜브 프리미엄', 'YouTube Premium', 'youtube premium', 'Youtube Premium', '유프'],
    description: 'Google의 유튜브 프리미엄 서비스',
    cancelPaths: [
      {
        channel: 'web',
        channelLabel: '웹으로 결제했을 때',
        steps: [
          {
            order: 1,
            title: '유튜브 웹사이트 접속',
            detailKo: '브라우저에서 youtube.com에 접속하여 로그인하세요.',
          },
          {
            order: 2,
            title: '프로필 메뉴 진입',
            detailKo: '우측 상단 프로필 아이콘을 클릭하고 "구매 항목 및 멤버십"을 선택하세요.',
          },
          {
            order: 3,
            title: '프리미엄 멤버십 관리',
            detailKo: '"YouTube Premium" 항목을 찾아 "관리" 또는 "설정"을 클릭하세요.',
          },
          {
            order: 4,
            title: '멤버십 해지',
            detailKo: '"멤버십 해지" 또는 "구독 취소" 버튼을 클릭하고 확인하세요.',
          },
        ],
        tags: [
          {
            kind: 'cancel_ne_refund',
            labelKo: '해지 ≠ 즉시 환불',
          },
          {
            kind: 'next_renewal',
            labelKo: '다음 갱신일 확인 필요',
          },
        ],
      },
      {
        channel: 'app_store',
        channelLabel: 'App Store로 결제했을 때',
        steps: [
          {
            order: 1,
            title: '설정 앱 열기',
            detailKo: 'iPhone 또는 iPad에서 "설정" 앱을 실행하세요.',
          },
          {
            order: 2,
            title: 'Apple ID → 구독',
            detailKo: 'Apple ID를 탭한 후 "구독" 메뉴로 이동하세요.',
          },
          {
            order: 3,
            title: 'YouTube Premium 선택',
            detailKo: '구독 목록에서 "YouTube Premium"을 선택하세요.',
          },
          {
            order: 4,
            title: '구독 취소',
            detailKo: '"구독 취소" 버튼을 탭하고 확인하세요.',
          },
        ],
        tags: [
          {
            kind: 'cancel_ne_refund',
            labelKo: '해지 ≠ 즉시 환불',
          },
          {
            kind: 'next_renewal',
            labelKo: '다음 갱신일 확인 필요',
          },
        ],
      },
      {
        channel: 'google_play',
        channelLabel: 'Google Play로 결제했을 때',
        steps: [
          {
            order: 1,
            title: 'Google Play 스토어 열기',
            detailKo: 'Android 기기에서 "Google Play 스토어" 앱을 실행하세요.',
          },
          {
            order: 2,
            title: '결제 및 구독',
            detailKo: '프로필 → "결제 및 구독" → "구독"으로 이동하세요.',
          },
          {
            order: 3,
            title: 'YouTube Premium 선택',
            detailKo: '구독 목록에서 "YouTube Premium"을 선택하세요.',
          },
          {
            order: 4,
            title: '구독 해지',
            detailKo: '"구독 해지" 버튼을 탭하고 확인하세요.',
          },
        ],
        tags: [
          {
            kind: 'cancel_ne_refund',
            labelKo: '해지 ≠ 즉시 환불',
          },
          {
            kind: 'next_renewal',
            labelKo: '다음 갱신일 확인 필요',
          },
        ],
      },
    ],
    notes: '유튜브 프리미엄은 웹, App Store, Google Play 모두에서 구독 가능합니다. 결제한 곳에 따라 해지 방법이 다르므로 결제 내역을 먼저 확인하세요.',
  },
  '쿠팡플레이': {
    nameKo: '쿠팡플레이',
    nameAliases: ['쿠팡플레이', '쿠팡 플레이', 'Coupang Play', 'coupang play'],
    description: '쿠팡의 OTT 스트리밍 서비스',
    cancelPaths: [
      {
        channel: 'web',
        channelLabel: '웹으로 결제했을 때',
        steps: [
          {
            order: 1,
            title: '쿠팡 웹사이트 로그인',
            detailKo: '브라우저에서 coupang.com에 접속하여 로그인하세요.',
          },
          {
            order: 2,
            title: 'My쿠팡 진입',
            detailKo: '우측 상단 "My쿠팡"을 클릭하세요.',
          },
          {
            order: 3,
            title: '쿠팡플레이 멤버십 관리',
            detailKo: '"멤버십 관리" 또는 "쿠팡플레이" 메뉴를 찾아 클릭하세요.',
          },
          {
            order: 4,
            title: '멤버십 해지',
            detailKo: '"멤버십 해지" 버튼을 클릭하고 안내에 따라 해지를 완료하세요.',
          },
        ],
        tags: [
          {
            kind: 'cancel_ne_refund',
            labelKo: '해지 ≠ 즉시 환불',
          },
          {
            kind: 'next_renewal',
            labelKo: '다음 갱신일 확인 필요',
          },
        ],
      },
    ],
  },
  '멜론': {
    nameKo: '멜론',
    nameAliases: ['멜론', 'Melon', 'melon'],
    description: 'Kakao Entertainment의 음악 스트리밍 서비스',
    cancelPaths: [
      {
        channel: 'web',
        channelLabel: '웹으로 결제했을 때',
        steps: [
          {
            order: 1,
            title: '멜론 웹사이트 로그인',
            detailKo: '브라우저에서 melon.com에 접속하여 로그인하세요.',
          },
          {
            order: 2,
            title: '마이뮤직 진입',
            detailKo: '우측 상단 "마이뮤직" 또는 프로필 아이콘을 클릭하세요.',
          },
          {
            order: 3,
            title: '이용권 관리',
            detailKo: '"이용권 관리" 또는 "내 정보" 메뉴를 찾아 클릭하세요.',
          },
          {
            order: 4,
            title: '이용권 해지',
            detailKo: '현재 이용 중인 이용권 옆의 "해지" 버튼을 클릭하고 확인하세요.',
          },
        ],
        tags: [
          {
            kind: 'cancel_ne_refund',
            labelKo: '해지 ≠ 즉시 환불',
          },
          {
            kind: 'next_renewal',
            labelKo: '다음 갱신일 확인 필요',
          },
        ],
      },
    ],
  },
  '스포티파이': {
    nameKo: '스포티파이',
    nameAliases: ['스포티파이', 'Spotify', 'spotify', '스포티파'],
    description: '글로벌 음악 스트리밍 서비스',
    cancelPaths: [
      {
        channel: 'web',
        channelLabel: '웹으로 결제했을 때',
        steps: [
          {
            order: 1,
            title: '스포티파이 웹사이트 로그인',
            detailKo: '브라우저에서 spotify.com에 접속하여 로그인하세요.',
          },
          {
            order: 2,
            title: '계정 페이지 진입',
            detailKo: '우측 상단 프로필을 클릭하고 "계정"을 선택하세요.',
          },
          {
            order: 3,
            title: '구독 관리',
            detailKo: '"구독" 섹션에서 "구독 변경 또는 취소"를 클릭하세요.',
          },
          {
            order: 4,
            title: '프리미엄 취소',
            detailKo: '"프리미엄 취소" 버튼을 클릭하고 안내에 따라 취소를 완료하세요.',
          },
        ],
        tags: [
          {
            kind: 'cancel_ne_refund',
            labelKo: '해지 ≠ 즉시 환불',
          },
          {
            kind: 'next_renewal',
            labelKo: '다음 갱신일 확인 필요',
          },
        ],
      },
    ],
  },
}

export function findBrand(query: string): BrandInfo | null {
  const normalized = query.toLowerCase().trim()
  
  for (const [key, brand] of Object.entries(brandCatalog)) {
    if (brand.nameAliases.some(alias => alias.toLowerCase() === normalized)) {
      return brand
    }
  }
  
  return null
}

export function getGenericGuidance(): {
  channel: {
    type: 'unknown'
    confidence: 'low'
    evidence: string[]
  }
  steps: {
    order: number
    title: string
    detailKo: string
  }[]
  tags: {
    kind: 'other_caution'
    labelKo: string
    evidence?: string
  }[]
  disclaimer: string
} {
  return {
    channel: {
      type: 'unknown',
      confidence: 'low',
      evidence: [
        '입력하신 서비스명으로는 정확한 결제 채널을 특정할 수 없습니다.',
        '결제 내역(카드 명세서, 앱스토어 영수증 등)을 먼저 확인하세요.',
      ],
    },
    steps: [
      {
        order: 1,
        title: '결제 채널 확인',
        detailKo: '먼저 이 서비스를 어디서 결제했는지 확인하세요. 신용카드 명세서, App Store 구매 내역, Google Play 구독 목록, 또는 서비스 웹사이트의 결제 내역을 확인하세요.',
      },
      {
        order: 2,
        title: '웹 결제인 경우',
        detailKo: '서비스 웹사이트에 로그인 → 마이페이지/계정 설정 → 구독 관리/이용권 관리 → 해지 버튼을 찾아 진행하세요.',
      },
      {
        order: 3,
        title: 'App Store 결제인 경우',
        detailKo: 'iPhone 설정 → Apple ID(상단 이름) → 구독 → 해당 서비스 선택 → 구독 취소를 진행하세요.',
      },
      {
        order: 4,
        title: 'Google Play 결제인 경우',
        detailKo: 'Play 스토어 → 프로필 → 결제 및 구독 → 구독 → 해당 서비스 선택 → 구독 해지를 진행하세요.',
      },
      {
        order: 5,
        title: '고객센터 문의',
        detailKo: '위 방법으로 해지가 어렵다면 해당 서비스의 고객센터(전화, 채팅, 이메일)에 직접 문의하여 해지를 요청하세요.',
      },
    ],
    tags: [
      {
        kind: 'other_caution',
        labelKo: '결제 채널 확인 필수',
        evidence: '서비스명만으로는 정확한 해지 방법을 안내하기 어렵습니다. 실제 결제한 채널을 먼저 확인하세요.',
      },
    ],
    disclaimer: '이 안내는 일반적인 구독 해지 절차를 참고용으로 제공합니다. 서비스 UI는 수시로 변경될 수 있으므로 반드시 공식 앱/웹사이트에서 최종 확인하시기 바랍니다. 본 서비스는 법률 자문이 아니며, 자동 해지를 수행하지 않습니다. 환불 및 위약금 관련 사항은 각 서비스 약관을 직접 확인하셔야 합니다.',
  }
}
