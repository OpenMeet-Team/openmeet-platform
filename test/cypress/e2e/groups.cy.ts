import { GroupPaginationEntity } from 'src/types'

describe('GroupsPage', () => {
  beforeEach(() => {
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

    cy.visit('/groups').then(() => {
      cy.wait('@getCategories')
      cy.wait('@getGroups')
    })
  })

  it('should fetch the list of groups', () => {
    cy.dataCy('groups-page').should('be.visible')
    cy.dataCy('groups-item').should('be.visible')
    // cy.dataCy('groups-reset-filters').should('not.be.visible')
    cy.dataCy('location-filter').should('be.visible')
    cy.dataCy('categories-filter').should('be.visible')
  })
})
