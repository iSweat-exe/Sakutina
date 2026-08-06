import * as React from 'react';
import { useParams } from 'react-router';
import { Sparkles, Briefcase, Dices, Heart, Wallet } from 'lucide-react';
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DiscordAvatar } from '@/components/DiscordAvatar';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { getUserAvatarUrl } from '@/lib/discord';

// Mirrors calculateLevel(xp) = floor(sqrt(xp / 10)) from @sakutina/economy,
// inverted to find the XP thresholds bounding the current level.
function levelProgress(experience: number, level: number) {
    const currentLevelXp = level * level * 10;
    const nextLevelXp = (level + 1) * (level + 1) * 10;
    const span = nextLevelXp - currentLevelXp || 1;
    const fraction = Math.min(
        1,
        Math.max(0, (experience - currentLevelXp) / span)
    );
    return {
        currentLevelXp,
        nextLevelXp,
        fraction,
    };
}

interface ProfileData {
    id: string;
    createdAt: string;
    experience: number;
    level: number;
    title: string | null;
    marriedTo: { id: string; displayName: string } | null;
    economy: { balance: number; bank: number; total: number };
    work: { jobTitle: string; shiftsDone: number; streak: number };
    casino: {
        gamesPlayed: number;
        wins: number;
        losses: number;
        winRate: number;
    };
    portfolioValue: number;
    netWorth: number;
}

export function ProfilePage() {
    const { guildId } = useParams();
    const { user } = useAuth();
    const [profile, setProfile] = React.useState<ProfileData | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!guildId) return;
        api.get<ProfileData>(`/api/guilds/${guildId}/profile`)
            .then(setProfile)
            .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : String(err))
            );
    }, [guildId]);

    if (error) {
        return <p className="text-sm text-destructive">{error}</p>;
    }

    const progress = profile
        ? levelProgress(profile.experience, profile.level)
        : null;

    return (
        <div className="mx-auto max-w-3xl">
            <Card className="mb-6 gap-0 overflow-hidden py-0">
                <div className="h-20 bg-gradient-to-r from-primary/25 via-primary/10 to-transparent" />
                <CardContent className="-mt-10 px-6 pb-5">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="flex items-end gap-4">
                            {user ? (
                                <DiscordAvatar
                                    src={getUserAvatarUrl(
                                        user.id,
                                        user.avatar,
                                        128
                                    )}
                                    alt={user.username}
                                    size={80}
                                    className="border-4 border-card shadow-md"
                                />
                            ) : (
                                <Skeleton className="size-20 rounded-full border-4 border-card" />
                            )}
                            <div className="pb-1">
                                <h1 className="text-2xl font-semibold">
                                    {user?.username ?? 'Profil'}
                                </h1>
                                {profile?.title ? (
                                    <p className="text-sm text-muted-foreground">
                                        {profile.title}
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Aucun titre équipé
                                    </p>
                                )}
                            </div>
                        </div>
                        {profile ? (
                            <Badge variant="secondary" className="gap-1">
                                <Sparkles className="size-3" />
                                Niveau {profile.level}
                            </Badge>
                        ) : (
                            <Skeleton className="h-6 w-24" />
                        )}
                    </div>

                    {profile && progress && (
                        <div className="mt-4">
                            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                                <span>Niveau {profile.level}</span>
                                <span>
                                    {profile.experience} /{' '}
                                    {progress.nextLevelXp} XP
                                </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                                    style={{
                                        width: `${progress.fraction * 100}%`,
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                    <CardHeader className="flex-row items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                            <Wallet className="size-5" />
                        </div>
                        <div>
                            <CardTitle>Économie</CardTitle>
                            <CardDescription>
                                Solde, banque et valeur nette
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {profile ? (
                            <dl className="grid grid-cols-2 gap-y-2 text-sm">
                                <dt className="text-muted-foreground">
                                    Portefeuille
                                </dt>
                                <dd className="text-right font-medium">
                                    {profile.economy.balance} 🪙
                                </dd>
                                <dt className="text-muted-foreground">
                                    Banque
                                </dt>
                                <dd className="text-right font-medium">
                                    {profile.economy.bank} 🪙
                                </dd>
                                <dt className="text-muted-foreground">
                                    Actions
                                </dt>
                                <dd className="text-right font-medium">
                                    {profile.portfolioValue} 🪙
                                </dd>
                                <dt className="font-semibold">Valeur nette</dt>
                                <dd className="text-right font-semibold">
                                    {profile.netWorth} 🪙
                                </dd>
                            </dl>
                        ) : (
                            <Skeleton className="h-24 w-full" />
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex-row items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-500">
                            <Briefcase className="size-5" />
                        </div>
                        <div>
                            <CardTitle>Travail</CardTitle>
                            <CardDescription>
                                Poste actuel et progression
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {profile ? (
                            <dl className="grid grid-cols-2 gap-y-2 text-sm">
                                <dt className="text-muted-foreground">Poste</dt>
                                <dd className="text-right font-medium">
                                    {profile.work.jobTitle}
                                </dd>
                                <dt className="text-muted-foreground">
                                    Shifts effectués
                                </dt>
                                <dd className="text-right font-medium">
                                    {profile.work.shiftsDone}
                                </dd>
                                <dt className="text-muted-foreground">
                                    Streak
                                </dt>
                                <dd className="text-right font-medium">
                                    {profile.work.streak} jour
                                    {profile.work.streak > 1 ? 's' : ''}
                                </dd>
                                <dt className="text-muted-foreground">
                                    Expérience
                                </dt>
                                <dd className="text-right font-medium">
                                    {profile.experience} XP
                                </dd>
                            </dl>
                        ) : (
                            <Skeleton className="h-24 w-full" />
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex-row items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-500">
                            <Dices className="size-5" />
                        </div>
                        <div>
                            <CardTitle>Casino</CardTitle>
                            <CardDescription>
                                Statistiques de jeu
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {profile ? (
                            <dl className="grid grid-cols-2 gap-y-2 text-sm">
                                <dt className="text-muted-foreground">
                                    Parties jouées
                                </dt>
                                <dd className="text-right font-medium">
                                    {profile.casino.gamesPlayed}
                                </dd>
                                <dt className="text-muted-foreground">
                                    Victoires
                                </dt>
                                <dd className="text-right font-medium">
                                    {profile.casino.wins}
                                </dd>
                                <dt className="text-muted-foreground">
                                    Défaites
                                </dt>
                                <dd className="text-right font-medium">
                                    {profile.casino.losses}
                                </dd>
                                <dt className="text-muted-foreground">
                                    Taux de victoire
                                </dt>
                                <dd className="text-right font-medium">
                                    {profile.casino.winRate}%
                                </dd>
                            </dl>
                        ) : (
                            <Skeleton className="h-24 w-full" />
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex-row items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pink-500/10 text-pink-500">
                            <Heart className="size-5" />
                        </div>
                        <div>
                            <CardTitle>Statut</CardTitle>
                            <CardDescription>Vie sociale</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {profile ? (
                            <p className="text-sm">
                                {profile.marriedTo ? (
                                    <>
                                        Marié·e à{' '}
                                        <span className="font-medium">
                                            {profile.marriedTo.displayName}
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-muted-foreground">
                                        Célibataire
                                    </span>
                                )}
                            </p>
                        ) : (
                            <Skeleton className="h-6 w-32" />
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
