"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, AlertCircle, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { acceptFacilitatorInvitation } from "../actions";

type Props = {
  token: string;
  fullName: string;
  email: string;
};

export function AcceptInvitationForm({ token, fullName, email }: Props) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const result = await acceptFacilitatorInvitation(token, password);

    if (!result.success) {
      setIsSubmitting(false);
      setErrorMessage(result.error);
    }
  };

  return (
    <Card className="w-full max-w-md bg-surface-elevated border-border-subtle shadow-xl">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-gold/10 text-gold border border-gold/20">
          <Lock className="size-6" />
        </div>
        <CardTitle className="text-xl font-bold text-ivory">
          Welcome to EMG Facilitator Portal
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Hello <span className="text-ivory font-semibold">{fullName}</span> ({email}). Set your password to activate your portal access.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive-foreground">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="password">Create Password *</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm Password *</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full gap-2">
            {isSubmitting ? "Activating Account..." : "Activate Account & Sign In"}
            <ArrowRight className="size-4" />
          </Button>

          <p className="text-center text-xs text-muted-foreground pt-2">
            Already have an active account?{" "}
            <Link href="/login" className="text-gold hover:underline">
              Sign In
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
