import { config } from '@vue/test-utils'
// import { cloneDeep } from 'lodash-es'
import { beforeAll, afterAll } from 'vitest'
import { createTestingPinia, TestingOptions } from '@pinia/testing'
import { Plugin } from 'vue'

export function installPinia (options?: Partial<TestingOptions>) {
  const globalConfigBackup = JSON.parse(JSON.stringify(config.global))

  beforeAll(() => {
    config.global.plugins.unshift(
     createTestingPinia(options) as unknown as Plugin
    )
  })

  afterAll(() => {
    config.global = globalConfigBackup
  })
}
