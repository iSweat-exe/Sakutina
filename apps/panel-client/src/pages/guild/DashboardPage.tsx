import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DiscordAvatar } from '@/components/DiscordAvatar';
import { api } from '@/lib/api';
import { getUserAvatarUrl } from '@/lib/discord';

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

function toErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
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

export function DashboardPage() {
    const { guildId } = useParams();
    const [overview, setOverview] = React.useState<Overview | null>(null);
    const [activity, setActivity] = React.useState<ActivityOverview | null>(
        null
    );
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!guildId) return;
        api.get<Overview>(`/api/guilds/${guildId}/dashboard/overview`)
            .then(setOverview)
            .catch((err: unknown) => setError(toErrorMessage(err)));
        api.get<ActivityOverview>(`/api/guilds/${guildId}/activity/overview`)
            .then(setActivity)
            .catch((err: unknown) => setError(toErrorMessage(err)));
    }, [guildId]);

    if (error) return <p className="text-destructive">{error}</p>;

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
                Analyse d'activité
            </h2>

            {!activity ? (
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
        </div>
    );
}
