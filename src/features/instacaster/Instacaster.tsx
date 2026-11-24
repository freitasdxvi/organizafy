import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useAdministrationAccess } from "@/features/administration/api";
import { supabase } from "@/integrations/supabase/client";
import type { Catalog, CodeResult, History, Order, OrderSummary } from "../../../supabase/functions/instacaster/handler";

const messages: Record<string, string> = {
  unauthorized: "Entre novamente para continuar.",
  forbidden: "Esta área é exclusiva de administradores.",
  not_configured: "A integração precisa da chave INSTACASTER_API_KEY nos segredos da função do Supabase.",
  provider_access: "O Instacaster recusou a chave configurada no servidor.",
  insufficient_balance: "Saldo insuficiente no Instacaster.",
  product_unavailable: "O produto saiu do catálogo.",
  out_of_stock: "Sem e-mails em estoque no momento.",
  price_changed: "O preço ou a prioridade mudou. Confira o valor atualizado antes de confirmar.",
  purchase_uncertain: "Não foi possível confirmar a compra. Atualize o histórico antes de fazer outro pedido.",
  order_not_found: "O pedido não foi encontrado no Instacaster.",
  code_unavailable: "Este e-mail não recebe mais códigos.",
  rate_limited: "Limite de consultas atingido. Aguarde alguns segundos.",
  service_busy: "O Instacaster está ocupado. Tente novamente em alguns segundos.",
  request_failed: "Não foi possível consultar o Instacaster.",
};

async function invoke<T>(action: string, values: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("instacaster", { body: { action, ...values } });
  if (!error) return data;
  const response = error.context;
  const payload = response instanceof Response ? await response.json().catch(() => null) : null;
  const code = payload?.error ?? (response?.status === 401 ? "unauthorized" : "");
  throw new Error(messages[code] || messages[action === "purchase" ? "purchase_uncertain" : "request_failed"]);
}

function money(amount: string, currency: string) {
  return `${currency} ${amount.replace(".", ",")}`;
}

