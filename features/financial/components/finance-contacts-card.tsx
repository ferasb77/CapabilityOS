"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FinanceContact } from "@/features/financial/data";

import { createFinanceContact, deleteFinanceContact, setFinanceContactPrimary } from "../actions";

export function FinanceContactsCard({ workspaceId, contacts }: { workspaceId: string; contacts: FinanceContact[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [busyContactId, setBusyContactId] = useState<string | null>(null);

  function handleAdd() {
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("email", email);
      formData.set("isPrimary", contacts.length === 0 ? "on" : "");

      const result = await createFinanceContact(workspaceId, formData);

      if (result.success) {
        setName("");
        setEmail("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleSetPrimary(contactId: string) {
    setBusyContactId(contactId);
    startTransition(async () => {
      await setFinanceContactPrimary(contactId, workspaceId);
      setBusyContactId(null);
      router.refresh();
    });
  }

  function handleDelete(contactId: string) {
    setBusyContactId(contactId);
    startTransition(async () => {
      await deleteFinanceContact(contactId);
      setBusyContactId(null);
      router.refresh();
    });
  }

  return (
    <Card className="bg-surface-elevated">
      <CardHeader>
        <CardTitle>Finance Contacts</CardTitle>
        <CardDescription>
          Payment milestone notifications are sent to the primary contact, plus any milestone-specific override.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No finance contacts yet.</p>
        ) : (
          <ul className="space-y-2">
            {contacts.map((contact) => (
              <li
                key={contact.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-night/40 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ivory">{contact.name}</p>
                    {contact.isPrimary && <Badge className="bg-gold/15 text-gold">Primary</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{contact.email}</p>
                </div>
                <div className="flex items-center gap-1">
                  {!contact.isPrimary && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={isPending && busyContactId === contact.id}
                      onClick={() => handleSetPrimary(contact.id)}
                      title="Set as primary"
                    >
                      <Star className="size-4 text-muted-foreground" />
                      <span className="sr-only">Set as primary</span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={isPending && busyContactId === contact.id}
                    onClick={() => handleDelete(contact.id)}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                    <span className="sr-only">Remove contact</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 border-t border-border-subtle pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="finance-contact-name">Name</Label>
            <Input id="finance-contact-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="finance-contact-email">Email</Label>
            <Input
              id="finance-contact-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <Button
            type="button"
            disabled={isPending || name.trim().length === 0 || email.trim().length === 0}
            onClick={handleAdd}
          >
            Add Contact
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
