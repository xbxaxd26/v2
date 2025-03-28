import { Connection, Commitment, ConnectionConfig } from "@solana/web3.js";
import EventEmitter from "events";
import chalk from "chalk";

export interface ConnectionManagerConfig {
  httpsEndpoints: string[];
  defaultCommitment?: Commitment | ConnectionConfig;
  debug?: boolean;
  retryDelay?: number;
  maxRetries?: number;
  healthCheckInterval?: number;
}

export enum ConnectionState {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  FAILED = "failed",
  SWITCHING = "switching",
}

/**
 * ConnectionManager - Manages multiple RPC connections with automatic failover
 */
export class ConnectionManager extends EventEmitter {
  private httpsEndpoints: string[];
  private currentEndpointIndex: number = 0;
  private connection: Connection | null = null;
  private state: ConnectionState = ConnectionState.CONNECTING;
  private defaultCommitment: Commitment | ConnectionConfig;
  private debug: boolean;
  private retryDelay: number;
  private maxRetries: number;
  private currentRetries: number = 0;
  private healthCheckIntervalId: NodeJS.Timeout | null = null;
  private healthCheckInterval: number;
  private lastTimeUsed: number = Date.now();
  private failedEndpoints: Set<number> = new Set();

  constructor(config: ConnectionManagerConfig) {
    super();
    this.httpsEndpoints = config.httpsEndpoints;
    this.defaultCommitment = config.defaultCommitment || "confirmed";
    this.debug = config.debug || false;
    this.retryDelay = config.retryDelay || 5000; // 5 seconds
    this.maxRetries = config.maxRetries || 3;
    this.healthCheckInterval = config.healthCheckInterval || 30000; // 30 seconds
    
    if (this.httpsEndpoints.length === 0) {
      throw new Error("No RPC endpoints provided");
    }
    
    this.connect();
    this.startHealthCheck();
  }

  /**
   * Get the current Connection object
   */
  public getConnection(): Connection {
    this.lastTimeUsed = Date.now(); // Update last used timestamp
    
    if (!this.connection) {
      this.log("Connection was null, reconnecting...", "warn");
      this.connect();
      throw new Error("Connection not ready yet");
    }
    
    return this.connection;
  }

  /**
   * Get the current RPC endpoint URL being used
   */
  public getCurrentEndpoint(): string {
    return this.httpsEndpoints[this.currentEndpointIndex];
  }

  /**
   * Connect to the current RPC endpoint
   */
  private connect(): void {
    this.setState(ConnectionState.CONNECTING);
    
    try {
      const endpoint = this.httpsEndpoints[this.currentEndpointIndex];
      this.log(`Connecting to RPC endpoint: ${endpoint}`, "info");
      
      this.connection = new Connection(endpoint, this.defaultCommitment);
      
      // Test the connection
      this.testConnection().then(isHealthy => {
        if (isHealthy) {
          this.setState(ConnectionState.CONNECTED);
          this.currentRetries = 0;
          this.log(`Successfully connected to ${endpoint}`, "info");
          this.emit("connected", endpoint);
        } else {
          this.handleConnectionFailure(new Error(`Failed to connect to ${endpoint}`));
        }
      }).catch(error => {
        this.handleConnectionFailure(error);
      });
    } catch (error) {
      this.handleConnectionFailure(error instanceof Error ? error : new Error("Unknown connection error"));
    }
  }

  /**
   * Test if the current connection is healthy
   */
  private async testConnection(): Promise<boolean> {
    try {
      if (!this.connection) return false;
      
      // Use getVersion as a lightweight health check
      const version = await this.connection.getVersion();
      return !!version;
    } catch (error) {
      this.log(`Connection test failed: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
      return false;
    }
  }

  /**
   * Switch to the next available RPC endpoint
   */
  private switchEndpoint(): void {
    // Mark the current endpoint as failed
    this.failedEndpoints.add(this.currentEndpointIndex);
    
    this.setState(ConnectionState.SWITCHING);
    
    // Find the next available endpoint
    let nextIndex = (this.currentEndpointIndex + 1) % this.httpsEndpoints.length;
    let attemptCount = 0;
    
    // If all endpoints have failed, reset and try again
    if (this.failedEndpoints.size >= this.httpsEndpoints.length) {
      this.log("All endpoints have failed, resetting failed list and trying again", "warn");
      this.failedEndpoints.clear();
    }
    
    // Find an endpoint that hasn't failed yet
    while (this.failedEndpoints.has(nextIndex) && attemptCount < this.httpsEndpoints.length) {
      nextIndex = (nextIndex + 1) % this.httpsEndpoints.length;
      attemptCount++;
    }
    
    this.currentEndpointIndex = nextIndex;
    this.log(`Switching to RPC endpoint: ${this.httpsEndpoints[this.currentEndpointIndex]}`, "info");
    
    // Connect to the new endpoint
    this.connect();
  }

  /**
   * Handle a connection failure
   */
  private handleConnectionFailure(error: Error): void {
    this.log(`Connection failure: ${error.message}`, "error");
    this.setState(ConnectionState.FAILED);
    this.emit("connection_failure", error);
    
    if (this.currentRetries < this.maxRetries) {
      this.currentRetries++;
      this.log(`Retrying current endpoint (${this.currentRetries}/${this.maxRetries})...`, "info");
      
      setTimeout(() => {
        this.connect();
      }, this.retryDelay);
    } else {
      this.log(`Max retries reached for current endpoint, switching...`, "warn");
      this.currentRetries = 0;
      this.switchEndpoint();
    }
  }

  /**
   * Start health check interval
   */
  private startHealthCheck(): void {
    this.healthCheckIntervalId = setInterval(async () => {
      // Only run health check if the connection was used recently (within 2x the health check interval)
      const timeSinceLastUse = Date.now() - this.lastTimeUsed;
      if (timeSinceLastUse > this.healthCheckInterval * 2) {
        return;
      }
      
      // Run health check silently unless there's an issue
      const isHealthy = await this.testConnection();
      
      if (!isHealthy) {
        this.log("Health check failed, switching endpoint", "warn");
        this.handleConnectionFailure(new Error("Health check failed"));
      }
    }, this.healthCheckInterval);
  }

  /**
   * Stop health check interval
   */
  public stop(): void {
    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
      this.healthCheckIntervalId = null;
    }
    this.removeAllListeners();
    this.log("Connection manager stopped", "info");
  }

  /**
   * Set the connection state
   */
  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.emit("state_change", state);
    }
  }

  /**
   * Log a message with optional level
   */
  private log(message: string, level: "info" | "warn" | "error" = "info"): void {
    if (this.debug) {
      const timestamp = new Date().toISOString();
      const prefix = `[ConnectionManager ${timestamp}]`;
      
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
}

// Create a singleton instance for better performance
let connectionManagerInstance: ConnectionManager | null = null;

/**
 * Initialize the connection manager with configuration
 */
export function initConnectionManager(config: ConnectionManagerConfig): ConnectionManager {
  if (connectionManagerInstance) {
    connectionManagerInstance.stop();
  }
  
  connectionManagerInstance = new ConnectionManager(config);
  return connectionManagerInstance;
}

/**
 * Get the connection manager instance
 */
export function getConnectionManager(): ConnectionManager {
  if (!connectionManagerInstance) {
    throw new Error("Connection manager not initialized");
  }
  
  return connectionManagerInstance;
}

/**
 * Get a Connection object from the connection manager
 */
export function getConnection(): Connection {
  return getConnectionManager().getConnection();
} 