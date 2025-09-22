// HyperIndex 프론트엔드 E2E 테스트 - Live/Stub 모드
// 목표: 두 레벨 모두 검증 - Stub 모드(UI·흐름) + Live 모드(실제 API)

describe('HyperIndex Positions E2E - Dual Mode', () => {
  const testSymbol = 'BTC-PERP';
  const testLeverage = 3;
  const testNotional = 50;

  beforeEach(() => {
    // 토큰 설정
    cy.window().then((win) => {
      win.localStorage.setItem('demo_token', Cypress.env('DEMO_TOKEN') || 'test_token_for_e2e');
    });
    
    cy.visit('/positions');
    cy.wait(1000); // 페이지 로딩 대기
  });

  context('🎭 Stub 모드 테스트 (UI·흐름 검증)', () => {
    beforeEach(() => {
      // Stub 모드로 전환
      cy.get('[data-testid="mode-toggle"]', { timeout: 10000 })
        .should('be.visible')
        .click();
      
      cy.get('[data-testid="stub-mode"]')
        .should('be.visible')
        .click();
      
      // Stub 모드 활성 확인
      cy.get('[data-testid="mode-indicator"]')
        .should('contain.text', 'STUB')
        .should('have.class', 'text-gray-500');
      
      // API 인터셉트 설정 (확정 응답)
      cy.intercept('POST', '/v1/indexes/*/positions/precheck', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            estimatedFee: '2.5',
            estimatedSlippage: '0.1',
            requiredMargin: '16.67',
            maxSize: '1000'
          }
        }
      }).as('stubPrecheck');
      
      cy.intercept('POST', '/v1/indexes/*/positions/open', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            orderId: 'stub-order-123',
            status: 'SUBMITTED',
            txHash: '0xstub123...abc'
          }
        }
      }).as('stubOpen');
      
      cy.intercept('GET', '/v1/indexes/*/positions', {
        statusCode: 200,
        body: {
          success: true,
          data: [
            {
              symbol: testSymbol,
              side: 'LONG',
              leverage: testLeverage,
              notionalUsd: testNotional,
              pnl: '5.25',
              status: 'OPEN'
            }
          ]
        }
      }).as('stubList');
      
      cy.intercept('POST', '/v1/indexes/*/positions/close', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            orderId: 'stub-close-456',
            status: 'SUBMITTED',
            txHash: '0xstub456...def'
          }
        }
      }).as('stubClose');
    });

    it('UI 전이 및 에러 토스트 표시 확인', () => {
      // 1. 포지션 오픈 UI 흐름
      cy.get('[data-testid="symbol-select"]').select(testSymbol);
      cy.get('[data-testid="leverage-input"]').clear().type(testLeverage.toString());
      cy.get('[data-testid="notional-input"]').clear().type(testNotional.toString());
      
      // Precheck 버튼 클릭
      cy.get('[data-testid="precheck-btn"]').click();
      cy.wait('@stubPrecheck');
      
      // 예상 수수료 표시 확인
      cy.get('[data-testid="estimated-fee"]').should('contain.text', '2.5');
      
      // 오픈 버튼 클릭
      cy.get('[data-testid="open-btn"]').click();
      cy.wait('@stubOpen');
      
      // 성공 토스트 확인
      cy.get('[data-testid="toast-success"]')
        .should('be.visible')
        .should('contain.text', 'Order submitted');
      
      // 2. 포지션 목록 확인
      cy.wait('@stubList');
      cy.get('[data-testid="positions-list"]')
        .should('contain.text', testSymbol)
        .should('contain.text', 'LONG')
        .should('contain.text', '+5.25'); // PnL 표시
      
      // 3. 포지션 클로즈 UI 흐름
      cy.get('[data-testid="close-btn"]').first().click();
      
      // 확인 모달
      cy.get('[data-testid="close-confirm-modal"]').should('be.visible');
      cy.get('[data-testid="confirm-close-btn"]').click();
      cy.wait('@stubClose');
      
      // 클로즈 성공 토스트 확인
      cy.get('[data-testid="toast-success"]')
        .should('be.visible')
        .should('contain.text', 'Position closed');
    });

    it('에러 상황 UI 처리 확인', () => {
      // 실패 응답 인터셉트
      cy.intercept('POST', '/v1/indexes/*/positions/open', {
        statusCode: 400,
        body: {
          success: false,
          error: {
            code: 'INSUFFICIENT_BALANCE',
            message: 'Insufficient balance for this position'
          }
        }
      }).as('stubError');
      
      // 포지션 오픈 시도
      cy.get('[data-testid="symbol-select"]').select(testSymbol);
      cy.get('[data-testid="open-btn"]').click();
      cy.wait('@stubError');
      
      // 에러 토스트 확인
      cy.get('[data-testid="toast-error"]')
        .should('be.visible')
        .should('contain.text', 'Insufficient balance');
    });
  });

  context('🚀 Live 모드 테스트 (실제 API)', () => {
    beforeEach(() => {
      // Live 모드로 전환
      cy.get('[data-testid="mode-toggle"]')
        .should('be.visible')
        .click();
      
      cy.get('[data-testid="live-mode"]')
        .should('be.visible')
        .click();
      
      // Live 모드 활성 확인
      cy.get('[data-testid="mode-indicator"]')
        .should('contain.text', 'LIVE')
        .should('have.class', 'text-green-500');
      
      // 실시간 txHash/latency 미니패널 확인
      cy.get('[data-testid="telemetry-panel"]').should('be.visible');
    });

    it('실제 테스트넷에서 open→list→close', () => {
      // 1. 실제 API 호출로 포지션 오픈
      cy.get('[data-testid="symbol-select"]').select(testSymbol);
      cy.get('[data-testid="leverage-input"]').clear().type('1'); // 안전한 레버리지
      cy.get('[data-testid="notional-input"]').clear().type('10'); // 소액
      
      cy.get('[data-testid="open-btn"]').click();
      
      // Order submitted 메시지 확인 (실제 API 응답)
      cy.get('[data-testid="toast-success"]', { timeout: 10000 })
        .should('be.visible')
        .should('contain.text', 'Order submitted');
      
      // 실시간 txHash 표시 확인
      cy.get('[data-testid="latest-tx-hash"]', { timeout: 5000 })
        .should('be.visible')
        .should('contain.text', '0x');
      
      // 응답 시간 표시 확인
      cy.get('[data-testid="latest-latency"]')
        .should('be.visible')
        .invoke('text')
        .should('match', /\d+ms/);
      
      // 2. 포지션이 목록에 나타날 때까지 대기 (최대 20초)
      cy.get('[data-testid="positions-list"]', { timeout: 20000 })
        .should('contain.text', testSymbol);
      
      // 3. 포지션 클로즈
      cy.get('[data-testid="close-btn"]').first().click();
      cy.get('[data-testid="confirm-close-btn"]').click();
      
      // 클로즈 성공 확인
      cy.get('[data-testid="toast-success"]', { timeout: 10000 })
        .should('be.visible');
      
      // 포지션이 목록에서 사라지는지 확인 (최대 15초)
      cy.get('[data-testid="positions-list"]', { timeout: 15000 })
        .should('not.contain.text', testSymbol);
    });

    it('실패 주입 테스트 - 업스트림 장애 토스트', () => {
      // 디버그 모드에서 RPC timeout 활성화
      cy.request({
        method: 'POST',
        url: '/__debug/rpc?mode=timeout',
        failOnStatusCode: false
      });
      
      // 60초 후 자동 해제될 예정이지만, 테스트용으로 짧게 설정
      cy.wait(1000);
      
      // 포지션 오픈 시도
      cy.get('[data-testid="symbol-select"]').select(testSymbol);
      cy.get('[data-testid="open-btn"]').click();
      
      // UPSTREAM_UNAVAILABLE 에러 토스트 확인
      cy.get('[data-testid="toast-error"]', { timeout: 15000 })
        .should('be.visible')
        .should('contain.text', 'Upstream service unavailable');
      
      // RPC timeout 해제
      cy.request({
        method: 'POST',
        url: '/__debug/rpc?mode=normal',
        failOnStatusCode: false
      });
      
      // 재시도 후 성공 확인
      cy.wait(2000);
      cy.get('[data-testid="open-btn"]').click();
      cy.get('[data-testid="toast-success"]', { timeout: 10000 })
        .should('be.visible');
    });
  });

  context('🔄 동시호출 멱등성 테스트', () => {
    beforeEach(() => {
      // Live 모드 설정
      cy.get('[data-testid="mode-toggle"]').click();
      cy.get('[data-testid="live-mode"]').click();
    });

    it('동일 Idempotency-Key 5회 발사 테스트', () => {
      // Dev 패널에서 동시호출 버튼 클릭
      cy.get('[data-testid="dev-panel-toggle"]').click();
      cy.get('[data-testid="concurrent-test-btn"]').click();
      
      // 5회 동시 요청 설정
      cy.get('[data-testid="concurrent-count"]').clear().type('5');
      cy.get('[data-testid="execute-concurrent"]').click();
      
      // 결과 확인 (1건 신규 + 4건 재생)
      cy.get('[data-testid="concurrent-results"]', { timeout: 10000 })
        .should('be.visible');
      
      cy.get('[data-testid="new-orders"]')
        .should('contain.text', '1'); // 신규 주문 1건
      
      cy.get('[data-testid="replayed-orders"]')
        .should('contain.text', '4'); // 재생 주문 4건
      
      // UI에 멱등성 뱃지 표시 확인
      cy.get('[data-testid="idempotency-badge"]')
        .should('be.visible')
        .should('contain.text', '기존 주문 재생성');
    });
  });
});
