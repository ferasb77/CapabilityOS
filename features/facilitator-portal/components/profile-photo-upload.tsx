"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import { uploadFacilitatorProfilePhoto } from "../actions";

type Props = {
  facilitatorId: string;
  fullName: string;
  photoUrl: string | null;
};

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ProfilePhotoUpload({ facilitatorId, fullName, photoUrl }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(photoUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFileChange() {
    setError(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set("photo", file);

    startTransition(async () => {
      const result = await uploadFacilitatorProfilePhoto(facilitatorId, formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setPreview(result.photoUrl);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar size="lg">
        {preview && <AvatarImage src={preview} alt={fullName} />}
        <AvatarFallback className="text-lg">{initials(fullName)}</AvatarFallback>
      </Avatar>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera className="size-4" />
          {isPending ? "Uploading..." : "Change Photo"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
