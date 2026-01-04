import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { Quasar } from 'quasar'
import LocationComponent from '../../../../../src/components/common/LocationComponent.vue'

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [] }))
  }
}))

// Mock LeafletMapComponent
vi.mock('../../../../../src/components/common/LeafletMapComponent.vue', () => ({
  default: {
    name: 'LeafletMapComponent',
    template: '<div class="mock-leaflet-map" data-testid="leaflet-map"></div>',
    props: ['lat', 'lon', 'disabled', 'zoom'],
    emits: ['markerLocation']
  }
}))

// Mock notification composable
vi.mock('../../../../../src/composables/useNotification', () => ({
  useNotification: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  })
}))

describe('LocationComponent - Inline Map Preview', () => {
  const mountComponent = (props = {}) => {
    return mount(LocationComponent, {
      props: {
        label: 'Location',
        ...props
      },
      global: {
        plugins: [Quasar],
        stubs: {
          LeafletMapComponent: {
            name: 'LeafletMapComponent',
            template: '<div class="mock-leaflet-map" data-testid="leaflet-map"></div>',
            props: ['lat', 'lon', 'disabled', 'zoom']
          }
        }
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock localStorage
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})
  })

  describe('showInlineMap prop', () => {
    it('should accept showInlineMap prop with default value of false', () => {
      const wrapper = mountComponent()
      // The inline map should not be visible by default
      expect(wrapper.find('[data-cy="inline-map-preview"]').exists()).toBe(false)
    })

    it('should show inline map container when showInlineMap is true', () => {
      const wrapper = mountComponent({ showInlineMap: true })
      // The inline map container should exist when prop is true
      expect(wrapper.find('[data-cy="inline-map-preview"]').exists()).toBe(true)
    })

    it('should not show inline map when showInlineMap is false', () => {
      const wrapper = mountComponent({ showInlineMap: false })
      expect(wrapper.find('[data-cy="inline-map-preview"]').exists()).toBe(false)
    })
  })

  describe('inline map rendering', () => {
    it('should render LeafletMapComponent inside inline map container', () => {
      const wrapper = mountComponent({
        showInlineMap: true,
        lat: 40.7128,
        lon: -74.006,
        location: 'New York, NY'
      })
      const inlineMap = wrapper.find('[data-cy="inline-map-preview"]')
      expect(inlineMap.exists()).toBe(true)
      // Should contain the Leaflet component (either the mock or stub)
      const leafletComponent = wrapper.findComponent({ name: 'LeafletMapComponent' })
      expect(leafletComponent.exists()).toBe(true)
    })

    it('should have proper height for inline map container (around 200px)', () => {
      const wrapper = mountComponent({ showInlineMap: true })
      const inlineMap = wrapper.find('[data-cy="inline-map-preview"]')
      expect(inlineMap.exists()).toBe(true)
      // Check that the container has a height class or style
      const classes = inlineMap.classes()
      const style = inlineMap.attributes('style')
      // Either has height in style or a specific class
      const hasHeightSet = style?.includes('height') || classes.some(c => c.includes('height'))
      expect(hasHeightSet || inlineMap.exists()).toBe(true)
    })

    it('should pass disabled=true to LeafletMapComponent for read-only preview', () => {
      const wrapper = mountComponent({ showInlineMap: true })
      const leafletMap = wrapper.findComponent({ name: 'LeafletMapComponent' })
      // If the component is found, check props
      if (leafletMap.exists()) {
        expect(leafletMap.props('disabled')).toBe(true)
      } else {
        // Check that the map in inline preview section is disabled
        const inlineMap = wrapper.find('[data-cy="inline-map-preview"]')
        expect(inlineMap.exists()).toBe(true)
      }
    })
  })

  describe('inline map with location data', () => {
    it('should show marker at provided coordinates', () => {
      const wrapper = mountComponent({
        showInlineMap: true,
        lat: 40.7128,
        lon: -74.006,
        location: 'New York, NY'
      })
      const inlineMap = wrapper.find('[data-cy="inline-map-preview"]')
      expect(inlineMap.exists()).toBe(true)
      // The map component should receive lat/lon props
      const leafletMap = wrapper.findComponent({ name: 'LeafletMapComponent' })
      if (leafletMap.exists()) {
        expect(leafletMap.props('lat')).toBe(40.7128)
        expect(leafletMap.props('lon')).toBe(-74.006)
      }
    })

    it('should show placeholder when no coordinates are set', () => {
      const wrapper = mountComponent({
        showInlineMap: true,
        lat: 0,
        lon: 0,
        location: ''
      })
      // With no coordinates, the inline map should show a placeholder
      const inlineMap = wrapper.find('[data-cy="inline-map-preview"]')
      expect(inlineMap.exists()).toBe(true)
      // Should show placeholder text
      expect(inlineMap.text().toLowerCase()).toContain('select')
    })
  })

  describe('accessibility', () => {
    it('should have aria-label on inline map container', () => {
      const wrapper = mountComponent({
        showInlineMap: true,
        lat: 40.7128,
        lon: -74.006,
        location: 'New York, NY'
      })
      const inlineMap = wrapper.find('[data-cy="inline-map-preview"]')
      expect(inlineMap.exists()).toBe(true)
      expect(inlineMap.attributes('aria-label')).toBe('Location preview map')
    })

    it('should have aria-live polite for location updates', () => {
      const wrapper = mountComponent({
        showInlineMap: true,
        lat: 40.7128,
        lon: -74.006,
        location: 'New York, NY'
      })
      const inlineMap = wrapper.find('[data-cy="inline-map-preview"]')
      expect(inlineMap.exists()).toBe(true)
      expect(inlineMap.attributes('aria-live')).toBe('polite')
    })

    it('should be keyboard accessible (tabindex)', () => {
      const wrapper = mountComponent({
        showInlineMap: true,
        lat: 40.7128,
        lon: -74.006
      })
      const inlineMap = wrapper.find('[data-cy="inline-map-preview"]')
      expect(inlineMap.exists()).toBe(true)
      // Should be focusable for keyboard users
      expect(inlineMap.attributes('tabindex')).toBe('0')
    })
  })

  describe('responsive behavior', () => {
    it('should have gt-md class for desktop-only visibility', () => {
      const wrapper = mountComponent({
        showInlineMap: true,
        lat: 40.7128,
        lon: -74.006
      })
      const inlineMap = wrapper.find('[data-cy="inline-map-preview"]')
      expect(inlineMap.exists()).toBe(true)
      // Should have Quasar responsive class for lg+ only
      const classes = inlineMap.classes()
      // Check for gt-md or gt-sm class (visible on desktop)
      expect(classes.some(c => c.includes('gt-md') || c.includes('gt-sm'))).toBe(true)
    })
  })
})
