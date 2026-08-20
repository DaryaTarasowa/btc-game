import assert from "node:assert/strict";
import test from "node:test";
import { AppsyncEventsPublisher } from "../appsyncEventsPublisher.js";

const marketPrice = {
  product: "BTC-USD",
  price: "100.25",
  eventTimestamp: "2026-08-20T12:00:00.123456Z",
};

test("publishes the market price to the fixed BTC channel using the signed request", async () => {
  let unsignedRequest: { hostname?: string; path?: string; body?: string } | undefined;
  const signer = {
    sign: async (request: unknown) => {
      unsignedRequest = request as typeof unsignedRequest;
      return { method: "POST", headers: { authorization: "signed" }, body: unsignedRequest?.body };
    },
  };
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push([input, init]);
    return { ok: true, status: 200 } as Response;
  };

  await new AppsyncEventsPublisher("https://events.example.test/event", "/prices", signer as never, fetcher).publish(marketPrice);

  assert.equal(unsignedRequest?.hostname, "events.example.test");
  assert.equal(unsignedRequest?.path, "/event");
  assert.deepEqual(JSON.parse(unsignedRequest?.body ?? ""), {
    channel: "/prices/BTC-USD",
    events: [JSON.stringify(marketPrice)],
  });
  assert.deepEqual(calls, [["https://events.example.test/event", {
    method: "POST",
    headers: { authorization: "signed" },
    body: unsignedRequest?.body,
  }]]);
});

test("fails when AppSync rejects a publish", async () => {
  const signer = { sign: async (request: unknown) => request };
  const fetcher: typeof fetch = async () => ({ ok: false, status: 403 }) as Response;
  await assert.rejects(
    new AppsyncEventsPublisher("https://events.example.test/event", "/prices", signer as never, fetcher).publish(marketPrice),
    /status 403/,
  );
});
