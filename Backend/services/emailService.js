const nodemailer = require('nodemailer');

let transporter = null;
let isConfigured = false;

/**
 * Initialize the SMTP transporter. Called automatically on first use.
 * Reads from process.env, so make sure dotenv has loaded before this runs.
 */
function initTransporter() {
  if (transporter !== null) return;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('[emailService] SMTP credentials not configured — emails will not be sent');
    isConfigured = false;
    return;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587', 10),
    secure: false,   // false for port 587 (STARTTLS); true for 465
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  isConfigured = true;
  console.log('[emailService] SMTP transporter initialized');
}

/**
 * Send an email via the configured SMTP transporter.
 *
 * @param {Object} options
 * @param {string} options.to       - Recipient email address
 * @param {string} options.subject  - Email subject line
 * @param {string} options.html     - HTML body
 * @param {string} options.text     - Plain-text fallback body
 * @returns {Promise<{success: boolean, error?: string, info?: Object}>}
 */
async function sendEmail({ to, subject, html, text }) {
  initTransporter();

  if (!isConfigured) {
    return {
      success: false,
      error: 'Email service is not configured (missing SMTP env vars)'
    };
  }

  const fromName = process.env.SMTP_FROM_NAME || 'Rfacon Dormitel';
  const fromAddress = process.env.SMTP_USER;

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to,
      subject,
      html,
      text
    });

    console.log(`[emailService] Email sent to ${to} (messageId: ${info.messageId})`);
    return { success: true, info };
  } catch (error) {
    console.error('[emailService] Failed to send email:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Build the HTML and plain-text bodies for the tenant invite email.
 *
 * @param {Object} options
 * @param {string} options.tenantName  - Tenant's name (or empty)
 * @param {string} options.inviteLink  - Full invite URL
 * @param {string} options.ownerName   - Owner's name (or 'your landlord')
 * @returns {{ subject: string, html: string, text: string }}
 */
function buildInviteEmail({ tenantName, inviteLink, ownerName }) {
  const greeting = tenantName ? `Hi ${tenantName},` : 'Hello,';
  const signedBy = ownerName || 'your landlord';

  const subject = 'You\'ve been invited to Rfacon Dormitel';

  const text = [
    greeting,
    '',
    `${signedBy} has invited you to set up your DormiSync tenant account.`,
    '',
    'Click the link below to set your password and finish onboarding:',
    inviteLink,
    '',
    'This link expires in 7 days.',
    '',
    'If you weren\'t expecting this email, you can ignore it.',
    '',
    '—',
    'Rfacon Dormitel'
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${subject}</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, sans-serif; background: #FFF8EE; padding: 24px; color: #333;">
  <div style="max-width: 540px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; border-top: 4px solid #E8A93D;">
    <h2 style="margin-top: 0; color: #333;">Welcome to Rfacon Dormitel</h2>
    <p>${greeting}</p>
    <p>${signedBy} has invited you to set up your DormiSync tenant account.</p>
    <p>Click the button below to set your password and finish onboarding:</p>
    <p style="text-align: center; margin: 32px 0;">
      <a href="${inviteLink}"
         style="display: inline-block; background: #E8A93D; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">
        Set Your Password
      </a>
    </p>
    <p style="color: #666; font-size: 13px;">
      Or copy this link into your browser:<br>
      <span style="word-break: break-all; color: #555;">${inviteLink}</span>
    </p>
    <p style="color: #999; font-size: 12px; margin-top: 24px;">
      This link expires in 7 days. If you weren't expecting this email, you can safely ignore it.
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px 0;">
    <p style="color: #999; font-size: 12px; margin: 0;">
      Rfacon Dormitel — Dormitory Management System
    </p>
  </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

/**
 * Build the HTML and plain-text bodies for the password reset email.
 *
 * @param {Object} options
 * @param {string} options.userName  - User's name (or empty)
 * @param {string} options.resetLink - Full reset URL
 * @returns {{ subject: string, html: string, text: string }}
 */
function buildResetEmail({ userName, resetLink }) {
  const greeting = userName ? `Hi ${userName},` : 'Hello,';

  const subject = 'Reset your Rfacon Dormitel password';

  const text = [
    greeting,
    '',
    'We received a request to reset your password.',
    '',
    'Click this link to set a new password:',
    resetLink,
    '',
    'This link expires in 1 hour.',
    '',
    "If you didn't request this, you can safely ignore this email.",
    '',
    '—',
    'Rfacon Dormitel'
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${subject}</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, sans-serif; background: #FFF8EE; padding: 24px; color: #333;">
  <div style="max-width: 540px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; border-top: 4px solid #E8A93D;">
    <h2 style="margin-top: 0; color: #333;">Reset Your Password</h2>
    <p>${greeting}</p>
    <p>We received a request to reset your Rfacon Dormitel password.</p>
    <p>Click the button below to set a new password:</p>
    <p style="text-align: center; margin: 32px 0;">
      <a href="${resetLink}"
         style="display: inline-block; background: #E8A93D; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">
        Reset Password
      </a>
    </p>
    <p style="color: #666; font-size: 13px;">
      Or copy this link into your browser:<br>
      <span style="word-break: break-all; color: #555;">${resetLink}</span>
    </p>
    <p style="color: #999; font-size: 12px; margin-top: 24px;">
      This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px 0;">
    <p style="color: #999; font-size: 12px; margin: 0;">
      Rfacon Dormitel — Dormitory Management System
    </p>
  </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

function fmtPHP(n) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtMonth(yyyyMM) {
  if (!yyyyMM) return '';
  const [y, m] = yyyyMM.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-PH', { month: 'long', year: 'numeric' });
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
}

const EMAIL_HEADER = `
<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border-top:4px solid #E8A93D;font-family:'Segoe UI',Tahoma,sans-serif;color:#333;">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
    <span style="font-size:20px;font-weight:700;color:#E8A93D;">Rfacon Dormitel</span>
  </div>`;
const EMAIL_FOOTER = `
  <hr style="border:none;border-top:1px solid #eee;margin:28px 0 16px;">
  <p style="color:#999;font-size:12px;margin:0;">Rfacon Dormitel — Dormitory Management System</p>
</div>`;

function buildBillCreatedEmail({ tenantName, roomName, billingMonth, shareAmount, flatFee, electricityAmount, dueDate }) {
  const subject = `New bill posted — ${fmtMonth(billingMonth)} | Rfacon Dormitel`;
  const greeting = tenantName ? `Hi ${tenantName},` : 'Hello,';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="background:#FFF8EE;padding:24px;">
${EMAIL_HEADER}
  <h2 style="color:#333;margin-top:0;">New Bill Posted</h2>
  <p>${greeting}</p>
  <p>A new bill has been created for your stay at <strong>${roomName}</strong>.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
    <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #f0f0f0;">Billing Period</td><td style="padding:8px 0;text-align:right;font-weight:600;">${fmtMonth(billingMonth)}</td></tr>
    <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #f0f0f0;">Flat Fee</td><td style="padding:8px 0;text-align:right;">${fmtPHP(flatFee)}</td></tr>
    <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #f0f0f0;">Electricity</td><td style="padding:8px 0;text-align:right;">${fmtPHP(electricityAmount)}</td></tr>
    <tr><td style="padding:8px 0;color:#333;font-weight:700;border-bottom:2px solid #E8A93D;">Your Share</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#E8A93D;font-size:18px;">${fmtPHP(shareAmount)}</td></tr>
  </table>
  <p style="background:#FFF8EE;border-radius:8px;padding:12px 16px;font-size:14px;">
    <strong>Due Date:</strong> ${fmtDate(dueDate)}
  </p>
  <p style="color:#666;font-size:13px;">Please settle your bill before the due date to avoid overdue charges.</p>
${EMAIL_FOOTER}
</body></html>`;
  const text = `${greeting}\n\nA new bill has been posted for ${roomName}.\nBilling Period: ${fmtMonth(billingMonth)}\nFlat Fee: ${fmtPHP(flatFee)}\nElectricity: ${fmtPHP(electricityAmount)}\nYour Share: ${fmtPHP(shareAmount)}\nDue Date: ${fmtDate(dueDate)}\n\n— Rfacon Dormitel`;
  return { subject, html, text };
}

function buildOverdueReminderEmail({ tenantName, roomName, billingMonth, shareAmount, dueDate }) {
  const subject = `Payment reminder — ${fmtMonth(billingMonth)} bill overdue | Rfacon Dormitel`;
  const greeting = tenantName ? `Hi ${tenantName},` : 'Hello,';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="background:#FFF8EE;padding:24px;">
${EMAIL_HEADER}
  <h2 style="color:#DC2626;margin-top:0;">Bill Overdue</h2>
  <p>${greeting}</p>
  <p>Your bill for <strong>${fmtMonth(billingMonth)}</strong> at <strong>${roomName}</strong> is now <strong style="color:#DC2626;">overdue</strong>.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
    <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #f0f0f0;">Billing Period</td><td style="padding:8px 0;text-align:right;font-weight:600;">${fmtMonth(billingMonth)}</td></tr>
    <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #f0f0f0;">Due Date</td><td style="padding:8px 0;text-align:right;color:#DC2626;">${fmtDate(dueDate)}</td></tr>
    <tr><td style="padding:8px 0;font-weight:700;">Amount Due</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#DC2626;font-size:18px;">${fmtPHP(shareAmount)}</td></tr>
  </table>
  <p style="color:#666;font-size:13px;">Please settle your balance immediately to avoid further penalties.</p>
${EMAIL_FOOTER}
</body></html>`;
  const text = `${greeting}\n\nYour ${fmtMonth(billingMonth)} bill of ${fmtPHP(shareAmount)} at ${roomName} is now overdue (due ${fmtDate(dueDate)}). Please settle immediately.\n\n— Rfacon Dormitel`;
  return { subject, html, text };
}

function buildArrearsNoticeEmail({ tenantName, roomName, billingMonth, shareAmount, totalArrears }) {
  const subject = `URGENT: Your account is in arrears — Rfacon Dormitel`;
  const greeting = tenantName ? `Hi ${tenantName},` : 'Hello,';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="background:#FFF8EE;padding:24px;">
${EMAIL_HEADER}
  <h2 style="color:#C2410C;margin-top:0;">Account in Arrears</h2>
  <p>${greeting}</p>
  <p>Your unpaid bill for <strong>${fmtMonth(billingMonth)}</strong> at <strong>${roomName}</strong> has been moved to <strong style="color:#C2410C;">arrears</strong>.</p>
  <div style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:14px 16px;border-radius:0 6px 6px 0;margin:16px 0;">
    <p style="margin:0;font-weight:600;color:#92400E;">Total Arrears Balance: ${fmtPHP(totalArrears || shareAmount)}</p>
    <p style="margin:4px 0 0;color:#78350F;font-size:13px;">This debt has been carried over and must be settled as soon as possible.</p>
  </div>
  <p style="color:#666;font-size:13px;">Please contact management immediately to arrange payment.</p>
${EMAIL_FOOTER}
</body></html>`;
  const text = `${greeting}\n\nURGENT: Your ${fmtMonth(billingMonth)} bill has been moved to arrears.\nTotal Arrears: ${fmtPHP(totalArrears || shareAmount)}\n\nPlease settle immediately.\n\n— Rfacon Dormitel`;
  return { subject, html, text };
}

function buildPaymentConfirmationEmail({ tenantName, roomName, billingMonth, amount, paymentDate }) {
  const subject = `Payment confirmed — ${fmtMonth(billingMonth)} | Rfacon Dormitel`;
  const greeting = tenantName ? `Hi ${tenantName},` : 'Hello,';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="background:#FFF8EE;padding:24px;">
${EMAIL_HEADER}
  <h2 style="color:#16A34A;margin-top:0;">Payment Confirmed</h2>
  <p>${greeting}</p>
  <p>Your payment for <strong>${fmtMonth(billingMonth)}</strong> at <strong>${roomName}</strong> has been confirmed.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
    <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #f0f0f0;">Billing Period</td><td style="padding:8px 0;text-align:right;font-weight:600;">${fmtMonth(billingMonth)}</td></tr>
    <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #f0f0f0;">Payment Date</td><td style="padding:8px 0;text-align:right;">${fmtDate(paymentDate)}</td></tr>
    <tr><td style="padding:8px 0;font-weight:700;">Amount Paid</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#16A34A;font-size:18px;">${fmtPHP(amount)}</td></tr>
  </table>
  <p style="color:#666;font-size:13px;">Thank you for your payment. This receipt serves as confirmation.</p>
${EMAIL_FOOTER}
</body></html>`;
  const text = `${greeting}\n\nYour payment of ${fmtPHP(amount)} for ${fmtMonth(billingMonth)} at ${roomName} has been confirmed on ${fmtDate(paymentDate)}.\n\nThank you!\n\n— Rfacon Dormitel`;
  return { subject, html, text };
}

function buildReminderEmail({ tenantName, roomNumber, overdueAmount, arrearsAmount, pendingAmount, totalOutstanding }) {
  const subject = `Outstanding balance reminder — Rfacon Dormitel`;
  const greeting = tenantName ? `Hi ${tenantName},` : 'Hello,';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="background:#FFF8EE;padding:24px;">
${EMAIL_HEADER}
  <h2 style="color:#333;margin-top:0;">Outstanding Balance Reminder</h2>
  <p>${greeting}</p>
  <p>This is a reminder that you have an outstanding balance for your room <strong>${roomNumber}</strong>.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
    ${arrearsAmount > 0 ? `<tr><td style="padding:8px 0;color:#C2410C;border-bottom:1px solid #f0f0f0;">Arrears</td><td style="padding:8px 0;text-align:right;color:#C2410C;font-weight:600;">${fmtPHP(arrearsAmount)}</td></tr>` : ''}
    ${overdueAmount > 0 ? `<tr><td style="padding:8px 0;color:#DC2626;border-bottom:1px solid #f0f0f0;">Overdue</td><td style="padding:8px 0;text-align:right;color:#DC2626;font-weight:600;">${fmtPHP(overdueAmount)}</td></tr>` : ''}
    ${pendingAmount > 0 ? `<tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #f0f0f0;">Pending</td><td style="padding:8px 0;text-align:right;">${fmtPHP(pendingAmount)}</td></tr>` : ''}
    <tr><td style="padding:8px 0;font-weight:700;">Total Outstanding</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#E8A93D;font-size:18px;">${fmtPHP(totalOutstanding)}</td></tr>
  </table>
  <p style="color:#666;font-size:13px;">Please settle your balance at the earliest opportunity. Contact management if you have any questions.</p>
${EMAIL_FOOTER}
</body></html>`;
  const text = `${greeting}\n\nYou have an outstanding balance of ${fmtPHP(totalOutstanding)} for room ${roomNumber}.\n${arrearsAmount > 0 ? `Arrears: ${fmtPHP(arrearsAmount)}\n` : ''}${overdueAmount > 0 ? `Overdue: ${fmtPHP(overdueAmount)}\n` : ''}Please settle immediately.\n\n— Rfacon Dormitel`;
  return { subject, html, text };
}

module.exports = {
  sendEmail,
  buildInviteEmail,
  buildResetEmail,
  buildBillCreatedEmail,
  buildOverdueReminderEmail,
  buildArrearsNoticeEmail,
  buildPaymentConfirmationEmail,
  buildReminderEmail
};