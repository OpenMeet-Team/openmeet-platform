// Basic test for Matrix chat integration
describe('Matrix Chat Basic Functionality', () => {
  beforeEach(() => {
    // Navigate to home page
    cy.visit('/')

    // Always attempt to login
    cy.login(Cypress.env('APP_TESTING_ADMIN_EMAIL'), Cypress.env('APP_TESTING_ADMIN_PASSWORD'))

    // Navigate to messages page
    cy.visit('/messages')

    // Wait for the messages page title to be visible
    cy.contains('Messages', { timeout: 10000 }).should('be.visible')
  })

  it('should load the chat interface', () => {
    // Basic validation that chat interface has loaded
    cy.dataCy('chat-container').should('exist')

    // Check for key chat interface components
    cy.dataCy('chat-list').should('exist')
    cy.dataCy('chat-input').should('exist')

    // Check if WebSocket functionality is available
    // Matrix uses native WebSockets, not socket.io
    cy.window().should((win) => {
      // Verify WebSocket is defined (should be available in all modern browsers)
      assert.exists(win.WebSocket, 'WebSocket should be supported in the browser')
    })

    // Take a screenshot for manual verification
    cy.screenshot('matrix-chat-interface')
  })
})
