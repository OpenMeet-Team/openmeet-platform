import { GroupPaginationEntity } from 'src/types'

describe('GroupsPage', () => {
  beforeEach(() => {
    // Intercept the GET /api/groups request
    cy.intercept('GET', '/api/categories', {}).as('getCategories')
    cy.intercept('GET', '/api/groups', {
      statusCode: 200,
      body: {
        data: [
          {
            id: 1,
            name: 'Group One',
            description: 'Description for group one'
          }
        ],
        totalPages: 1,
        page: 1,
        total: 10
      } as GroupPaginationEntity
    }).as('getGroups')

    cy.visit('/groups')
  })

  it('--- fetches the list of groups', () => {
    cy.wait('@getGroups')
    cy.dataCy('groups-page-title').should('be.visible')
  })

  it('--- fetches the list of categories', () => {
    cy.wait('@getCategories')
  })
})
