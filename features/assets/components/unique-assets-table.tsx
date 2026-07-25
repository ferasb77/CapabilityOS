"use client";

import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AssetWithStatus } from "@/features/assets/data";

import { UniqueAssetStatusBadge } from "./asset-status-badge";

type Props = {
  assets: AssetWithStatus[];
  onEdit: (asset: AssetWithStatus) => void;
};

export function UniqueAssetsTable({ assets, onEdit }: Props) {
  if (assets.length === 0) {
    return (
      <Card className="bg-surface-elevated">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">No unique assets yet.</CardContent>
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
            <TableHead>Serial Number</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="text-right">Edit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => (
            <TableRow key={asset.id}>
              <TableCell className="font-medium text-ivory">{asset.name}</TableCell>
              <TableCell className="text-muted-foreground">{asset.category ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{asset.serialNumber ?? "—"}</TableCell>
              <TableCell>
                <UniqueAssetStatusBadge assignment={asset.currentAssignment} />
              </TableCell>
              <TableCell className="text-muted-foreground">{asset.location ?? "—"}</TableCell>
              <TableCell className="max-w-[220px] truncate text-muted-foreground">{asset.notes ?? "—"}</TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onEdit(asset)}
                  aria-label={`Edit ${asset.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
