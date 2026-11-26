/** All user-facing copy lives here. */

export interface StatusInfo {
  sessionAgeMin: number | null;
  lastTurn: { at: Date; durationMs: number; ok: boolean } | null;
  uptimeMin: number;
}

export const texts = {
  start: (name: string) =>
    [
      `📡 ${name} burada. Ne olup bittiğini sor, arayıp okuyup kısa kısa anlatayım.`,
      "",
      "/brief — son 24 saatin özeti (/brief konu da olur)",
      "/new — yeni sohbet",
      "/status — durum",
    ].join("\n"),
  busy: "⏳ Hâlâ önceki mesajın üzerindeyim, bitince yazarım.",
  timeout: "⌛ Cevap çok uzun sürdü, iptal ettim. Tekrar dener misin? Olmazsa /new.",
  empty: "🤷 Boş cevap geldi. Tekrar dener misin?",
  crash: "⚠️ Beklenmeyen bir hata oldu, log'a yazdım.",
  newDone: "🆕 Yeni sohbet başladı.",
  status: (s: StatusInfo) =>
    [
      `⏱ Çalışma süresi: ${s.uptimeMin} dk`,
      `💬 Oturum: ${s.sessionAgeMin === null ? "yok" : `${s.sessionAgeMin} dk önce`}`,
      `🧠 Son tur: ${
        s.lastTurn
          ? `${(s.lastTurn.durationMs / 1000).toFixed(1)} sn, ${s.lastTurn.ok ? "başarılı" : "hatalı"}`
          : "henüz yok"
      }`,
    ].join("\n"),
};

export function describeError(message: string): string {
  if (/usage limit|rate limit|quota|too many requests/i.test(message)) {
    return "⚠️ Abonelik kotası dolmuş görünüyor. Biraz sonra tekrar dene.";
  }
  if (/login|auth|unauthori[sz]ed|401/i.test(message)) {
    return "⚠️ Codex oturumu düşmüş görünüyor, sunucuda yeniden login gerekiyor.";
  }
  const short = message.length > 200 ? `${message.slice(0, 200)}…` : message;
  return `⚠️ Bir sorun çıktı: ${short}`;
}
