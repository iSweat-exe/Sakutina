import { createCommandHandler } from '../../../utils/index.js';
import {
    MessageFlags,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { env } from '../../../config/env.js';
import { I18nService } from '../../../services/I18nService.js';
import { db } from '../../../repositories/db.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';
import { sql } from 'drizzle-orm';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';

const execAsync = promisify(exec);

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('dev')
        .setNameLocalizations({ fr: 'dev' })
        .setDescription('Developer commands (Restricted)')
        .setDescriptionLocalizations({
            fr: 'Commandes développeur (Restreint)',
        })
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((sub) =>
            sub
                .setName('eval')
                .setNameLocalizations({ fr: 'evaluer' })
                .setDescription('Evaluate raw JavaScript (DANGEROUS)')
                .setDescriptionLocalizations({
                    fr: 'Évaluer du JavaScript brut (DANGEREUX)',
                })
                .addStringOption((opt) =>
                    opt
                        .setName('code')
                        .setNameLocalizations({ fr: 'code' })
                        .setDescription('The JS code to run')
                        .setDescriptionLocalizations({
                            fr: 'Le code JS à exécuter',
                        })
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('sql')
                .setNameLocalizations({ fr: 'sql' })
                .setDescription('Execute raw SQL queries (DANGEROUS)')
                .setDescriptionLocalizations({
                    fr: 'Exécuter des requêtes SQL brutes (DANGEREUX)',
                })
                .addStringOption((opt) =>
                    opt
                        .setName('query')
                        .setNameLocalizations({ fr: 'requete' })
                        .setDescription('The SQL query to run')
                        .setDescriptionLocalizations({
                            fr: 'La requête SQL à exécuter',
                        })
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('servers')
                .setNameLocalizations({ fr: 'serveurs' })
                .setDescription('List all servers the bot is in')
                .setDescriptionLocalizations({
                    fr: 'Lister tous les serveurs où le bot est présent',
                })
        )
        .addSubcommand((sub) =>
            sub
                .setName('stats')
                .setNameLocalizations({ fr: 'statistiques' })
                .setDescription('Show bot performance and system stats')
                .setDescriptionLocalizations({
                    fr: 'Afficher les performances du bot et du système',
                })
        )
        .addSubcommand((sub) =>
            sub
                .setName('cleardb')
                .setNameLocalizations({ fr: 'viderbdd' })
                .setDescription('Clear all tables in the database (DANGEROUS)')
                .setDescriptionLocalizations({
                    fr: 'Vider toutes les tables de la base de données (DANGEREUX)',
                })
                .addBooleanOption((opt) =>
                    opt
                        .setName('confirm')
                        .setNameLocalizations({ fr: 'confirmer' })
                        .setDescription('Confirm deletion')
                        .setDescriptionLocalizations({
                            fr: 'Confirmer la suppression',
                        })
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('deploy')
                .setNameLocalizations({ fr: 'deployer' })
                .setDescription(
                    'Deploy slash commands to Discord via sub-process'
                )
                .setDescriptionLocalizations({
                    fr: 'Déployer les slash commands sur Discord',
                })
        ),

    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            // Security check: ONLY DEVELOPERS CAN USE THIS COMMAND
            if (!env.DEVELOPER_ID.includes(interaction.user.id)) {
                const embed = EmbedUtils.error(
                    I18nService.translate('common:DEV_UNAUTHORIZED', {
                        lng: lang,
                    }),
                    'Unauthorized',
                    interaction.user
                );
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            const subcommand = interaction.options.getSubcommand();
            if (subcommand === 'eval') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const code = interaction.options.getString('code', true);
                try {
                    // Warning: eval in async context doesn't automatically await promises unless wrapped
                    const asyncWrapper = `(async () => { return ${code}; })()`;
                    let result = await eval(asyncWrapper);
                    if (typeof result !== 'string') {
                        result = require('node:util').inspect(result, {
                            depth: 1,
                        });
                    }
                    // Truncate if too long for Discord message
                    if (result.length > 3900) {
                        result = result.substring(0, 3900) + '...';
                    }
                    const embed = new EmbedBuilder()
                        .setTitle('🚀 Eval Result')
                        .setDescription(`\`\`\`js\n${result}\n\`\`\``)
                        .setColor('#2ECC71');
                    await interaction.editReply({ embeds: [embed] });
                } catch (error: any) {
                    const embed = new EmbedBuilder()
                        .setTitle('Eval Error')
                        .setDescription(`\`\`\`js\n${error.message}\n\`\`\``)
                        .setColor('#E74C3C');
                    await interaction.editReply({ embeds: [embed] });
                }
            } else if (subcommand === 'sql') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const query = interaction.options.getString('query', true);
                try {
                    const result = await db.execute(sql.raw(query));
                    let formattedResult = JSON.stringify(result, null, 2);
                    if (formattedResult.length > 3900) {
                        formattedResult =
                            formattedResult.substring(0, 3900) + '...';
                    }
                    const embed = new EmbedBuilder()
                        .setTitle('💾 SQL Result')
                        .setDescription(
                            `\`\`\`json\n${formattedResult}\n\`\`\``
                        )
                        .setColor('#3498DB');
                    await interaction.editReply({ embeds: [embed] });
                } catch (error: any) {
                    const embed = new EmbedBuilder()
                        .setTitle('SQL Error')
                        .setDescription(`\`\`\`json\n${error.message}\n\`\`\``)
                        .setColor('#E74C3C');
                    await interaction.editReply({ embeds: [embed] });
                }
            } else if (subcommand === 'servers') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const guilds = interaction.client.guilds.cache;
                let desc = `Bot is in **${guilds.size}** servers:\n\n`;
                guilds.forEach((guild) => {
                    desc += `- **${guild.name}** (${guild.id}) - ${guild.memberCount} members\n`;
                });
                if (desc.length > 4000) desc = desc.substring(0, 3995) + '...';
                const embed = new EmbedBuilder()
                    .setTitle('Servers List')
                    .setDescription(desc)
                    .setColor('#9B59B6');
                await interaction.editReply({ embeds: [embed] });
            } else if (subcommand === 'stats') {
                const memoryUsage = process.memoryUsage();
                const uptime = process.uptime();
                const formatBytes = (bytes: number) =>
                    `${(bytes / 1024 / 1024).toFixed(2)} MB`;
                const formatUptime = (seconds: number) => {
                    const d = Math.floor(seconds / (3600 * 24));
                    const h = Math.floor((seconds % (3600 * 24)) / 3600);
                    const m = Math.floor((seconds % 3600) / 60);
                    const s = Math.floor(seconds % 60);
                    return `${d}d ${h}h ${m}m ${s}s`;
                };
                const embed = new EmbedBuilder()
                    .setTitle('📊 Bot & System Stats')
                    .setColor('#F1C40F')
                    .addFields(
                        {
                            name: '🤖 Bot Uptime',
                            value: formatUptime(uptime),
                            inline: true,
                        },
                        {
                            name: '📡 Ping (Websocket)',
                            value: `${interaction.client.ws.ping} ms`,
                            inline: true,
                        },
                        {
                            name: '💽 Memory (RSS)',
                            value: formatBytes(memoryUsage.rss),
                            inline: true,
                        },
                        {
                            name: '💽 Memory (Heap)',
                            value: `${formatBytes(memoryUsage.heapUsed)} / ${formatBytes(memoryUsage.heapTotal)}`,
                            inline: true,
                        },
                        {
                            name: '💻 OS Platform',
                            value: `${os.platform()} ${os.release()}`,
                            inline: true,
                        },
                        {
                            name: '💻 CPU Cores',
                            value: `${os.cpus().length} threads`,
                            inline: true,
                        }
                    );
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            } else if (subcommand === 'cleardb') {
                const confirm = interaction.options.getBoolean('confirm', true);
                if (!confirm) {
                    const embed = EmbedUtils.warn(
                        I18nService.translate('common:DEV_CLEARDB_CANCELLED', {
                            lng: lang,
                        }),
                        'Action Cancelled',
                        interaction.user
                    );
                    await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                try {
                    await db.execute(
                        sql`TRUNCATE TABLE users, guild_settings, guild_event_channels, reminders, user_quests, interaction_stats, mod_actions, transactions, warns CASCADE;`
                    );
                    const embed = EmbedUtils.success(
                        I18nService.translate('common:DEV_CLEARDB_SUCCESS', {
                            lng: lang,
                        }),
                        'Database Cleared',
                        interaction.user
                    );
                    await interaction.editReply({ embeds: [embed] });
                } catch (error: any) {
                    const embed = EmbedUtils.error(
                        `Error clearing DB: ${error.message}`,
                        'Database Error',
                        interaction.user
                    );
                    await interaction.editReply({ embeds: [embed] });
                }
            } else if (subcommand === 'deploy') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                try {
                    const { stdout, stderr } =
                        await execAsync('bun run deploy');
                    const out = stdout.substring(0, 1900);
                    const err = stderr.substring(0, 1900);
                    const embed = new EmbedBuilder()
                        .setTitle('⚙️ Slash Commands Deployed')
                        .setDescription(
                            `**Stdout**:\n\`\`\`bash\n${out || 'No output'}\n\`\`\`\n**Stderr**:\n\`\`\`bash\n${err || 'No errors'}\n\`\`\``
                        )
                        .setColor('#2ECC71');
                    await interaction.editReply({ embeds: [embed] });
                } catch (error: any) {
                    const embed = EmbedUtils.error(
                        `Deploy failed: \`\`\`bash\n${error.message}\n\`\`\``,
                        'Deploy Error',
                        interaction.user
                    );
                    await interaction.editReply({ embeds: [embed] });
                }
            }
        }
    ),
};

export default command;
