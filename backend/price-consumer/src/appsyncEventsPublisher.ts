import { Sha256 } from "@aws-crypto/sha256-js";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import type { LiveMarketPrice, PricePublisher } from "./types.js";

const SERVICE = "appsync";
const REGION = "eu-central-1";

type RequestSigner = Pick<SignatureV4, "sign">;
type Fetcher = typeof fetch;

/**
 * Publishes live market prices to the product-specific AppSync Events channel.
 *
 * Signs each request with AWS Signature V4 using the runtime AWS credentials
 * and sends the market price to the configured AppSync Events endpoint.
 */
export class AppsyncEventsPublisher implements PricePublisher {
  public constructor(
    private readonly endpoint: string,
    private readonly channelPrefix: string,
    private readonly signer: RequestSigner = new SignatureV4({
      credentials: fromNodeProviderChain(),
      region: REGION,
      service: SERVICE,
      sha256: Sha256,
    }),
    private readonly fetcher: Fetcher = fetch,
  ) {}

  public async publish(marketPrice: LiveMarketPrice): Promise<void> {
    const url = new URL(this.endpoint);

    const body = JSON.stringify({
      channel: `${this.channelPrefix.replace(/\/$/, "")}/${marketPrice.product}`,
      events: [JSON.stringify(marketPrice)],
    });

    const request = new HttpRequest({
      method: "POST",
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        host: url.hostname,
        "content-type": "application/json",
      },
      body,
    });

    const signedRequest = await this.signer.sign(request);

    const response = await this.fetcher(this.endpoint, {
      method: signedRequest.method,
      headers: signedRequest.headers,
      body: signedRequest.body,
    });

    if (!response.ok) {
      throw new Error(`AppSync publish failed with status ${response.status}.`);
    }
  }
}
