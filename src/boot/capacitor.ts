import { boot } from 'quasar/wrappers'
import { Capacitor } from '@capacitor/core'
import { App, URLOpenListenerEvent } from '@capacitor/app'
import { StatusBar } from '@capacitor/status-bar'
import { SafeArea } from '@aashu-dubey/capacitor-statusbar-safe-area'
import { parseDeepLink, isValidDeepLinkDomain } from '../utils/deepLinkHandler'

/**
 * Redact sensitive query parameters from a URL for safe logging.
 * OAuth tokens, codes, and states should not appear in logs.
 */
function redactUrlForLogging (url: string): string {
  try {
    const parsed = new URL(url)
    // Only show the path, not query params which may contain auth codes/tokens
    return `${parsed.origin}${parsed.pathname}${parsed.search ? '?[REDACTED]' : ''}`
  } catch {
    return '[invalid URL]'
  }
}

export default boot(async ({ router }) => {
  if (Capacitor.isNativePlatform()) {
    // Try to disable overlay mode
    try {
      await StatusBar.setOverlaysWebView({ overlay: false })
    } catch (e) {
      console.warn('StatusBar.setOverlaysWebView failed:', e)
    }

    // Get safe area insets and set as CSS custom properties
    try {
      const result = await SafeArea.getSafeAreaInsets()
      console.log('SafeArea result:', JSON.stringify(result))
      const root = document.documentElement
      // Plugin returns { top, bottom, left, right } directly
      root.style.setProperty('--safe-area-top', `${result.top}px`)
      root.style.setProperty('--safe-area-bottom', `${result.bottom}px`)
      root.style.setProperty('--safe-area-left', `${result.left}px`)
      root.style.setProperty('--safe-area-right', `${result.right}px`)
    } catch (e) {
      console.warn('SafeArea.getSafeAreaInsets failed:', e)
      // Fallback for Android status bar (typical height ~24-28dp)
      document.documentElement.style.setProperty('--safe-area-top', '28px')
    }

    // Handle deep links (OAuth callbacks, Universal/App Links)
    // This handles both Android App Links and iOS Universal Links
    // @see https://capacitorjs.com/docs/guides/deep-links
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      console.log('App opened with URL:', redactUrlForLogging(event.url))

      // Security: Only process URLs from valid domains (configured in APP_CONFIG)
      if (!isValidDeepLinkDomain(event.url)) {
        console.warn('Deep link from invalid domain, ignoring')
        return
      }

      const result = parseDeepLink(event.url)
      if (result) {
        console.log('Navigating to:', result.path)
        // Navigate to the path using Vue Router
        // The query params will be available to the page component
        router.push({
          path: result.path,
          query: result.query
        })
      } else {
        console.warn('Failed to parse deep link URL')
      }
    })

    // Check if app was launched with a URL (cold start)
    try {
      const launchUrl = await App.getLaunchUrl()
      if (launchUrl?.url) {
        console.log('App launched with URL:', redactUrlForLogging(launchUrl.url))

        // Security: Only process URLs from valid domains (configured in APP_CONFIG)
        if (!isValidDeepLinkDomain(launchUrl.url)) {
          console.warn('Launch URL from invalid domain, ignoring')
        } else {
          const result = parseDeepLink(launchUrl.url)
          if (result) {
            console.log('Initial navigation to:', result.path)
            // Use replace to avoid adding to history since this is the initial load
            router.replace({
              path: result.path,
              query: result.query
            })
          }
        }
      }
    } catch (e) {
      console.warn('Failed to get launch URL:', e)
    }
  }
})