function CopyValue({ value, label }: { value: string; label: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error("Selecione o texto para copiar manualmente.");
    }
  }
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1">
      <span className="break-all font-mono">{value}</span>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Copiar ${label.toLowerCase()}`} onClick={() => void copy()}>
        <Copy className="h-4 w-4" aria-hidden="true" />
      </Button>
    </span>
  );
}

function OrderRow({ order, currency, onRefresh }: { order: OrderSummary; currency?: string; onRefresh: () => void }) {
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const code = useMutation({
    mutationFn: () => invoke<CodeResult>("code", { order_id: order.order_id }),
    onSuccess: result => {
      const value = result.code;
      if (value) {
        setNewCodes(previous => [value, ...previous]);
        setExpanded(true);
      }
      onRefresh();
    },
    retry: false,
    gcTime: 0,
  });
  const codes = order.codes?.length ? order.codes.map(item => item.code) : [order.last_code].filter(Boolean);
  const received = Array.from(new Set([...newCodes, ...codes].filter((value): value is string => Boolean(value))));

  return (
    <li className="grid gap-3 border-t py-4 sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <CopyValue value={order.email} label="E-mail" />
        <p className="break-all text-sm text-muted-foreground">
          Pedido {order.order_id} · {currency ? money(order.price, currency) : order.price}
          {order.status === "failed" && " · E-mail inativo"}
        </p>
      </div>
      <Button type="button" variant="outline" disabled={code.isPending || order.status === "failed"} onClick={() => code.mutate()}>
        {code.isPending ? "Consultando…" : "Consultar código"}
      </Button>
      {code.isError && <p role="alert" className="text-sm text-destructive sm:col-span-2">{code.error.message}</p>}
      {code.data?.status === "pending" && <p role="status" className="text-sm text-muted-foreground sm:col-span-2">Nenhum código novo. Consulte novamente em alguns segundos.</p>}
      {received.length > 0 && (
        <details className="sm:col-span-2" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
          <summary className="cursor-pointer text-sm">Códigos recebidos ({received.length})</summary>
          <ul className="mt-1">
            {received.map(value => <li key={value}><CopyValue value={value} label="Código" /></li>)}
          </ul>
        </details>
      )}
    </li>
  );
}

function InstacasterWorkspace({ userId }: { userId: string }) {
  const [mode, setMode] = useState(0);
  const [offset, setOffset] = useState(0);
  const [confirmedQuote, setConfirmedQuote] = useState<{ mode: number; price: string; currency: string } | null>(null);
  const client = useQueryClient();
  const catalogKey = ["instacaster", userId, "catalog"];
  const historyKey = ["instacaster", userId, "history"];
  const catalog = useQuery({
    queryKey: catalogKey,
    queryFn: () => invoke<Catalog>("catalog"),
    retry: false,
    gcTime: 0,
  });
  const history = useQuery({
    queryKey: [...historyKey, offset],
    queryFn: () => invoke<History & { page_size: number }>("history", { offset }),
    retry: false,
    gcTime: 0,
  });
  const purchase = useMutation({
    mutationFn: (quote: { mode: number; price: string; currency: string }) => invoke<Order>("purchase", quote),
    onSuccess: () => setOffset(0),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: catalogKey });
      void client.invalidateQueries({ queryKey: historyKey });
    },
    retry: false,
    gcTime: 0,
  });
  const product = catalog.data?.product;
  const balance = catalog.data?.balance;
  const options = product?.priority_options ?? [];
  const selected = options.find(option => option.mode === mode) ?? options[0];
  const quote = selected && balance ? { mode: selected.mode, price: selected.price, currency: balance.currency } : null;
  const pageSize = history.data?.page_size ?? 25;
  const refreshHistory = () => { void client.invalidateQueries({ queryKey: historyKey }); };

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5">
      <header className="flex items-start gap-3">
        <Mail className="mt-1 h-6 w-6 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold">Instacaster</h1>
          <p className="text-sm text-muted-foreground">Compre e-mails para verificação do Instagram e consulte os códigos dos seus pedidos.</p>
        </div>
      </header>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>{product?.name ?? "Instagram Gmail OTP"}</CardTitle>
            <CardDescription className="mt-1">{balance ? `Saldo disponível · ${money(balance.balance, balance.currency)}` : "Saldo e preços do Instacaster"}</CardDescription>
          </div>
          <Button type="button" variant="outline" size="icon" aria-label="Atualizar saldo e preços" disabled={catalog.isFetching} onClick={() => void catalog.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4">
          {catalog.isPending && <p role="status">Carregando saldo e preços…</p>}
          {catalog.isError && <p role="alert" className="text-sm text-destructive">{catalog.error.message}</p>}
          {catalog.isSuccess && !product && <p>O produto está indisponível no catálogo.</p>}
          {quote && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid max-w-full gap-1.5 text-sm">
                Prioridade
                <select className="h-10 max-w-full rounded-md border bg-background px-3" value={quote.mode} disabled={purchase.isPending} onChange={event => setMode(Number(event.target.value))}>
                  {options.map(option => (
                    <option key={option.mode} value={option.mode}>
                      {option.mode === 0 ? "Normal" : `${option.seconds_earlier} s de antecedência`} · {money(option.price, quote.currency)}
                    </option>
                  ))}
                </select>
              </label>
              <AlertDialog onOpenChange={open => setConfirmedQuote(open ? quote : null)}>
                <AlertDialogTrigger asChild>
                  <Button type="button" disabled={purchase.isPending || catalog.isError || catalog.isFetching}>
                    {purchase.isPending ? "Comprando…" : "Comprar e-mail"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar compra de e-mail</AlertDialogTitle>
                    <AlertDialogDescription>
                      {confirmedQuote && <>O Instacaster debitará {money(confirmedQuote.price, confirmedQuote.currency)} do saldo quando entregar o e-mail. A compra é definitiva.</>}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction disabled={!confirmedQuote || purchase.isPending} onClick={() => {
                      if (confirmedQuote && !purchase.isPending) purchase.mutate(confirmedQuote);
                    }}>Confirmar compra</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
          {purchase.isError && <p role="alert" className="text-sm text-destructive">{purchase.error.message}</p>}
          {purchase.data && <div><p role="status" className="text-sm">E-mail comprado com sucesso.</p><CopyValue value={purchase.data.email} label="E-mail" /></div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Pedidos</CardTitle>
            <CardDescription className="mt-1">Consulte o código depois de solicitá-lo no Instagram.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="icon" aria-label="Atualizar pedidos" disabled={history.isFetching} onClick={() => void history.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </CardHeader>
        <CardContent>
          {history.isPending && <p role="status">Carregando pedidos…</p>}
          {history.isError && <p role="alert" className="text-sm text-destructive">{history.error.message}</p>}
          {history.data?.orders.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido nesta página.</p>}
          <ul>
            {history.data?.orders.map(order => <OrderRow key={order.order_id} order={order} currency={balance?.currency} onRefresh={refreshHistory} />)}
          </ul>
          {(offset > 0 || history.data?.has_more) && (
            <nav className="flex flex-wrap items-center gap-3 pt-3" aria-label="Páginas de pedidos">
              <Button type="button" variant="outline" disabled={offset === 0 || history.isFetching} onClick={() => setOffset(offset - pageSize)}>Anterior</Button>
              <span className="text-sm">Página {offset / pageSize + 1}</span>
              <Button type="button" variant="outline" disabled={!history.data?.has_more || history.isFetching} onClick={() => setOffset(offset + pageSize)}>Próxima</Button>
            </nav>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Instacaster() {
  const access = useAdministrationAccess();
  const { user } = useAuth();
  if (access.isPending) return <p role="status">Verificando acesso administrativo…</p>;
  if (access.isError) return <p role="alert">{access.error.message}</p>;
  if (!user || !access.data?.is_admin || access.data.account_status !== "approved") {
    return <section><h1 className="text-2xl font-semibold">Acesso restrito</h1><p>Esta área é exclusiva de administradores.</p></section>;
  }
  return <InstacasterWorkspace key={user.id} userId={user.id} />;
}
