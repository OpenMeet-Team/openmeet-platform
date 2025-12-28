import { boot } from 'quasar/wrappers'
import { Capacitor } from '@capacitor/core'
import { StatusBar } from '@capacitor/status-bar'
import { SafeArea } from '@aashu-dubey/capacitor-statusbar-safe-area'

export default boot(async () => {
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
  }
})
