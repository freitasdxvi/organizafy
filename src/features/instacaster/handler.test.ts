// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { createInstacasterHandler } from "../../../supabase/functions/instacaster/handler";

const sku = "ig_gmail_otp";
const origin = "https://instacaster.top";
const product = {
  slug: sku, name: "Instagram Gmail OTP", price: "0.20", hold_seconds: 30,
  priority_options: [{ mode: 1, seconds_earlier: 30, price: "0.25" }],
};
const balance = { balance: "5.00", currency: "USD" };
const order = { order_id: "order-1", product: sku, email: "test@example.test", status: "charged", price: "0.25" };
const purchase = { action: "purchase", mode: 1, price: "0.25", currency: "USD" };

function post(body: object, token = "admin") {
  return new Request("https://persiste.online/functions/v1/instacaster", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

function fakeProvider(options: { hold?: number; purchaseFails?: boolean } = {}) {
  const { hold = 30, purchaseFails = false } = options;
  return vi.fn<typeof fetch>(async (input, init) => {
    expect(new Headers(init?.headers).get("X-API-Key")).toBe("test-provider-key");
    const url = new URL(String(input));
    expect(url.origin).toBe(origin);
    switch (url.pathname) {
      case "/v1/products": return Response.json([{ ...product, hold_seconds: hold }]);
      case "/v1/balance": return Response.json(balance);
      case "/v1/orders":
        if (init?.method === "POST") {
          if (purchaseFails) throw new Error("network failure");
          return Response.json(order);
        }
        return Response.json({ orders: [order, { ...order, product: "other" }], has_more: true });
      case "/v1/orders/order-1": return Response.json(order);
      case "/v1/orders/other": return Response.json({ ...order, product: "other" });
      case "/v1/orders/order-1/code": return Response.json({ order_id: "order-1", status: "ready", code: "123456" });
      default: throw new Error("Unexpected request");
    }
  });
}

function setup(options?: Parameters<typeof fakeProvider>[0]) {
  const provider = fakeProvider(options);
  const run = createInstacasterHandler(async token => token === "admin" ? "admin" : "forbidden", "test-provider-key", undefined, provider);
  return { provider, run };
}

describe("Instacaster", () => {
  it("rejects unauthorized spending and reads before contacting the provider", async () => {
    const { run, provider } = setup();
    expect((await run(post(purchase, "member"))).status).toBe(403);
    expect((await run(post({ action: "history" }, ""))).status).toBe(401);
    expect(provider).not.toHaveBeenCalled();
  });

  it("only charges when the confirmed mode and price still match the catalog", async () => {
    const { run, provider } = setup();
    const changed = await run(post({ ...purchase, price: "0.20" }));
    expect(changed.status).toBe(409);
    expect(await changed.json()).toEqual({ error: "price_changed" });
    expect(provider.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);

    const result = await run(post(purchase));
    expect(await result.json()).toMatchObject(order);
    const writes = provider.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(writes).toHaveLength(1);
    expect(JSON.parse(String(writes[0][1]?.body))).toEqual({ product: sku, priority_mode: 1 });
  });

  it("only offers normal pricing when stock has no hold", async () => {
    const { run, provider } = setup({ hold: 0 });
    const result = await run(post({ action: "catalog" }));
    expect(await result.json()).toMatchObject({
      balance,
      product: { priority_options: [{ mode: 0, seconds_earlier: 0, price: "0.20" }] },
    });
    expect((await run(post(purchase))).status).toBe(409);
    expect(provider.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("returns an uncertain result without resubmitting after a network failure", async () => {
    const { run, provider } = setup({ purchaseFails: true });
    const result = await run(post(purchase));
    expect(result.status).toBe(502);
    expect(await result.json()).toEqual({ error: "purchase_uncertain" });
    expect(provider.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("shows only this product's orders and retrieves their codes", async () => {
    const { run, provider } = setup();
    const result = await run(post({ action: "history", offset: 25 }));
    expect(await result.json()).toEqual({ orders: [order], has_more: true, page_size: 25 });
    expect(provider.mock.calls[0][0]).toBe(`${origin}/v1/orders?limit=25&offset=25`);
    const unrelated = await run(post({ action: "code", order_id: "other" }));
    expect(unrelated.status).toBe(404);
    expect(provider.mock.calls.some(([url]) => url === `${origin}/v1/orders/other/code`)).toBe(false);
    const code = await run(post({ action: "code", order_id: order.order_id }));
    expect(code.headers.get("Cache-Control")).toBe("no-store");
    expect(await code.json()).toEqual({ order_id: order.order_id, status: "ready", code: "123456" });
  });
});
