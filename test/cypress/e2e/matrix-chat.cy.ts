// Tests for the Matrix chat integration
describe('Matrix Chat Integration', () => {
  beforeEach(() => {
    // Mock the auth user with Matrix credentials
    cy.intercept('GET', '/api/auth/session', {
      statusCode: 200,
      body: {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        avatar: null,
        matrixUserId: '@test:matrix.example.org',
        matrixAccessToken: 'matrix_token_123',
        matrixDeviceId: 'DEVICE_123'
      }
    }).as('getSession')

    // Mock Matrix provisioning endpoint
    cy.intercept('POST', '/api/matrix/provision-user', {
      statusCode: 200,
      body: {
        matrixUserId: '@test:matrix.example.org',
        matrixAccessToken: 'matrix_token_123',
        matrixDeviceId: 'DEVICE_123'
      }
    }).as('provisionMatrixUser')

    // Mock Matrix SSE events endpoint
    // This is a bit tricky as we can't easily mock an SSE stream in Cypress
    cy.intercept('GET', '/api/matrix/events', {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    }).as('matrixEvents')

    // Mock typing notification endpoint
    cy.intercept('POST', '/api/matrix/*/typing', {
      statusCode: 200,
      body: { success: true }
    }).as('sendTypingNotification')

    // Visit the chat page to test Matrix integration
    cy.visit('/messages')
    cy.wait('@getSession')
  })

  it('should automatically provision a Matrix user if needed', () => {
    // Reset user to not have Matrix credentials
    cy.intercept('GET', '/api/auth/session', {
      statusCode: 200,
      body: {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        avatar: null
        // No Matrix credentials
      }
    }).as('getSessionNoMatrix')

    // Visit messages page and confirm provisioning call was made
    cy.visit('/messages')
    cy.wait('@getSessionNoMatrix')
    cy.wait('@provisionMatrixUser').its('request.method').should('eq', 'POST')
  })

  it('should render a list of chats', () => {
    // Mock the chat list API response
    cy.intercept('GET', '/api/chat', {
      statusCode: 200,
      body: [
        {
          id: 1,
          name: 'Chat Room 1',
          roomId: 'room_id_1',
          lastMessage: {
            content: { body: 'Hello there' },
            sender: '@other:matrix.org',
            origin_server_ts: Date.now() - 60000
          }
        },
        {
          id: 2,
          name: 'Chat Room 2',
          roomId: 'room_id_2',
          lastMessage: {
            content: { body: 'How are you?' },
            sender: '@test:matrix.example.org',
            origin_server_ts: Date.now() - 120000
          }
        }
      ]
    }).as('getChats')

    // Check if chat list renders correctly
    cy.wait('@getChats')
    cy.contains('Chat Room 1').should('be.visible')
    cy.contains('Chat Room 2').should('be.visible')
    cy.contains('Hello there').should('be.visible')
  })

  it('should open a chat and display messages', () => {
    // Mock the chat list API response
    cy.intercept('GET', '/api/chat', {
      statusCode: 200,
      body: [
        {
          id: 1,
          name: 'Chat Room 1',
          roomId: 'room_id_1',
          lastMessage: {
            content: { body: 'Hello there' },
            sender: '@other:matrix.org',
            origin_server_ts: Date.now() - 60000
          }
        }
      ]
    }).as('getChats')

    // Mock the messages for a specific chat
    cy.intercept('GET', '/api/chat/*/messages*', {
      statusCode: 200,
      body: {
        messages: [
          {
            event_id: 'event1',
            room_id: 'room_id_1',
            sender: '@other:matrix.org',
            origin_server_ts: Date.now() - 300000,
            content: {
              body: 'First message',
              msgtype: 'm.text'
            },
            type: 'm.room.message'
          },
          {
            event_id: 'event2',
            room_id: 'room_id_1',
            sender: '@test:matrix.example.org',
            origin_server_ts: Date.now() - 240000,
            content: {
              body: 'Second message',
              msgtype: 'm.text'
            },
            type: 'm.room.message'
          },
          {
            event_id: 'event3',
            room_id: 'room_id_1',
            sender: '@other:matrix.org',
            origin_server_ts: Date.now() - 180000,
            content: {
              body: 'Third message',
              msgtype: 'm.text'
            },
            type: 'm.room.message'
          }
        ],
        nextToken: null
      }
    }).as('getChatMessages')

    // Click on a chat to open it
    cy.wait('@getChats')
    cy.contains('Chat Room 1').click()
    cy.wait('@getChatMessages')

    // Verify messages are displayed
    cy.contains('First message').should('be.visible')
    cy.contains('Second message').should('be.visible')
    cy.contains('Third message').should('be.visible')
  })

  it('should send a message', () => {
    // Mock the chat list and messages
    cy.intercept('GET', '/api/chat', {
      statusCode: 200,
      body: [
        {
          id: 1,
          name: 'Chat Room 1',
          roomId: 'room_id_1',
          lastMessage: {
            content: { body: 'Hello there' },
            sender: '@other:matrix.org',
            origin_server_ts: Date.now() - 60000
          }
        }
      ]
    }).as('getChats')

    cy.intercept('GET', '/api/chat/*/messages*', {
      statusCode: 200,
      body: {
        messages: [],
        nextToken: null
      }
    }).as('getChatMessages')

    // Mock the send message API
    cy.intercept('POST', '/api/chat/*/messages', {
      statusCode: 200,
      body: {
        event_id: 'new_event_id',
        room_id: 'room_id_1',
        sender: '@test:matrix.example.org',
        origin_server_ts: Date.now(),
        content: {
          body: 'Test message',
          msgtype: 'm.text'
        },
        type: 'm.room.message'
      }
    }).as('sendMessage')

    // Open the chat
    cy.wait('@getChats')
    cy.contains('Chat Room 1').click()
    cy.wait('@getChatMessages')

    // Type and send a message
    cy.get('[data-cy="chat-input"]').type('Test message')
    cy.get('[data-cy="send-message-button"]').click()

    // Verify message sent request
    cy.wait('@sendMessage').its('request.body').should('deep.equal', {
      message: 'Test message'
    })

    // Verify the message appears in the UI
    cy.contains('Test message').should('be.visible')
  })

  it('should send typing notifications', () => {
    // Mock the chat list and messages
    cy.intercept('GET', '/api/chat', {
      statusCode: 200,
      body: [
        {
          id: 1,
          name: 'Chat Room 1',
          roomId: 'room_id_1',
          lastMessage: {
            content: { body: 'Hello there' },
            sender: '@other:matrix.org',
            origin_server_ts: Date.now() - 60000
          }
        }
      ]
    }).as('getChats')

    cy.intercept('GET', '/api/chat/*/messages*', {
      statusCode: 200,
      body: {
        messages: [],
        nextToken: null
      }
    }).as('getChatMessages')

    // Open the chat
    cy.wait('@getChats')
    cy.contains('Chat Room 1').click()
    cy.wait('@getChatMessages')

    // Type in the input to trigger typing notification
    cy.get('[data-cy="chat-input"]').type('Hello')

    // Verify typing notification is sent
    cy.wait('@sendTypingNotification').its('request.body').should('deep.equal', {
      isTyping: true
    })

    // Use cy.clock and tick instead of cy.wait for debounce timeout
    cy.clock()
    cy.tick(2500) // Advance time by 2500ms (typing indicator debounce is 2000ms)
    cy.wait('@sendTypingNotification').its('request.body').should('deep.equal', {
      isTyping: false
    })
  })

  it('should show typing indicators when other users are typing', () => {
    // Mock the chat list and messages
    cy.intercept('GET', '/api/chat', {
      statusCode: 200,
      body: [
        {
          id: 1,
          name: 'Chat Room 1',
          roomId: 'room_id_1',
          lastMessage: {
            content: { body: 'Hello there' },
            sender: '@other:matrix.org',
            origin_server_ts: Date.now() - 60000
          }
        }
      ]
    }).as('getChats')

    cy.intercept('GET', '/api/chat/*/messages*', {
      statusCode: 200,
      body: {
        messages: [],
        nextToken: null
      }
    }).as('getChatMessages')

    // Open the chat
    cy.wait('@getChats')
    cy.contains('Chat Room 1').click()
    cy.wait('@getChatMessages')

    // Get the EventSource instance (it's tricky to fully mock SSE in Cypress)
    // Instead, we'll inject a message directly to the window to simulate a Matrix typing event
    cy.window().then((win) => {
      // Add typing indicator event
      const typingEvent = {
        type: 'm.typing',
        room_id: 'room_id_1',
        typing: ['@other:matrix.org']
      }

      // Simulate event being received (this requires the app to have a handler for window custom events)
      win.dispatchEvent(new CustomEvent('matrix-event', { detail: typingEvent }))
    })

    // Verify typing indicator is shown
    cy.contains('is typing...').should('be.visible')
  })

  it('should handle real-time message updates via SSE', () => {
    // Mock the chat list and messages
    cy.intercept('GET', '/api/chat', {
      statusCode: 200,
      body: [
        {
          id: 1,
          name: 'Chat Room 1',
          roomId: 'room_id_1',
          lastMessage: {
            content: { body: 'Hello there' },
            sender: '@other:matrix.org',
            origin_server_ts: Date.now() - 60000
          }
        }
      ]
    }).as('getChats')

    cy.intercept('GET', '/api/chat/*/messages*', {
      statusCode: 200,
      body: {
        messages: [],
        nextToken: null
      }
    }).as('getChatMessages')

    // Open the chat
    cy.wait('@getChats')
    cy.contains('Chat Room 1').click()
    cy.wait('@getChatMessages')

    // Simulate receiving a new message via SSE
    cy.window().then((win) => {
      const newMessage = {
        type: 'm.room.message',
        event_id: 'event_new',
        room_id: 'room_id_1',
        sender: '@other:matrix.org',
        origin_server_ts: Date.now(),
        content: {
          body: 'New real-time message',
          msgtype: 'm.text'
        }
      }

      // Simulate event being received
      win.dispatchEvent(new CustomEvent('matrix-event', { detail: newMessage }))
    })

    // Verify the new message appears in the UI
    cy.contains('New real-time message').should('be.visible')
  })
})
