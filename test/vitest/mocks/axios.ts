import { vi } from 'vitest'

vi.mock('axios', () => ({
  default: ({
    create: () => ({
      interceptors: {
        request: { use: vi.fn(), eject: vi.fn() },
        response: { use: vi.fn(), eject: vi.fn() }
      },
      get: vi.fn((route) => {
        return Promise.resolve({ route, data: [] })
      }),
      post: vi.fn((route, data) => {
        return Promise.resolve({ route, data })
      }),
      put: vi.fn((route, data) => {
        return Promise.resolve({ route, data })
      }),
      delete: vi.fn((route) => {
        return Promise.resolve({ route, data: [] })
      })
    })
  })
}))
