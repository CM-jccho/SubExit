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
  const isMultiChannel = result.multiChannel && result.channels

  return (
    <div style={{ marginTop: '30px' }}>
      {result.service && (
        <div style={{
          backgroundColor: '#e3f2fd',
          border: '2px solid #2196f3',
          borderRadius: '12px',
          padding: '15px',
          marginBottom: '20px',
          textAlign: 'center',
        }}>
          <strong style={{ fontSize: '1.1rem', color: '#1565c0' }}>
            "{result.service.nameKo}"로 인식
          </strong>
        </div>
      )}

      {isMultiChannel ? (
        <>
          <div style={{
            backgroundColor: '#fff3cd',
            border: '2px solid #ffc107',
            borderRadius: '12px',
            padding: '15px',
            marginBottom: '20px',
          }}>
            <strong style={{ color: '#856404' }}>💡 여러 결제 경로 가능</strong>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: '#856404' }}>
              이 서비스는 웹, App Store, Google Play 등 여러 방법으로 결제 가능합니다. 
              실제 결제한 채널에 해당하는 경로를 따라 진행하세요.
            </p>
          </div>

          {result.channels!.map((channelData, idx) => (
            <div key={idx} style={{ marginBottom: '30px' }}>
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '25px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                marginBottom: '20px',
              }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#1a1a1a' }}>
                  {idx === 0 ? '📱' : idx === 1 ? '🍎' : '🤖'} {channelData.channelLabel}
                </h2>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '15px',
                }}>
                  <span style={{
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    color: '#007bff',
                  }}>
                    {channelLabels[channelData.channel.type]}
                  </span>
                  <span style={{
                    padding: '4px 12px',
                    backgroundColor: channelData.channel.confidence === 'high' ? '#d4edda' : 
                                   channelData.channel.confidence === 'medium' ? '#fff3cd' : '#f8d7da',
                    color: channelData.channel.confidence === 'high' ? '#155724' : 
                           channelData.channel.confidence === 'medium' ? '#856404' : '#721c24',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                  }}>
                    신뢰도: {confidenceLabels[channelData.channel.confidence]}
                  </span>
                </div>
                {channelData.channel.evidence.length > 0 && (
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ fontSize: '0.9rem', color: '#666' }}>근거:</strong>
                    <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: '#666', fontSize: '0.9rem' }}>
                      {channelData.channel.evidence.map((ev, i) => (
                        <li key={i}>{ev}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#333', marginTop: '20px' }}>
                  📋 해지 단계
                </h3>
                {channelData.steps.map((step, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: i === channelData.steps.length - 1 ? '0' : '15px',
                      paddingBottom: i === channelData.steps.length - 1 ? '0' : '15px',
                      borderBottom: i === channelData.steps.length - 1 ? 'none' : '1px solid #eee',
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
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#333' }}>
                          {step.title}
                        </h4>
                        <p style={{ margin: '0', color: '#666', fontSize: '0.95rem', lineHeight: '1.5' }}>
                          {step.detailKo}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {channelData.tags.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', color: '#333' }}>
                      ⚠️ 주의사항
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {channelData.tags.map((tag, i) => {
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
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          {result.channel && (
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
          )}

          {result.steps && result.steps.length > 0 && (
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
                    marginBottom: i === result.steps!.length - 1 ? '0' : '15px',
                    paddingBottom: i === result.steps!.length - 1 ? '0' : '15px',
                    borderBottom: i === result.steps!.length - 1 ? 'none' : '1px solid #eee',
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
          )}

          {result.tags && result.tags.length > 0 && (
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
        </>
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
