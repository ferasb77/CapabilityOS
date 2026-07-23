function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type SurveyEmailInput = {
  participantFirstName: string;
  workshopTitle: string;
  surveyUrl: string;
};

export function renderSurveyEmail({
  participantFirstName,
  workshopTitle,
  surveyUrl,
}: SurveyEmailInput): { subject: string; html: string } {
  const subject = `Your feedback on ${workshopTitle}`;
  const safeName = escapeHtml(participantFirstName);
  const safeTitle = escapeHtml(workshopTitle);

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#0A0A0F;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0A0F;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#111118;border-radius:16px;overflow:hidden;border:1px solid rgba(201,169,110,0.15);">
            <tr>
              <td style="padding:40px 32px 24px;text-align:center;">
                <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C9A96E;">Enable My Growth</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <h1 style="margin:0 0 16px;color:#EDEAE3;font-size:22px;line-height:1.4;font-weight:600;">
                  Hi ${safeName},
                </h1>
                <p style="margin:0 0 16px;color:rgba(237,234,227,0.75);font-size:15px;line-height:1.6;">
                  Thank you for attending <strong style="color:#EDEAE3;">${safeTitle}</strong>.
                </p>
                <p style="margin:0 0 32px;color:rgba(237,234,227,0.75);font-size:15px;line-height:1.6;">
                  Your feedback helps us improve every future workshop — it only takes a couple of minutes.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 40px;text-align:center;">
                <a href="${surveyUrl}" style="display:inline-block;background-color:#C9A96E;color:#0A0A0F;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:10px;">
                  Complete Survey
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;border-top:1px solid rgba(237,234,227,0.08);">
                <p style="margin:24px 0 0;color:rgba(237,234,227,0.4);font-size:12px;line-height:1.6;">
                  If the button above doesn't work, copy and paste this link into your browser:<br />
                  <a href="${surveyUrl}" style="color:#C9A96E;word-break:break-all;">${surveyUrl}</a>
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0;color:rgba(237,234,227,0.3);font-size:12px;">
            Enable My Growth
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}
