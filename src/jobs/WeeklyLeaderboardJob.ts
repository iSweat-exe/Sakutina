import cron from 'node-cron';
import { db } from '../repositories/db.js';
import { guildSettings } from '../repositories/schema.js';
import { isNotNull } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { botClient } from '../bot.js';
import { EconomyService } from '../services/EconomyService.js';
import { GuildConfigService } from '../services/GuildConfigService.js';
import { I18nService } from '../services/I18nService.js';
import { EmbedUtils } from '../utils/EmbedUtils.js';

/** Coin rewards for the top 3 of the weekly leaderboard */
const WEEKLY_REWARDS = [1000, 500, 250];

export class WeeklyLeaderboardJob {
    public static start() {
        // Every Monday at noon UTC
        cron.schedule('0 12 * * 1', async () => {
            try {
                const guilds = await db
                    .select({
                        guildId: guildSettings.guildId,
                        leaderboardChannel: guildSettings.leaderboardChannel,
                    })
                    .from(guildSettings)
                    .where(isNotNull(guildSettings.leaderboardChannel));

                for (const { guildId, leaderboardChannel } of guilds) {
                    if (!leaderboardChannel) continue;
                    try {
                        const top = await EconomyService.getLeaderboard(
                            guildId,
                            3
                        );
                        if (top.length === 0) continue;

                        const lines: string[] = [];
                        for (let i = 0; i < top.length; i++) {
                            const entry = top[i]!;
                            const reward = WEEKLY_REWARDS[i] ?? 0;
                            if (reward > 0) {
                                await EconomyService.addBalance(
                                    entry.discordId,
                                    guildId,
                                    reward,
                                    'Weekly leaderboard reward',
                                    'weekly_leaderboard_reward'
                                );
                            }
                            lines.push(
                                `**#${i + 1}** <@${entry.discordId}> — ${entry.total} (+${reward})`
                            );
                        }

                        const channel = await botClient.channels
                            .fetch(leaderboardChannel)
                            .catch(() => null);
                        if (channel && channel.isSendable()) {
                            const lang =
                                await GuildConfigService.getGuildLanguage(
                                    guildId
                                );
                            const title = I18nService.translate(
                                'economy:WEEKLY_LEADERBOARD_TITLE',
                                { lng: lang }
                            );
                            const desc = I18nService.translate(
                                'economy:WEEKLY_LEADERBOARD_DESC',
                                { lng: lang }
                            );
                            const embed = EmbedUtils.success(
                                `${desc}\n\n${lines.join('\n')}`,
                                title
                            );
                            await channel.send({ embeds: [embed] });
                        }
                    } catch (err) {
                        logger.error(
                            `[WeeklyLeaderboardJob] Error processing guild ${guildId}`,
                            err
                        );
                    }
                }

                logger.info(
                    '[WeeklyLeaderboardJob] Weekly leaderboard rewards distributed.'
                );
            } catch (error) {
                logger.error(
                    '[WeeklyLeaderboardJob] Error distributing weekly leaderboard rewards',
                    error
                );
            }
        });
    }
}
