import { GroupPaginationEntity } from 'src/types'

describe('GroupsPage', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/categories', {
      statusCode: 200,
      body: [
        {
          id: 1,
          name: 'Category One'
        }
      ]
    }).as('getCategories')
    cy.intercept('GET', '/api/groups', {
      statusCode: 200,
      body: {
        data: [
          {
            id: 1,
            slug: 'group-one',
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
    cy.dataCy('location-filter').should('be.visible')
    cy.dataCy('categories-filter').should('be.visible')
  })

  it('should reset location filter', () => {
    cy.intercept('GET', 'https://nominatim.openstreetmap.org/search?q=Location&format=json').as('getLocation')
    cy.dataCy('location-filter').should('be.visible').type('Location')
    // cy.wait('@getLocation')
    cy.dataCy('location-filter').withinSelectMenu({
      fn: () => {
        cy.dataCy('location-filter-item-label').contains('Location').click()
      }
    })

    cy.dataCy('groups-reset-filters').should('be.visible').click()
    cy.testRoute('/groups')
  })

  it.only('should reset categories filter', () => {
    cy.dataCy('categories-filter').should('be.visible').click()
    cy.dataCy('categories-filter').withinSelectMenu({
      fn: () => {
        cy.get('.q-item').first().click()
      }
    })
    cy.dataCy('groups-reset-filters').should('be.visible').click()
    cy.testRoute('/groups')
  })
})
