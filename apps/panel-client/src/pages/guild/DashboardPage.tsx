import * as React from 'react';
import { Link, useParams } from 'react-router';
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DiscordAvatar } from '@/components/DiscordAvatar';
import { api, ApiError, isAbortError } from '@/lib/api';
import { getUserAvatarUrl } from '@/lib/discord';
import { useToast } from '@/lib/toast-context';

interface OverviewMember {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
}

interface RecentAction {
    id: number;
    userId: string;
    actionType: string;
    reason: string;
    createdAt: string;
    member: OverviewMember | null;
}

interface TopUser {
    discordId: string;
    balance: number;
    member: OverviewMember | null;
}

interface Overview {
    memberCount: number | null;
    trackedUsers: number;
    warnCount: number;
    actionCount: number;
    interactionsTotal: number;
    recentActions: RecentAction[];
    topUsers: TopUser[];
}

interface ChannelActivityEntry {
    channelId: string;
    name: string;
    messageCount: number;
    lastMessageAt: string | null;
}

interface VoiceChannelEntry {
    channelId: string;
    name: string;
    totalSeconds: number;
    sessionCount: number;
    currentCount: number;
}

interface HourlyEntry {
    hour: number;
    messageCount: number;
}

interface ActivityOverview {
    channels: ChannelActivityEntry[];
    mostActiveChannel: ChannelActivityEntry | null;
    leastActiveChannel: ChannelActivityEntry | null;
    voiceChannels: VoiceChannelEntry[];
    mostActiveVoiceChannel: VoiceChannelEntry | null;
    totalVoiceSeconds: number;
    currentVoiceUsers: number;
    hourly: HourlyEntry[];
    peakHour: HourlyEntry | null;
    quietHour: HourlyEntry | null;
}

interface TransactionTypeVolume {
    type: string;
    volume: number;
}

interface SimulationCalibration {
    windowDays: number;
    sampleSize: number;
    activeDaysObserved: number;
    activeFraction: number;
    dailyClaimRate: number;
    avgWorkShiftsPerActiveDay: number;
    casinoParticipationRate: number;
    avgCasinoBetsPerActivePlayer: number;
    avgBetFraction: number;
    depositRate: number;
    robAttemptRate: number;
}

interface SimulationRun {
    params: { playerCount: number; days: number };
    reportHtml: string;
}

const SIMULATE_MIN_DAYS = 1;
const SIMULATE_MAX_DAYS = 180;
const SIMULATE_DEFAULT_DAYS = 30;

interface EconomyOverview {
    totalWallet: number;
    totalBank: number;
    totalPortfolioValue: number;
    totalWealth: number;
    avgWealth: number;
    transactionCount7d: number;
    totalEarned7d: number;
    totalSpent7d: number;
    transactionsByType: TransactionTypeVolume[];
}

const TRANSACTION_TYPE_LABEL: Record<string, string> = {
    daily: 'Récompense quotidienne',
    work: 'Travail',
    rob: 'Vol',
    robbed: 'Victime de vol',
    pay: 'Virement',
    casino: 'Casino',
    bank_deposit: 'Dépôt banque',
    bank_withdraw: 'Retrait banque',
    shop_purchase: 'Boutique',
    invest_buy: 'Achat actions',
    invest_sell: 'Vente actions',
};

function transactionTypeLabel(type: string): string {
    return TRANSACTION_TYPE_LABEL[type] ?? type;
}

function toErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function formatCoins(value: number): string {
    return `${new Intl.NumberFormat('fr-FR').format(value)} 🪙`;
}

