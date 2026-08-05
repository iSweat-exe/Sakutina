import { createCommandHandler } from '@/utils/index.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
    type ButtonInteraction,
    type User,
} from 'discord.js';
import type { Command } from '@/types/Command.js';
import type { Stock, StockPriceHistoryRow } from '@sakutina/db';
import { I18nService } from '@/services/I18nService.js';
import { InvestmentService } from '@/services/InvestmentService.js';
import { EmbedUtils, EmbedColors } from '@/utils/EmbedUtils.js';
import {
    AppError,
    InvestError,
    InsufficientFundsError,
} from '@/utils/errors.js';
import { logger } from '@/utils/logger.js';
import { STOCK_LIST } from '../stocks.js';
import { buildStockChartUrl } from '../chart.js';

const CHART_REFRESH_MS = 15_000;
const CHART_REFRESH_COUNT = 20; // 20 * 15s = 5 minutes
const BUY_TIERS = [1, 5, 10];
const MARKET_PAGE_SIZE = 5;

function clampPage(page: number, totalPages: number): number {
    return Math.min(Math.max(0, page), totalPages - 1);
}

/**
 * Tracks which ticker a live `/invest chart` message is currently showing,
 * keyed by message id. The refresh interval (closed over the ticker the
 * command was originally run with) consults this map on every tick so the
 * "Next Company" button — driven by a *different* interaction — can redirect
 * an already-running live view without racing it.
 */
const activeChartState = new Map<string, { ticker: string }>();

function trendMarker(price: number, previousPrice: number): string {
    if (price > previousPrice) return '+';
    if (price < previousPrice) return '-';
    return '/';
}

function buildChartEmbed(
    stock: Stock,
    history: StockPriceHistoryRow[],
    lang: string,
    user: User,
    footerText: string
) {
    const prices = [...history.map((h) => h.price), stock.price];
    const open = prices[0] ?? stock.price;
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const change = stock.price - open;
    const changePct = open !== 0 ? (change / open) * 100 : 0;
    const sign = change > 0 ? '+' : '';
    const marker = trendMarker(stock.price, open);
    const color =
        change > 0
            ? EmbedColors.Success
            : change < 0
              ? EmbedColors.Error
              : EmbedColors.Info;

    const title = I18nService.translate('economy:INVEST_CHART_TITLE', {
        lng: lang,
        ticker: stock.ticker,
        name: stock.name,
    });
    const sinceOpen = I18nService.translate('economy:INVEST_CHART_SINCE_OPEN', {
        lng: lang,
    });
    const priceLine = `${marker} ${stock.price}  (${sign}${change} · ${sign}${changePct.toFixed(2)}%) ${sinceOpen}`;

    return EmbedUtils.base({ title, color, user })
        .setDescription('```diff\n' + priceLine + '\n```')
        .addFields(
            {
                name: I18nService.translate('economy:INVEST_CHART_FIELD_OPEN', {
                    lng: lang,
                }),
                value: `${open}`,
                inline: true,
            },
            {
                name: I18nService.translate('economy:INVEST_CHART_FIELD_HIGH', {
                    lng: lang,
                }),
                value: `${high}`,
                inline: true,
            },
            {
                name: I18nService.translate('economy:INVEST_CHART_FIELD_LOW', {
                    lng: lang,
                }),
                value: `${low}`,
                inline: true,
            }
        )
        .setImage(buildStockChartUrl(stock.ticker, history, stock.price))
        .setFooter({ text: footerText });
}

