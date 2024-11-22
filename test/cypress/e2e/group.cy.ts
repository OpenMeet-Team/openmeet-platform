import { GroupEntity, GroupVisibility } from 'src/types'

describe('GroupPage', () => {
  const group = {
    id: 1,
    slug: 'group-one',
    name: 'Group One',
    description: 'Description for group one'
  }

  describe('when the group visibility is public', () => {
    beforeEach(() => {
      cy.intercept('GET', `/api/groups/${group.slug}`, {
        statusCode: 200,
        body: {
          ...group,
          visibility: GroupVisibility.Public
        } as GroupEntity
      }).as('getGroup')
      cy.intercept('GET', `/api/groups/${group.slug}/recommended-events`, {
        statusCode: 200,
        body: [{ id: 1, name: 'Event One', slug: 'event-one' }]
      }).as('getRecommendedEvents')
      cy.intercept('POST', '/api/auth/login', {
        statusCode: 200
      }).as('login')

      cy.visit(`/groups/${group.slug}`).then(() => {
        cy.wait('@getGroup')
        cy.wait('@getRecommendedEvents')
      })
    })

    it('should display the group', () => {
      cy.dataCy('group-name').should('be.visible')
    })

    it('should display the join group button', () => {
      cy.dataCy('join-group-button').should('be.visible')
    })

    it('should display login popup when clicking on join group button', () => {
      cy.dataCy('join-group-button').click()
      cy.dataCy('login-form').should('be.visible')
    })

    it('should join the group when clicking on join group button', () => {
      cy.dataCy('join-group-button').click()
      cy.dataCy('login-form').should('be.visible')
      cy.dataCy('login-email').type(Cypress.env('APP_TESTING_USER_EMAIL'))
      cy.dataCy('login-password').type(Cypress.env('APP_TESTING_USER_PASSWORD'))
      cy.dataCy('login-submit').click()
      cy.dataCy('join-group-button').should('be.visible').click()
    })

    it('should display the recommended events', () => {
      cy.dataCy('recommended-events-component').should('be.visible')
    })

    it('should display the group events page', () => {
      cy.visit(`/groups/${group.slug}/events`)
      cy.dataCy('group-events-page').should('be.visible')
    })

    it('should display the group members page', () => {
      cy.visit(`/groups/${group.slug}/members`)
      cy.dataCy('group-members-page').should('be.visible')
    })

    it('should display the group discussions page', () => {
      cy.visit(`/groups/${group.slug}/discussions`)
      cy.dataCy('group-discussions-page').should('be.visible')
    })
  })

  describe('when the group visibility is private', () => {
    beforeEach(() => {
      cy.intercept('GET', `/api/groups/${group.slug}`, {
        statusCode: 200,
        body: { ...group, visibility: GroupVisibility.Private } as GroupEntity
      }).as('getGroup')

      cy.visit(`/groups/${group.slug}`).then(() => {
        cy.wait('@getGroup')
      })
    })

    it('should display the request to join group button', () => {
      cy.dataCy('join-group-button').should('be.visible')
    })

    it('should display the private group content', () => {
      cy.dataCy('private-group-content').should('be.visible')
    })

    it('should show not permission page when trying to access to group events page', () => {
      cy.visit(`/groups/${group.slug}/events`)
      cy.dataCy('no-permission-group-events-page').should('be.visible')
    })

    it('should show not permission page when trying to access to group members page', () => {
      cy.visit(`/groups/${group.slug}/members`)
      cy.dataCy('no-permission-group-members-page').should('be.visible')
    })

    it('should show not permission page when trying to access to group discussions page', () => {
      cy.visit(`/groups/${group.slug}/discussions`)
      cy.dataCy('no-permission-group-discussions-page').should('be.visible')
    })
  })

  describe('when the group visibility is authenticated', () => {
    beforeEach(() => {
      cy.intercept('GET', `/api/groups/${group.slug}`, {
        statusCode: 200,
        body: {
          ...group,
          visibility: GroupVisibility.Authenticated
        } as GroupEntity
      }).as('getGroup')

      cy.visit(`/groups/${group.slug}`).then(() => {
        cy.wait('@getGroup')
      })
    })

    it('should display the auth group content', () => {
      cy.dataCy('auth-group-content').should('be.visible')
    })

    it('should show please authenticate page when trying to access to group events page', () => {
      cy.visit(`/groups/${group.slug}/events`)
      cy.dataCy('no-permission-group-events-page').should('be.visible')
    })
  })
})
