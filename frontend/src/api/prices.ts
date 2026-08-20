import { z } from "zod";

export const marketPriceSchema = z.object({
  price: z.string().refine(
    (value) => {
      const price = Number(value);
      return Number.isFinite(price) && price > 0;
    },
    { message: "Price must be a finite positive number." },
  ),
  eventTimestamp: z.iso.datetime({ offset: true }),
});

export const priceResponseSchema = z.object({
  prices: z.array(marketPriceSchema),
});

export type MarketPrice = z.infer<typeof marketPriceSchema>;

export function parsePriceResponse(value: unknown): MarketPrice[] {
  return priceResponseSchema.parse(value).prices;
}

interface GetRecentPricesOptions {
  signal?: AbortSignal;
  start?: string;
  end?: string;
}

export async function getRecentPrices({
  signal,
  start,
  end,
}: GetRecentPricesOptions = {}): Promise<MarketPrice[]> {
  const endpoint = import.meta.env.VITE_GET_PRICES_URL;
  if (!endpoint) {
    throw new Error("The price-history endpoint is not configured.");
  }

  const url = new URL(endpoint);
  if (start !== undefined || end !== undefined) {
    if (!start || !end) throw new Error("Both price-history window timestamps are required.");
    url.searchParams.set("start", start);
    url.searchParams.set("end", end);
  }
  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Price history could not be loaded (${response.status}).`);
  }

  try {
    return parsePriceResponse(await response.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error("The price service returned malformed price history.", {
        cause: error,
      });
    }
    throw error;
  }
}
