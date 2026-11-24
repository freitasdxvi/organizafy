import { integrationOrigins, PERSISTE_SITE_ORIGIN } from "../_shared/integration-origins.ts";

const provider = "https://instacaster.top";
const productSlug = "ig_gmail_otp";
const pageSize = 25;

export type PriorityOption = { mode: number; seconds_earlier: number; price: string };
export type Product = { slug: string; name: string; price: string; hold_seconds: number; priority_options: PriorityOption[] };
export type Balance = { balance: string; currency: string };
export type Order = {
  order_id: string;
  product: string;
  email: string;
  price: string;
  status: string;
  priority_mode: number;
};
export type OrderSummary = Order & {
  codes_received: number;
  last_code?: string | null;
  codes?: { code: string; received_at?: string | null }[];
  created_at?: string | null;
};
export type History = { orders: OrderSummary[]; has_more: boolean };
export type CodeResult = { order_id: string; status: string; code?: string | null };
export type Catalog = { product: Product | null; balance: Balance };

class ProviderError extends Error {
  constructor(readonly status: number, readonly code?: string) { super("provider_error"); }
}

type Authorization = (token: string) => Promise<"admin" | "forbidden" | "unauthorized">;

export function createInstacasterHandler(
  authorize: Authorization,
  apiKey: string | undefined,
  origins = integrationOrigins(),
  request = fetch,
) {
  async function call<T>(path: string, body?: object): Promise<T> {
    const response = await request(provider + path, {
      method: body ? "POST" : "GET",
      headers: {
        "X-API-Key": apiKey!,
        Accept: "application/json",
        ...(body && { "Content-Type": "application/json" }),
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ProviderError(response.status, data?.error?.code);
    if (data === null) throw new Error("invalid_provider_response");
    return data;
  }

  async function getProduct(): Promise<Product | null> {
    const products = await call<Product[]>("/v1/products");
    const product = products.find(item => item.slug === productSlug);
    if (!product) return null;
    const normal = { mode: 0, seconds_earlier: 0, price: product.price };
    const priority = product.hold_seconds > 0
      ? (product.priority_options ?? []).filter(option =>
        (option.mode === 1 || option.mode === 2) && option.seconds_earlier > 0
      )
      : [];
    return { ...product, priority_options: [normal, ...priority] };
  }

  return async (req: Request) => {
    const origin = req.headers.get("origin") ?? "";
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origins.has(origin) ? origin : PERSISTE_SITE_ORIGIN,
      "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      Vary: "Origin",
    };
    const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
    const fail = (error: string, status: number) => reply({ error }, status);
    if (req.method === "OPTIONS") return new Response(null, { headers });
    if (req.method !== "POST") return fail("invalid_request", 405);
    const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return fail("unauthorized", 401);

    let access;
    try { access = await authorize(token); } catch { return fail("request_failed", 500); }
    if (access === "unauthorized") return fail("unauthorized", 401);
    if (access !== "admin") return fail("forbidden", 403);
    if (!apiKey) return fail("not_configured", 503);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail("invalid_request", 400);
    let submittedPurchase = false;
    try {
      switch (body.action) {
        case "catalog": {
          const [product, balance] = await Promise.all([getProduct(), call<Balance>("/v1/balance")]);
          return reply({ product, balance } satisfies Catalog);
        }
        case "history": {
          const offset = body.offset ?? 0;
          if (!Number.isInteger(offset) || offset < 0 || offset > 100_000) return fail("invalid_request", 400);
          const history = await call<History>(`/v1/orders?limit=${pageSize}&offset=${offset}`);
          return reply({
            orders: history.orders.filter(order => order.product === productSlug),
            has_more: history.has_more && offset + pageSize <= 100_000,
            page_size: pageSize,
          });
        }
        case "purchase": {
          const { mode, price, currency } = body;
          if (![0, 1, 2].includes(mode) || typeof price !== "string" || !/^\d+(\.\d+)?$/.test(price) ||
            typeof currency !== "string" || !/^[a-z]{3}$/i.test(currency)) return fail("invalid_request", 400);
          const [product, balance] = await Promise.all([getProduct(), call<Balance>("/v1/balance")]);
          if (!product) return fail("product_unavailable", 409);
          const option = product.priority_options.find(item => item.mode === mode);
          if (!option || option.price !== price || balance.currency !== currency) return fail("price_changed", 409);
          submittedPurchase = true;
          const order = await call<Order>("/v1/orders", { product: productSlug, priority_mode: mode });
          if (order.status !== "charged" || !order.order_id || !order.email || order.product !== productSlug) {
            return fail("purchase_uncertain", 502);
          }
          return reply(order);
        }
        case "code": {
          if (typeof body.order_id !== "string" || !/^[\w-]{1,128}$/.test(body.order_id)) return fail("invalid_request", 400);
          const path = `/v1/orders/${encodeURIComponent(body.order_id)}`;
          const order = await call<Order>(path);
          if (order.product !== productSlug) return fail("order_not_found", 404);
          return reply(await call<CodeResult>(`${path}/code`));
        }
        default:
          return fail("invalid_request", 400);
      }
    } catch (error) {
      if (error instanceof ProviderError) {
        if (error.status === 401 || error.status === 403) return fail("provider_access", 503);
        if (error.status === 402) return fail("insufficient_balance", 402);
        if (error.status === 404 && body.action === "code") return fail("order_not_found", 404);
        if (error.status === 409 && submittedPurchase) return fail("out_of_stock", 409);
        if (error.status === 409 && body.action === "code") return fail("code_unavailable", 409);
        if (error.status === 429) return fail("rate_limited", 429);
        if (error.status === 503 && error.code === "service_busy") return fail("service_busy", 503);
      }
      return submittedPurchase ? fail("purchase_uncertain", 502) : fail("request_failed", 502);
    }
  };
}