function buildMarketEmbed(
    allStocks: Stock[],
    lang: string,
    user: User,
    page: number,
    totalPages: number
) {
    const pageStocks = allStocks.slice(
        page * MARKET_PAGE_SIZE,
        page * MARKET_PAGE_SIZE + MARKET_PAGE_SIZE
    );
    const title = I18nService.translate('economy:INVEST_MARKET_TITLE', {
        lng: lang,
    });
    const rows = pageStocks.map((s) => {
        const marker = trendMarker(s.price, s.previousPrice);
        const row = I18nService.translate('economy:INVEST_MARKET_ROW', {
            lng: lang,
            ticker: s.ticker,
            name: s.name,
            price: s.price,
        });
        return `${marker} ${row}`;
    });
    const footer = I18nService.translate('economy:INVEST_MARKET_PAGE_FOOTER', {
        lng: lang,
        page: page + 1,
        total: totalPages,
    });

    return EmbedUtils.base({
        title,
        description: '```diff\n' + rows.join('\n') + '\n```',
        color: EmbedColors.Info,
        user,
    }).setFooter({ text: footer });
}

function buildMarketComponents(
    page: number,
    totalPages: number,
    lang: string
): ActionRowBuilder<ButtonBuilder>[] {
    const prevButton = new ButtonBuilder()
        .setCustomId(`invest:marketpage:${Math.max(0, page - 1)}`)
        .setLabel(
            I18nService.translate('economy:INVEST_MARKET_BTN_PREV', {
                lng: lang,
            })
        )
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 0);
    const nextButton = new ButtonBuilder()
        .setCustomId(`invest:marketpage:${Math.min(totalPages - 1, page + 1)}`)
        .setLabel(
            I18nService.translate('economy:INVEST_MARKET_BTN_NEXT', {
                lng: lang,
            })
        )
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1);

    return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            prevButton,
            nextButton
        ),
    ];
}

