"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string[];
};

export function TagInput({ name, label, placeholder, defaultValue = [] }: Props) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [inputValue, setInputValue] = useState("");

  function addTag(raw: string) {
    const value = raw.trim();

    if (!value) {
      return;
    }

    setTags((current) => (current.includes(value) ? current : [...current, value]));
    setInputValue("");
  }

  function removeTag(tag: string) {
    setTags((current) => current.filter((t) => t !== tag));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(inputValue);
      return;
    }

    if (event.key === "Backspace" && inputValue === "" && tags.length > 0) {
      setTags((current) => current.slice(0, -1));
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`${name}-input`}>{label}</Label>
      <input type="hidden" name={name} value={tags.join(",")} />
      <div
        className={cn(
          "flex min-h-8 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1.5",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
        )}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-surface-elevated px-2.5 py-1 text-xs text-ivory"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove ${tag}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={`${name}-input`}
          type="text"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(inputValue)}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="min-w-28 flex-1 bg-transparent py-0.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      <p className="text-xs text-muted-foreground">Press Enter or comma to add.</p>
    </div>
  );
}
