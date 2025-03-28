import { WebSocketManager, WebSocketManagerOptions, ConnectionState } from "./websocketManager";
import { EventEmitter } from "events";
import chalk from "chalk";

export class WebSocketManagerFactory extends EventEmitter {
  private wssEndpoints: string[];
  private currentEndpointIndex: number = 0;
  private wsManager: WebSocketManager | null = null;
  private options: Omit<WebSocketManagerOptions, 'url'>;
  private failedEndpoints: Set<number> = new Set();
  private isReconnecting: boolean = false;
  private debug: boolean;
  private primaryFailCount: number = 0;
  private maxPrimaryFailCount: number = 3; // How many times we try primary before moving to backup

  constructor(wssEndpoints: string[], options: Omit<WebSocketManagerOptions, 'url'> = {}) {
    super();
    
    if (!wssEndpoints || wssEndpoints.length === 0) {
      throw new Error("No WebSocket endpoints provided");
    }
    
    this.wssEndpoints = wssEndpoints;
    this.options = options;
    this.debug = options.debug || false;
    
    this.createWebSocketManager();
  }

  /**
   * Get the current WebSocket Manager
   */
  public getWebSocketManager(): WebSocketManager {
    if (!this.wsManager) {
      this.log("WebSocket manager was null, recreating...", "warn");
      this.createWebSocketManager();
      throw new Error("WebSocket manager not ready yet");
    }
    
    return this.wsManager;
  }

  /**
   * Get the current WebSocket endpoint
   */
  public getCurrentEndpoint(): string {
    return this.wssEndpoints[this.currentEndpointIndex];
  }

  /**
   * Create a new WebSocket Manager with the current endpoint
   */
  private createWebSocketManager(): void {
    const endpoint = this.wssEndpoints[this.currentEndpointIndex];
    this.log(`Creating WebSocket manager with endpoint: ${endpoint}`, "info");
    
    if (this.wsManager) {
      this.wsManager.removeAllListeners();
      this.wsManager.disconnect();
    }
    
    this.wsManager = new WebSocketManager({
      url: endpoint,
      ...this.options
    });
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Connect the WebSocket
    this.wsManager.connect();
  }

  /**
   * Set up event listeners for the WebSocket Manager
   */
  private setupEventListeners(): void {
    if (!this.wsManager) return;
    
    this.wsManager.on("open", () => {
      this.log(`WebSocket connected to ${this.getCurrentEndpoint()}`, "info");
      this.emit("open");
      this.primaryFailCount = 0;
    });
    
    this.wsManager.on("message", (data) => {
      this.emit("message", data);
    });
    
    this.wsManager.on("error", (error) => {
      this.handleConnectionError(error);
    });
    
    this.wsManager.on("state_change", (state) => {
      if (state === ConnectionState.RECONNECTING && !this.isReconnecting) {
        this.isReconnecting = true;
        this.log("WebSocket is reconnecting, may switch endpoint if it fails", "warn");
        
        // If the connection is trying to reconnect, increment the failure counter
        if (this.currentEndpointIndex === 0) {
          this.primaryFailCount++;
          this.log(`Primary endpoint fail count: ${this.primaryFailCount}/${this.maxPrimaryFailCount}`, "info");
          
          if (this.primaryFailCount >= this.maxPrimaryFailCount) {
            this.log("Primary endpoint exceeded max failures, switching to backup", "warn");
            this.switchEndpoint();
            return;
          }
        }
      } else if (state === ConnectionState.CONNECTED) {
        this.isReconnecting = false;
      }
      
      this.emit("state_change", state);
    });
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(error: Error): void {
    this.log(`WebSocket error: ${error.message}`, "error");
    this.emit("error", error);
    
    // If the primary endpoint is failing too often, switch to a backup
    if (this.currentEndpointIndex === 0) {
      this.primaryFailCount++;
      
      if (this.primaryFailCount >= this.maxPrimaryFailCount && this.wssEndpoints.length > 1) {
        this.log("Primary endpoint exceeds fail limit, switching to backup", "warn");
        this.switchEndpoint();
      }
    }
  }

  /**
   * Switch to the next available WebSocket endpoint
   */
  private switchEndpoint(): void {
    // Mark the current endpoint as failed
    this.failedEndpoints.add(this.currentEndpointIndex);
    this.isReconnecting = false;
    
    // Find the next available endpoint
    let nextIndex = (this.currentEndpointIndex + 1) % this.wssEndpoints.length;
    let attemptCount = 0;
    
    // If all endpoints have failed, reset and try again
    if (this.failedEndpoints.size >= this.wssEndpoints.length) {
      this.log("All endpoints have failed, resetting failed list", "warn");
      this.failedEndpoints.clear();
      this.primaryFailCount = 0;
    }
    
    // Find an endpoint that hasn't failed yet
    while (this.failedEndpoints.has(nextIndex) && attemptCount < this.wssEndpoints.length) {
      nextIndex = (nextIndex + 1) % this.wssEndpoints.length;
      attemptCount++;
    }
    
    this.currentEndpointIndex = nextIndex;
    this.log(`Switching to WebSocket endpoint: ${this.wssEndpoints[this.currentEndpointIndex]}`, "info");
    
    // Create a new WebSocket manager with the new endpoint
    this.createWebSocketManager();
  }

  /**
   * Log a message with optional level
   */
  private log(message: string, level: "info" | "warn" | "error" = "info"): void {
    if (this.debug) {
      const timestamp = new Date().toISOString();
      const prefix = `[WebSocketManagerFactory ${timestamp}]`;
      
      switch (level) {
        case "warn":
          console.warn(`${chalk.yellow(prefix)} ${chalk.yellow('⚠️')} ${chalk.yellow(message)}`);
          break;
        case "error":
          console.error(`${chalk.red(prefix)} ${chalk.red('❌')} ${chalk.red(message)}`);
          break;
        default:
          console.log(`${chalk.blue(prefix)} ${chalk.blue('ℹ️')} ${chalk.dim(message)}`);
      }
    }
  }

  /**
   * Forward a send call to the current WebSocket Manager
   */
  public send(data: any): boolean {
    if (!this.wsManager) {
      this.log("Cannot send: WebSocket manager not initialized", "error");
      return false;
    }
    
    return this.wsManager.send(data);
  }

  /**
   * Forward a connect call to the current WebSocket Manager
   */
  public connect(): void {
    if (!this.wsManager) {
      this.createWebSocketManager();
      return;
    }
    
    this.wsManager.connect();
  }

  /**
   * Forward a disconnect call to the current WebSocket Manager
   */
  public disconnect(): void {
    if (this.wsManager) {
      this.wsManager.disconnect();
    }
    
    this.removeAllListeners();
    this.log("WebSocket manager factory stopped", "info");
  }
}

// Create a singleton instance
let wsManagerFactoryInstance: WebSocketManagerFactory | null = null;

/**
 * Initialize the WebSocket Manager Factory
 */
export function initWebSocketManagerFactory(
  wssEndpoints: string[], 
  options: Omit<WebSocketManagerOptions, 'url'> = {}
): WebSocketManagerFactory {
  if (wsManagerFactoryInstance) {
    wsManagerFactoryInstance.disconnect();
  }
  
  wsManagerFactoryInstance = new WebSocketManagerFactory(wssEndpoints, options);
  return wsManagerFactoryInstance;
}

/**
 * Get the WebSocket Manager Factory instance
 */
export function getWebSocketManagerFactory(): WebSocketManagerFactory {
  if (!wsManagerFactoryInstance) {
    throw new Error("WebSocket manager factory not initialized");
  }
  
  return wsManagerFactoryInstance;
} 