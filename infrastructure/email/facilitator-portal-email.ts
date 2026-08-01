function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type FacilitatorPortalInvitationEmailInput = {
  organizationName: string;
  acceptUrl: string;
};

export function renderFacilitatorPortalInvitationEmail(input: FacilitatorPortalInvitationEmailInput): {
  subject: string;
  html: string;
} {
  const subject = "You've been invited to manage your facilitator profile on CapabilityOS";

  const safeOrganization = escapeHtml(input.organizationName);

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
                  You're invited to your facilitator portal
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 0;">
                <p style="margin:0;color:#3F3F46;font-size:14px;line-height:1.6;">
                  <strong style="color:#18181B;">${safeOrganization}</strong> has invited you to access your facilitator portal where you can view your assigned programs, manage your profile, and update your availability.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 0;text-align:center;">
                <a href="${input.acceptUrl}" style="display:inline-block;background-color:#18181B;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;">
                  Accept Invitation &amp; Set Password
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 32px;">
                <p style="margin:0;color:#A1A1AA;font-size:12px;line-height:1.6;">
                  If the button above doesn't work, copy and paste this link into your browser:<br />
                  <a href="${input.acceptUrl}" style="color:#71717A;">${input.acceptUrl}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px;border-top:1px solid #F4F4F5;">
                <p style="margin:0;color:#A1A1AA;font-size:11px;line-height:1.6;">
                  This invitation was sent by ${safeOrganization} via CapabilityOS. If you weren't expecting this,
                  you can safely ignore this email.
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
