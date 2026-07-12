export type PaymentProvider = "stripe" | "razorpay" | "manual";

function getRawEnv(key: string): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>;
  return env[key] ?? (typeof process !== "undefined" ? (process.env[key] as string | undefined) : undefined);
}

export function getPaymentProvider(): PaymentProvider {
  const configured = (getRawEnv("VITE_PAYMENT_PROVIDER") ?? getRawEnv("PAYMENT_PROVIDER"))?.toLowerCase();
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
