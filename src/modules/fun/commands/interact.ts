import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags,
} from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';
import { createCommandHandler } from '../../../utils/index.js';
import { db } from '../../../repositories/db.js';
import { interactionStats } from '../../../repositories/schema.js';
import { sql } from 'drizzle-orm';

async function incrementInteraction(
    userId: string,
    guildId: string,
    type: string
): Promise<number> {
    const result = await db
        .insert(interactionStats)
        .values({ userId, guildId, interactionType: type, count: 1 })
        .onConflictDoUpdate({
            target: [
                interactionStats.userId,
                interactionStats.guildId,
                interactionStats.interactionType,
            ],
            set: { count: sql`${interactionStats.count} + 1` },
        })
        .returning({ count: interactionStats.count });
    return result[0]?.count ?? 1;
}

const ACTIONS = [
    {
        name: 'hug',
        fr: 'calin',
        desc: 'Give someone a hug',
        frDesc: "Faire un câlin à quelqu'un",
    },
    {
        name: 'cuddle',
        fr: 'cuddle',
        desc: 'Cuddle with someone',
        frDesc: "Faire un câlin tendre à quelqu'un",
    },
    {
        name: 'sleep',
        fr: 'dormir',
        desc: 'Sleep with someone',
        frDesc: "Dormir avec quelqu'un",
    },
    {
        name: 'confused',
        fr: 'confus',
        desc: 'Be confused',
        frDesc: 'Être confus',
    },
    {
        name: 'blush',
        fr: 'rougir',
        desc: 'Blush at someone',
        frDesc: "Rougir devant quelqu'un",
    },
    {
        name: 'think',
        fr: 'reflechir',
        desc: 'Think deeply',
        frDesc: 'Réfléchir intensément',
    },
    {
        name: 'highfive',
        fr: 'highfive',
        desc: 'High-five someone',
        frDesc: "Taper dans la main de quelqu'un",
    },
    {
        name: 'bite',
        fr: 'mordre',
        desc: 'Bite someone',
        frDesc: "Mordre quelqu'un",
    },
    {
        name: 'shocked',
        fr: 'choque',
        desc: 'Be shocked',
        frDesc: 'Être choqué',
    },
    { name: 'bleh', fr: 'bleh', desc: 'Go bleh', frDesc: 'Tirer la langue' },
    { name: 'bored', fr: 'ennui', desc: 'Be bored', frDesc: "S'ennuyer" },
    { name: 'nya', fr: 'nya', desc: 'Nya~', frDesc: 'Faire nya~' },
    {
        name: 'pat',
        fr: 'pat',
        desc: 'Pat someone',
        frDesc: "Faire des pat-pats à quelqu'un",
    },
    { name: 'angry', fr: 'colere', desc: 'Be angry', frDesc: 'Être en colère' },
    {
        name: 'kiss',
        fr: 'bisou',
        desc: 'Kiss someone',
        frDesc: 'Faire un bisou',
    },
    {
        name: 'handshake',
        fr: 'poigneemain',
        desc: 'Shake hands',
        frDesc: 'Serrer la main',
    },
    { name: 'cry', fr: 'pleurer', desc: 'Cry', frDesc: 'Pleurer' },
    {
        name: 'lappillow',
        fr: 'genoux',
        desc: 'Give a lap pillow',
        frDesc: 'Prêter ses genoux',
    },
    {
        name: 'blowkiss',
        fr: 'bisouvolant',
        desc: 'Blow a kiss',
        frDesc: 'Envoyer un bisou volant',
    },
    {
        name: 'waifu',
        fr: 'waifu',
        desc: 'Claim as waifu',
        frDesc: 'Réclamer comme waifu',
    },
    { name: 'laugh', fr: 'rigoler', desc: 'Laugh', frDesc: 'Rigoler' },
    {
        name: 'thumbsup',
        fr: 'pouce',
        desc: 'Give a thumbs up',
        frDesc: 'Lever le pouce',
    },
    {
        name: 'shake',
        fr: 'secouer',
        desc: 'Shake someone',
        frDesc: "Secouer quelqu'un",
    },
    { name: 'yawn', fr: 'bailler', desc: 'Yawn', frDesc: 'Bailler' },
];

interface GifData {
    url: string;
    animeName?: string;
}

const FALLBACK_GIFS = [
    'https://media.tenor.com/kCZjTqCKiggAAAAC/hug.gif',
    'https://media.tenor.com/qF7mO4nnL0sAAAAC/anya-forger-spy-x-family.gif',
];

async function getGif(type: string): Promise<GifData> {
    try {
        const res = await fetch(`https://nekos.best/api/v2/${type}`);
        if (res.ok) {
            const data = (await res.json()) as any;
            if (data?.results?.[0]?.url) {
                return {
                    url: data.results[0].url,
                    animeName: data.results[0].anime_name,
                };
            }
        }
    } catch (e) {
        // Fallback below
    }
    return {
        url: FALLBACK_GIFS[
            Math.floor(Math.random() * FALLBACK_GIFS.length)
        ] as string,
    };
}

