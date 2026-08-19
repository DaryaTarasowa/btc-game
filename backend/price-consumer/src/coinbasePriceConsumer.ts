import WebSocket, { type RawData } from "ws";

import { getMessageType, normalizeCoinbaseMessage } from "./coinbaseMapper.js";
import type { MarketPriceEventData } from "./types.js";
import type { LogLevel } from "./utils.js";

const COINBASE_URL = "wss://ws-feed.exchange.coinbase.com";
const PRODUCT = "BTC-USD";
const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const STALE_CONNECTION_MS = 15_000;

type Logger = (
  level: LogLevel,
  event: string,
  details?: Record<string, unknown>,
) => void;

export class CoinbasePriceConsumer {
  private socket: WebSocket | undefined;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private watchdogTimer: NodeJS.Timeout | undefined;
  private reconnectAttempt = 0;
  private stopping = false;

  public constructor(
    private readonly log: Logger,
    private readonly onPriceUpdate: (eventData: MarketPriceEventData) => void,
  ) {}

  public start(): void {
    if (!this.socket && !this.reconnectTimer && !this.stopping) {
      this.connect();
    }
  }

  public stop(): void {
    this.stopping = true;
    this.clearTimers();

    const socket = this.socket;
    this.socket = undefined;
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close(1000, "Service shutting down");
    }
  }

  private connect(): void {
    this.log("info", "coinbase_connecting", {
      url: COINBASE_URL,
      product: PRODUCT,
    });
    const socket = new WebSocket(COINBASE_URL);
    this.socket = socket;

    socket.on("open", () => {
      if (this.socket !== socket || this.stopping) {
        socket.close();
        return;
      }

      this.reconnectAttempt = 0;
      socket.send(
        JSON.stringify({
          type: "subscribe",
          product_ids: [PRODUCT],
          channels: ["ticker", "heartbeat"],
        }),
      );
      this.log("info", "coinbase_connected", { product: PRODUCT });
      this.resetWatchdog(socket);
    });

    socket.on("message", (data: RawData) => {
      if (this.socket !== socket || this.stopping) {
        return;
      }

      this.resetWatchdog(socket);
      this.handleMessage(data);
    });

    socket.on("error", (error: Error) => {
      this.log("error", "coinbase_socket_error", { message: error.message });
    });

    socket.on("close", (code: number, reason: Buffer) => {
      if (this.socket === socket) {
        this.socket = undefined;
      }
      this.clearWatchdog();
      this.log("warn", "coinbase_disconnected", {
        code,
        reason: reason.toString("utf8"),
      });
      this.scheduleReconnect();
    });
  }

  private handleMessage(data: RawData): void {
    let value: unknown;

    try {
      value = JSON.parse(data.toString());
    } catch (error: unknown) {
      this.log("warn", "coinbase_malformed_json", {
        message:
          error instanceof Error ? error.message : "Unknown JSON parse error",
      });
      return;
    }

    const type = getMessageType(value);

    if (type === "subscriptions" || type === "heartbeat") {
      return;
    }

    if (type === "error") {
      this.log("error", "coinbase_error_message");
      return;
    }

    const marketPriceEventData = normalizeCoinbaseMessage(
      value,
      new Date().toISOString(),
    );

    if (!marketPriceEventData) {
      this.log("warn", "coinbase_message_normalization_failed", {
        type: type ?? "unknown",
      });
      return;
    }

    this.onPriceUpdate(marketPriceEventData);
  }

  private resetWatchdog(socket: WebSocket): void {
    this.clearWatchdog();
    this.watchdogTimer = setTimeout(() => {
      if (this.socket === socket) {
        this.log("warn", "coinbase_connection_stale", {
          timeoutMs: STALE_CONNECTION_MS,
        });
        socket.terminate();
      }
    }, STALE_CONNECTION_MS);
    this.watchdogTimer.unref();
  }

  private scheduleReconnect(): void {
    if (this.stopping || this.reconnectTimer) {
      return;
    }

    const exponentialDelay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempt,
      MAX_RECONNECT_DELAY_MS,
    );
    const delayMs = Math.round(exponentialDelay * (0.8 + Math.random() * 0.4));
    this.reconnectAttempt += 1;

    this.log("info", "coinbase_reconnect_scheduled", { delayMs });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, delayMs);
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = undefined;
    }
  }

  private clearTimers(): void {
    this.clearWatchdog();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}
