// Custom Cypress commands for event creation and management

// Note: Type definitions for these commands are in commands.ts
// to avoid linting errors with namespace declarations

// Create a new event directly using the backend API
Cypress.Commands.add('createEventApi', (name: string, options = {}) => {
  const eventSlug = name.toLowerCase().replace(/\s+/g, '-')

  // Set default options
  const eventOptions = {
    description: `Description for ${name}`,
    startDate: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    endDate: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
    location: 'Test Location',
    maxAttendees: 10,
    requireApproval: false,
    approvalQuestion: '',
    visibility: 'public',
    cleanup: true,
    latitude: 12.3456,
    longitude: 12.3456,
    // Add required fields that were missing and caused 422 errors
    type: 'in-person', // Required field
    categories: [4], // Required field
    ...options
  }

  // Get the authentication token from local storage with better error logging
  cy.window().then((win) => {
    // Get token from localStorage, handling Quasar's prefix format if present
    let authToken = win.localStorage.getItem('token')
    let refreshToken = win.localStorage.getItem('refreshToken')

    // Check if the token has Quasar's __q_strn| prefix and remove it
    if (authToken && authToken.startsWith('__q_strn|')) {
      authToken = authToken.substring('__q_strn|'.length)
      cy.log('Removed Quasar prefix from token')
    }

    if (refreshToken && refreshToken.startsWith('__q_strn|')) {
      refreshToken = refreshToken.substring('__q_strn|'.length)
      cy.log('Removed Quasar prefix from refresh token')
    }

    // Log token state without exposing actual token values
    cy.log(`Authentication token status: ${authToken ? 'Present' : 'Missing'}`)
    cy.log(`Refresh token status: ${refreshToken ? 'Present' : 'Missing'}`)

    // Check if token is available
    if (!authToken) {
      cy.log('No authentication token found - falling back to UI approach')
      // Return early with blank slug to trigger fallback
      return cy.wrap('')
    }

    // Get tenant ID from Cypress env var with no fallback
    const tenantId = Cypress.env('APP_TESTING_TENANT_ID')
    if (!tenantId) {
      throw new Error('APP_TESTING_TENANT_ID environment variable is not set. This is required for tests.')
    }
    cy.log(`Using tenant ID: ${tenantId}`)

    // Use the API URL from Cypress env var with no fallback
    // This is important for JWT tokens which are often bound to specific domains
    const apiBaseUrl = Cypress.env('APP_TESTING_API_URL')
    if (!apiBaseUrl) {
      throw new Error('APP_TESTING_API_URL environment variable is not set. This is required for tests.')
    }
    const apiUrl = `${apiBaseUrl}/api/events`
    cy.log(`Using API URL: ${apiUrl}`)

    cy.request({
      method: 'POST',
      url: apiUrl,
      failOnStatusCode: false, // Don't fail on non-2xx response
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId
      },
      body: {
        name,
        description: eventOptions.description,
        startDate: eventOptions.startDate,
        endDate: eventOptions.endDate,
        latitude: eventOptions.latitude,
        longitude: eventOptions.longitude,
        location: eventOptions.location,
        maxAttendees: eventOptions.maxAttendees,
        requireApproval: eventOptions.requireApproval,
        approvalQuestion: eventOptions.approvalQuestion,
        visibility: eventOptions.visibility,
        // Add required fields that were missing
        type: eventOptions.type,
        categories: eventOptions.categories
      }
    }).then((response) => {
      // Check for a successful API response (status 201-Created)
      if (response.status !== 201) {
        cy.log(`API call failed with status ${response.status}`)
        cy.log(`Response body: ${JSON.stringify(response.body)}`)

        // If the response contains a slug, still try to use it
        if (response.body?.slug) {
          cy.log(`Using slug from response despite error: ${response.body.slug}`)
          return cy.wrap(response.body.slug)
        }

        // Otherwise fall back to the calculated eventSlug
        cy.log(`Falling back to calculated eventSlug: ${eventSlug}`)
        return cy.wrap(eventSlug)
      }

      // Extract the slug from response
      const slug = response.body?.slug || eventSlug
      cy.log(`Successfully created event with slug: ${slug}`)

      // If cleanup is enabled, store the event slug for later deletion
      if (eventOptions.cleanup) {
        Cypress.env('lastCreatedEventSlug', slug)
      }

      // Return the event slug
      return cy.wrap(slug)
    })
  })
})

