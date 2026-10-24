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

  async sendPredictionAlertEmail(opts: {
    to:          string;
    firstName:   string;
    companyName: string;
    riskLevel:   'elevated' | 'high';
    warningText: string;
    statusUrl:   string;
  }): Promise<void> {
    const html = renderTemplate('prediction-alert', {
      appName:     config.app.name,
      firstName:   opts.firstName,
      companyName: opts.companyName,
      riskLevel:   opts.riskLevel,
      warningText: opts.warningText,
      statusUrl:   opts.statusUrl,
    });

    await this.provider.send({
      to:      opts.to,
      subject: `Predictive warning: ${opts.companyName} may be heading for an outage — ${config.app.name}`,
      html,
    });

    logger.info('Prediction alert email sent', { to: opts.to, company: opts.companyName, riskLevel: opts.riskLevel });
  }

  async sendPostmortemEmail(opts: {
    to:              string;
    firstName:       string;
    companyName:     string;
    durationMinutes: number;
    peakIndicator:   string;
    summary:         string;
    statusUrl:       string;
  }): Promise<void> {
    const html = renderTemplate('postmortem-ready', {
      appName:         config.app.name,
      firstName:       opts.firstName,
      companyName:     opts.companyName,
      durationMinutes: String(opts.durationMinutes),
      peakIndicator:   opts.peakIndicator,
      summary:         opts.summary,
      statusUrl:       opts.statusUrl,
    });

    await this.provider.send({
      to:      opts.to,
      subject: `${opts.companyName} incident resolved — postmortem ready — ${config.app.name}`,
      html,
    });

    logger.info('Postmortem email sent', { to: opts.to, company: opts.companyName });
  }

  async sendIncidentSummaryEmail(opts: {
    to:          string;
    firstName:   string;
    companyName: string;
    indicator:   string;
    summary:     string;
    statusUrl:   string;
  }): Promise<void> {
    const html = renderTemplate('incident-summary', {
      appName:     config.app.name,
      firstName:   opts.firstName,
      companyName: opts.companyName,
      indicator:   opts.indicator,
      summary:     opts.summary,
      statusUrl:   opts.statusUrl,
    });

    await this.provider.send({
      to:      opts.to,
      subject: `Live incident update: ${opts.companyName} — ${config.app.name}`,
      html,
    });

    logger.info('Incident summary email sent', { to: opts.to, company: opts.companyName });
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
