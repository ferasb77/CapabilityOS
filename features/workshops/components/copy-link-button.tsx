"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COPIED_DURATION_MS = 2000;

type Props = {
  url: string;
  label?: string;
  className?: string;
};

export function CopyLinkButton({ url, label = "Copy Link", className }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = setTimeout(() => setCopied(false), COPIED_DURATION_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard API can fail (permissions, insecure context) — nothing
      // useful to recover into beyond leaving the button unchanged so the
      // user can try again or copy the visible URL manually.
    }
  }

  return (
    <Button
      type="button"
      variant={copied ? "default" : "secondary"}
      onClick={handleCopy}
      className={cn(copied && "text-night", className)}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Copied!" : label}
    </Button>
  );
}
