import { EventEntity } from 'src/types'

describe('EventPage', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/events/1', {
      statusCode: 200,
      body: {} as EventEntity
    }).as('getEvent')

    cy.visit('/events/1')
  })

  it.skip('should fetch the event', () => {
    cy.wait('@getEvent')
  })
})
