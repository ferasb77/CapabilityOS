"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2, X } from "lucide-react";

import { CopyLinkButton } from "./copy-link-button";

const AUTO_DISMISS_MS = 8000;

type Props = {
  registrationUrl: string;
};

export function WorkshopCreatedBanner({ registrationUrl }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // Dismissing means dropping `?created=true` from the URL, not local
  // component state — refreshing mid-banner still shows it (the URL still
  // says so), but once dismissed it stays dismissed on refresh too.
  const dismiss = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  useEffect(() => {
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [dismiss]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/30 bg-gold/10 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-ivory">
        <CheckCircle2 className="size-4 shrink-0 text-gold" />
        Workshop created successfully. Share the registration link with your participants.
      </div>

      <div className="flex items-center gap-2">
        <CopyLinkButton url={registrationUrl} />
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-ivory"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
