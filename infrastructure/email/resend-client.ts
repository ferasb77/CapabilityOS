import { Resend } from "resend";

import { requireEnv } from "@/infrastructure/env";

let client: Resend | null = null;

export function getResendClient(): Resend {
  if (!client) {
    client = new Resend(requireEnv("RESEND_API_KEY"));
  }

  return client;
}

export function getResendFromAddress(): string {
  return `Enable My Growth <${requireEnv("RESEND_FROM_EMAIL")}>`;
}
