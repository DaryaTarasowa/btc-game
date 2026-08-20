const products = (import.meta.env.VITE_MARKET_PRODUCTS ?? "").split(",").map((product) => product.trim()).filter(Boolean);
const defaultProduct = import.meta.env.VITE_DEFAULT_MARKET_PRODUCT || products[0] || "";
const livePriceChannelPrefix = import.meta.env.VITE_APPSYNC_EVENTS_CHANNEL_PREFIX || "";

export const marketConfig = Object.freeze({
  products: Object.freeze(products),
  defaultProduct,
  livePriceChannelPrefix,
});

export function assertMarketConfig() {
  if (!defaultProduct || !products.includes(defaultProduct) || !livePriceChannelPrefix) {
    throw new Error("Market products, default product, and live-price channel prefix must be configured.");
  }
}

export function marketProductDisplayName(product: string) {
  return product.replace(/-/g, " / ");
}
