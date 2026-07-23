"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  url: string;
};

export function RegistrationQrCode({ url }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Standard black-on-white, not brand colors — a QR code is meant to be
    // scanned and printed, and low-contrast modules risk failing to scan.
    QRCode.toDataURL(url, {
      width: 480,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    })
      .then((generated) => {
        if (!cancelled) {
          setDataUrl(generated);
        }
      })
      .catch(() => {
        // Leave dataUrl null — the thumbnail button stays disabled.
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!dataUrl}
        aria-label="Show registration QR code"
        className="shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-white p-1 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a generated data URL needs no image optimization
          <img src={dataUrl} alt="Registration QR code" className="size-14" />
        ) : (
          <div className="size-14 animate-pulse bg-muted" />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registration QR Code</DialogTitle>
            <DialogDescription>
              Scan to open the registration form, or display / print this for in-person sign-up.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center rounded-lg bg-white p-6">
            {dataUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- a generated data URL needs no image optimization
              <img src={dataUrl} alt="Registration QR code" className="size-64" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
