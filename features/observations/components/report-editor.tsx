"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Heading2, Italic, List } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FacilitatorReport, FacilitatorReportStatus } from "../data";

import { approveReport, exportReportPDF, generateFacilitatorReport, saveReportEdit } from "../actions";

const AUTOSAVE_DELAY_MS = 2000;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Converts the AI's "## Heading" / plain-paragraph / "- bullet" text into
 * the same h2/p/ul/li vocabulary features/observations/report.ts's PDF
 * parser expects — this is also what seeds the contentEditable div, so the
 * editor's basic toolbar (bold/italic/heading/bullets) only ever needs to
 * add to, never translate, this markup. */
function markdownLiteToHtml(text: string): string {
  const lines = text.split(/\r?\n/);
  const parts: string[] = [];
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (inList) {
        parts.push("</ul>");
        inList = false;
      }
      continue;
    }

    if (line.startsWith("## ")) {
      if (inList) {
        parts.push("</ul>");
        inList = false;
      }
      parts.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList) {
        parts.push("<ul>");
        inList = true;
      }
      parts.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      continue;
    }

    if (inList) {
      parts.push("</ul>");
      inList = false;
    }
    parts.push(`<p>${escapeHtml(line)}</p>`);
  }

  if (inList) {
    parts.push("</ul>");
  }

  return parts.join("");
}

const STATUS_STEPS: FacilitatorReportStatus[] = ["draft", "edited", "approved", "exported"];
const STATUS_LABEL: Record<FacilitatorReportStatus, string> = {
  draft: "Draft",
  edited: "Edited",
  approved: "Approved",
  exported: "Exported",
};

function StatusStepper({ status }: { status: FacilitatorReportStatus }) {
  const currentIndex = STATUS_STEPS.indexOf(status);

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {STATUS_STEPS.map((step, index) => (
        <span key={step} className="flex items-center gap-1.5">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-medium",
              index <= currentIndex ? "bg-gold text-night" : "bg-night/60 text-muted-foreground"
            )}
          >
            {STATUS_LABEL[step]}
          </span>
          {index < STATUS_STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
        </span>
      ))}
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Bold;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon className="size-4" />
    </Button>
  );
}

type Props = {
  experienceId: string;
  report: FacilitatorReport;
  onReportChange: (report: FacilitatorReport) => void;
};

export function ReportEditor({ experienceId, report, onReportChange }: Props) {
  // State, not a ref — the value is read during render (dangerouslySetInnerHTML),
  // and only ever changes deliberately via "Use AI Draft" (never reactively
  // synced from report.draftContent, so a Regenerate never clobbers this).
  const [initialHtml, setInitialHtml] = useState(() => report.editedContent ?? markdownLiteToHtml(report.draftContent));
  const editableRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.execCommand("defaultParagraphSeparator", false, "p");
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function exec(command: string, value?: string) {
    document.execCommand(command, false, value);
    editableRef.current?.focus();
  }

  function scheduleAutosave(html: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSavingState("saving");
      setError(null);

      const result = await saveReportEdit(report.id, html);

      if (!result.success) {
        setError(result.error);
        setSavingState("idle");
        return;
      }

      onReportChange({
        ...report,
        editedContent: html,
        status: report.status === "draft" ? "edited" : report.status,
      });
      setSavingState("saved");
    }, AUTOSAVE_DELAY_MS);
  }

  function handleInput() {
    if (!editableRef.current) return;
    scheduleAutosave(editableRef.current.innerHTML);
  }

  async function handleRegenerate() {
    setIsRegenerating(true);
    setError(null);

    const result = await generateFacilitatorReport(experienceId);

    setIsRegenerating(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onReportChange(result.report);
  }

  function handleUseAiDraft() {
    const html = markdownLiteToHtml(report.draftContent);
    setInitialHtml(html);
    scheduleAutosave(html);
  }

  async function handleApprove() {
    setIsApproving(true);
    setError(null);

    const result = await approveReport(report.id);

    setIsApproving(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onReportChange({ ...report, status: "approved", approvedAt: new Date().toISOString() });
  }

  async function handleExport() {
    setIsExporting(true);
    setError(null);

    const result = await exportReportPDF(report.id);

    setIsExporting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onReportChange({ ...report, status: "exported", exportedAt: new Date().toISOString() });
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <Card className="bg-surface-elevated">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Final Report</CardTitle>
        <StatusStepper status={report.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ivory">AI Draft</p>
              <Button type="button" variant="ghost" size="sm" disabled={isRegenerating} onClick={handleRegenerate}>
                {isRegenerating ? "Regenerating..." : "Regenerate"}
              </Button>
            </div>
            <div
              className="prose-sm max-h-[32rem] overflow-y-auto rounded-lg border border-border-subtle bg-night/40 p-4 text-sm text-muted-foreground [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ivory [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2"
              dangerouslySetInnerHTML={{ __html: markdownLiteToHtml(report.draftContent) }}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ivory">Your Report</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  {savingState === "saving" ? "Saving..." : savingState === "saved" ? "Saved" : ""}
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={handleUseAiDraft}>
                  Use AI Draft
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <ToolbarButton icon={Bold} label="Bold" onClick={() => exec("bold")} />
              <ToolbarButton icon={Italic} label="Italic" onClick={() => exec("italic")} />
              <ToolbarButton icon={Heading2} label="Heading" onClick={() => exec("formatBlock", "H2")} />
              <ToolbarButton icon={List} label="Bullet list" onClick={() => exec("insertUnorderedList")} />
            </div>

            <div
              ref={editableRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              dangerouslySetInnerHTML={{ __html: initialHtml }}
              className="prose-sm max-h-[32rem] min-h-64 overflow-y-auto rounded-lg border border-border-subtle bg-night/20 p-4 text-sm text-ivory outline-none focus:border-gold/50 [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2"
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle pt-4">
          <Button type="button" variant="outline" disabled={isApproving || report.status === "approved" || report.status === "exported"} onClick={handleApprove}>
            {isApproving ? "Approving..." : "Approve Report"}
          </Button>
          <Button
            type="button"
            disabled={isExporting || (report.status !== "approved" && report.status !== "exported")}
            onClick={handleExport}
          >
            {isExporting ? "Exporting..." : "Export as PDF"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