const builder = new SlashCommandBuilder()
    .setName('interact')
    .setDescription('Interact with other users')
    .setNameLocalizations({ fr: 'interagir' })
    .setDescriptionLocalizations({
        fr: "Interagir avec d'autres utilisateurs",
    });

ACTIONS.forEach((act) => {
    builder.addSubcommand((sub) =>
        sub
            .setName(act.name)
            .setDescription(act.desc)
            .setNameLocalizations({ fr: act.fr })
            .setDescriptionLocalizations({ fr: act.frDesc })
            .addUserOption((option) =>
                option
                    .setName('target')
                    .setDescription('The target user (optional)')
                    .setNameLocalizations({ fr: 'cible' })
                    .setDescriptionLocalizations({
                        fr: "L'utilisateur cible (optionnel)",
                    })
                    .setRequired(false)
            )
    );
});

const command: Command = {
    data: builder,
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            const subcommand = interaction.options.getSubcommand();
            const guildId = interaction.guildId ?? 'dm';
            const target = interaction.options.getUser('target', false);

            let deferred = false;
            let deferAttempts = 0;
            while (deferAttempts < 3 && !deferred) {
                try {
                    await interaction.deferReply();
                    deferred = true;
                } catch (e: any) {
                    if (e.code === 10062) {
                        deferAttempts++;
                        await new Promise((resolve) =>
                            setTimeout(resolve, 250)
                        );
                    } else if (e.code === 40060) {
                        deferred = true;
                    } else {
                        throw e;
                    }
                }
            }

            if (!deferred) {
                return;
            }

            if (target && target.id === interaction.user.id) {
                const embed = EmbedUtils.error(
                    I18nService.translate('fun:INTERACT_SELF_ERROR', {
                        lng: lang,
                    }),
                    I18nService.translate('common:EMBED_TITLE_ERROR', {
                        lng: lang,
                    }),
                    interaction.user
                );
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            if (target && target.bot) {
                const embed = EmbedUtils.error(
                    I18nService.translate('fun:INTERACT_BOT_ERROR', {
                        lng: lang,
                    }),
                    I18nService.translate('common:EMBED_TITLE_ERROR', {
                        lng: lang,
                    }),
                    interaction.user
                );
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const gifData = await getGif(subcommand);
            const up = subcommand.toUpperCase();

            let msgKey = target ? `INTERACT_${up}_TARGET` : `INTERACT_${up}`;
            let btnKey = `INTERACT_BTN_${up}`;

            let text = I18nService.translate(`fun:${msgKey}`, {
                lng: lang,
                user: interaction.user.displayName,
                target: target?.displayName || '',
            });

            if (target) {
                const count = await incrementInteraction(
                    target.id,
                    guildId,
                    subcommand
                );
                const statText = I18nService.translate('fun:INTERACT_STATS', {
                    lng: lang,
                    target: target.displayName,
                    count,
                    action: subcommand,
                });
                text += `\n${statText}`;
            }

            if (gifData.animeName) {
                text += `\n-# Anime: ${gifData.animeName}`;
            }

            const embed = EmbedUtils.base({
                user: interaction.user,
            })
                .setDescription(text)
                .setImage(gifData.url);

            const components: ActionRowBuilder<ButtonBuilder>[] = [];
            if (target) {
                components.push(
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`interact_${subcommand}`)
                            .setLabel(
                                I18nService.translate(`fun:${btnKey}`, {
                                    lng: lang,
                                })
                            )
                            .setStyle(ButtonStyle.Secondary)
                    )
                );
            }

            const response = await interaction.editReply({
                embeds: [embed],
                components,
            });

            if (!target) return; // No target = no button = no collector needed

            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 600000, // 10 minutes to interact back
            });

            collector.on('collect', async (i) => {
                if (i.user.id !== target.id) {
                    await i.reply({
                        content: I18nService.translate(
                            'fun:INTERACT_BTN_NOT_TARGET',
                            { lng: lang }
                        ),
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }

                await i.deferUpdate();

                const newGifData = await getGif(subcommand);

                let newText = I18nService.translate(`fun:INTERACT_${up}_BACK`, {
                    lng: lang,
                    user: target.displayName,
                    target: interaction.user.displayName,
                });

                const backCount = await incrementInteraction(
                    interaction.user.id,
                    guildId,
                    subcommand
                );
                const backStatText = I18nService.translate(
                    'fun:INTERACT_STATS',
                    {
                        lng: lang,
                        target: interaction.user.displayName,
                        count: backCount,
                        action: subcommand,
                    }
                );
                newText += `\n${backStatText}`;

                if (newGifData.animeName) {
                    newText += `\n-# Anime: ${newGifData.animeName}`;
                }

                const newEmbed = EmbedUtils.base({
                    user: i.user, // Now the target is the user
                })
                    .setDescription(newText)
                    .setImage(newGifData.url);

                await i.editReply({
                    embeds: [newEmbed],
                    components: [], // Remove button once clicked
                });
                collector.stop();
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    await interaction
                        .editReply({ components: [] })
                        .catch(() => null);
                }
            });
        }
    ),
};

export default command;