function buildChartComponents(
    ticker: string,
    lang: string,
    disabled = false
): ActionRowBuilder<ButtonBuilder>[] {
    const buyButtons = BUY_TIERS.map((qty) =>
        new ButtonBuilder()
            .setCustomId(`invest:buy:${ticker}:${qty}`)
            .setLabel(
                I18nService.translate('economy:INVEST_CHART_BTN_BUY', {
                    lng: lang,
                    qty,
                })
            )
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled)
    );
    const sellAllButton = new ButtonBuilder()
        .setCustomId(`invest:sellall:${ticker}`)
        .setLabel(
            I18nService.translate('economy:INVEST_CHART_BTN_SELL_ALL', {
                lng: lang,
            })
        )
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled);
    const nextButton = new ButtonBuilder()
        .setCustomId(`invest:next:${ticker}`)
        .setLabel(
            I18nService.translate('economy:INVEST_CHART_BTN_NEXT', {
                lng: lang,
            })
        )
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled);

    return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(...buyButtons),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            sellAllButton,
            nextButton
        ),
    ];
}

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('invest')
        .setDescription('Trade fictional stocks with your coins')
        .setDescriptionLocalizations({
            fr: 'Échanger des actions fictives avec vos pièces',
        })
        .addSubcommand((sub) =>
            sub
                .setName('market')
                .setDescription('View the current stock market')
                .setDescriptionLocalizations({
                    fr: 'Voir le marché boursier actuel',
                })
        )
        .addSubcommand((sub) =>
            sub
                .setName('buy')
                .setDescription('Buy shares of a stock')
                .setDescriptionLocalizations({
                    fr: "Acheter des actions d'une entreprise",
                })
                .addStringOption((option) =>
                    option
                        .setName('ticker')
                        .setDescription('The stock ticker')
                        .setDescriptionLocalizations({
                            fr: "Le symbole de l'action",
                        })
                        .setRequired(true)
                        .addChoices(
                            STOCK_LIST.map((s) => ({
                                name: `${s.ticker} — ${s.name}`,
                                value: s.ticker,
                            }))
                        )
                )
                .addIntegerOption((option) =>
                    option
                        .setName('quantity')
                        .setDescription('Number of shares to buy')
                        .setDescriptionLocalizations({
                            fr: "Nombre d'actions à acheter",
                        })
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('sell')
                .setDescription('Sell shares of a stock')
                .setDescriptionLocalizations({
                    fr: "Vendre des actions d'une entreprise",
                })
                .addStringOption((option) =>
                    option
                        .setName('ticker')
                        .setDescription('The stock ticker')
                        .setDescriptionLocalizations({
                            fr: "Le symbole de l'action",
                        })
                        .setRequired(true)
                        .addChoices(
                            STOCK_LIST.map((s) => ({
                                name: `${s.ticker} — ${s.name}`,
                                value: s.ticker,
                            }))
                        )
                )
                .addIntegerOption((option) =>
                    option
                        .setName('quantity')
                        .setDescription('Number of shares to sell')
                        .setDescriptionLocalizations({
                            fr: "Nombre d'actions à vendre",
                        })
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('portfolio')
                .setDescription('View your stock portfolio')
                .setDescriptionLocalizations({
                    fr: 'Voir votre portefeuille boursier',
                })
        )
        .addSubcommand((sub) =>
            sub
                .setName('chart')
                .setDescription('View a live-updating price chart for a stock')
                .setDescriptionLocalizations({
                    fr: "Voir un graphique du prix d'une action en temps réel",
                })
                .addStringOption((option) =>
                    option
                        .setName('ticker')
                        .setDescription('The stock ticker')
                        .setDescriptionLocalizations({
                            fr: "Le symbole de l'action",
                        })
                        .setRequired(true)
                        .addChoices(
                            STOCK_LIST.map((s) => ({
                                name: `${s.ticker} — ${s.name}`,
                                value: s.ticker,
                            }))
                        )
                )
        ),
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            const guildId = interaction.guildId ?? 'dm';
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'market') {
                const allStocks = await InvestmentService.getAllStocks();
                const totalPages = Math.max(
                    1,
                    Math.ceil(allStocks.length / MARKET_PAGE_SIZE)
                );
                const embed = buildMarketEmbed(
                    allStocks,
                    lang,
                    interaction.user,
                    0,
                    totalPages
                );
                const components = buildMarketComponents(0, totalPages, lang);
                await interaction.reply({ embeds: [embed], components });
                return;
            }

            if (subcommand === 'buy') {
                const ticker = interaction.options.getString('ticker', true);
                const quantity = interaction.options.getInteger(
                    'quantity',
                    true
                );
                try {
                    const result = await InvestmentService.buy(
                        interaction.user.id,
                        guildId,
                        ticker,
                        quantity
                    );
                    const msg = I18nService.translate(
                        'economy:INVEST_BUY_SUCCESS',
                        {
                            lng: lang,
                            quantity,
                            ticker,
                            cost: result.cost,
                            avgPrice: result.avgBuyPrice,
                        }
                    );
                    await interaction.reply({
                        embeds: [
                            EmbedUtils.success(msg, 'Invest', interaction.user),
                        ],
                    });
                } catch (error) {
                    await replyInvestError(interaction, error, lang);
                }
                return;
            }

            if (subcommand === 'sell') {
                const ticker = interaction.options.getString('ticker', true);
                const quantity = interaction.options.getInteger(
                    'quantity',
                    true
                );
                try {
                    const result = await InvestmentService.sell(
                        interaction.user.id,
                        guildId,
                        ticker,
                        quantity
                    );
                    const msg = I18nService.translate(
                        'economy:INVEST_SELL_SUCCESS',
                        {
                            lng: lang,
                            quantity,
                            ticker,
                            proceeds: result.proceeds,
                        }
                    );
                    await interaction.reply({
                        embeds: [
                            EmbedUtils.success(msg, 'Invest', interaction.user),
                        ],
                    });
                } catch (error) {
                    await replyInvestError(interaction, error, lang);
                }
                return;
            }

            if (subcommand === 'portfolio') {
                const portfolio = await InvestmentService.getPortfolio(
                    interaction.user.id,
                    guildId
                );
                const title = I18nService.translate(
                    'economy:INVEST_PORTFOLIO_TITLE',
                    { lng: lang, user: interaction.user.username }
                );
                if (portfolio.length === 0) {
                    const embed = EmbedUtils.info(
                        I18nService.translate(
                            'economy:INVEST_PORTFOLIO_EMPTY',
                            { lng: lang }
                        ),
                        title,
                        interaction.user
                    );
                    await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }
                let total = 0;
                const rows = portfolio.map((h) => {
                    total += h.currentValue;
                    const marker = trendMarker(h.profitLoss, 0);
                    const pl =
                        h.profitLoss >= 0
                            ? `+${h.profitLoss} `
                            : `${h.profitLoss} `;
                    const row = I18nService.translate(
                        'economy:INVEST_PORTFOLIO_ROW',
                        {
                            lng: lang,
                            ticker: h.ticker,
                            quantity: h.quantity,
                            avgPrice: h.avgBuyPrice,
                            price: h.currentPrice,
                            pl,
                        }
                    );
                    return `${marker} ${row}`;
                });
                const totalLine = I18nService.translate(
                    'economy:INVEST_PORTFOLIO_TOTAL',
                    { lng: lang, total }
                );
                const embed = EmbedUtils.base({
                    title,
                    description:
                        '```diff\n' + rows.join('\n') + '\n```\n' + totalLine,
                    color: EmbedColors.Info,
                    user: interaction.user,
                });
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            if (subcommand === 'chart') {
                const ticker = interaction.options.getString('ticker', true);
                try {
                    const stock = await InvestmentService.getStock(ticker);
                    const history =
                        await InvestmentService.getPriceHistory(ticker);
                    const footer = I18nService.translate(
                        'economy:INVEST_CHART_FOOTER',
                        { lng: lang }
                    );

                    const embed = buildChartEmbed(
                        stock,
                        history,
                        lang,
                        interaction.user,
                        footer
                    );
                    const components = buildChartComponents(ticker, lang);

                    await interaction.reply({ embeds: [embed], components });
                    const message = await interaction.fetchReply();
                    activeChartState.set(message.id, { ticker });

                    let ticks = 0;
                    const interval = setInterval(() => {
                        void (async () => {
                            const currentTicker =
                                activeChartState.get(message.id)?.ticker ??
                                ticker;
                            ticks++;
                            const isLast = ticks >= CHART_REFRESH_COUNT;
                            if (isLast) {
                                clearInterval(interval);
                                activeChartState.delete(message.id);
                            }
                            try {
                                const freshStock =
                                    await InvestmentService.getStock(
                                        currentTicker
                                    );
                                const freshHistory =
                                    await InvestmentService.getPriceHistory(
                                        currentTicker
                                    );
                                const refreshedEmbed = buildChartEmbed(
                                    freshStock,
                                    freshHistory,
                                    lang,
                                    interaction.user,
                                    isLast
                                        ? I18nService.translate(
                                              'economy:INVEST_CHART_EXPIRED_FOOTER',
                                              { lng: lang }
                                          )
                                        : footer
                                );
                                const refreshedComponents =
                                    buildChartComponents(
                                        currentTicker,
                                        lang,
                                        isLast
                                    );
                                await interaction.editReply({
                                    embeds: [refreshedEmbed],
                                    components: refreshedComponents,
                                });
                            } catch (err) {
                                // Swallow per-tick errors (e.g. stale/deleted message) — the
                                // handler's promise already resolved, nothing to propagate to.
                                logger.error(
                                    '[invest chart] Failed to refresh chart',
                                    err
                                );
                            }
                        })();
                    }, CHART_REFRESH_MS);
                } catch (error) {
                    await replyInvestError(interaction, error, lang);
                }
            }
        }
    ),
};

