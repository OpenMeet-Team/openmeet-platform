/// <reference types="cypress" />

declare namespace Cypress {
    interface Chainable {
        /**
         * Custom command to log in with username and password
         * @example cy.login('user@example.com', 'password123')
         */
        login(username: string, password: string): Chainable<void>;

        /**
         * Custom command to log in on the login page
         * @example cy.loginPage('user@example.com', 'password123')
         */
        loginPage(username: string, password: string): Chainable<void>;

        /**
         * Custom command to log out
         * @example cy.logout()
         */
        logout(): Chainable<void>;

        /**
         * Custom command to log in with Bluesky
         * @example cy.loginBluesky('handle', 'password123')
         */
        loginBluesky(username: string, password: string): Chainable<void>;

        /**
         * Custom command to simulate Bluesky authentication
         * @example cy.simulateBlueskyAuth()
         */
        simulateBlueskyAuth(): Chainable<void>;

        /**
         * Custom command to mock Bluesky authentication for API testing
         * @example cy.mockBlueskyAuth()
         */
        mockBlueskyAuth(): Chainable<void>;

        /**
         * Custom command to perform real Bluesky OAuth authentication
         * @example cy.authenticateWithBluesky()
         */
        authenticateWithBluesky(): Chainable<void>;

        /**
         * Custom command to directly authenticate with Bluesky bypassing OAuth
         * @example cy.directBlueskyAuth()
         */
        directBlueskyAuth(): Chainable<void>;
    }
}
