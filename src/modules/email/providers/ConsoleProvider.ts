import 'reflect-metadata';
import { injectable } from 'tsyringe';
import { logger } from '../../../observability/logger';
import type { EmailProvider, SendEmailOptions } from './EmailProvider';

@injectable()
export class ConsoleProvider implements EmailProvider {
  async send(options: SendEmailOptions): Promise<void> {
    const body = options.text ?? options.html;
    const link = body.match(/https?:\/\/[^\s"<>]+/)?.[0] ?? '(no link found)';

    logger.info('📧 [DEV EMAIL] ' + options.subject, { to: options.to, link });
  }
}
