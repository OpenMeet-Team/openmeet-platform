import { boot } from 'quasar/wrappers'
import { App } from 'vue'

interface EventData {
  name: string;
  data: never;
  timestamp: Date;
}

class AnalyticsHandler {
  private eventQueue: EventData[] = []
  private isProcessing: boolean = false

  trackEvent (eventName: string, eventData: never): void {
    this.eventQueue.push({ name: eventName, data: eventData, timestamp: new Date() })
    this.processQueue()
  }

  private async processQueue (): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) return

    this.isProcessing = true

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()
      if (event) {
        await this.sendEvent(event)
      }
    }

    this.isProcessing = false
  }

  private async sendEvent (event: EventData): Promise<void> {
    // Implement your actual analytics sending logic here
    // This could be an API call to your analytics service
    console.log('Sending event:', event)

    // Simulating an API call
    await new Promise(resolve => setTimeout(resolve, 300))
  }
}

const analyticsHandler = new AnalyticsHandler()

export default boot(({ app }: { app: App }) => {
  app.config.globalProperties.$analytics = analyticsHandler
})

export { analyticsHandler }
