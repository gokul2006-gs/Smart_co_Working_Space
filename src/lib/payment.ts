export type PaymentProvider = "stripe" | "razorpay" | "manual";

function getRawEnv(key: string): string | undefined {
  if (typeof import.meta !== "undefined" && typeof import.meta.env !== "undefined") {
    const env = import.meta.env as Record<string, string | undefined>;
    if (env[key]) return env[key];
  }

  if (typeof process !== "undefined" && typeof process.env !== "undefined") {
    return process.env[key] as string | undefined;
  }

  return undefined;
}

export function getPaymentProvider(): PaymentProvider {
  // Server-side: read directly from process.env first
  const serverEnv = typeof process !== "undefined" ? process.env : undefined;
  const fromProcess = serverEnv?.["PAYMENT_PROVIDER"]?.toLowerCase();

  // Client-side: read from Vite's import.meta.env
  let fromVite: string | undefined;
  if (typeof import.meta !== "undefined" && typeof import.meta.env !== "undefined") {
    const env = import.meta.env as Record<string, string | undefined>;
    fromVite = env["VITE_PAYMENT_PROVIDER"]?.toLowerCase();
  }

  const configured = fromVite ?? fromProcess;
  if (configured === "stripe") return "stripe";
  if (configured === "razorpay") return "razorpay";
  if (configured === "demo" || configured === "manual") return "manual";
  return "manual";
}

export function isPaymentGatewayEnabled(): boolean {
  const provider = getPaymentProvider();
  return provider === "stripe" || provider === "razorpay";
}

export function getAppUrl(): string {
  return getRawEnv("VITE_APP_URL") ?? getRawEnv("APP_URL") ?? "http://localhost:8080";
}
