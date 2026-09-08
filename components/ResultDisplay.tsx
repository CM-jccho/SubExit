import { AnalysisResult } from './UploadForm'

const channelLabels = {
  web: '웹사이트',
  app_store: 'App Store',
  google_play: 'Google Play',
  merchant: '가맹점 직접',
  unknown: '확인 필요',
}

const confidenceLabels = {
  high: '높음',
  medium: '중간',
  low: '낮음',
}

const tagStyles = {
  dark_pattern: { bg: '#fff3cd', color: '#856404', border: '#ffc107' },
  cancel_ne_refund: { bg: '#d1ecf1', color: '#0c5460', border: '#bee5eb' },
  next_renewal: { bg: '#d4edda', color: '#155724', border: '#c3e6cb' },
  other_caution: { bg: '#f8d7da', color: '#721c24', border: '#f5c6cb' },
}

export default function ResultDisplay({ result }: { result: AnalysisResult }) {
  return (
    <div style={{ marginTop: '30px' }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '25px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginBottom: '20px',
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#1a1a1a' }}>
          📱 결제 채널 추정
        </h2>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '15px',
        }}>
          <span style={{
            fontSize: '1.3rem',
            fontWeight: 'bold',
            color: '#007bff',
          }}>
            {channelLabels[result.channel.type]}
          </span>
          <span style={{
            padding: '4px 12px',
            backgroundColor: result.channel.confidence === 'high' ? '#d4edda' : 
                           result.channel.confidence === 'medium' ? '#fff3cd' : '#f8d7da',
            color: result.channel.confidence === 'high' ? '#155724' : 
                   result.channel.confidence === 'medium' ? '#856404' : '#721c24',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 'bold',
          }}>
            신뢰도: {confidenceLabels[result.channel.confidence]}
          </span>
        </div>
        {result.channel.evidence.length > 0 && (
          <div>
            <strong style={{ fontSize: '0.9rem', color: '#666' }}>근거:</strong>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: '#666', fontSize: '0.9rem' }}>
              {result.channel.evidence.map((ev, i) => (
                <li key={i}>{ev}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '25px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginBottom: '20px',
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#1a1a1a' }}>
          📋 해지 단계
        </h2>
        {result.steps.map((step, i) => (
          <div
            key={i}
            style={{
              marginBottom: i === result.steps.length - 1 ? '0' : '15px',
              paddingBottom: i === result.steps.length - 1 ? '0' : '15px',
              borderBottom: i === result.steps.length - 1 ? 'none' : '1px solid #eee',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}>
              <span style={{
                display: 'inline-block',
                width: '28px',
                height: '28px',
                backgroundColor: '#007bff',
                color: 'white',
                borderRadius: '50%',
                textAlign: 'center',
                lineHeight: '28px',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                flexShrink: 0,
              }}>
                {step.order}
              </span>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#333' }}>
                  {step.title}
                </h3>
                <p style={{ margin: '0', color: '#666', fontSize: '0.95rem', lineHeight: '1.5' }}>
                  {step.detailKo}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {result.tags.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '25px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '20px',
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#1a1a1a' }}>
            ⚠️ 주의사항
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {result.tags.map((tag, i) => {
              const style = tagStyles[tag.kind]
              return (
                <div
                  key={i}
                  style={{
                    backgroundColor: style.bg,
                    border: `1px solid ${style.border}`,
                    borderRadius: '8px',
                    padding: '12px 15px',
                    color: style.color,
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '5px' }}>
                    {tag.labelKo}
                  </strong>
                  {tag.evidence && (
                    <div style={{ fontSize: '0.9rem' }}>
                      근거: {tag.evidence}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{
        backgroundColor: '#f8f9fa',
        borderRadius: '12px',
        padding: '20px',
        border: '2px solid #dee2e6',
      }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#495057' }}>
          📌 면책 고지
        </h3>
        <p style={{ margin: '0', fontSize: '0.9rem', color: '#6c757d', lineHeight: '1.6' }}>
          {result.disclaimer}
        </p>
      </div>
    </div>
  )
}
