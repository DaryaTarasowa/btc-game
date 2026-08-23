# Coinbase market-price consumer

This standalone TypeScript service connects to Coinbase Exchange's public WebSocket feed and subscribes to the configured channels and products.

Each normalized changed-price event is processed in source-time order and drives three independent consumers:

- **Bet resolution** — active bets whose resolution time has passed are resolved against the next changed market price.
- **Price history** — real market events are sampled at one-second resolution and stored in DynamoDB for chart history.
- **Live prices** — market-price updates are published to AppSync Events for realtime delivery to connected clients.

Equal or older source timestamps are dropped before application processing.

## Price history

Chart history is a derived stream. The service stores an event when its Coinbase `sourceTimestamp` is at least one second after the most recently stored source timestamp. It never creates synthetic points, and a long gap produces only the next real changed-price event.

Prices remain decimal strings so JavaScript floating-point conversion cannot discard precision. Sampling and the ten-minute TTL use Coinbase `sourceTimestamp`, which represents market-event time. `receivedTimestamp` is local processing time and can shift because of network latency or reconnects, so it is not used to build the chart timeline.

At startup, the service queries DynamoDB once per configured product and initializes independent in-memory sampling timestamps. It does not read DynamoDB for each market event. A product's timestamp advances only after a successful write; a failed write leaves a later eligible event able to retry naturally.

## Configuration

The service uses the following environment variables:

- `PRICE_HISTORY_TABLE` — DynamoDB price-history table.
- `BETS_TABLE` — DynamoDB bets table.
- `PLAYERS_TABLE` — DynamoDB players table.
- `MARKET_PRODUCTS` — configured Coinbase products.
- `COINBASE_CHANNELS` — configured Coinbase WebSocket channels.
- `APPSYNC_EVENTS_ENDPOINT` — AppSync Events HTTP endpoint.
- `APPSYNC_EVENTS_CHANNEL_PREFIX` — channel prefix used for live-price events.
- `APPSYNC_REGION` — AWS region used when signing AppSync Events requests.

AWS credentials use the normal AWS SDK credential chain.

## Run locally

Requires Node.js 22+.

```powershell
pnpm install

$env:PRICE_HISTORY_TABLE = "btc-game-price-history"

pnpm dev
```