function formatVoiceDuration(totalSeconds: number): string {
    const s = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function formatHour(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00 UTC`;
}

function formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
}

function formatDecimal(value: number): string {
    return value.toFixed(2);
}

/**
 * Each entry maps a card to the matching field in
 * packages/economy/src/simulation/params.ts's SimulationParams, so the
 * measured value can be dropped straight into a --json override for
 * `bun run economy:simulate`.
 */
const SIMULATION_STAT_FIELDS: {
    key: keyof SimulationCalibration;
    paramKey: string;
    label: string;
    format: (value: number) => string;
}[] = [
    {
        key: 'activeFraction',
        paramKey: 'activeFraction',
        label: 'Fraction active',
        format: formatPercent,
    },
    {
        key: 'dailyClaimRate',
        paramKey: 'dailyClaimRate',
        label: 'Taux de récompense quotidienne',
        format: formatPercent,
    },
    {
        key: 'avgWorkShiftsPerActiveDay',
        paramKey: 'avgWorkShiftsPerActiveDay',
        label: 'Postes de travail / jour actif',
        format: formatDecimal,
    },
    {
        key: 'casinoParticipationRate',
        paramKey: 'casinoParticipationRate',
        label: 'Participation au casino',
        format: formatPercent,
    },
    {
        key: 'avgCasinoBetsPerActivePlayer',
        paramKey: 'avgCasinoBetsPerActivePlayer',
        label: 'Paris casino / joueur actif',
        format: formatDecimal,
    },
    {
        key: 'avgBetFraction',
        paramKey: 'avgBetFraction',
        label: 'Fraction moyenne misée',
        format: formatPercent,
    },
    {
        key: 'depositRate',
        paramKey: 'depositRate',
        label: 'Taux de dépôt en banque',
        format: formatPercent,
    },
    {
        key: 'robAttemptRate',
        paramKey: 'robAttemptRate',
        label: 'Taux de tentative de vol',
        format: formatPercent,
    },
];

export function DashboardPage() {
    const { guildId } = useParams();
    const toast = useToast();
    const [overview, setOverview] = React.useState<Overview | null>(null);
    const [activity, setActivity] = React.useState<ActivityOverview | null>(
        null
    );
    const [economy, setEconomy] = React.useState<EconomyOverview | null>(null);
    const [simParams, setSimParams] =
        React.useState<SimulationCalibration | null>(null);
    const [overviewError, setOverviewError] = React.useState<string | null>(
        null
    );
    const [activityError, setActivityError] = React.useState<string | null>(
        null
    );
    const [economyError, setEconomyError] = React.useState<string | null>(null);
    const [simParamsError, setSimParamsError] = React.useState<string | null>(
        null
    );
    const [simDays, setSimDays] = React.useState(SIMULATE_DEFAULT_DAYS);
    const [simRun, setSimRun] = React.useState<SimulationRun | null>(null);
    const [simRunning, setSimRunning] = React.useState(false);

    React.useEffect(() => {
        if (!guildId) return;
        const controller = new AbortController();
        const { signal } = controller;
        api.get<Overview>(`/api/guilds/${guildId}/dashboard/overview`, {
            signal,
        })
            .then(setOverview)
            .catch((err: unknown) => {
                if (isAbortError(err)) return;
                setOverviewError(toErrorMessage(err));
            });
        api.get<ActivityOverview>(`/api/guilds/${guildId}/activity/overview`, {
            signal,
        })
            .then(setActivity)
            .catch((err: unknown) => {
                if (isAbortError(err)) return;
                setActivityError(toErrorMessage(err));
            });
        api.get<EconomyOverview>(`/api/guilds/${guildId}/dashboard/economy`, {
            signal,
        })
            .then(setEconomy)
            .catch((err: unknown) => {
                if (isAbortError(err)) return;
                setEconomyError(toErrorMessage(err));
            });
        api.get<SimulationCalibration>(
            `/api/guilds/${guildId}/dashboard/simulation-params`,
            { signal }
        )
            .then(setSimParams)
            .catch((err: unknown) => {
                if (isAbortError(err)) return;
                setSimParamsError(toErrorMessage(err));
            });
        return () => controller.abort();
    }, [guildId]);

    function clampSimDays(value: number): number {
        if (!Number.isFinite(value)) return SIMULATE_MIN_DAYS;
        return Math.min(
            Math.max(Math.round(value), SIMULATE_MIN_DAYS),
            SIMULATE_MAX_DAYS
        );
    }

    async function copySimParamsJson() {
        if (!simParams) return;
        const overrides = Object.fromEntries(
            SIMULATION_STAT_FIELDS.map((field) => [
                field.paramKey,
                Math.round(simParams[field.key] * 1000) / 1000,
            ])
        );
        try {
            await navigator.clipboard.writeText(
                JSON.stringify(overrides, null, 4)
            );
            toast.success(
                'JSON copié — utilisable avec economy:simulate -- --json=<fichier>'
            );
        } catch {
            toast.error('Échec de la copie dans le presse-papiers');
        }
    }

    async function runSimulation() {
        if (!guildId) return;
        setSimRunning(true);
        try {
            const result = await api.post<SimulationRun>(
                `/api/guilds/${guildId}/dashboard/simulate`,
                { days: simDays }
            );
            setSimRun(result);
        } catch (err) {
            const message = err instanceof ApiError ? err.message : String(err);
            toast.error(message);
        } finally {
            setSimRunning(false);
        }
    }

    if (overviewError)
        return <p className="text-destructive">{overviewError}</p>;

    if (!overview) {
        return (
            <div>
                <h1 className="mb-6 text-2xl font-semibold">Vue d'ensemble</h1>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                    ))}
                </div>
            </div>
        );
    }

    const stats = [
        { label: 'Membres', value: overview.memberCount ?? '—' },
        { label: 'Utilisateurs suivis', value: overview.trackedUsers },
        { label: 'Avertissements', value: overview.warnCount },
        { label: 'Actions de modération', value: overview.actionCount },
        { label: 'Interactions totales', value: overview.interactionsTotal },
    ];

    return (
        <div>
            <h1 className="mb-6 text-2xl font-semibold">Vue d'ensemble</h1>

            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
                {stats.map((stat) => (
                    <Card key={stat.label}>
                        <CardHeader>
                            <CardDescription>{stat.label}</CardDescription>
                            <CardTitle className="text-3xl">
                                {stat.value}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Activité récente</CardTitle>
                        <CardDescription>
                            Dernières actions de modération
                        </CardDescription>
                    </CardHeader>
                    <div className="px-6 pb-6">
                        {overview.recentActions.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                                Aucune action récente.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {overview.recentActions.map((action) => (
                                    <div
                                        key={action.id}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <DiscordAvatar
                                            src={
                                                action.member?.avatarUrl ??
                                                getUserAvatarUrl(
                                                    action.userId,
                                                    null,
                                                    28
                                                )
                                            }
                                            alt={
                                                action.member?.displayName ??
                                                action.userId
                                            }
                                            size={24}
                                        />
                                        <span className="truncate font-medium">
                                            {action.member?.displayName ??
                                                action.userId}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className="shrink-0"
                                        >
                                            {action.actionType}
                                        </Badge>
                                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                                            {new Date(
                                                action.createdAt
                                            ).toLocaleDateString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Link
                            to={`/g/${guildId}/moderation`}
                            className="mt-4 inline-block text-xs text-primary hover:underline"
                        >
                            Voir tout l'historique →
                        </Link>
                    </div>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Top membres</CardTitle>
                        <CardDescription>
                            Les plus riches du serveur
                        </CardDescription>
                    </CardHeader>
                    <div className="px-6 pb-6">
                        {overview.topUsers.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                                Pas encore de données économiques.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {overview.topUsers.map((u, i) => (
                                    <div
                                        key={u.discordId}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <span className="w-4 text-muted-foreground">
                                            {i + 1}
                                        </span>
                                        <DiscordAvatar
                                            src={
                                                u.member?.avatarUrl ??
                                                getUserAvatarUrl(
                                                    u.discordId,
                                                    null,
                                                    28
                                                )
                                            }
                                            alt={
                                                u.member?.displayName ??
                                                u.discordId
                                            }
                                            size={24}
                                        />
                                        <span className="truncate font-medium">
                                            {u.member?.displayName ??
                                                u.discordId}
                                        </span>
                                        <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                                            {u.balance}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Link
                            to={`/g/${guildId}/economy`}
                            className="mt-4 inline-block text-xs text-primary hover:underline"
                        >
                            Voir le classement complet →
                        </Link>
                    </div>
                </Card>
            </div>

            <h2 className="mt-8 mb-4 text-xl font-semibold">
                Économie du serveur
            </h2>

            {economyError ? (
                <p className="text-destructive">{economyError}</p>
            ) : !economy ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                    ))}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader>
                                <CardDescription>
                                    Masse monétaire totale
                                </CardDescription>
                                <CardTitle className="text-2xl">
                                    {formatCoins(
                                        economy.totalWallet + economy.totalBank
                                    )}
                                </CardTitle>
                                <p className="text-muted-foreground text-xs">
                                    dont {formatCoins(economy.totalBank)} en
                                    banque
                                </p>
                            </CardHeader>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardDescription>
                                    Valeur du portefeuille boursier
                                </CardDescription>
                                <CardTitle className="text-2xl">
                                    {formatCoins(economy.totalPortfolioValue)}
                                </CardTitle>
                            </CardHeader>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardDescription>
                                    Richesse moyenne / membre
                                </CardDescription>
                                <CardTitle className="text-2xl">
                                    {formatCoins(economy.avgWealth)}
                                </CardTitle>
                            </CardHeader>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardDescription>
                                    Transactions (7 derniers jours)
                                </CardDescription>
                                <CardTitle className="text-2xl">
                                    {economy.transactionCount7d}
                                </CardTitle>
                                <p className="text-xs">
                                    <span className="text-emerald-500">
                                        +{formatCoins(economy.totalEarned7d)}
                                    </span>{' '}
                                    <span className="text-destructive">
                                        −{formatCoins(economy.totalSpent7d)}
                                    </span>
                                </p>
                            </CardHeader>
                        </Card>
                    </div>

                    {economy.transactionsByType.length > 0 && (
                        <Card className="mt-4">
                            <CardHeader>
                                <CardTitle>
                                    Volume par type de transaction
                                </CardTitle>
                                <CardDescription>
                                    Sur les 7 derniers jours
                                </CardDescription>
                            </CardHeader>
                            <div className="space-y-3 px-6 pb-6">
                                {economy.transactionsByType.map((entry) => {
                                    const max =
                                        economy.transactionsByType[0]?.volume ||
                                        1;
                                    const pct = Math.max(
                                        4,
                                        Math.round((entry.volume / max) * 100)
                                    );
                                    return (
                                        <div key={entry.type}>
                                            <div className="mb-1 flex items-center justify-between text-sm">
                                                <span>
                                                    {transactionTypeLabel(
                                                        entry.type
                                                    )}
                                                </span>
                                                <span className="text-muted-foreground font-mono text-xs">
                                                    {formatCoins(entry.volume)}
                                                </span>
                                            </div>
                                            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                                                <div
                                                    className="bg-primary h-full rounded-full"
                                                    style={{
                                                        width: `${pct}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    )}
                </>
            )}

            <h2 className="mt-8 mb-4 text-xl font-semibold">
                Analyse d'activité
            </h2>

            {activityError ? (
                <p className="text-destructive">{activityError}</p>
            ) : !activity ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Salon le plus actif
                            </CardDescription>
                            <CardTitle className="text-lg">
                                {activity.mostActiveChannel
                                    ? `#${activity.mostActiveChannel.name}`
                                    : '—'}
                            </CardTitle>
                            {activity.mostActiveChannel && (
                                <p className="text-xs text-muted-foreground">
                                    {activity.mostActiveChannel.messageCount}{' '}
                                    messages
                                </p>
                            )}
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Salon le moins actif
                            </CardDescription>
                            <CardTitle className="text-lg">
                                {activity.leastActiveChannel
                                    ? `#${activity.leastActiveChannel.name}`
                                    : '—'}
                            </CardTitle>
                            {activity.leastActiveChannel && (
                                <p className="text-xs text-muted-foreground">
                                    {activity.leastActiveChannel.messageCount}{' '}
                                    messages
                                </p>
                            )}
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Actuellement en vocal
                            </CardDescription>
                            <CardTitle className="text-3xl">
                                {activity.currentVoiceUsers}
                            </CardTitle>
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Temps vocal total enregistré
                            </CardDescription>
                            <CardTitle className="text-lg">
                                {formatVoiceDuration(
                                    activity.totalVoiceSeconds
                                )}
                            </CardTitle>
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Salon vocal le plus actif
                            </CardDescription>
                            <CardTitle className="text-lg">
                                {activity.mostActiveVoiceChannel
                                    ? `#${activity.mostActiveVoiceChannel.name}`
                                    : '—'}
                            </CardTitle>
                            {activity.mostActiveVoiceChannel && (
                                <p className="text-xs text-muted-foreground">
                                    {formatVoiceDuration(
                                        activity.mostActiveVoiceChannel
                                            .totalSeconds
                                    )}
                                </p>
                            )}
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Heure d'activité (pic / calme)
                            </CardDescription>
                            <CardTitle className="text-lg">
                                {activity.peakHour
                                    ? formatHour(activity.peakHour.hour)
                                    : '—'}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                                {activity.quietHour
                                    ? `Le plus calme : ${formatHour(activity.quietHour.hour)}`
                                    : 'Pas encore assez de données'}
                            </p>
                        </CardHeader>
                    </Card>
                </div>
            )}

            <div className="mt-8 mb-4 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">
                        Calibration du modèle de simulation
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Comportement réel des joueurs, à comparer aux paramètres
                        par défaut du simulateur d'économie.
                    </p>
                </div>
                {simParams && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void copySimParamsJson()}
                    >
                        Copier le JSON
                    </Button>
                )}
            </div>

            {simParamsError ? (
                <p className="text-destructive">{simParamsError}</p>
            ) : !simParams ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                    ))}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        {SIMULATION_STAT_FIELDS.map((field) => (
                            <Card key={field.key}>
                                <CardHeader>
                                    <CardDescription>
                                        {field.label}
                                    </CardDescription>
                                    <CardTitle className="text-2xl">
                                        {field.format(simParams[field.key])}
                                    </CardTitle>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                        Calculé sur {simParams.windowDays} jours (
                        {simParams.sampleSize} transactions,{' '}
                        {simParams.activeDaysObserved} jour(s) avec activité).
                    </p>

                    <div className="mt-6 flex flex-wrap items-end gap-3">
                        <div>
                            <label
                                htmlFor="sim-days"
                                className="mb-1 block text-xs text-muted-foreground"
                            >
                                Jours à simuler
                            </label>
                            <Input
                                id="sim-days"
                                type="number"
                                min={SIMULATE_MIN_DAYS}
                                max={SIMULATE_MAX_DAYS}
                                value={simDays}
                                onChange={(e) =>
                                    setSimDays(
                                        clampSimDays(Number(e.target.value))
                                    )
                                }
                                className="w-28"
                            />
                        </div>
                        <Button
                            onClick={() => void runSimulation()}
                            disabled={simRunning}
                        >
                            {simRunning
                                ? 'Simulation en cours…'
                                : 'Lancer une simulation'}
                        </Button>
                    </div>

                    {simRun && (
                        <div className="mt-4">
                            <p className="mb-3 text-xs text-muted-foreground">
                                {simRun.params.days} jour(s) simulé(s) sur{' '}
                                {simRun.params.playerCount} joueurs, calibré sur
                                les statistiques réelles ci-dessus (valeurs par
                                défaut pour le reste).
                            </p>
                            <div
                                className="rounded-lg bg-muted p-4"
                                dangerouslySetInnerHTML={{
                                    __html: simRun.reportHtml,
                                }}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
