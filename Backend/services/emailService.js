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

module.exports = { sendEmail, buildInviteEmail };