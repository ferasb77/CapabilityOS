function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

type MilestoneTriggeredEmailInput = {
  clientName: string;
  engagementTitle: string;
  milestoneTitle: string;
  amount: number;
  currency: string;
  percentageOfTotal: number;
  triggerReason: string;
  contractTotal: number;
  previouslyCollected: number;
  remainingAfterThis: number;
  dueDate: string | null;
  notes: string | null;
  ctaUrl: string;
};

/**
 * Finance teams expect a plain, professional white-background email — this
 * intentionally does not reuse the EMG dark-brand template used for
 * participant-facing survey/certificate emails (see
 * infrastructure/email/survey-email.ts).
 */
export function renderMilestoneTriggeredEmail(input: MilestoneTriggeredEmailInput): { subject: string; html: string } {
  const subject = `Payment milestone triggered — ${input.engagementTitle}`;

  const safeClient = escapeHtml(input.clientName);
  const safeEngagement = escapeHtml(input.engagementTitle);
  const safeMilestone = escapeHtml(input.milestoneTitle);
  const safeReason = escapeHtml(input.triggerReason);
  const safeNotes = input.notes ? escapeHtml(input.notes) : null;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#F4F4F5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F4F5;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#FFFFFF;border-radius:8px;overflow:hidden;border:1px solid #E4E4E7;">
            <tr>
              <td style="padding:32px 32px 0;">
                <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717A;">CapabilityOS</p>
                <h1 style="margin:12px 0 0;color:#18181B;font-size:20px;line-height:1.4;font-weight:700;">
                  Payment Milestone Triggered
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 0;">
                <p style="margin:0;color:#3F3F46;font-size:14px;line-height:1.6;">
                  <strong style="color:#18181B;">${safeClient}</strong> — ${safeEngagement}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFAFA;border:1px solid #E4E4E7;border-radius:6px;">
                  <tr>
                    <td style="padding:20px 20px 4px;">
                      <p style="margin:0;color:#71717A;font-size:12px;">${safeMilestone}</p>
                      <p style="margin:4px 0 0;color:#18181B;font-size:28px;font-weight:700;">
                        ${formatMoney(input.amount, input.currency)}
                      </p>
                      <p style="margin:2px 0 20px;color:#71717A;font-size:12px;">
                        ${input.percentageOfTotal}% of total contract value
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 0;">
                <p style="margin:0;color:#3F3F46;font-size:14px;line-height:1.6;">${safeReason}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E4E4E7;">
                  <tr>
                    <td style="padding:16px 0 8px;color:#71717A;font-size:13px;">Contract total</td>
                    <td style="padding:16px 0 8px;color:#18181B;font-size:13px;text-align:right;">${formatMoney(input.contractTotal, input.currency)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#71717A;font-size:13px;">Previously collected</td>
                    <td style="padding:6px 0;color:#18181B;font-size:13px;text-align:right;">${formatMoney(input.previouslyCollected, input.currency)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#18181B;font-size:13px;font-weight:700;">This milestone</td>
                    <td style="padding:6px 0;color:#18181B;font-size:13px;font-weight:700;text-align:right;">${formatMoney(input.amount, input.currency)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0 16px;border-bottom:1px solid #E4E4E7;color:#71717A;font-size:13px;">Remaining after this</td>
                    <td style="padding:6px 0 16px;border-bottom:1px solid #E4E4E7;color:#18181B;font-size:13px;text-align:right;">${formatMoney(input.remainingAfterThis, input.currency)}</td>
                  </tr>
                  ${
                    input.dueDate
                      ? `<tr>
                    <td style="padding:12px 0 0;color:#71717A;font-size:13px;">Due date</td>
                    <td style="padding:12px 0 0;color:#18181B;font-size:13px;text-align:right;">${formatDate(input.dueDate)}</td>
                  </tr>`
                      : ""
                  }
                </table>
              </td>
            </tr>
            ${
              safeNotes
                ? `<tr>
              <td style="padding:20px 32px 0;">
                <p style="margin:0;color:#71717A;font-size:12px;">Notes</p>
                <p style="margin:4px 0 0;color:#3F3F46;font-size:13px;line-height:1.6;">${safeNotes}</p>
              </td>
            </tr>`
                : ""
            }
            <tr>
              <td style="padding:28px 32px 32px;text-align:center;">
                <a href="${input.ctaUrl}" style="display:inline-block;background-color:#18181B;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:6px;">
                  View in CapabilityOS →
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px;border-top:1px solid #F4F4F5;">
                <p style="margin:0;color:#A1A1AA;font-size:11px;line-height:1.6;">
                  This notification was generated automatically by CapabilityOS. Log in to mark this milestone as invoiced or collected.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}
