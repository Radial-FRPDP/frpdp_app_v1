const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f1f3f0;font-family:Arial,Helvetica,sans-serif;color:#10202e;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f3f0;padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;">
          <tr><td style="background:#1f3a5f;padding:20px 28px;">
            <span style="color:#ffffff;font-size:15px;font-weight:bold;letter-spacing:0.02em;">Candidate Screening — Batch 1</span>
          </td></tr>
          <tr><td style="padding:28px;">
            <h1 style="font-size:18px;margin:0 0 16px;color:#10202e;">${title}</h1>
            ${bodyHtml}
          </td></tr>
          <tr><td style="padding:16px 28px;border-top:1px solid #dce1de;">
            <span style="font-size:11px;color:#8a96a0;">This is an automated message from the Batch 1 screening platform.</span>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function inviteEmail(fullName: string, inviteToken: string, jqsNumber: string | null) {
  const link = `${APP_URL}/invite/${inviteToken}`;
  return shell(
    "You've been shortlisted — complete your profile",
    `<p style="font-size:14px;line-height:1.6;">Hi ${escapeHtml(fullName)},</p>
     <p style="font-size:14px;line-height:1.6;">You've been nominated for the Field Readiness Programme 2025 cohort. Please
     complete your profile — including your NIN, BVN, and NYSC discharge/exemption certificate details — using the secure
     link below.</p>
     ${
       jqsNumber
         ? `<p style="font-size:14px;line-height:1.6;">Your JQS Number is <b>${escapeHtml(
             jqsNumber
           )}</b> — you'll use it together with a password you set to sign in from now on.</p>`
         : ""
     }
     <p style="text-align:center;margin:28px 0;">
       <a href="${link}" style="background:#058812;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;">Complete your profile</a>
     </p>
     <p style="font-size:12px;color:#55636f;">If the button doesn't work, copy this link into your browser: ${link}</p>`
  );
}

export function validationReportEmail(
  filename: string,
  totalRows: number,
  validRows: number,
  issues: { row: number; name: string; problems: string[] }[]
) {
  if (issues.length === 0) {
    return shell(
      "Intake batch validated — all clear",
      `<p style="font-size:14px;line-height:1.6;">All ${totalRows} records in <b>${escapeHtml(
        filename
      )}</b> passed validation with no issues. ${validRows} candidates are ready — review and approve dispatch from the M-01 Intake screen.</p>`
    );
  }

  const rows = issues
    .map(
      (i) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #dce1de;font-size:13px;">${i.row}</td>
             <td style="padding:6px 10px;border-bottom:1px solid #dce1de;font-size:13px;">${escapeHtml(i.name)}</td>
             <td style="padding:6px 10px;border-bottom:1px solid #dce1de;font-size:13px;color:#b23a3a;">${escapeHtml(
               i.problems.join("; ")
             )}</td></tr>`
    )
    .join("");

  return shell(
    "Intake batch validated — data issues found",
    `<p style="font-size:14px;line-height:1.6;">Of ${totalRows} records in <b>${escapeHtml(
      filename
    )}</b>, ${validRows} passed validation and are ready to dispatch once you approve. ${issues.length} need your attention:</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
       <tr><th align="left" style="font-size:11px;text-transform:uppercase;color:#8a96a0;padding:0 10px 6px;">Row</th>
           <th align="left" style="font-size:11px;text-transform:uppercase;color:#8a96a0;padding:0 10px 6px;">Name</th>
           <th align="left" style="font-size:11px;text-transform:uppercase;color:#8a96a0;padding:0 10px 6px;">Issue</th></tr>
       ${rows}
     </table>`
  );
}

export function cbtConfirmationEmail(fullName: string, startsAt: string, location: string | null) {
  const when = new Date(startsAt).toLocaleString("en-NG", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  });
  return shell(
    "Your CBT slot is confirmed",
    `<p style="font-size:14px;line-height:1.6;">Hi ${escapeHtml(fullName)},</p>
     <p style="font-size:14px;line-height:1.6;">Your computer-based test is booked for:</p>
     <p style="font-size:15px;font-weight:bold;margin:16px 0;">${when}${location ? ` — ${escapeHtml(location)}` : ""}</p>
     <p style="font-size:14px;line-height:1.6;">Please arrive at least 30 minutes early with a valid ID.</p>`
  );
}

export function cbtReminderEmail(fullName: string, startsAt: string, location: string | null) {
  const when = new Date(startsAt).toLocaleString("en-NG", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  });
  return shell(
    "Reminder: your CBT is coming up",
    `<p style="font-size:14px;line-height:1.6;">Hi ${escapeHtml(fullName)},</p>
     <p style="font-size:14px;line-height:1.6;">This is a reminder that your computer-based test is scheduled for:</p>
     <p style="font-size:15px;font-weight:bold;margin:16px 0;">${when}${location ? ` — ${escapeHtml(location)}` : ""}</p>`
  );
}

export function staffInviteEmail(fullName: string, actionLink: string, orgLabel: string) {
  return shell(
    "Your Field Readiness Programme account is ready",
    `<p style="font-size:14px;line-height:1.6;">Hi ${escapeHtml(fullName)},</p>
     <p style="font-size:14px;line-height:1.6;">A Programme Manager at Radial Circle has set up your staff account for the Field Readiness Programme platform, under <b>${escapeHtml(
       orgLabel
     )}</b>.</p>
     <p style="font-size:14px;line-height:1.6;">Use the secure link below to sign in and set your password:</p>
     <p style="margin:20px 0;"><a href="${actionLink}" style="display:inline-block;background:#058812;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:8px;">Set my password &amp; sign in</a></p>
     <p style="font-size:12px;line-height:1.6;color:#8a96a0;">This link expires soon. If you didn't expect this account, you can ignore this email.</p>`
  );
}

