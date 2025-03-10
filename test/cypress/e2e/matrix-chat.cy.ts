describe('Matrix Chat Integration', () => {
  beforeEach(() => {
    // Visit the homepage then login using the custom command
    cy.visit('/').then(() => {
      cy.login(Cypress.env('APP_TESTING_USER_EMAIL'), Cypress.env('APP_TESTING_USER_PASSWORD'))
    })
  })

  it('should display chat rooms', () => {
    // Navigate to chats
    cy.visit('/chats')

    // Check if chat rooms are displayed
    cy.get('.chat-room-list').should('exist')
    cy.get('.chat-room-item').should('have.length.at.least', 0)
  })

  it('should be able to send a message', () => {
    // Navigate to a specific chat room (assuming there's at least one)
    cy.visit('/chats')
    cy.get('.chat-room-item').first().click()

    // Type and send a message
    const testMessage = `Test message ${Date.now()}`
    cy.get('input[name="message"]').type(testMessage)
    cy.get('button[type="submit"]').click()

    // Verify the message appears in the chat
    cy.contains(testMessage).should('exist')
  })

  it('should be able to create a new chat room', () => {
    // Navigate to chats
    cy.visit('/chats')

    // Click on create new room button
    cy.get('button[aria-label="Create new room"]').click()

    // Fill in room details
    const roomName = `Test Room ${Date.now()}`
    cy.get('input[name="roomName"]').type(roomName)
    cy.get('button[type="submit"]').click()

    // Verify the new room appears in the list
    cy.contains(roomName).should('exist')
  })

  it('should be able to invite a user to a room', () => {
    // Navigate to a specific chat room
    cy.visit('/chats')
    cy.get('.chat-room-item').first().click()

    // Click on invite user button
    cy.get('button[aria-label="Invite user"]').click()

    // Select a user to invite
    cy.get('input[name="userSearch"]').type('admin')
    cy.get('.user-search-result').first().click()
    cy.get('button[type="submit"]').click()

    // Verify invitation success message
    cy.contains('User invited successfully').should('exist')
  })
})
