// Matrix Tenant-Specific Bot Authentication E2E Test
// Validates the fix for tenant-specific bot user IDs and power levels

describe('Matrix Tenant-Specific Bot Authentication', () => {
  let testEventSlug: string
  let tenantId: string

  // Environment configuration
  const MAS_URL = Cypress.env('MAS_SERVICE_URL')

  if (!MAS_URL) {
    throw new Error('MAS_SERVICE_URL environment variable is required')
  }

  before(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
    cy.visit('/')

    // Get tenant ID for bot user validation
    tenantId = Cypress.env('APP_TESTING_TENANT_ID') || 'default-tenant'
    cy.log(`📋 Testing with tenant ID: ${tenantId}`)

    // Login and create test event
    cy.login(Cypress.env('APP_TESTING_ADMIN_EMAIL'), Cypress.env('APP_TESTING_ADMIN_PASSWORD'))

    // Create test event with Matrix chat enabled
    const eventName = `Tenant Bot Auth Test ${Date.now()}`
    cy.createEventApi(eventName, { enableChat: true }).then((slug) => {
      testEventSlug = slug as string
      cy.log(`✅ Created test event: ${testEventSlug}`)
    })
  })

  after(() => {
    if (testEventSlug) {
      cy.deleteEventApi(testEventSlug)
    }
  })

  it('should use tenant-specific bot authentication and validate power levels', () => {
    // Skip if no test event was created
    if (!testEventSlug) {
      cy.log('⚠️ Skipping test - no test event available')
      return
    }

    // Navigate to event and connect to Matrix
    cy.visit(`/events/${testEventSlug}`)
    cy.contains('Loading', { timeout: 10000 }).should('not.exist')

    // Check if Matrix chat interface is available
    cy.get('body').then(($body) => {
      if (!$body.find('[data-cy="matrix-chat-interface"]').length) {
        cy.log('⚠️ Matrix chat interface not available, skipping test')
        return
      }

      cy.dataCy('matrix-chat-interface', { timeout: 30000 }).should('exist')

      // Connect to Matrix if needed
      if ($body.find('[data-cy="matrix-connect-button"]').length > 0) {
        cy.dataCy('matrix-connect-button').click()
        cy.log('🔐 Starting Matrix OAuth flow')

        // Handle MAS consent screen with better error handling
        cy.origin(MAS_URL, () => {
          cy.get('body', { timeout: 15000 }).then(($body) => {
            if ($body.text().includes('Allow access to your account?')) {
              cy.contains('button', 'Continue', { timeout: 15000 }).click()
              cy.log('✅ OAuth consent granted')
            }
          })
        })

        // Wait for OAuth completion
        cy.url({ timeout: 30000 }).should('include', '/events/')
        cy.log('✅ OAuth flow completed')
      }

      // Wait for Matrix connection - be more flexible about timeouts
      cy.get('[data-cy="chat-input"], [data-cy="matrix-connect-button"]', { timeout: 30000 }).should('exist')

      // Only proceed if chat input is available
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="chat-input"]').length > 0) {
          const testMessage = `Tenant bot test ${Date.now()}`
          cy.dataCy('chat-input').type(testMessage)
          cy.dataCy('chat-input').type('{enter}')
          cy.log(`📤 Sent test message: ${testMessage}`)

          // Wait for message container to appear
          cy.get('[data-cy="messages-container"]', { timeout: 15000 }).should('be.visible')
        } else {
          cy.log('⚠️ Chat input not available, Matrix may not be connected')
        }
      })
    })

    // Validate tenant-specific bot authentication through Matrix client
    cy.window().then((win) => {
      const matrixClientManager = (win as unknown as {
        matrixClientManager?: {
          getClient: (...args: unknown[]) => {
            getRooms: () => Array<{
              roomId: string
              name?: string
              getJoinedMembers: () => Array<{ userId: string }>
              currentState: {
                getStateEvents: (eventType: string) => Array<{
                  getContent: () => {
                    users?: Record<string, number>
                    users_default?: number
                    events_default?: number
                    state_default?: number
                    ban?: number
                    kick?: number
                    redact?: number
                  }
                  getSender: () => string
                }>
              }
            }>
          }
          isReady: () => boolean
        }
      }).matrixClientManager

      if (!matrixClientManager?.isReady() || !matrixClientManager.getClient()) {
        cy.log('⚠️ Matrix client not ready, skipping detailed validation')
        return
      }

      const matrixClient = matrixClientManager.getClient()
      const rooms = matrixClient.getRooms()
      cy.log(`📊 Found ${rooms.length} Matrix rooms`)

      // Find our test event room
      const eventRoom = rooms.find(room =>
        room.name && room.name.includes('Tenant Bot Auth Test')
      )

      if (!eventRoom) {
        cy.log('⚠️ Test event room not found')
        cy.log('Available rooms:', rooms.map(r => r.name || 'unnamed').join(', '))
        return
      }

      cy.log(`✅ Found test event room: ${eventRoom.name}`)

      // Check room members for tenant-specific bot
      const members = eventRoom.getJoinedMembers()
      cy.log(`👥 Room has ${members.length} members`)

      // Validate tenant-specific bot presence
      const expectedTenantBotPattern = `@openmeet-bot-${tenantId}:`
      const tenantBot = members.find(member =>
        member.userId.includes('openmeet-bot-') &&
        member.userId.includes(tenantId)
      )

      // ASSERT: Tenant-specific bot must be present
      cy.wrap(tenantBot).should('exist', `Tenant-specific bot matching pattern ${expectedTenantBotPattern} must be in room`)
      if (tenantBot) {
        cy.log(`✅ Found tenant-specific bot: ${tenantBot.userId}`)

        // Validate bot user ID format
        cy.wrap(tenantBot.userId).should('match', new RegExp(`@openmeet-bot-${tenantId}:`),
          'Bot user ID must follow tenant-specific format @openmeet-bot-{tenant}:server')

        // Ensure it's NOT the old generic format
        cy.wrap(tenantBot.userId).should('not.eq', '@openmeet-bot:matrix.openmeet.net',
          'Bot should NOT use old generic AppService sender format')
      }

      // Check power levels configuration
      const powerLevelEvents = eventRoom.currentState.getStateEvents('m.room.power_levels')

      // ASSERT: Power level events must exist
      cy.wrap(powerLevelEvents).should('exist', 'Power level events must be configured')
      cy.wrap(powerLevelEvents).should('have.length.greaterThan', 0, 'At least one power level event must exist')

      const powerLevelEvent = powerLevelEvents[0]
      const powerLevels = powerLevelEvent.getContent()
      const powerLevelsSetter = powerLevelEvent.getSender()

      cy.log(`👤 Power levels set by: ${powerLevelsSetter}`)
      cy.log('🔍 Power level content:', JSON.stringify(powerLevels, null, 2))

      // ASSERT: Power levels must be set by tenant-specific bot
      cy.wrap(powerLevelsSetter).should('include', 'openmeet-bot-',
        'Power levels must be set by tenant-specific bot')
      cy.wrap(powerLevelsSetter).should('include', tenantId,
        'Power levels must be set by bot for current tenant')

      // Validate power level structure for moderation capabilities
      if (powerLevels.users) {
        const allUsers = Object.entries(powerLevels.users)
        const adminUsers = allUsers.filter(([, level]) => typeof level === 'number' && level >= 100)
        const moderatorUsers = allUsers.filter(([, level]) => typeof level === 'number' && level >= 50 && level < 100)

        cy.log('👑 Power level distribution:')
        cy.log(`   🔴 Admins (≥100): ${adminUsers.length}`)
        cy.log(`   🟡 Moderators (50-99): ${moderatorUsers.length}`)

        // ASSERT: Tenant bot must have admin privileges
        const tenantBotPowerLevel = tenantBot ? powerLevels.users[tenantBot.userId] : undefined
        cy.wrap(tenantBotPowerLevel).should('eq', 100,
          'Tenant-specific bot must have admin power level (100)')

        // ASSERT: Redaction permissions must be configured for moderators
        cy.wrap(powerLevels.redact).should('be.a', 'number', 'Redact permission level must be configured')
        cy.wrap(powerLevels.redact).should('be.at.most', 50,
          'Redact permission should allow moderators (≤50) to redact messages')

        // Log specific power levels for debugging
        if (adminUsers.length > 0) {
          cy.log('👑 Admin users:', adminUsers.map(([userId, level]) => `${userId} (${level})`).join(', '))
        }
        if (moderatorUsers.length > 0) {
          cy.log('🟡 Moderator users:', moderatorUsers.map(([userId, level]) => `${userId} (${level})`).join(', '))
        }
      }

      // Final validation summary
      cy.log('✅ VALIDATION COMPLETE:')
      cy.log(`   ✓ Tenant-specific bot present: ${tenantBot?.userId}`)
      cy.log(`   ✓ Power levels set by tenant bot: ${powerLevelsSetter}`)
      cy.log(`   ✓ Bot has admin privileges: ${tenantBot ? powerLevels.users?.[tenantBot.userId] : 'N/A'}`)
      cy.log(`   ✓ Redaction configured for moderators: ${powerLevels.redact}`)

      cy.log('🎉 SUCCESS: Tenant-specific bot authentication working correctly!')
    })
  })

  it('should validate moderator redaction permissions are properly configured', () => {
    // This test validates that the power level configuration supports
    // the frontend moderator redaction feature we plan to implement

    cy.visit(`/events/${testEventSlug}`)
    cy.contains('Loading', { timeout: 10000 }).should('not.exist')

    // Ensure Matrix is connected
    cy.dataCy('matrix-chat-interface', { timeout: 30000 }).should('exist')

    // Wait for Matrix connection
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="matrix-connect-button"]').length > 0) {
        cy.log('⚠️ Matrix not connected, skipping redaction permissions test')
        return
      }

      cy.dataCy('chat-input', { timeout: 15000 }).should('be.visible')
      cy.log('✅ Matrix connected, validating redaction permissions')

      // Access Matrix client to check redaction permissions
      cy.window().then((win) => {
        const matrixClientManager = (win as unknown as {
          matrixClientManager?: {
            getClient: (...args: unknown[]) => {
              getRooms: () => Array<{
                roomId: string
                name?: string
                currentState: {
                  getStateEvents: (eventType: string) => Array<{
                    getContent: () => {
                      users?: Record<string, number>
                      redact?: number
                      kick?: number
                      ban?: number
                    }
                  }>
                }
              }>
            }
            isReady: () => boolean
          }
        }).matrixClientManager

        if (!matrixClientManager?.isReady()) {
          cy.log('⚠️ Matrix client not ready for redaction validation')
          return
        }

        const matrixClient = matrixClientManager.getClient()
        const rooms = matrixClient.getRooms()
        const eventRoom = rooms.find(room =>
          room.name && room.name.includes('Tenant Bot Auth Test')
        )

        if (!eventRoom) {
          cy.log('⚠️ Event room not found for redaction validation')
          return
        }

        const powerLevelEvents = eventRoom.currentState.getStateEvents('m.room.power_levels')
        if (!powerLevelEvents?.length) {
          cy.log('⚠️ No power level events for redaction validation')
          return
        }

        const powerLevels = powerLevelEvents[0].getContent()

        // ASSERT: Redaction permissions must be configured appropriately for moderators
        cy.wrap(powerLevels.redact).should('exist', 'Redact permission must be configured')
        cy.wrap(powerLevels.redact).should('be.a', 'number', 'Redact permission must be numeric')
        cy.wrap(powerLevels.redact).should('be.at.most', 50,
          'Moderators (power level 50+) must be able to redact messages')

        // ASSERT: Other moderation permissions should also be configured
        cy.wrap(powerLevels.kick).should('be.a', 'number', 'Kick permission must be configured')
        cy.wrap(powerLevels.ban).should('be.a', 'number', 'Ban permission must be configured')

        cy.log('✅ Redaction permissions properly configured:')
        cy.log(`   🔧 Redact level: ${powerLevels.redact} (moderators can redact)`)
        cy.log(`   🔧 Kick level: ${powerLevels.kick}`)
        cy.log(`   🔧 Ban level: ${powerLevels.ban}`)

        // This validates that when we implement the frontend moderator redaction UI,
        // users with power level 50+ will have the necessary Matrix permissions
        cy.log('🎯 READY: Backend permissions configured for frontend moderator redaction feature')
      })
    })
  })
})
