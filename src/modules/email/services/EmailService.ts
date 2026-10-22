import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../../../tokens';
import { config } from '../../../config';
import { logger } from '../../../observability/logger';
import { renderTemplate } from '../utils/renderTemplate';
import type { EmailProvider } from '../providers/EmailProvider';

@injectable()
export class EmailService {
  constructor(
    @inject(TOKENS.EmailProvider) private readonly provider: EmailProvider,
  ) {}

  async sendVerificationEmail(opts: {
    to:              string;
    firstName:       string;
    verificationUrl: string;
  }): Promise<void> {
    const html = renderTemplate('verify-email', {
      appName:         config.app.name,
      firstName:       opts.firstName,
      verificationUrl: opts.verificationUrl,
    });

    await this.provider.send({
      to:      opts.to,
      subject: `Verify your email — ${config.app.name}`,
      html,
    });

    logger.info('Verification email sent', { to: opts.to });
  }

  async sendPasswordResetEmail(opts: {
    to:        string;
    firstName: string;
    resetUrl:  string;
  }): Promise<void> {
    const html = renderTemplate('reset-password', {
      appName:   config.app.name,
      firstName: opts.firstName,
      resetUrl:  opts.resetUrl,
    });

    await this.provider.send({
      to:      opts.to,
      subject: `Reset your password — ${config.app.name}`,
      html,
    });

    logger.info('Password reset email sent', { to: opts.to });
  }

  async sendStatusChangeEmail(opts: {
    to:          string;
    firstName:   string;
    companyName: string;
    indicator:   string;
    description: string;
    statusUrl:   string;
    type:        'degraded' | 'recovered';
  }): Promise<void> {
    const template = opts.type === 'recovered' ? 'service-recovered' : 'service-degraded';
    const subject  = opts.type === 'recovered'
      ? `${opts.companyName} has recovered — ${config.app.name}`
      : `${opts.companyName} is experiencing issues — ${config.app.name}`;

    const html = renderTemplate(template, {
      appName:     config.app.name,
      firstName:   opts.firstName,
      companyName: opts.companyName,
      indicator:   opts.indicator,
      description: opts.description,
      statusUrl:   opts.statusUrl,
    });

    await this.provider.send({ to: opts.to, subject, html });
    logger.info('Status change email sent', { to: opts.to, type: opts.type, company: opts.companyName });
  }

  async sendWelcomeEmail(opts: {
    to:        string;
    firstName: string;
    appUrl:    string;
  }): Promise<void> {
    const html = renderTemplate('welcome', {
      appName:   config.app.name,
      firstName: opts.firstName,
      appUrl:    opts.appUrl,
    });

    await this.provider.send({
      to:      opts.to,
      subject: `Welcome to ${config.app.name}!`,
      html,
    });

    logger.info('Welcome email sent', { to: opts.to });
  }
}
