"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MILESTONE_CURRENCIES,
  PAYMENT_TERMS,
  PAYMENT_TERMS_LABELS,
  type PaymentTerms,
} from "@/features/financial/schema";

import { updateFinanceSettings } from "../actions";

type Props = {
  workspaceId: string;
  defaultCurrency: string;
  defaultPaymentTerms: PaymentTerms;
};

export function FinanceDefaultsCard({ workspaceId, defaultCurrency, defaultPaymentTerms }: Props) {
  const router = useRouter();
  const [currency, setCurrency] = useState(defaultCurrency);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>(defaultPaymentTerms);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("defaultCurrency", currency);
      formData.set("defaultPaymentTerms", paymentTerms);

      const result = await updateFinanceSettings(workspaceId, formData);

      if (result.success) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Card className="bg-surface-elevated">
      <CardHeader>
        <CardTitle>Defaults</CardTitle>
        <CardDescription>Applied when a new engagement or milestone doesn&apos;t specify its own.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="default-currency">Default currency</Label>
            <Select
              value={currency}
              onValueChange={(value) => value && setCurrency(value)}
              items={MILESTONE_CURRENCIES.map((value) => ({ value, label: value }))}
            >
              <SelectTrigger id="default-currency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MILESTONE_CURRENCIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="default-payment-terms">Default payment terms</Label>
            <Select
              value={paymentTerms}
              onValueChange={(value) => value && setPaymentTerms(value as PaymentTerms)}
              items={PAYMENT_TERMS.map((value) => ({ value, label: PAYMENT_TERMS_LABELS[value] }))}
            >
              <SelectTrigger id="default-payment-terms" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TERMS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {PAYMENT_TERMS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" disabled={isPending} onClick={handleSave}>
            {isPending ? "Saving..." : "Save Defaults"}
          </Button>
          {saved && !isPending && <p className="text-sm text-emerald-400">Saved.</p>}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
