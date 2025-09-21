describe('Basket Flow E2E', () => {
  beforeEach(() => {
    cy.interceptApiCalls();
    cy.visit('/');
    cy.loginWithDemoToken();
  });

  it('should complete full basket flow: precheck -> open -> state -> close', () => {
    // Navigate to basket section
    cy.get('[data-testid="basket-section"]', { timeout: 10000 }).should('be.visible');

    // Step 1: Precheck basket
    cy.get('[data-testid="basket-amount-input"]').clear().type('100');
    cy.get('[data-testid="basket-precheck-btn"]').click();

    cy.waitForApiCall('basketPrecheck');

    // Verify precheck results
    cy.get('[data-testid="token-balance"]').should('contain', '1000');
    cy.get('[data-testid="hype-balance"]').should('contain', '5.0');
    cy.get('[data-testid="precheck-success"]').should('contain', 'Sufficient balance');

    // Step 2: Open basket (assemble)
    cy.get('[data-testid="basket-open-btn"]').should('be.enabled').click();
    cy.waitForApiCall('basketOpen');

    // Verify open success
    cy.get('[data-testid="basket-success-message"]').should('contain', 'Basket assembled successfully');
    cy.get('[data-testid="basket-tx-hash"]').should('contain', '0xbasket123456789');

    // Step 3: Check basket state
    cy.get('[data-testid="basket-state-tab"]').click();
    cy.waitForApiCall('basketState');

    // Verify basket state is displayed
    cy.get('[data-testid="basket-state-panel"]').should('be.visible');
    cy.get('[data-testid="basket-asset-id"]').should('contain', 'basket_001');
    cy.get('[data-testid="basket-balance"]').should('contain', '100');

    // Step 4: Close basket (disassemble)
    cy.get('[data-testid="basket-close-btn"]').click();

    // Close basket modal
    cy.get('[data-testid="close-basket-modal"]').should('be.visible');
    cy.get('[data-testid="close-amount-input"]').clear().type('100');
    cy.get('[data-testid="confirm-close-basket-btn"]').click();

    cy.waitForApiCall('basketClose');

    // Verify close success
    cy.get('[data-testid="basket-success-message"]').should('contain', 'Basket disassembled successfully');
    cy.get('[data-testid="basket-close-tx-hash"]').should('contain', '0xbasketclose123');

    // Verify basket state updates
    cy.waitForApiCall('basketState');
    cy.get('[data-testid="basket-empty-state"]').should('contain', 'No active basket');
  });

  it('should handle insufficient token balance error', () => {
    // Mock insufficient tokens error
    cy.intercept('POST', '**/basket/precheck', {
      statusCode: 400,
      body: {
        code: 'INSUFFICIENT_TOKENS',
        message: 'Not enough index tokens'
      }
    }).as('insufficientTokens');

    cy.get('[data-testid="basket-section"]').should('be.visible');

    // Try to open large basket
    cy.get('[data-testid="basket-amount-input"]').clear().type('999999999');
    cy.get('[data-testid="basket-precheck-btn"]').click();

    cy.waitForApiCall('insufficientTokens', 400);

    // Verify error message
    cy.get('[data-testid="basket-error-message"]').should('contain', 'Not enough index tokens');
    cy.get('[data-testid="basket-open-btn"]').should('be.disabled');
  });

  it('should handle insufficient gas (HYPE) error', () => {
    // Mock insufficient gas error
    cy.intercept('POST', '**/basket/precheck', {
      statusCode: 400,
      body: {
        code: 'INSUFFICIENT_GAS',
        message: 'Not enough HYPE for gas'
      }
    }).as('insufficientGas');

    cy.get('[data-testid="basket-section"]').should('be.visible');

    cy.get('[data-testid="basket-amount-input"]').clear().type('10');
    cy.get('[data-testid="basket-precheck-btn"]').click();

    cy.waitForApiCall('insufficientGas', 400);

    // Verify error message
    cy.get('[data-testid="basket-error-message"]').should('contain', 'Not enough HYPE for gas');
    cy.get('[data-testid="basket-open-btn"]').should('be.disabled');
  });

  it('should validate basket amount input', () => {
    cy.get('[data-testid="basket-section"]').should('be.visible');

    // Test invalid inputs
    cy.get('[data-testid="basket-amount-input"]').clear().type('0');
    cy.get('[data-testid="basket-amount-error"]').should('contain', 'Amount must be greater than 0');

    cy.get('[data-testid="basket-amount-input"]').clear().type('-10');
    cy.get('[data-testid="basket-amount-error"]').should('contain', 'Amount must be positive');

    cy.get('[data-testid="basket-amount-input"]').clear().type('abc');
    cy.get('[data-testid="basket-amount-error"]').should('contain', 'Amount must be a valid number');

    // Precheck button should be disabled with invalid inputs
    cy.get('[data-testid="basket-precheck-btn"]').should('be.disabled');

    // Fix input
    cy.get('[data-testid="basket-amount-input"]').clear().type('100');

    // Precheck button should be enabled with valid input
    cy.get('[data-testid="basket-precheck-btn"]').should('be.enabled');
  });

  it('should handle concurrent basket operations with idempotency', () => {
    // Mock successful response for concurrent test
    cy.intercept('POST', '**/basket/open', {
      statusCode: 200,
      body: {
        status: 'SUBMITTED',
        txHash: '0xbasket123456789',
        idempotent_replay: true
      }
    }).as('basketOpenIdempotent');

    cy.get('[data-testid="basket-section"]').should('be.visible');

    // Precheck first
    cy.get('[data-testid="basket-amount-input"]').clear().type('50');
    cy.get('[data-testid="basket-precheck-btn"]').click();
    cy.waitForApiCall('basketPrecheck');

    // Click open multiple times quickly
    cy.get('[data-testid="basket-open-btn"]').click();
    cy.get('[data-testid="basket-open-btn"]').click();
    cy.get('[data-testid="basket-open-btn"]').click();

    // Should handle gracefully with idempotency
    cy.waitForApiCall('basketOpenIdempotent');

    // Only one success message should be shown
    cy.get('[data-testid="basket-success-message"]').should('have.length', 1);
  });

  it('should display basket state correctly', () => {
    // Mock detailed basket state
    cy.intercept('GET', '**/basket', {
      statusCode: 200,
      body: {
        state: {
          assetId: 'basket_001',
          balance: '100',
          underlyingPositions: [
            { symbol: 'BTC-PERP', size: '0.2', side: 'LONG' },
            { symbol: 'ETH-PERP', size: '2.5', side: 'LONG' }
          ],
          totalValue: '15000.00',
          pnl: '250.00',
          pnlPercent: '1.67'
        }
      }
    }).as('basketStateDetailed');

    cy.get('[data-testid="basket-section"]').should('be.visible');
    cy.get('[data-testid="basket-state-tab"]').click();

    cy.waitForApiCall('basketStateDetailed');

    // Verify detailed state display
    cy.get('[data-testid="basket-asset-id"]').should('contain', 'basket_001');
    cy.get('[data-testid="basket-balance"]').should('contain', '100');
    cy.get('[data-testid="basket-total-value"]').should('contain', '$15,000.00');
    cy.get('[data-testid="basket-pnl"]').should('contain', '$250.00');
    cy.get('[data-testid="basket-pnl-percent"]').should('contain', '1.67%');

    // Verify underlying positions
    cy.get('[data-testid="underlying-positions"]').should('be.visible');
    cy.get('[data-testid="underlying-position"]').should('have.length', 2);
    cy.get('[data-testid="position-symbol"]').first().should('contain', 'BTC-PERP');
    cy.get('[data-testid="position-size"]').first().should('contain', '0.2');
    cy.get('[data-testid="position-symbol"]').last().should('contain', 'ETH-PERP');
    cy.get('[data-testid="position-size"]').last().should('contain', '2.5');
  });

  it('should handle empty basket state', () => {
    // Mock empty basket state
    cy.intercept('GET', '**/basket', {
      statusCode: 200,
      body: {
        state: {
          assetId: null,
          balance: '0',
          underlyingPositions: [],
          totalValue: '0.00',
          pnl: '0.00',
          pnlPercent: '0.00'
        }
      }
    }).as('basketStateEmpty');

    cy.get('[data-testid="basket-section"]').should('be.visible');
    cy.get('[data-testid="basket-state-tab"]').click();

    cy.waitForApiCall('basketStateEmpty');

    // Verify empty state display
    cy.get('[data-testid="basket-empty-state"]').should('be.visible');
    cy.get('[data-testid="basket-empty-message"]').should('contain', 'No active basket');
    cy.get('[data-testid="create-basket-cta"]').should('contain', 'Create your first basket');
  });
});