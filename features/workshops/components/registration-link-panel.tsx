"use client";

import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { CopyLinkButton } from "./copy-link-button";
import { RegistrationQrCode } from "./registration-qr-code";

type Props = {
  url: string;
};

export function RegistrationLinkPanel({ url }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-elevated p-4 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-3">
        <RegistrationQrCode url={url} />
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-xs text-muted-foreground">Registration Link</p>
          <Input
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
            className="font-mono text-xs"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <CopyLinkButton url={url} />
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href={url} target="_blank" rel="noopener noreferrer" />}
        >
          <ExternalLink className="size-4" />
          Open
        </Button>
      </div>
    </div>
  );
}
