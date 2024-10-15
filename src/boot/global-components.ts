import { boot } from 'quasar/wrappers'
import NoContentComponent from 'components/global/NoContentComponent.vue'
import { QCalendar } from '@quasar/quasar-ui-qcalendar'
import '@quasar/quasar-ui-qcalendar/src/css/q-calendar.sass'

export default boot(({ app }) => {
  app.component('NoContentComponent', NoContentComponent)
  app.component('QCalendar', QCalendar)
})
