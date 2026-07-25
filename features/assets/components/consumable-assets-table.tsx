"use client";

import { Pencil, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AssetWithStatus } from "@/features/assets/data";

import { ConsumableStockBadge } from "./asset-status-badge";
import { StockBar } from "./stock-bar";

type Props = {
  assets: AssetWithStatus[];
  onEdit: (asset: AssetWithStatus) => void;
  onAdjustStock: (asset: AssetWithStatus) => void;
};

export function ConsumableAssetsTable({ assets, onEdit, onAdjustStock }: Props) {
  if (assets.length === 0) {
    return (
      <Card className="bg-surface-elevated">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">No consumable assets yet.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-elevated">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Reorder At</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => (
            <TableRow key={asset.id}>
              <TableCell className="font-medium text-ivory">{asset.name}</TableCell>
              <TableCell className="text-muted-foreground">{asset.category ?? "—"}</TableCell>
              <TableCell className="min-w-[160px]">
                <div className="space-y-1.5">
                  <p className="text-sm text-ivory">
                    {asset.stockQuantity} {asset.stockUnit}
                  </p>
                  <StockBar stockQuantity={asset.stockQuantity} reorderThreshold={asset.reorderThreshold} />
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {asset.reorderThreshold !== null ? `${asset.reorderThreshold} ${asset.stockUnit}` : "—"}
              </TableCell>
              <TableCell>
                <ConsumableStockBadge stockQuantity={asset.stockQuantity} reorderThreshold={asset.reorderThreshold} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => onAdjustStock(asset)}>
                    <Settings2 className="size-4" />
                    Adjust Stock
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onEdit(asset)}
                    aria-label={`Edit ${asset.name}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
