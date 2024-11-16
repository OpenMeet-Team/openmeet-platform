describe('Messages', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/chat', {
      statusCode: 200,
      fixture: 'messages/chats.json'
    }).as('getChatList')

    cy.intercept('GET', '/api/chat?chat=1234567890', {
      statusCode: 200,
      fixture: 'messages/chat.json'
    }).as('getChatById')

    cy.intercept('GET', '/api/chat?user=1234567890', {
      statusCode: 200,
      fixture: 'messages/chat.json'
    }).as('getChatByUser')

    cy.intercept('POST', '/api/chat/*/message', {
      statusCode: 200,
      body: {
        id: 1,
        content: 'Hello, world!',
        sender_id: 1,
        sender_full_name: 'Test User',
        timestamp: new Date().getTime()
      }
    }).as('sendMessage')

    cy.visit('/messages').then(() => {
      cy.loginPage(Cypress.env('APP_TESTING_USER_EMAIL'), Cypress.env('APP_TESTING_USER_PASSWORD'))
      cy.wait('@getChatList')
    })
  })

  it('should display chats', () => {
    cy.dataCy('chat-item').should('be.visible').first().click()
  })

  it('should display chat', () => {
    cy.visit('/messages?user=1234567890').then(() => {
      cy.wait('@getChatByUser')
      cy.dataCy('chat-item').should('be.visible').first().click()
      cy.dataCy('chat-messages').should('be.visible')
    })
  })

  // should send message
  it('should send message', () => {
    cy.visit('/messages?chat=1234567890').then(() => {
      cy.wait('@getChatById')
      cy.dataCy('chat-message-input').type('Hello, world!{enter}')
      cy.wait('@sendMessage')
      // cy.dataCy('chat-message').should('be.visible').contains('Hello, world!')
    })
  })

  // it('should display chats', () => {
  //   cy.visit('/messages').then(() => {
  //     cy.wait('@getChatList')
  //     cy.dataCy('chat-item').should('be.visible')
  //   })
  // })

  // it('should display chat', () => {
  //   cy.visit('/messages?user=1234567890').then(() => {
  //     cy.wait('@getChatList')
  //     cy.wait('@getChatById')
  //     cy.dataCy('chat-item').should('be.visible').first().click()
  //     cy.dataCy('chat-messages').should('be.visible')
  //   })
  // })
})
