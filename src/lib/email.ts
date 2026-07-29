import nodemailer from "nodemailer";

import { getAppUrl } from "@/lib/payment";
import type { BookingDTO } from "@/models/Booking";

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
}

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; dev?: boolean }> {
  const from = process.env.EMAIL_FROM ?? "noreply@example.com";
  const transport = getTransport();
  const recipients = Array.isArray(payload.to) ? payload.to.join(", ") : payload.to;

  if (transport && from.endsWith(".local")) {
    console.warn(
      "📧 [email] SMTP is configured but EMAIL_FROM is using a .local address. Replace it with a valid public domain to avoid delivery failures."
    );
  }

  if (!transport) {
    console.log("\n📧 [email:dev] — SMTP not configured, logging instead:");
    console.log(`   To: ${recipients}`);
    console.log(`   Subject: ${payload.subject}`);
    console.log(`   ${payload.text}\n`);
    return { ok: true, dev: true };
  }

  try {
    await transport.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
    return { ok: true };
  } catch (err) {
    console.error("Email send failed:", err);
    return { ok: false };
  }
}

/** Fire-and-forget — never blocks the booking flow */
export function sendEmailSafe(payload: EmailPayload): void {
  void sendEmail(payload).then((result) => {
    if (!result.ok && !result.dev) {
      console.error("[email] Failed to deliver email:", {
        to: Array.isArray(payload.to) ? payload.to.join(", ") : payload.to,
        subject: payload.subject,
      });
    }
  });
}

export function notifyOwnerNewBooking(booking: BookingDTO, ownerEmails: string[]): void {
  if (ownerEmails.length === 0) return;

  const appUrl = getAppUrl();
  const date = new Date(`${booking.date}T12:00:00`).toLocaleDateString();

  sendEmailSafe({
    to: ownerEmails,
    subject: `New booking request — ${booking.spaceName}`,
    text: [
      `Hi ${booking.ownerName !== "Awaiting owner" ? booking.ownerName : "there"},`,
      ``,
      `${booking.memberName} (${booking.memberEmail}) requested a booking:`,
      `Space: ${booking.spaceName}, ${booking.spaceCity}`,
      `Date: ${date}`,
      `Seats: ${booking.seats}`,
      `Total: $${booking.totalAmount}`,
      ``,
      `Review and respond: ${appUrl}/owner`,
    ].join("\n"),
    html: `
      <p>Hi ${booking.ownerName !== "Awaiting owner" ? booking.ownerName : "there"},</p>
      <p><strong>${booking.memberName}</strong> (${booking.memberEmail}) requested a booking:</p>
      <ul>
        <li><strong>Space:</strong> ${booking.spaceName}, ${booking.spaceCity}</li>
        <li><strong>Date:</strong> ${date}</li>
        <li><strong>Seats:</strong> ${booking.seats}</li>
        <li><strong>Total:</strong> $${booking.totalAmount}</li>
      </ul>
      <p><a href="${appUrl}/owner">Review in Owner Portal →</a></p>
    `,
  });
}

export function notifyMemberBookingRejected(booking: BookingDTO): void {
  const appUrl = getAppUrl();
  const date = new Date(`${booking.date}T12:00:00`).toLocaleDateString();

  sendEmailSafe({
    to: booking.memberEmail,
    subject: `Booking request declined — ${booking.spaceName}`,
    text: [
      `Hi ${booking.memberName},`,
      ``,
      `Unfortunately your booking request for ${booking.spaceName} on ${date} was declined.`,
      booking.ownerNotes ? `Note from owner: ${booking.ownerNotes}` : "",
      ``,
      `Browse other spaces: ${appUrl}/spaces`,
    ].join("\n"),
    html: `
      <p>Hi ${booking.memberName},</p>
      <p>Unfortunately your booking request for <strong>${booking.spaceName}</strong> on ${date} was <strong>declined</strong>.</p>
      ${booking.ownerNotes ? `<p><em>Note from owner:</em> ${booking.ownerNotes}</p>` : ""}
      <p><a href="${appUrl}/spaces">Browse other spaces →</a></p>
    `,
  });
}

