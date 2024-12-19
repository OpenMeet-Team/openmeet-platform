describe('HomePage', () => {
  describe('UserHomePage', () => {
    beforeEach(() => {
      // cy.intercept('GET', '/api/home/guest', {
      //   statusCode: 200,
      //   fixture: 'home/guest.json'
      // }).as('getGuestHome')
      // cy.intercept('GET', '/api/home/user', {
      //   statusCode: 200,
      //   fixture: 'home/user.json'
      // }).as('getUserHome')
      cy.visit('/').then(() => {
        // cy.wait('@getGuestHome')
        // cy.loginPage(Cypress.env('APP_TESTING_ADMIN_EMAIL'), Cypress.env('APP_TESTING_ADMIN_PASSWORD'))
        cy.login(Cypress.env('APP_TESTING_ADMIN_EMAIL'), Cypress.env('APP_TESTING_ADMIN_PASSWORD'))
      })
    })

    it('should have home user page components', () => {
      cy.dataCy('home-user-page').should('be.visible').within(() => {
        cy.dataCy('home-user-organized-groups-component').should('be.visible')
        cy.dataCy('home-user-upcoming-events-item-component').should('be.visible')
        cy.dataCy('home-user-interests-item-component').should('be.visible')
        cy.dataCy('home-user-recent-event-drafts-item-component').should('be.visible')
        cy.dataCy('home-user-member-groups-item-component').should('be.visible')
      })
    })
  })

  describe('GuestHomePage', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/home/guest', {
        statusCode: 200,
        fixture: 'home/guest.json'
      }).as('getGuestHome')
      cy.visit('/').then(() => {
        cy.wait('@getGuestHome')
      })
    })

    it('should have featured groups', () => {
      cy.dataCy('header-logo-component').should('be.visible')
      cy.dataCy('home-featured-groups').should('be.visible')
      cy.dataCy('home-upcoming-events').should('be.visible')
      cy.dataCy('home-categories').should('be.visible')
      cy.dataCy('home-interests').should('be.visible')
    })
  })
})
