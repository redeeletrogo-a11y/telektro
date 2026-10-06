export const GOOGLE_ADS_ID = "AW-11299986599";
export const GOOGLE_ADS_CONVERSION = "AW-11299986599/Cek7COb2npMdEKe5oIwq";

export const GOOGLE_ADS_SNIPPET = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GOOGLE_ADS_ID}');`;

type AdsWindow = Window & { gtag?: (...args: unknown[]) => void };

export function trackAdsConversion() {
  try {
    const w = window as AdsWindow;
    if (typeof w.gtag === "function") {
      w.gtag("event", "conversion", { send_to: GOOGLE_ADS_CONVERSION, value: 1.0, currency: "BRL" });
    }
  } catch {
    // Tracking must never stop the customer opening WhatsApp.
  }
}
