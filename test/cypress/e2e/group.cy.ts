import { GroupEntity } from 'src/types'

describe('GroupPage', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/groups/1', {
      statusCode: 200,
      body: {} as GroupEntity
    }).as('getGroup')

    cy.visit('/groups/1')
  })

  it.skip('--- fetches the group', () => {
    cy.wait('@getGroup')
  })
})
