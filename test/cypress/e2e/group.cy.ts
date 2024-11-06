import { GroupEntity, GroupVisibility } from 'src/types'
import { TESTER_EMAIL, TESTER_PASSWORD } from '../utils/constants'
describe('GroupPage', () => {
  const group = {
    id: 1,
    slug: 'group-one',
    name: 'Group One',
    description: 'Description for group one'
  }

  describe('when the group visibility is public', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/groups/1', {
        statusCode: 200,
        body: {
          ...group,
          visibility: GroupVisibility.Public
        } as GroupEntity
      }).as('getGroup')
      cy.intercept('GET', '/api/groups/1/recommended-events', {
        statusCode: 200,
        body: [{ id: 1, name: 'Event One' }]
      }).as('getRecommendedEvents')
      cy.intercept('POST', '/api/auth/login', {
        statusCode: 200
      }).as('login')

      cy.visit('/groups/group-one--b').then(() => {
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
      cy.dataCy('login-form-email').type(TESTER_EMAIL)
      cy.dataCy('login-form-password').type(TESTER_PASSWORD)
      cy.dataCy('login-form-submit').click()
      cy.wait('@login')
      cy.dataCy('join-group-button').should('be.visible').click()
    })

    it('should display the recommended events', () => {
      cy.dataCy('recommended-events-component').should('be.visible')
    })
  })

  describe('when the group visibility is private', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/groups/1', {
        statusCode: 200,
        body: { ...group, visibility: GroupVisibility.Private } as GroupEntity
      }).as('getGroup')

      cy.visit('/groups/group-one--b').then(() => {
        cy.wait('@getGroup')
      })
    })

    it('should display the request to join group button', () => {
      cy.dataCy('join-group-button').should('be.visible')
    })

    it('should display the private group content', () => {
      cy.dataCy('private-group-content').should('be.visible')
    })
  })

  describe('when the group visibility is authenticated', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/groups/1', {
        statusCode: 200,
        body: { ...group, visibility: GroupVisibility.Authenticated } as GroupEntity
      }).as('getGroup')

      cy.visit('/groups/group-one--b').then(() => {
        cy.wait('@getGroup')
      })
    })

    it('should display the auth group content', () => {
      cy.dataCy('auth-group-content').should('be.visible')
    })
  })
})
