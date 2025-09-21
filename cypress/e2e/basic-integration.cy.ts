describe('Basic Integration Test', () => {
  it('should load the frontend and verify backend connection', () => {
    // Visit the frontend
    cy.visit('/');

    // Check that the page loads
    cy.get('body').should('be.visible');

    // Test backend health endpoint
    cy.request('GET', 'http://localhost:3001/health').then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('status', 'ok');
    });
  });

  it('should test backend API endpoints', () => {
    // Test authentication requirement
    cy.request({
      method: 'POST',
      url: 'http://localhost:3001/v1/indexes/test-index-1/positions/precheck',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        symbol: 'ETH-PERP',
        side: 'LONG',
        leverage: 5,
        notionalUsd: 1000,
        slippageBps: 50
      },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(401);
      expect(response.body.error.code).to.eq('UNAUTHORIZED');
    });
  });

  it('should demonstrate full stack integration', () => {
    // Step 1: Load frontend
    cy.visit('/');
    cy.get('body').should('contain.text', 'Loading');

    // Step 2: Verify backend is running
    cy.request('http://localhost:3001/health').should((response) => {
      expect(response.status).to.eq(200);
    });

    // Step 3: Test various backend endpoints
    const endpoints = [
      '/health',
      '/v1/meta',
      '/v1/info'
    ];

    endpoints.forEach(endpoint => {
      cy.request({
        url: `http://localhost:3001${endpoint}`,
        failOnStatusCode: false
      }).then((response) => {
        // Should respond (may be 200, 401, or 404 depending on endpoint)
        expect(response.status).to.be.oneOf([200, 401, 404]);
      });
    });
  });

  it('should test API error handling', () => {
    // Test invalid JSON
    cy.request({
      method: 'POST',
      url: 'http://localhost:3001/v1/indexes/test/positions/precheck',
      headers: {
        'Content-Type': 'application/json'
      },
      body: 'invalid json',
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.be.oneOf([400, 401, 500]);
    });

    // Test missing headers
    cy.request({
      method: 'POST',
      url: 'http://localhost:3001/v1/indexes/test/positions/precheck',
      body: {
        symbol: 'ETH-PERP'
      },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.be.oneOf([400, 401]);
    });
  });

  it('should verify environment configuration', () => {
    // Check that servers are running on expected ports
    cy.request('http://localhost:3001/health').should((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.status).to.eq('ok');
    });

    // Visit frontend
    cy.visit('/');
    cy.url().should('include', 'localhost:3002');
  });
});