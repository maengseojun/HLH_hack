/// <reference types="cypress" />

// Custom commands for HyperIndex E2E tests

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login with demo token
       */
      loginWithDemoToken(): Chainable<void>

      /**
       * Intercept API calls with mock responses
       */
      interceptApiCalls(): Chainable<void>

      /**
       * Wait for API response and verify status
       */
      waitForApiCall(alias: string, expectedStatus?: number): Chainable<void>
    }
  }
}

Cypress.Commands.add('loginWithDemoToken', () => {
  const demoToken = Cypress.env('demoToken');
  cy.window().then((win) => {
    win.localStorage.setItem('auth_token', demoToken);
  });
});

Cypress.Commands.add('interceptApiCalls', () => {
  const apiBaseUrl = Cypress.env('apiBaseUrl');

  // Mock responses for positions flow
  cy.intercept('POST', `${apiBaseUrl}/v1/indexes/*/positions/precheck`, {
    statusCode: 200,
    body: {
      estimatedEntryPrice: '2500.00',
      estimatedSize: '0.4',
      estimatedFee: '5.00',
      leverage: 5,
      notionalUsd: 1000
    }
  }).as('positionsPrecheck');

  cy.intercept('POST', `${apiBaseUrl}/v1/indexes/*/positions/open`, {
    statusCode: 200,
    body: {
      positionId: 'pos_test_123',
      txHash: '0xabcdef123456789',
      status: 'SUBMITTED'
    }
  }).as('positionsOpen');

  cy.intercept('GET', `${apiBaseUrl}/v1/indexes/*/positions`, {
    statusCode: 200,
    body: [
      {
        positionId: 'pos_test_123',
        symbol: 'BTC-PERP',
        side: 'LONG',
        size: '0.4',
        entryPrice: '2500.00',
        leverage: 5,
        pnl: '25.00',
        pnlPercent: '2.5'
      }
    ]
  }).as('positionsList');

  cy.intercept('POST', `${apiBaseUrl}/v1/indexes/*/positions/close`, {
    statusCode: 200,
    body: {
      txHash: '0x987654321abcdef',
      status: 'SUBMITTED'
    }
  }).as('positionsClose');

  // Mock responses for basket flow
  cy.intercept('POST', `${apiBaseUrl}/v1/indexes/*/basket/precheck`, {
    statusCode: 200,
    body: {
      ok: true,
      tokenBal: '1000',
      hypeBal: '5000000000000000000'
    }
  }).as('basketPrecheck');

  cy.intercept('POST', `${apiBaseUrl}/v1/indexes/*/basket/open`, {
    statusCode: 200,
    body: {
      status: 'SUBMITTED',
      txHash: '0xbasket123456789'
    }
  }).as('basketOpen');

  cy.intercept('GET', `${apiBaseUrl}/v1/indexes/*/basket`, {
    statusCode: 200,
    body: {
      state: {
        assetId: 'basket_001',
        balance: '100',
        underlyingPositions: []
      }
    }
  }).as('basketState');

  cy.intercept('POST', `${apiBaseUrl}/v1/indexes/*/basket/close`, {
    statusCode: 200,
    body: {
      status: 'SUBMITTED',
      txHash: '0xbasketclose123'
    }
  }).as('basketClose');
});

Cypress.Commands.add('waitForApiCall', (alias: string, expectedStatus: number = 200) => {
  cy.wait(`@${alias}`).then((interception) => {
    expect(interception.response?.statusCode).to.eq(expectedStatus);
  });
});

export {};