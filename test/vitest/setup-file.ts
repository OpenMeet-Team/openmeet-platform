// This file will be run before each test file
import { config } from '@vue/test-utils'

config.global.mocks = {
  $t: (tKey: string): string => tKey // returns the translation key as a string
}
