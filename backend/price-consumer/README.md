# Coinbase BTC-USD price consumer

This standalone TypeScript service connects to Coinbase Exchange's public WebSocket feed and subscribes to the `ticker` and `heartbeat` channels for `BTC-USD`.

The raw application stream contains every normalized, strictly source-time-ordered **changed-price** event. It is kept separate for future consumers such as bet resolution. Equal or older source timestamps are dropped before both raw application processing and history processing.

Chart history is a derived stream. The service stores an event when its Coinbase `sourceTimestamp` is at least one second after the most recently stored source timestamp. It never creates synthetic points, and a long gap produces only the next real changed-price event.

Prices remain decimal strings so JavaScript floating-point conversion cannot discard precision. Sampling and the ten-minute TTL use Coinbase `sourceTimestamp`, which represents market-event time. `receivedTimestamp` is local processing time and can shift because of network latency or reconnects, so it is not used to build the chart timeline.

At startup, the service queries DynamoDB once for the newest `BTC-USD` item and initializes the in-memory sampling timestamp. It does not read DynamoDB for each market event. The timestamp advances only after a successful write; a failed write is logged and leaves a later eligible event able to retry naturally.

Set `PRICE_HISTORY_TABLE` to the DynamoDB table name. AWS credentials and region use the normal AWS SDK credential chain.

## Run locally

Requires Node.js 22+.

```powershell
pnpm install
$env:PRICE_HISTORY_TABLE = "btc-game-price-history"
pnpm dev
```

On Linux, macOS, or WSL:

```sh
PRICE_HISTORY_TABLE=btc-game-price-history pnpm dev
```

Build and run the compiled application:

```powershell
pnpm build
pnpm start
```

## Run with Docker

```powershell
docker build -t btc-price-consumer .
docker run --rm -e PRICE_HISTORY_TABLE=btc-game-price-history btc-price-consumer
```

Example normalized output:

```json
{"type":"price_update","source":"coinbase","product":"BTC-USD","price":"59432.10","sourceTimestamp":"2026-08-18T18:30:12.123456Z","receivedTimestamp":"2026-08-18T18:30:12.140Z","sequence":123456789,"tradeId":987654321}
```

Malformed JSON, invalid ticker payloads, and unexpected message types are reported without terminating the process. Closed, failed, or stale connections reconnect automatically with capped exponential backoff and jitter. DynamoDB write failures are logged with the affected product and source timestamp.

## Run tests

The sampler and DynamoDB item/TTL mapping tests do not connect to Coinbase or AWS:

```sh
pnpm test
```