export function notifyMemberBookingConfirmed(
  booking: BookingDTO,
  options?: { paymentUrl?: string; gateway?: boolean },
): void {
  const appUrl = getAppUrl();
  const date = new Date(`${booking.date}T12:00:00`).toLocaleDateString();
  const gateway = options?.gateway ?? false;
  const paymentUrl = options?.paymentUrl ?? booking.paymentUrl;

  const paymentBlock = gateway && paymentUrl
    ? `\n\nPay now to complete your booking:\n${paymentUrl}`
    : booking.paymentInstructions
      ? `\n\nPayment method: ${booking.paymentMethod}\n${booking.paymentInstructions}${booking.paymentReference ? `\nReference: ${booking.paymentReference}` : ""}`
      : "";

  const paymentHtml = gateway && paymentUrl
    ? `<p><a href="${paymentUrl}" style="display:inline-block;padding:12px 24px;background:#c17f59;color:#fff;text-decoration:none;border-radius:6px;">Pay now — $${booking.totalAmount}</a></p>`
    : booking.paymentInstructions
      ? `<p><strong>Payment method:</strong> ${booking.paymentMethod}<br/>${booking.paymentInstructions}${booking.paymentReference ? `<br/><strong>Reference:</strong> ${booking.paymentReference}` : ""}</p>`
      : "";

  sendEmailSafe({
    to: booking.memberEmail,
    subject: gateway
      ? `Booking approved — complete payment for ${booking.spaceName}`
      : `Booking confirmed — ${booking.spaceName}`,
    text: [
      `Hi ${booking.memberName},`,
      ``,
      gateway
        ? `Your booking request for ${booking.spaceName} on ${date} has been approved.`
        : `Your booking for ${booking.spaceName} on ${date} is confirmed.`,
      `Seats: ${booking.seats} · Total: $${booking.totalAmount}`,
      paymentBlock,
      booking.ownerNotes ? `\nNote from owner: ${booking.ownerNotes}` : "",
      ``,
      `View your dashboard: ${appUrl}/dashboard`,
    ].join("\n"),
    html: `
      <p>Hi ${booking.memberName},</p>
      <p>${gateway ? `Your booking request for <strong>${booking.spaceName}</strong> on ${date} has been <strong>approved</strong>.` : `Your booking for <strong>${booking.spaceName}</strong> on ${date} is <strong>confirmed</strong>.`}</p>
      <p>Seats: ${booking.seats} · Total: $${booking.totalAmount}</p>
      ${paymentHtml}
      ${booking.ownerNotes ? `<p><em>Note from owner:</em> ${booking.ownerNotes}</p>` : ""}
      <p><a href="${appUrl}/dashboard">View dashboard →</a></p>
    `,
  });
}

export async function notifyPaymentReceived(
  booking: BookingDTO,
  adminEmails: string[],
): Promise<void> {
  const appUrl = getAppUrl();
  const date = new Date(`${booking.date}T12:00:00`).toLocaleDateString();

  const recipients = [booking.ownerEmail, ...adminEmails].filter(Boolean) as string[];
  if (recipients.length === 0) return;

  const subject = `Payment received — ${booking.spaceName} (${booking.memberName})`;

  const text = [
    `Hi,`,
    ``,
    `Payment has been received for the following booking:`,
    ``,
    `Member:  ${booking.memberName} (${booking.memberEmail})`,
    `Space:   ${booking.spaceName}, ${booking.spaceCity}`,
    `Date:    ${date}`,
    `Seats:   ${booking.seats}`,
    `Amount:  $${booking.totalAmount}`,
    `Payment: ${booking.paymentMethod ?? "—"}`,
    booking.paymentId ? `Ref:     ${booking.paymentId}` : "",
    ``,
    `View in portal: ${appUrl}/owner`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  const html = `
    <p>Hi,</p>
    <p>Payment has been received for the following booking:</p>
    <table style="border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Member</td><td><strong>${booking.memberName}</strong> (${booking.memberEmail})</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Space</td><td>${booking.spaceName}, ${booking.spaceCity}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Date</td><td>${date}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Seats</td><td>${booking.seats}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Amount</td><td><strong>$${booking.totalAmount}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Method</td><td>${booking.paymentMethod ?? "—"}</td></tr>
      ${booking.paymentId ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Ref</td><td>${booking.paymentId}</td></tr>` : ""}
    </table>
    <p><a href="${appUrl}/owner">View in Owner Portal →</a></p>
  `;

  sendEmailSafe({ to: recipients, subject, text, html });
}
