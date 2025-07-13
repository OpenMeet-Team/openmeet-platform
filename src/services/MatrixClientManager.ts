import type { MatrixClient, ClientEvent } from 'matrix-js-sdk'
import { createClient, IndexedDBStore, IndexedDBCryptoStore } from 'matrix-js-sdk'

/**
 * MatrixClientManager - Centralized Matrix client management
 * 
 * This singleton manages the Matrix client lifecycle, eliminating redundant
 * client creation and startClient() calls that were causing performance issues.
 * 
 * Key optimizations:
 * - Single client instance across the application
 * - Consolidated startClient() configuration
 * - Efficient store management
 * - Parallel API operations where possible
 */
export class MatrixClientManager {
  private static instance: MatrixClientManager
  private client: MatrixClient | null = null
  private isInitializing = false
  private initPromise: Promise<MatrixClient> | null = null
  private isStarted = false

  private constructor() {}

  public static getInstance(): MatrixClientManager {
    if (!MatrixClientManager.instance) {
      MatrixClientManager.instance = new MatrixClientManager()
    }
    return MatrixClientManager.instance
  }

  /**
   * Get the current Matrix client instance
   */
  public getClient(): MatrixClient | null {
    return this.client
  }

  /**
   * Check if client is ready (created and started)
   */
  public isReady(): boolean {
    return this.client?.isLoggedIn() && this.isStarted
  }

  /**
   * Create and initialize Matrix client with optimized configuration
   */
  public async initializeClient(credentials: {
    homeserverUrl: string
    accessToken: string
    userId: string
    deviceId?: string
  }): Promise<MatrixClient> {
    // Return existing client if already initialized
    if (this.client && this.client.isLoggedIn() && this.isStarted) {
      console.log('✅ Matrix client already initialized and ready')
      return this.client
    }

    // Prevent concurrent initialization
    if (this.isInitializing && this.initPromise) {
      console.log('🔄 Matrix initialization already in progress, waiting...')
      return this.initPromise
    }

    this.isInitializing = true
    this.initPromise = this._performInitialization(credentials)

    try {
      const client = await this.initPromise
      this.isInitializing = false
      return client
    } catch (error) {
      this.isInitializing = false
      this.initPromise = null
      throw error
    }
  }

  /**
   * Start the Matrix client with optimized sync configuration
   */
  public async startClient(): Promise<void> {
    if (!this.client) {
      throw new Error('Cannot start client: no client initialized')
    }

    if (this.isStarted) {
      console.log('✅ Matrix client already started')
      return
    }

    console.log('🔄 Starting Matrix client with optimized sync configuration...')
    
    const startTime = performance.now()
    
    await this.client.startClient({
      initialSyncLimit: 50,           // Reduced from 100 for faster initial sync
      includeArchivedRooms: false,    // Skip archived rooms for performance
      lazyLoadMembers: true,          // Load members on demand
      pollTimeout: 30000,             // 30s long polling
      threadSupport: false,           // Disable threads for better performance
      cryptoCallbacks: {              // Optimize crypto callbacks
        getCrossSigningKey: null,
        saveCrossSigningKeys: null
      }
    })

    this.isStarted = true
    const duration = performance.now() - startTime
    console.log(`✅ Matrix client started in ${duration.toFixed(2)}ms`)
  }

  /**
   * Restart the client (for error recovery)
   */
  public async restartClient(): Promise<void> {
    if (!this.client) {
      throw new Error('Cannot restart client: no client initialized')
    }

    console.log('🔄 Restarting Matrix client...')
    this.isStarted = false
    
    // Stop the current client
    this.client.stopClient()
    
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Restart with same configuration
    await this.startClient()
  }

  /**
   * Clear and reset the client
   */
  public async clearClient(): Promise<void> {
    if (this.client) {
      console.log('🧹 Clearing Matrix client...')
      this.client.stopClient()
      this.client = null
    }
    this.isStarted = false
    this.isInitializing = false
    this.initPromise = null
  }

  /**
   * Internal initialization logic
   */
  private async _performInitialization(credentials: {
    homeserverUrl: string
    accessToken: string
    userId: string
    deviceId?: string
  }): Promise<MatrixClient> {
    try {
      console.log('🔄 Creating Matrix client with optimized stores...')
      
      const startTime = performance.now()

      // Determine base URL
      let baseUrl = credentials.homeserverUrl
      if (!baseUrl.startsWith('http')) {
        baseUrl = `https://${baseUrl}`
      }

      // Create optimized IndexedDB stores
      const userId = credentials.userId
      const deviceId = credentials.deviceId || 'DEVICE_ID_NOT_SET'

      // Use separate databases for main store and crypto store
      const store = new IndexedDBStore({
        indexedDB: window.indexedDB,
        dbName: `matrix-js-sdk:${userId}`,
        workerFactory: () => new Worker(
          new URL('matrix-js-sdk/lib/store/indexeddb-worker.js', import.meta.url)
        )
      })

      const cryptoStore = new IndexedDBCryptoStore(
        window.indexedDB,
        `matrix-js-sdk-crypto:${userId}:${deviceId}`
      )

      // Startup the stores in parallel for better performance
      const [, ] = await Promise.all([
        store.startup(),
        cryptoStore.startup()
      ])

      // Create the client
      this.client = createClient({
        baseUrl,
        accessToken: credentials.accessToken,
        userId,
        deviceId,
        store,
        cryptoStore,
        verificationMethods: [],      // Disable verification for performance
        cryptoCallbacks: {},          // Minimal crypto callbacks
        useAuthorizationHeader: true, // More efficient auth
        timelineSupport: true,
        unstableClientRelationAggregation: false // Disable for performance
      })

      // Perform initial API calls in parallel
      console.log('🔄 Performing initial Matrix API calls...')
      const apiStartTime = performance.now()
      
      await Promise.all([
        this.client.whoami(),
        // Could add other initial calls here in parallel
      ])
      
      const apiDuration = performance.now() - apiStartTime
      console.log(`✅ Initial API calls completed in ${apiDuration.toFixed(2)}ms`)

      const totalDuration = performance.now() - startTime
      console.log(`✅ Matrix client created in ${totalDuration.toFixed(2)}ms`)

      return this.client

    } catch (error) {
      console.error('❌ Failed to initialize Matrix client:', error)
      await this.clearClient()
      throw error
    }
  }

  /**
   * Set up essential event listeners (minimal set for performance)
   */
  public setupEventListeners(onSyncStateChange?: (state: string) => void): void {
    if (!this.client) {
      return
    }

    // Only essential listeners for performance
    this.client.on(ClientEvent.Sync, (state, prevState, data) => {
      console.log(`🔄 Matrix sync state: ${prevState} → ${state}`)
      
      if (onSyncStateChange) {
        onSyncStateChange(state)
      }

      if (state === 'PREPARED') {
        console.log('✅ Matrix client fully synced and ready')
      } else if (state === 'ERROR') {
        console.error('❌ Matrix sync error:', data)
      }
    })

    // Log when client is ready
    this.client.once(ClientEvent.Sync, (state) => {
      if (state === 'PREPARED') {
        const rooms = this.client?.getRooms() || []
        console.log(`📊 Matrix client has ${rooms.length} rooms after sync`)
      }
    })
  }
}

// Export singleton instance
export const matrixClientManager = MatrixClientManager.getInstance()