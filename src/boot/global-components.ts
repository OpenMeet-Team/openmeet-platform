import { boot } from 'quasar/wrappers'
import NoContentComponent from 'components/global/NoContentComponent.vue'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'

export default boot(({ app }) => {
  app.component('NoContentComponent', NoContentComponent)
  app.component('SpinnerComponent', SpinnerComponent)
})
