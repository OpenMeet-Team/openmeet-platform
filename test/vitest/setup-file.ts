// This file will be run before each test file
import { config } from '@vue/test-utils'

config.global.mocks = {
  $t: tKey => tKey // just return translation key
}
