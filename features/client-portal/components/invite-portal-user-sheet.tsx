"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { inviteClientPortalUser } from "../actions";

type Props = {
  clientId: string;
};

export function InvitePortalUserSheet({ clientId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!fullName.trim() || !email.trim()) {
      setError("Full name and email are required.");
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await inviteClientPortalUser(clientId, {
        fullName: fullName.trim(),
        email: email.trim(),
        jobTitle: jobTitle.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setOpen(false);
      setFullName("");
      setEmail("");
      setJobTitle("");
      router.refresh();
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Invite User
      </Button>

      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Invite Portal User</SheetTitle>
          <SheetDescription>
            They&apos;ll receive an email with a link to set their password and access this client&apos;s training portal.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4">
          <div className="space-y-2">
            <Label htmlFor="invite-full-name">
              Full name <span className="text-gold">*</span>
            </Label>
            <Input id="invite-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-email">
              Email <span className="text-gold">*</span>
            </Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-job-title">Job title</Label>
            <Input id="invite-job-title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <SheetFooter>
          <Button type="button" disabled={isPending} onClick={handleSubmit}>
            {isPending ? "Sending Invitation..." : "Send Invitation"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
