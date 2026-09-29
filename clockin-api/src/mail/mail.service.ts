import { Injectable, Logger } from '@nestjs/common';
import { promises as dns } from 'node:dns';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  isConfigured(): boolean {
    return Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);
  }

  /**
   * Phase2 FIX6 — send invite with password-reset link.
   * Returns true if sent; false if SMTP not configured (caller keeps link fallback).
   */
  async sendInviteEmail(opts: {
    to: string;
    inviteeName?: string | null;
    organisationName: string;
    inviterName?: string | null;
    passwordResetLink: string;
  }): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'SMTP not configured (SMTP_HOST / EMAIL_FROM); skip invite email',
      );
      return false;
    }

    const appName = process.env.APP_NAME?.trim() || 'ClockIn';
    const from = process.env.EMAIL_FROM!;
    const smtpHost = process.env.SMTP_HOST!;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER || undefined;
    const pass = process.env.SMTP_PASS || undefined;

    let connectHost = smtpHost;
    let tlsServername: string | undefined;
    try {
      // Render free outbound often has no working IPv6 (ENETUNREACH to Gmail).
      // Nodemailer may still pick AAAA even with family:4, so pin to resolve4 IP.
      const ipv4 = await dns.resolve4(smtpHost);
      if (ipv4[0]) {
        connectHost = ipv4[0];
        tlsServername = smtpHost;
        this.logger.log(
          `SMTP connecting via IPv4 ${connectHost} (TLS SNI ${tlsServername})`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Could not resolve IPv4 for ${smtpHost}, using hostname: ${message}`,
      );
    }

    const transporter = nodemailer.createTransport({
      host: connectHost,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
      tls: tlsServername ? { servername: tlsServername } : undefined,
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 20_000,
    });

    const greeting = opts.inviteeName?.trim()
      ? `Hi ${opts.inviteeName.trim()},`
      : 'Hi,';
    const inviter = opts.inviterName?.trim() || 'Your administrator';

    const text = [
      greeting,
      '',
      `${inviter} invited you to join ${opts.organisationName} on ${appName}.`,
      '',
      'Set your password using this link:',
      opts.passwordResetLink,
      '',
      'If you did not expect this invite, you can ignore this email.',
    ].join('\n');

    const html = `
      <p>${greeting}</p>
      <p><strong>${inviter}</strong> invited you to join
      <strong>${opts.organisationName}</strong> on ${appName}.</p>
      <p><a href="${opts.passwordResetLink}">Set your password</a></p>
      <p style="color:#64748b;font-size:12px">If you did not expect this invite, you can ignore this email.</p>
    `;

    try {
      await transporter.sendMail({
        from,
        to: opts.to,
        subject: `You're invited to ${opts.organisationName} on ${appName}`,
        text,
        html,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send invite email to ${opts.to}: ${message}`);
      return false;
    }
  }
}
