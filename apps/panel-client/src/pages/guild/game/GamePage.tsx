import * as React from 'react';
import { Link, useParams } from 'react-router';
import { Coins as CoinsIcon, Hand, Dices, Repeat } from 'lucide-react';
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

const games = [
    {
        to: 'coinflip',
        label: 'Pile ou Face',
        description: 'Devine le bon côté, double ta mise.',
        icon: CoinsIcon,
    },
    {
        to: 'rps',
        label: 'Pierre-Papier-Ciseaux',
        description: 'Affronte le bot, gagne le double.',
        icon: Hand,
    },
    {
        to: 'slots',
        label: 'Machine à Sous',
        description: 'Trois rouleaux, gros multiplicateurs.',
        icon: Dices,
    },
    {
        to: 'double-or-nothing',
        label: 'Quitte ou Double',
        description: '50/50, tout ou rien.',
        icon: Repeat,
    },
];

export function GamePage() {
    const { guildId } = useParams();
    const [balance, setBalance] = React.useState<number | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!guildId) return;
        setError(null);
        api.get<{ balance: number }>(`/api/guilds/${guildId}/game/me`)
            .then((data) => setBalance(data.balance))
            .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : String(err))
            );
    }, [guildId]);

    return (
        <div className="mx-auto max-w-3xl">
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Casino</h1>
                <div className="text-right">
                    <p className="text-xs text-muted-foreground">Solde</p>
                    {error ? (
                        <p className="text-sm text-destructive">
                            Échec du chargement
                        </p>
                    ) : balance === null ? (
                        <Skeleton className="h-6 w-20" />
                    ) : (
                        <p className="text-lg font-semibold">{balance} 🪙</p>
                    )}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                {games.map(({ to, label, description, icon: Icon }) => (
                    <Link key={to} to={to}>
                        <Card className="h-full transition-colors hover:bg-accent">
                            <CardHeader className="flex-row items-center gap-3">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <Icon className="size-5" />
                                </div>
                                <div>
                                    <CardTitle>{label}</CardTitle>
                                    <CardDescription>
                                        {description}
                                    </CardDescription>
                                </div>
                            </CardHeader>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