export function accessRequestReceivedEmail(fullName: string, email: string, orgLabel: string, note: string | null) {
  return shell(
    "New access request",
    `<p style="font-size:14px;line-height:1.6;"><b>${escapeHtml(fullName)}</b> (${escapeHtml(
      email
    )}) has requested a staff account under <b>${escapeHtml(orgLabel)}</b>.</p>
     ${note ? `<p style="font-size:14px;line-height:1.6;">Note from requester: "${escapeHtml(note)}"</p>` : ""}
     <p style="font-size:14px;line-height:1.6;">Review and approve or decline it from the Users screen in the Programme Manager portal.</p>`
  );
}

export function accessRequestDecisionEmail(fullName: string, approved: boolean, decisionNote: string | null) {
  return shell(
    approved ? "Your access request was approved" : "Your access request was declined",
    `<p style="font-size:14px;line-height:1.6;">Hi ${escapeHtml(fullName)},</p>
     ${
       approved
         ? `<p style="font-size:14px;line-height:1.6;">Your request for a Field Readiness Programme staff account has been approved. A separate email with a sign-in link is on its way.</p>`
         : `<p style="font-size:14px;line-height:1.6;">Your request for a Field Readiness Programme staff account was not approved at this time.</p>`
     }
     ${decisionNote ? `<p style="font-size:14px;line-height:1.6;">Note: ${escapeHtml(decisionNote)}</p>` : ""}`
  );
}

export function newMessageForRadialEmail(candidateFullName: string, jqsNumber: string | null, body: string) {
  return shell(
    "New message from a candidate",
    `<p style="font-size:14px;line-height:1.6;"><b>${escapeHtml(candidateFullName)}</b>${
      jqsNumber ? ` (${escapeHtml(jqsNumber)})` : ""
    } sent a new message on the Field Readiness Programme platform:</p>
     <p style="font-size:14px;line-height:1.6;background:#f1f3f0;border-radius:8px;padding:14px 16px;white-space:pre-wrap;">${escapeHtml(
       body
     )}</p>
     <p style="font-size:14px;line-height:1.6;">Reply from the Messages tab on their M-02 Verification Queue entry.</p>`
  );
}

export function newMessageForCandidateEmail(fullName: string, body: string) {
  return shell(
    "New message from Radial Circle",
    `<p style="font-size:14px;line-height:1.6;">Hi ${escapeHtml(fullName)},</p>
     <p style="font-size:14px;line-height:1.6;">You have a new message from the Radial Circle Programme Team:</p>
     <p style="font-size:14px;line-height:1.6;background:#f1f3f0;border-radius:8px;padding:14px 16px;white-space:pre-wrap;">${escapeHtml(
       body
     )}</p>
     <p style="font-size:14px;line-height:1.6;">Sign in to your candidate portal to read the full conversation and reply.</p>`
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
