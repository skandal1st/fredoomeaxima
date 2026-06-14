import { Injectable, Logger, Global, Module } from '@nestjs/common';
import axios from 'axios';
import { TypedConfigService } from '../config/config.module';

/**
 * Telegram admin notifications. If TELEGRAM_BOT_TOKEN / chat id are unset, falls
 * back to logging — the service stays usable in local dev without a bot.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token: string;
  private readonly chatId: string;

  constructor(config: TypedConfigService) {
    this.token = config.get('TELEGRAM_BOT_TOKEN');
    this.chatId = config.get('TELEGRAM_ADMIN_CHAT_ID');
  }

  get enabled(): boolean {
    return Boolean(this.token && this.chatId);
  }

  async sendAdmin(message: string): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(`[telegram disabled] ${message.replace(/\n/g, ' | ')}`);
      return;
    }
    try {
      await axios.post(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        { chat_id: this.chatId, text: message, parse_mode: 'HTML', disable_web_page_preview: true },
        { timeout: 10_000 },
      );
    } catch (err) {
      this.logger.error(`Failed to send Telegram notification: ${(err as Error).message}`);
    }
  }

  /** Structured server-incident alert (matches the spec's required fields). */
  async serverAlert(params: {
    serverName: string;
    country: string;
    problem: string;
    unavailableService?: string;
    lastSuccessfulCheck?: Date | null;
  }): Promise<void> {
    const lines = [
      '🚨 <b>VPN server alert</b>',
      `Server: <b>${params.serverName}</b>`,
      `Country: ${params.country}`,
      `Problem: ${params.problem}`,
      params.unavailableService ? `Service: ${params.unavailableService}` : null,
      `Time: ${new Date().toISOString()}`,
      `Last OK check: ${params.lastSuccessfulCheck ? params.lastSuccessfulCheck.toISOString() : 'never'}`,
    ].filter(Boolean);
    await this.sendAdmin(lines.join('\n'));
  }
}

@Global()
@Module({
  providers: [TelegramService],
  exports: [TelegramService],
})
export class NotificationsModule {}
