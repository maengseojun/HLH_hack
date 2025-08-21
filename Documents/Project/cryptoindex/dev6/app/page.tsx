// app/page.tsx
export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 헤더 */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-blue-600">CryptoIndex</h1>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="/privy-login"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                로그인
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            안전한 P2P 암호화폐 거래
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            CryptoIndex에서 신뢰할 수 있는 P2P 거래를 경험하세요. 
            이메일 또는 지갑으로 간편하게 로그인하고 안전한 거래를 시작할 수 있습니다.
          </p>
          
          <div className="flex gap-4 justify-center mb-16">
            <a
              href="/privy-login"
              className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              거래 시작하기
            </a>
            <a
              href="/api/health"
              className="border border-gray-300 text-gray-700 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              시스템 상태 확인
            </a>
          </div>

          {/* 특징 소개 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">안전한 인증</h3>
              <p className="text-gray-600">이메일 OTP 또는 지갑 서명을 통한 안전한 2단계 인증</p>
            </div>
            
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">신뢰할 수 있는 거래</h3>
              <p className="text-gray-600">에스크로 시스템으로 보호되는 P2P 암호화폐 거래</p>
            </div>
            
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">빠른 거래</h3>
              <p className="text-gray-600">실시간 시세 확인과 즉시 거래 체결</p>
            </div>
          </div>
        </div>
      </div>

      {/* 푸터 */}
      <footer className="bg-white border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">
            <p>&copy; 2024 CryptoIndex. All rights reserved.</p>
            <p className="mt-2 text-sm">안전하고 신뢰할 수 있는 P2P 암호화폐 거래 플랫폼</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
