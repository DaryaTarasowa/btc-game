import { createContext, useMemo, useState, type PropsWithChildren } from "react";
import { assertMarketConfig, marketConfig } from "@/config/market";

export interface MarketContextValue {
  product: string;
  products: readonly string[];
  setProduct: (product: string) => void;
}

export const MarketContext = createContext<MarketContextValue | null>(null);

export function MarketProvider({ children }: PropsWithChildren) {
  assertMarketConfig();
  const [product, setSelectedProduct] = useState(marketConfig.defaultProduct);
  const value = useMemo(() => ({
    product,
    products: marketConfig.products,
    setProduct(nextProduct: string) {
      if (!marketConfig.products.includes(nextProduct)) throw new Error(`Unsupported market product: ${nextProduct}`);
      setSelectedProduct(nextProduct);
    },
  }), [product]);

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}
