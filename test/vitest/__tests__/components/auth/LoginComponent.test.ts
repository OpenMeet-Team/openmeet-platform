// src/components/__tests__/LoginPage.spec.ts
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { mount } from '@vue/test-utils'
import { Notify } from 'quasar'
import { describe, it, expect, vi } from 'vitest'
import LoginPage from '../../../../../src/components/auth/LoginComponent.vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../../../../src/stores/auth-store'
import { installPinia } from '../../../install-pinia'
import { installRouter } from '../../../install-router'

installQuasarPlugin({ plugins: { Notify } })
installPinia({ stubActions: false, createSpy: vi.fn })
installRouter({
  spy: {
    create: fn => vi.fn(fn),
    reset: spy => spy.mockClear()
  }
})

describe('LoginPage.vue', () => {
  it('--- renders login form correctly', () => {
    const wrapper = mount(LoginPage)

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
  })

  it.skip('--- validates email and password on form submission', async () => {
    const authStore = useAuthStore()
    const router = useRouter()
    const wrapper = mount(LoginPage)

    // Find input fields and submit button
    const emailInput = wrapper.find('input[type="email"]')
    const passwordInput = wrapper.find('input[type="password"]')
    const submitButton = wrapper.find('button[type="submit"]')

    // Set invalid email and empty password
    await emailInput.setValue('invalid-email')
    await passwordInput.setValue('')

    // Submit the form
    await submitButton.trigger('submit')

    // Check if the store login action is not called due to invalid form data
    expect(authStore.actionLogin).not.toHaveBeenCalled()

    // Set valid email and password
    await emailInput.setValue('test@example.com')
    await passwordInput.setValue('validPassword123')

    // Submit the form again
    await submitButton.trigger('submit')
    // Check if the login action is called with correct email and password
    expect(authStore.actionLogin).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'validPassword123'
    })

    // Ensure the router pushes after successful login
    expect(router.push).toHaveBeenCalledWith('/')
  })

  it.skip('--- displays error notification on login failure', async () => {
    const authStore = useAuthStore()
    authStore.actionLogin = vi.fn().mockRejectedValueOnce(new Error('Login failed'))
    const wrapper = mount(LoginPage)

    const emailInput = wrapper.find('input[type="email"]')
    const passwordInput = wrapper.find('input[type="password"]')
    const submitButton = wrapper.find('button[type="submit"]')

    // Set valid email and password
    await emailInput.setValue('test@example.com')
    await passwordInput.setValue('invalidPassword123')

    // Submit the form
    await submitButton.trigger('submit')

    // const notify = vi.spyOn(Notify, 'create')
    // expect(notify.create).toBeTruthy()
    // expect(notify.create).toHaveBeenCalled()
    // expect(Notify.create).toHaveBeenCalledWith(expect.objectContaining({
    //   color: 'negative',
    //   textColor: 'white',
    //   icon: 'warning',
    //   message: 'Please provide a valid email and password'
    // }))
  })
})
