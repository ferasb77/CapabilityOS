"use client";

import { useState } from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  name: string;
  label: string;
};

export function StarRating({ name, label }: Props) {
  const [value, setValue] = useState(0);
  const [hovered, setHovered] = useState(0);

  const display = hovered || value;

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ivory">{label}</legend>
      <input type="hidden" name={name} value={value || ""} />
      <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={`${star} out of 5`}
            aria-pressed={value === star}
            onMouseEnter={() => setHovered(star)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(0)}
            onClick={() => setValue(star)}
            className="rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            <Star
              className={cn(
                "size-8 transition-colors",
                star <= display ? "fill-gold text-gold" : "fill-transparent text-ivory/25"
              )}
            />
          </button>
        ))}
      </div>
    </fieldset>
  );
}
