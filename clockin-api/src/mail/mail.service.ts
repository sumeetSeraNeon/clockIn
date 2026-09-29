import { Injectable, Logger } from '@nestjs/common';
import { promises as dns } from 'node:dns';
import * as nodemailer from 'nodemailer';

type InviteMailContent = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  isConfigured(): boolean {
    return Boolean(
      process.env.EMAIL_FROM &&
        (process.env.RESEND_API_KEY || process.env.SMTP_HOST),
    );
  }

  /**
   * Phase2 FIX6 — send invite with password-reset link.
   * Returns true if sent; false if not configured / send failed
   * (caller keeps link fallback).
   *
   * Prefer RESEND_API_KEY (HTTPS). Render free blocks outbound SMTP
   * on ports 25/465/587, so Gmail SMTP hangs there.
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
        'Email not configured (EMAIL_FROM + RESEND_API_KEY or SMTP_HOST); skip invite email',
      );
      return false;
    }

    const appName = process.env.APP_NAME?.trim() || 'ClockIn';
    const from = process.env.EMAIL_FROM!;
    const greeting = opts.inviteeName?.trim()
      ? `Hi ${opts.inviteeName.trim()},`
      : 'Hi,';
    const inviter = opts.inviterName?.trim() || 'Your administrator';

    const content: InviteMailContent = {
      to: opts.to,
      subject: `You're invited to ${opts.organisationName} on ${appName}`,
      text: [
        greeting,
        '',
        `${inviter} invited you to join ${opts.organisationName} on ${appName}.`,
        '',
        'Set your password using this link:',
        opts.passwordResetLink,
        '',
        'If you did not expect this invite, you can ignore this email.',
      ].join('\n'),
      html: `
      <p>${greeting}</p>
      <p><strong>${inviter}</strong> invited you to join
      <strong>${opts.organisationName}</strong> on ${appName}.</p>
      <p><a href="${opts.passwordResetLink}">Set your password</a></p>
      <p style="color:#64748b;font-size:12px">If you did not expect this invite, you can ignore this email.</p>
    `,
    };

    if (process.env.RESEND_API_KEY?.trim()) {
      return this.sendViaResend(from, content);
    }

    return this.sendViaSmtp(from, content);
  }

  private async sendViaResend(
    from: string,
    content: InviteMailContent,
  ): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY!.trim();
    this.logger.log(`Sending invite email via Resend HTTPS to ${content.to}`);

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [content.to],
          subject: content.subject,
          text: content.text,
          html: content.html,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.error(
          `Resend failed for ${content.to}: HTTP ${response.status} ${body}`,
        );
        return false;
      }

      this.logger.log(`Invite email sent via Resend to ${content.to}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Resend failed for ${content.to}: ${message}`);
      return false;
    }
  }

  private async sendViaSmtp(
    from: string,
    content: InviteMailContent,
  ): Promise<boolean> {
    const smtpHost = process.env.SMTP_HOST!;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER || undefined;
    const pass = process.env.SMTP_PASS || undefined;

    if (process.env.RENDER) {
      this.logger.warn(
        'SMTP on Render free tier is blocked (ports 25/465/587). Set RESEND_API_KEY for HTTPS email, or upgrade the Render instance.',
      );
    }

    let connectHost = smtpHost;
    let tlsServername: string | undefined;
    try {
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
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 8_000,
    });

    try {
      this.logger.log(`SMTP sendMail starting for ${content.to}`);
      await Promise.race([
        transporter.sendMail({
          from,
          to: content.to,
          subject: content.subject,
          text: content.text,
          html: content.html,
        }),
        new Promise<never>((_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(
                  'SMTP timed out after 10s (Render free blocks ports 25/465/587 — use RESEND_API_KEY)',
                ),
              ),
            10_000,
          );
        }),
      ]);
      this.logger.log(`Invite email sent via SMTP to ${content.to}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send invite email to ${content.to}: ${message}`);
      return false;
    } finally {
      transporter.close();
    }
  }
}
