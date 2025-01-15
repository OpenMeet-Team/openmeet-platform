import { boot } from 'quasar/wrappers'
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load'
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { ZoneContextManager } from '@opentelemetry/context-zone'

export default boot(() => {
  if (process.env.VITE_ENABLE_TRACING !== 'true') {
    console.log('Tracing disabled')
    return
  }

  const endpoint = process.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT + '/v1/traces'
  console.log('Tracing endpoint:', endpoint)

  const provider = new WebTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'openmeet-frontend',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.VITE_APP_VERSION || '1.0.0'
    })
  })

  provider.addSpanProcessor(
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: endpoint,
        headers: {},
        timeoutMillis: 5000
      }),
      {
        maxQueueSize: 1000,
        scheduledDelayMillis: 5000,
        exportTimeoutMillis: 5000
      }
    )
  )

  provider.addSpanProcessor({
    onStart: (span) => {
      span.attributes.startTime = Date.now()
    },
    onEnd: (span) => {
      if ((Date.now() - (span.attributes.startTime as number)) > 5000) {
        console.warn('Span took longer than 5 seconds:', span.name)
      }
    },
    forceFlush: async () => {},
    shutdown: async () => {}
  })

  provider.register({
    contextManager: new ZoneContextManager()
  })

  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new UserInteractionInstrumentation({
        eventNames: ['click', 'submit']
      })
    ]
  })
})
