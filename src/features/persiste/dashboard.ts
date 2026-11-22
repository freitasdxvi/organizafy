import type { AnalyticsReport } from "@/features/instagram-publisher/useInstagramAnalytics";

function inTimezone(options: Intl.DateTimeFormatOptions, timezone: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: timezone });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "America/Sao_Paulo" });
  }
}

export function dashboardGreeting(now: Date, timezone: string, name: string) {
  const options = { hour: "2-digit", hourCycle: "h23" } as const;
  const hour = Number(inTimezone(options, timezone).formatToParts(now).find((part) => part.type === "hour")?.value);
  const greeting = hour < 5 ? "Boa madrugada" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = name.trim().split(/\s+/)[0];
  return firstName ? `${greeting}, ${firstName}.` : `${greeting}!`;
}

export function viewsOnReelsPublishedToday(report: AnalyticsReport | undefined, now: Date, timezone: string) {
  const formatter = inTimezone({ year: "numeric", month: "numeric", day: "numeric" }, timezone);
  const today = formatter.format(now);
  const seen = new Set<string>();
  let total = 0;

  for (const account of report?.accounts ?? []) {
    if (account.unavailable) continue;
    for (const video of account.videos) {
      const time = Date.parse(video.timestamp);
      if (video.account_id !== account.account_id || video.media_product_type !== "REELS" || seen.has(video.id) ||
        video.views === null || !Number.isFinite(video.views) || video.views < 0 || !Number.isFinite(time) ||
        time > now.getTime() || formatter.format(time) !== today) continue;
      seen.add(video.id);
      total += video.views;
    }
  }
  return total;
}

const marketingLines = [
  "Como tá o faturamento do dia? Olha quais vídeos trouxeram mais cliques antes de postar de novo.",
  "Qual gancho segurou mais gente nos primeiros três segundos? Testa uma variação no próximo Reel.",
  "Antes de mudar tudo, testa uma capa diferente. Assim dá pra saber o que fez diferença.",
  "Qual vídeo trouxe mais cliques no perfil? Vale testar outra versão com o mesmo tema.",
];

export function mascotLine(turn: number, totalViews: number | null, viewsOnNewReels: number) {
  const lines = [
    ...(totalViews !== null && totalViews >= 1_000_000 ? ["1M de vizu? Me vende mentoria?"] : []),
    ...(viewsOnNewReels >= 10_000 ? ["Caraca, já tá nos 10k nos Reels de hoje? Qual foi o gancho?"] : []),
    ...(totalViews !== null && totalViews >= 1_000_000 ? ["Já pode vender mentoria, hein. Anota o que funcionou pra repetir no próximo vídeo."] : []),
    ...marketingLines,
  ];
  return lines[turn % lines.length];
}
