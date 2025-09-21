describe('Positions Flow E2E', () => {
  beforeEach(() => {
    cy.interceptApiCalls();
    cy.visit('/');
    cy.loginWithDemoToken();
  });

  it('should complete full positions flow: open -> view -> close', () => {
    // Navigate to trading interface
    cy.get('[data-testid="trading-section"]', { timeout: 10000 }).should('be.visible');

    // Step 1: Open position
    cy.get('[data-testid="symbol-select"]').should('be.visible').select('BTC-PERP');
    cy.get('[data-testid="side-select"]').select('LONG');
    cy.get('[data-testid="leverage-input"]').clear().type('5');
    cy.get('[data-testid="notional-input"]').clear().type('1000');
    cy.get('[data-testid="slippage-input"]').clear().type('50');

    // Click precheck first
    cy.get('[data-testid="precheck-btn"]').click();
    cy.waitForApiCall('positionsPrecheck');

    // Verify precheck results are displayed
    cy.get('[data-testid="estimated-entry-price"]').should('contain', '2500.00');
    cy.get('[data-testid="estimated-size"]').should('contain', '0.4');

    // Open position
    cy.get('[data-testid="open-position-btn"]').click();
    cy.waitForApiCall('positionsOpen');

    // Verify success message
    cy.get('[data-testid="success-message"]').should('contain', 'Position opened successfully');
    cy.get('[data-testid="tx-hash"]').should('contain', '0xabcdef123456789');

    // Step 2: View positions
    cy.get('[data-testid="positions-tab"]').click();
    cy.waitForApiCall('positionsList');

    // Verify position appears in list
    cy.get('[data-testid="positions-table"]').should('be.visible');
    cy.get('[data-testid="position-row"]').should('have.length', 1);
    cy.get('[data-testid="position-symbol"]').should('contain', 'BTC-PERP');
    cy.get('[data-testid="position-side"]').should('contain', 'LONG');
    cy.get('[data-testid="position-size"]').should('contain', '0.4');
    cy.get('[data-testid="position-pnl"]').should('contain', '25.00');

    // Step 3: Close position
    cy.get('[data-testid="close-position-btn"]').first().click();

    // Close position modal
    cy.get('[data-testid="close-position-modal"]').should('be.visible');
    cy.get('[data-testid="close-percentage-input"]').clear().type('100');
    cy.get('[data-testid="close-slippage-input"]').clear().type('50');
    cy.get('[data-testid="confirm-close-btn"]').click();

    cy.waitForApiCall('positionsClose');

    // Verify close success
    cy.get('[data-testid="success-message"]').should('contain', 'Position closed successfully');
    cy.get('[data-testid="close-tx-hash"]').should('contain', '0x987654321abcdef');

    // Verify position list updates
    cy.waitForApiCall('positionsList');
    cy.get('[data-testid="positions-empty"]').should('contain', 'No open positions');
  });

  it('should handle position opening errors gracefully', () => {
    // Mock error response
    cy.intercept('POST', '**/positions/precheck', {
      statusCode: 400,
      body: {
        code: 'INSUFFICIENT_BALANCE',
        message: 'Insufficient balance for this position'
      }
    }).as('precheckError');

    cy.get('[data-testid="trading-section"]').should('be.visible');

    // Fill form with invalid data
    cy.get('[data-testid="symbol-select"]').select('BTC-PERP');
    cy.get('[data-testid="notional-input"]').clear().type('999999999'); // Large amount

    cy.get('[data-testid="precheck-btn"]').click();
    cy.waitForApiCall('precheckError', 400);

    // Verify error message is displayed
    cy.get('[data-testid="error-message"]').should('contain', 'Insufficient balance');
    cy.get('[data-testid="open-position-btn"]').should('be.disabled');
  });

  it('should display loading states during API calls', () => {
    // Slow down API response to test loading state
    cy.intercept('POST', '**/positions/precheck', (req) => {
      req.reply({ delay: 2000, statusCode: 200, body: { estimatedEntryPrice: '2500.00' } });
    }).as('slowPrecheck');

    cy.get('[data-testid="trading-section"]').should('be.visible');

    // Fill form
    cy.get('[data-testid="symbol-select"]').select('BTC-PERP');
    cy.get('[data-testid="notional-input"]').clear().type('1000');

    cy.get('[data-testid="precheck-btn"]').click();

    // Verify loading state
    cy.get('[data-testid="precheck-loading"]').should('be.visible');
    cy.get('[data-testid="precheck-btn"]').should('be.disabled');

    cy.waitForApiCall('slowPrecheck');

    // Verify loading state clears
    cy.get('[data-testid="precheck-loading"]').should('not.exist');
    cy.get('[data-testid="precheck-btn"]').should('be.enabled');
  });

  it('should validate form inputs', () => {
    cy.get('[data-testid="trading-section"]').should('be.visible');

    // Test invalid inputs
    cy.get('[data-testid="leverage-input"]').clear().type('101'); // Too high
    cy.get('[data-testid="leverage-error"]').should('contain', 'Maximum leverage is 100');

    cy.get('[data-testid="notional-input"]').clear().type('0'); // Too low
    cy.get('[data-testid="notional-error"]').should('contain', 'Minimum notional is $1');

    cy.get('[data-testid="slippage-input"]').clear().type('1001'); // Too high
    cy.get('[data-testid="slippage-error"]').should('contain', 'Maximum slippage is 1000 bps');

    // Precheck button should be disabled with invalid inputs
    cy.get('[data-testid="precheck-btn"]').should('be.disabled');

    // Fix inputs
    cy.get('[data-testid="leverage-input"]').clear().type('5');
    cy.get('[data-testid="notional-input"]').clear().type('1000');
    cy.get('[data-testid="slippage-input"]').clear().type('50');

    // Precheck button should be enabled with valid inputs
    cy.get('[data-testid="precheck-btn"]').should('be.enabled');
  });
});