async function replyInvestError(
    interaction: ChatInputCommandInteraction,
    error: unknown,
    lang: string
) {
    // commandHandler.ts's generic AppError fallback only checks the
    // 'common' namespace, so InvestError must be translated manually here.
    let msg: string;
    if (error instanceof InsufficientFundsError) {
        msg = I18nService.translate('economy:INSUFFICIENT_FUNDS', {
            lng: lang,
        });
    } else if (error instanceof InvestError) {
        msg = I18nService.translate(`economy:${error.code}`, {
            lng: lang,
            ...error.meta,
        });
    } else {
        msg = I18nService.translate('common:ERROR_GENERIC', { lng: lang });
        logger.error('[invest] Unexpected error:', error);
    }
    const embed = EmbedUtils.error(msg, 'Error', interaction.user);
    const replied = interaction.replied || interaction.deferred;
    if (replied) {
        await interaction.editReply({ embeds: [embed] });
    } else {
        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    }
}

/**
 * Handles `invest:buy:<ticker>:<qty>`, `invest:sellall:<ticker>` and
 * `invest:next:<ticker>` button clicks from a live `/invest chart` message.
 * Routed here from interactionCreate.ts.
 */
export async function handleInvestButton(
    interaction: ButtonInteraction,
    lang: string
) {
    const [, action, ticker, rawQty] = interaction.customId.split(':');
    if (!ticker) return;
    const guildId = interaction.guildId ?? 'dm';

    try {
        if (action === 'marketpage') {
            const allStocks = await InvestmentService.getAllStocks();
            const totalPages = Math.max(
                1,
                Math.ceil(allStocks.length / MARKET_PAGE_SIZE)
            );
            const page = clampPage(Number(ticker), totalPages);
            const embed = buildMarketEmbed(
                allStocks,
                lang,
                interaction.user,
                page,
                totalPages
            );
            const components = buildMarketComponents(page, totalPages, lang);
            await interaction.update({ embeds: [embed], components });
            return;
        }

        if (action === 'buy') {
            const quantity = Number(rawQty);
            const result = await InvestmentService.buy(
                interaction.user.id,
                guildId,
                ticker,
                quantity
            );
            const msg = I18nService.translate('economy:INVEST_BUY_SUCCESS', {
                lng: lang,
                quantity,
                ticker,
                cost: result.cost,
                avgPrice: result.avgBuyPrice,
            });
            await interaction.reply({
                content: msg,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (action === 'sellall') {
            const result = await InvestmentService.sellAll(
                interaction.user.id,
                guildId,
                ticker
            );
            const msg = I18nService.translate('economy:INVEST_SELL_SUCCESS', {
                lng: lang,
                quantity: result.quantity,
                ticker,
                proceeds: result.proceeds,
            });
            await interaction.reply({
                content: msg,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (action === 'next') {
            const currentIndex = STOCK_LIST.findIndex(
                (s) => s.ticker === ticker
            );
            const nextIndex =
                (currentIndex + 1 + STOCK_LIST.length) % STOCK_LIST.length;
            const nextTicker = STOCK_LIST[nextIndex]!.ticker;

            const stock = await InvestmentService.getStock(nextTicker);
            const history = await InvestmentService.getPriceHistory(nextTicker);
            const footer = I18nService.translate(
                'economy:INVEST_CHART_FOOTER',
                { lng: lang }
            );
            const embed = buildChartEmbed(
                stock,
                history,
                lang,
                interaction.user,
                footer
            );
            const components = buildChartComponents(nextTicker, lang);

            await interaction.update({ embeds: [embed], components });
            if (interaction.message) {
                activeChartState.set(interaction.message.id, {
                    ticker: nextTicker,
                });
            }
            return;
        }
    } catch (error) {
        // commandHandler.ts's generic AppError fallback only checks the
        // 'common' namespace, so errors must be translated manually here.
        const msg =
            error instanceof AppError
                ? I18nService.translate(`economy:${error.code}`, {
                      lng: lang,
                      ...error.meta,
                  })
                : I18nService.translate('common:ERROR_GENERIC', { lng: lang });
        await interaction
            .reply({ content: msg, flags: MessageFlags.Ephemeral })
            .catch(() => null);
        if (!(error instanceof AppError)) {
            logger.error('[Button:invest] Unexpected error:', error);
        }
    }
}

export default command;
