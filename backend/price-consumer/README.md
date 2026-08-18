# Coinbase BTC-USD price consumer

This standalone TypeScript service connects to Coinbase Exchange's public WebSocket feed, subscribes to the `ticker` and `heartbeat` channels for `BTC-USD`, and samples the latest normalized price once per second. It emits at most one JSON price event per second and suppresses a sample when its price matches the last emitted price, including across reconnects. It has no AWS or application-side integrations.

Prices remain decimal strings so JavaScript floating-point conversion cannot discard precision. `sourceTimestamp` comes directly from Coinbase's ticker message; `receivedTimestamp` is recorded locally when the message is processed.

## Run locally

Requires Node.js 22+.

```powershell
pnpm install
pnpm dev
```

Build and run the compiled application:

```powershell
pnpm build
pnpm start
```

## Run with Docker

```powershell
docker build -t btc-price-consumer .
docker run --rm btc-price-consumer
```

Example normalized output:

```json
{"type":"price_update","source":"coinbase","product":"BTC-USD","price":"59432.10","sourceTimestamp":"2026-08-18T18:30:12.123456Z","receivedTimestamp":"2026-08-18T18:30:12.140Z","sequence":123456789,"tradeId":987654321}
```

Malformed JSON, invalid ticker payloads, and unexpected message types are reported without terminating the process. Closed, failed, or stale connections reconnect automatically with capped exponential backoff and jitter.
