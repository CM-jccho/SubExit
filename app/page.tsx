import UploadForm from '@/components/UploadForm'

export default function Home() {
  return (
    <main style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '40px 20px',
    }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '10px', color: '#1a1a1a' }}>
          SubExit
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#666', marginBottom: '20px' }}>
          구독 관리 화면 스크린샷으로 해지 경로를 빠르게 찾으세요
        </p>
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '15px',
          marginTop: '20px',
          textAlign: 'left',
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#856404' }}>
            ⚠️ 중요한 고지사항
          </h3>
          <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '0.9rem', color: '#856404' }}>
            <li>이 서비스는 구독 해지 경로 이해를 돕는 참고 자료입니다</li>
            <li>법률 자문이 아니며, 환불이나 위약금 면제를 보장하지 않습니다</li>
            <li>실제 해지는 각 서비스 정책에 따라 직접 진행하셔야 합니다</li>
            <li>업로드 이미지는 분석 후 저장하지 않습니다</li>
          </ul>
        </div>
      </header>

      <UploadForm />

      <footer style={{
        textAlign: 'center',
        marginTop: '60px',
        paddingTop: '20px',
        borderTop: '1px solid #ddd',
        color: '#999',
        fontSize: '0.85rem',
      }}>
        <p>Wanted AI Championship 2026 Hackathon Project</p>
      </footer>
    </main>
  )
}
