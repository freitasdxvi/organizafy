import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Instacaster from "./Instacaster";

const { invoke, access } = vi.hoisted(() => ({
  invoke: vi.fn(),
  access: { data: { is_admin: true, account_status: "approved" } },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "qa" } }) }));
vi.mock("@/features/administration/api", () => ({ useAdministrationAccess: () => access }));

const order = { order_id: "order-1", email: "test@example.test", price: "0.25", status: "charged" };

beforeEach(() => {
  access.data.is_admin = true;
  invoke.mockReset().mockImplementation(async (_function, { body }) => {
    switch (body.action) {
      case "catalog": return {
        data: {
          product: {
            name: "Instagram Gmail OTP", priority_options: [
              { mode: 0, seconds_earlier: 0, price: "0.20" },
              { mode: 1, seconds_earlier: 30, price: "0.25" },
            ],
          },
          balance: { balance: "5.00", currency: "USD" },
        },
      };
      case "purchase": return { data: order };
      case "history": return { data: { orders: [order], has_more: false, page_size: 25 } };
      case "code": return { data: { order_id: order.order_id, status: "ready", code: "123456" } };
      default: throw new Error("Unexpected action");
    }
  });
});

afterEach(cleanup);

function show() {
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><Instacaster /></QueryClientProvider>);
}

it("requires confirmation of the selected price and shows new codes", async () => {
  show();
  const priority = await screen.findByRole("combobox", { name: "Prioridade" });
  fireEvent.change(priority, { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Comprar e-mail" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("USD 0,25");
  expect(invoke.mock.calls.some(([, { body }]) => body.action === "purchase")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));
  await waitFor(() => expect(invoke).toHaveBeenCalledWith("instacaster", {
    body: { action: "purchase", mode: 1, price: "0.25", currency: "USD" },
  }));
  expect(await screen.findByText("E-mail comprado com sucesso.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Consultar código" }));
  expect(await screen.findByText("123456")).toBeVisible();
});

it("blocks the direct page for members without administrator access", () => {
  access.data.is_admin = false;
  show();
  expect(screen.getByRole("heading", { name: "Acesso restrito" })).toBeVisible();
  expect(invoke).not.toHaveBeenCalled();
});
