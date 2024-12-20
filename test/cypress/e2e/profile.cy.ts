describe('ProfilePage', () => {
  beforeEach(() => {
    cy.visit('/dashboard/profile').then(() => {
      cy.loginPage(Cypress.env('APP_TESTING_ADMIN_EMAIL'), Cypress.env('APP_TESTING_ADMIN_PASSWORD'))
    })
  })

  it('should display and update the profile page', () => {
    cy.dataCy('profile-page').should('be.visible')
    cy.dataCy('profile-form').should('be.visible')
    cy.dataCy('profile-first-name').should('be.visible')
    cy.dataCy('profile-last-name').should('be.visible')
    cy.dataCy('profile-bio').should('be.visible')
    cy.dataCy('profile-photo').should('be.visible')
    cy.dataCy('profile-password').should('be.visible').click()
    cy.dataCy('profile-old-password').should('be.visible')
    cy.dataCy('profile-new-password').should('be.visible')
    cy.dataCy('profile-delete-account').should('be.visible')

    cy.dataCy('profile-update').should('be.visible').click()
  })

  it('should display the email form', () => {
    cy.dataCy('profile-email').should('be.visible').click()
  })
})
