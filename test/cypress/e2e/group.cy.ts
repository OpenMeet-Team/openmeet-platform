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

    cy.visit('/groups/group-one--b').then(() => {
      cy.wait('@getGroup')
    })
  })

  it('should display the group', () => {
    cy.dataCy('group-name').should('be.visible').contains('Group One')
    cy.dataCy('group-description').should('be.visible').contains('Description for group one')
  })

  it('should display the join group button', () => {
    cy.dataCy('join-group-button').should('be.visible')
  })
})
