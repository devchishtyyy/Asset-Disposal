'use strict';

const nodemailer = require('nodemailer');

const isConfigured = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return _transporter;
}

async function sendEmail({ toEmail, toName, subject, message }) {
  if (!isConfigured) {
    console.info('[Email] Not configured — would send to:', toEmail, '|', subject);
    return;
  }
  if (!toEmail) return;
  try {
    await getTransporter().sendMail({
      from:    process.env.EMAIL_FROM || 'Asset Disposal System <noreply@packagesgroup.com>',
      to:      `${toName || toEmail} <${toEmail}>`,
      subject,
      text:    message,
    });
  } catch (err) {
    // Non-fatal — log and continue
    console.error('[Email] Failed to send:', err.message);
  }
}

async function notifyApproverPending({ approver, initiatorName, assetNumber, companyName }) {
  await sendEmail({
    toEmail: approver.email,
    toName:  approver.name,
    subject: `Action Required — Asset Disposal Approval (Asset ${assetNumber})`,
    message:
      `Dear ${approver.name},\n\n` +
      `An Asset Disposal form for Asset No. ${assetNumber} at ${companyName} has been submitted by ` +
      `${initiatorName} and requires your approval as ${approver.stepLabel}.\n\n` +
      `Please log in to the Asset Disposal System to review and take action.\n\n` +
      `Thank you,\nAsset Disposal System — Packages Group`,
  });
}

async function notifyNextApproverAfterApproval({ nextApprover, prevApproverLabel, assetNumber, companyName }) {
  await sendEmail({
    toEmail: nextApprover.email,
    toName:  nextApprover.name,
    subject: `Action Required — Asset Disposal Approval (Asset ${assetNumber})`,
    message:
      `Dear ${nextApprover.name},\n\n` +
      `The Asset Disposal form for Asset No. ${assetNumber} at ${companyName} has been approved by ` +
      `${prevApproverLabel} and now requires your approval as ${nextApprover.stepLabel}.\n\n` +
      `Please log in to the Asset Disposal System to review and take action.\n\n` +
      `Thank you,\nAsset Disposal System — Packages Group`,
  });
}

module.exports = { notifyApproverPending, notifyNextApproverAfterApproval, isConfigured };
