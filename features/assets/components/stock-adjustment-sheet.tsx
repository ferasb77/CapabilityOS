"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { STOCK_ADJUSTMENT_REASONS, STOCK_ADJUSTMENT_REASON_LABELS, type StockAdjustmentReason } from "@/features/assets/schema";

import { adjustStock } from "../actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: { id: string; name: string; stockQuantity: number; stockUnit: string } | null;
};

export function StockAdjustmentSheet({ open, onOpenChange, asset }: Props) {
  const router = useRouter();
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState<StockAdjustmentReason>("received");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function reset() {
    setDirection("add");
    setAmount("1");
    setReason("received");
    setNotes("");
    setError(null);
  }

  async function handleSave() {
    if (!asset) return;

    setError(null);
    setIsSaving(true);

    const parsedAmount = Number(amount);
    const quantityChange = direction === "add" ? parsedAmount : -parsedAmount;

    const formData = new FormData();
    formData.set("quantityChange", String(quantityChange));
    formData.set("reason", reason);
    formData.set("notes", notes);

    const result = await adjustStock(asset.id, formData);

    setIsSaving(false);

    if (result.success) {
      reset();
      onOpenChange(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  const parsedAmount = Number(amount);
  const canSave = asset !== null && Number.isInteger(parsedAmount) && parsedAmount > 0 && !isSaving;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Adjust Stock</SheetTitle>
          <SheetDescription>
            {asset ? `${asset.name} — currently ${asset.stockQuantity} ${asset.stockUnit}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4">
          <div className="space-y-2">
            <Label>Direction</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={direction === "add" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setDirection("add")}
              >
                + Add
              </Button>
              <Button
                type="button"
                variant={direction === "remove" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setDirection("remove")}
              >
                − Remove
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjustment-amount">
              Quantity <span className="text-gold">*</span>
            </Label>
            <Input
              id="adjustment-amount"
              type="number"
              min={1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjustment-reason">Reason</Label>
            <Select
              value={reason}
              onValueChange={(value) => value && setReason(value as StockAdjustmentReason)}
              items={STOCK_ADJUSTMENT_REASONS.map((value) => ({ value, label: STOCK_ADJUSTMENT_REASON_LABELS[value] }))}
            >
              <SelectTrigger id="adjustment-reason" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STOCK_ADJUSTMENT_REASONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {STOCK_ADJUSTMENT_REASON_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjustment-notes">Notes (optional)</Label>
            <Textarea id="adjustment-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <SheetFooter>
          <Button type="button" disabled={!canSave} onClick={handleSave}>
            {isSaving ? "Saving..." : "Save Adjustment"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
