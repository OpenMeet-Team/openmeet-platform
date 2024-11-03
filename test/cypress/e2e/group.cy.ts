import { GroupEntity } from 'src/types'

describe('GroupPage', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/groups/1', {
      statusCode: 200,
      body: {
        id: 1,
        slug: 'group-one',
        name: 'Group One',
        description: 'Description for group one'
      } as GroupEntity
    }).as('getGroup')
    cy.intercept('GET', '/api/groups/1/recommended-events', {
      statusCode: 200,
      body: [{ id: 1, name: 'Event One' }]
    }).as('getRecommendedEvents')

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

  it('should display the recommended events', () => {
    cy.dataCy('recommended-events-component').should('be.visible')
  })
})