// Legacy event creation through UI - kept for reference
Cypress.Commands.add('createEvent', (name: string, options = {}) => {
  const eventSlug = name.toLowerCase().replace(/\s+/g, '-')

  // Set default options
  const eventOptions = {
    description: `Description for ${name}`,
    startDate: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    endDate: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
    location: 'Test Location',
    maxAttendees: 10,
    requireApproval: false,
    approvalQuestion: '',
    visibility: 'public',
    cleanup: true,
    ...options
  }

  // Listen for API calls but use real responses
  cy.intercept('GET', '/api/groups/me').as('getMyGroups')
  cy.intercept('POST', '/api/events').as('createEvent')
  cy.intercept('POST', '/api/v1/files/upload').as('uploadImage')
  cy.intercept('GET', 'https://nominatim.openstreetmap.org/search*').as('getLocations')

  // Open the create event form
  cy.dataCy('header-nav-add-event-button').should('be.visible').click()
  cy.wait('@getMyGroups').then(() => {
    // Fill out the event form
    cy.dataCy('event-name-input').should('be.visible').type(name)

    // Event group selection may not be visible depending on user groups
    // Check if it exists first and only interact with it if found
    cy.dataCy('event-group').then($group => {
      if ($group.length > 0) {
        cy.wrap($group).should('be.visible')
      } else {
        cy.log('No groups available for this user, skipping group selection')
      }
    })

    cy.dataCy('event-description').type(eventOptions.description)

    // Set dates
    cy.dataCy('event-start-date').type(eventOptions.startDate)
    cy.dataCy('event-set-end-time').click()
    cy.dataCy('event-end-date').type(eventOptions.endDate)

    // Upload an image
    cy.dataCy('event-image').within(() => {
      cy.get('input[type=file]').selectFile({
        contents: Cypress.Buffer.from('image contents here', 'base64'),
        fileName: 'image.png',
        mimeType: 'image/png',
        lastModified: Date.now()
      })
      cy.wait('@uploadImage')
    })

    // Set location
    cy.dataCy('event-location').should('be.visible').type(eventOptions.location)
    cy.wait('@getLocations')
    cy.dataCy('event-location').withinSelectMenu({
      fn: () => {
        cy.dataCy('location-item-label').first().click()
      }
    })

    // Set max attendees
    cy.dataCy('event-max-attendees').click()
    cy.dataCy('event-max-attendees-input').should('be.visible').type(eventOptions.maxAttendees.toString())

    // Set approval if required
    if (eventOptions.requireApproval) {
      cy.dataCy('event-require-approval').click()
      cy.dataCy('event-approval-question').type(eventOptions.approvalQuestion || 'Approval question')
    }

    // Set visibility
    cy.dataCy('event-visibility').should('be.visible').click()
    cy.dataCy('event-visibility').withinSelectMenu({
      fn: () => {
        // Select the appropriate visibility option based on the provided value
        let index = 0 // Default to first item (public)
        if (eventOptions.visibility === 'private') index = 1
        if (eventOptions.visibility === 'authenticated') index = 2

        cy.get('.q-item').eq(index).click()
      }
    })

    // Publish the event
    cy.dataCy('event-publish').click()

    // Wait for the event to be created and verify redirection
    cy.wait('@createEvent').then(() => {
      cy.url().should('include', `/events/${eventSlug}`)

      // If cleanup is enabled, store the event slug for later deletion
      if (eventOptions.cleanup) {
        Cypress.env('lastCreatedEventSlug', eventSlug)
      }

      // Return the event slug
      return cy.wrap(eventSlug)
    })
  })
})

// Delete an event with the given slug via direct API call
Cypress.Commands.add('deleteEventApi', (slug: string) => {
  // Get the authentication token from local storage with better error logging
  cy.window().then((win) => {
    // Get token from localStorage, handling Quasar's prefix format if present
    let authToken = win.localStorage.getItem('token')
    let refreshToken = win.localStorage.getItem('refreshToken')

    // Check if the token has Quasar's __q_strn| prefix and remove it
    if (authToken && authToken.startsWith('__q_strn|')) {
      authToken = authToken.substring('__q_strn|'.length)
      cy.log('Removed Quasar prefix from token for deletion')
    }

    if (refreshToken && refreshToken.startsWith('__q_strn|')) {
      refreshToken = refreshToken.substring('__q_strn|'.length)
      cy.log('Removed Quasar prefix from refresh token for deletion')
    }

    // Log token state without exposing actual token values
    cy.log(`Authentication token status for deletion: ${authToken ? 'Present' : 'Missing'}`)
    cy.log(`Refresh token status for deletion: ${refreshToken ? 'Present' : 'Missing'}`)

    // Check if token is available
    if (!authToken) {
      cy.log('No authentication token found for deletion - falling back to UI approach')
      // Return early with false to trigger fallback
      return cy.wrap(false)
    }

    // Get tenant ID from Cypress env var with no fallback
    const tenantId = Cypress.env('APP_TESTING_TENANT_ID')
    if (!tenantId) {
      throw new Error('APP_TESTING_TENANT_ID environment variable is not set. This is required for deletion.')
    }
    cy.log(`Using tenant ID for deletion: ${tenantId}`)

    // Use the API URL from Cypress env var with no fallback
    const apiBaseUrl = Cypress.env('APP_TESTING_API_URL')
    if (!apiBaseUrl) {
      throw new Error('APP_TESTING_API_URL environment variable is not set. This is required for deletion.')
    }
    const apiUrl = `${apiBaseUrl}/api/events/${slug}`
    cy.log(`Using API URL for deletion: ${apiUrl}`)

    cy.request({
      method: 'DELETE',
      url: apiUrl,
      failOnStatusCode: false, // Don't fail on non-2xx response
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId
      }
    }).then((response) => {
      // Check for any 2xx status code for success (200, 204, etc.)
      if (!response.status.toString().startsWith('2')) {
        cy.log(`Delete API call failed with status ${response.status}`)
        cy.log(`Response body: ${JSON.stringify(response.body)}`)

        // If status is 404, the event might already be deleted
        if (response.status === 404) {
          cy.log('Event not found (404) - it may have already been deleted')
          return cy.wrap(true)
        }

        // Any other non-2xx status code is considered a failure
        return cy.wrap(false)
      }

      cy.log(`Successfully deleted event with slug: ${slug}`)
      return cy.wrap(true)
    })
  })
})

// Legacy delete event through UI - kept for reference
Cypress.Commands.add('deleteEvent', (slug: string) => {
  // Listen for the delete API call using real API
  cy.intercept('DELETE', `/api/events/${slug}`).as('deleteEvent')

  // Navigate to the dashboard to delete the event
  cy.visit('/dashboard/events')

  // Find the event in the list and delete it
  cy.contains(slug).parent().find('[data-cy="event-delete-button"]').click()
  cy.dataCy('confirm-delete-button').click()

  // Wait for the delete API call to complete
  cy.wait('@deleteEvent')
})

// Import this file in commands.ts to make the commands available
export {}
