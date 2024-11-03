// import { APP_URL, TESTER_EMAIL, TESTER_PASSWORD, TESTING_TENANT_ID } from './constants'

// Cypress.Commands.add('getAuthToken', (email = TESTER_EMAIL, password = TESTER_PASSWORD) => {
//   return cy.request({
//     method: 'POST',
//     url: `${APP_URL}/api/v1/auth/email/login`,
//     headers: {
//       'tenant-id': TESTING_TENANT_ID
//     },
//     body: { email, password }
//   }).then((response) => {
//     expect(response.status).to.eq(200)
//     return response.body.token
//   })
// })

// Cypress.Commands.add('createGroup', (authToken, groupData) => {
//   return cy.request({
//     method: 'POST',
//     url: `${APP_URL}/api/groups`,
//     headers: {
//       'tenant-id': TESTING_TENANT_ID,
//       Authorization: `Bearer ${authToken}`
//     },
//     body: groupData
//   }).then((response) => {
//     expect(response.status).to.eq(201)
//     return response.body
//   })
// })

// Cypress.Commands.add('createEvent', (authToken, eventData) => {
//   return cy.request({
//     method: 'POST',
//     url: `${APP_URL}/api/events`,
//     headers: {
//       'tenant-id': TESTING_TENANT_ID,
//       Authorization: `Bearer ${authToken}`
//     },
//     body: eventData
//   }).then((response) => {
//     expect(response.status).to.eq(201)
//     return response.body
//   })
// })

// Cypress.Commands.add('deleteGroup', (authToken, groupId) => {
//   return cy.request({
//     method: 'DELETE',
//     url: `${APP_URL}/api/groups/${groupId}`,
//     headers: {
//       'tenant-id': TESTING_TENANT_ID,
//       Authorization: `Bearer ${authToken}`
//     }
//   }).then((response) => {
//     expect(response.status).to.eq(200)
//   })
// })

// Cypress.Commands.add('deleteEvent', (authToken, eventId) => {
//   return cy.request({
//     method: 'DELETE',
//     url: `${APP_URL}/api/events/${eventId}`,
//     headers: {
//       'tenant-id': TESTING_TENANT_ID,
//       Authorization: `Bearer ${authToken}`
//     }
//   }).then((response) => {
//     expect(response.status).to.eq(200)
//   })
// })

// Cypress.Commands.add('getRecommendedEvents', (authToken, eventId, minEvents = 0, maxEvents = 5) => {
//   return cy.request({
//     method: 'GET',
//     url: `${APP_URL}/api/events/${eventId}/recommended-events?minEvents=${minEvents}&maxEvents=${maxEvents}`,
//     headers: {
//       'tenant-id': TESTING_TENANT_ID,
//       Authorization: `Bearer ${authToken}`
//     }
//   }).then((response) => {
//     expect(response.status).to.eq(200)
//     return response.body
//   })
// })

// Cypress.Commands.add('updateEvent', (authToken, eventId, eventData) => {
//   return cy.request({
//     method: 'PATCH',
//     url: `${APP_URL}/api/events/${eventId}`,
//     headers: {
//       'tenant-id': TESTING_TENANT_ID,
//       Authorization: `Bearer ${authToken}`
//     },
//     body: eventData
//   }).then((response) => {
//     expect(response.status).to.eq(200)
//     return response.body
//   })
// })

// Cypress.Commands.add('getAllEvents', (authToken) => {
//   return cy.request({
//     method: 'GET',
//     url: `${APP_URL}/api/events`,
//     headers: {
//       'tenant-id': TESTING_TENANT_ID,
//       Authorization: `Bearer ${authToken}`
//     }
//   }).then((response) => {
//     expect(response.status).to.eq(200)
//     return response.body
//   })
// })

// Cypress.Commands.add('getEvent', (authToken, eventId) => {
//   return cy.request({
//     method: 'GET',
//     url: `${APP_URL}/api/events/${eventId}`,
//     headers: {
//       'tenant-id': TESTING_TENANT_ID,
//       Authorization: `Bearer ${authToken}`
//     }
//   }).then((response) => {
//     expect(response.status).to.eq(200)
//     return response.body
//   })
// })

// Cypress.Commands.add('getMyEvents', (authToken) => {
//   return cy.request({
//     method: 'GET',
//     url: `${APP_URL}/api/dashboard/my-events`,
//     headers: {
//       'tenant-id': TESTING_TENANT_ID,
//       Authorization: `Bearer ${authToken}`
//     }
//   }).then((response) => {
//     expect(response.status).to.eq(200)
//     return response.body
//   })
// })

// Cypress.Commands.add('createCategory', (authToken, categoryData) => {
//   return cy.request({
//     method: 'POST',
//     url: `${APP_URL}/api/categories`,
//     headers: {
//       'tenant-id': TESTING_TENANT_ID,
//       Authorization: `Bearer ${authToken}`
//     },
//     body: categoryData
//   }).then((response) => {
//     expect(response.status).to.eq(201)
//     return response.body
//   })
// })
