import { boot } from 'quasar/wrappers'
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base'
// Using simple fetch-based exporter instead of protobuf-based OTLPTraceExporter
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load'
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { ZoneContextManager } from '@opentelemetry/context-zone'

// Create a simple exporter that uses fetch instead of protobufjs
class FetchTraceExporter {
  private url: string
  private headers: Record<string, string>

  constructor (options: { url: string, headers?: Record<string, string> }) {
    this.url = options.url
    this.headers = options.headers || {}
  }

  // Define a basic span type
  export (spans: Array<{
    name: string;
    kind: string | number;
    startTime: number;
    endTime: number;
    attributes?: Record<string, unknown>;
    events?: Array<unknown>;
    links?: Array<unknown>;
    status?: Record<string, unknown>;
  }>, resultCallback: (result: { code: number }) => void) {
    // Transform spans to the format expected by the server
    const payload = {
      resourceSpans: [{
        resource: { attributes: {} },
        scopeSpans: [{
          scope: {},
          spans: spans.map(span => ({
            name: span.name,
            kind: span.kind,
            startTimeUnixNano: span.startTime,
            endTimeUnixNano: span.endTime,
            attributes: Object.entries(span.attributes || {}).map(([key, value]) => ({ key, value })),
            events: span.events || [],
            links: span.links || [],
            status: span.status || {}
          }))
        }]
      }]
    }

    fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers
      },
      body: JSON.stringify(payload)
    })
      .then(response => {
        resultCallback({ code: response.status })
      })
      .catch(error => {
        console.error('Failed to export spans:', error)
        resultCallback({ code: 500 })
      })
  }

  shutdown () {
    // Nothing to do here
    return Promise.resolve()
  }
}

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

  // Use our fetch-based exporter instead of OTLPTraceExporter
  const exporter = process.env.NODE_ENV === 'production'
    ? new FetchTraceExporter({
      url: endpoint,
      headers: {}
    })
    : new ConsoleSpanExporter() // Use console in dev for debugging

  provider.addSpanProcessor(
    // @ts-expect-error - BatchSpanProcessor expects SpanExporter type but our custom FetchTraceExporter doesn't match exactly
    new BatchSpanProcessor(exporter, {
      maxQueueSize: 1000,
      scheduledDelayMillis: 5000,
      exportTimeoutMillis: 5000
    })
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
