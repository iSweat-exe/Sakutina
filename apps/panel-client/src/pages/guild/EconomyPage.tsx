import * as React from 'react';
import { useParams } from 'react-router';
import { ArrowDown, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DiscordAvatar } from '@/components/DiscordAvatar';
import { api, isAbortError } from '@/lib/api';
import { getUserAvatarUrl } from '@/lib/discord';
import { cn } from '@/lib/utils';

interface EconomyMember {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
}

interface EconomyUser {
    discordId: string;
    balance: number;
    bank: number;
    experience: number;
    member: EconomyMember | null;
}

type SortKey = 'balance' | 'bank' | 'experience';

const columns: { key: SortKey; label: string }[] = [
    { key: 'balance', label: 'Solde' },
    { key: 'bank', label: 'Banque' },
    { key: 'experience', label: 'XP' },
];

export function EconomyPage() {
    const { guildId } = useParams();
    const [users, setUsers] = React.useState<EconomyUser[] | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [search, setSearch] = React.useState('');
    const [sort, setSort] = React.useState<SortKey>('balance');

    React.useEffect(() => {
        if (!guildId) return;
        setUsers(null);
        const controller = new AbortController();
        api.get<EconomyUser[]>(
            `/api/guilds/${guildId}/economy/users?sort=${sort}&limit=50`,
            { signal: controller.signal }
        )
            .then(setUsers)
            .catch((err: unknown) => {
                if (isAbortError(err)) return;
                setError(err instanceof Error ? err.message : String(err));
            });
        return () => controller.abort();
    }, [guildId, sort]);

    const filtered = React.useMemo(() => {
        if (!users) return null;
        const query = search.trim().toLowerCase();
        if (!query) return users;
        return users.filter((u) => {
            const name =
                u.member?.displayName ?? u.member?.username ?? u.discordId;
            return (
                name.toLowerCase().includes(query) ||
                u.discordId.includes(query)
            );
        });
    }, [users, search]);

    return (
        <div>
            <div className="mb-6 flex items-center justify-between gap-4">
                <h1 className="text-2xl font-semibold">Économie</h1>
                <div className="relative w-64">
                    <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher un membre…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Classement</CardTitle>
                </CardHeader>
                <CardContent>
                    {error && <p className="text-destructive">{error}</p>}

                    {!error && !users && (
                        <div className="space-y-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                            ))}
                        </div>
                    )}

                    {!error && users && filtered?.length === 0 && (
                        <p className="text-muted-foreground text-sm">
                            Aucun membre ne correspond à cette recherche.
                        </p>
                    )}

                    {!error && filtered && filtered.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-muted-foreground">
                                        <th className="py-2 font-medium">
                                            Membre
                                        </th>
                                        {columns.map((col) => (
                                            <th
                                                key={col.key}
                                                className="py-2 font-medium"
                                                aria-sort={
                                                    sort === col.key
                                                        ? 'descending'
                                                        : 'none'
                                                }
                                            >
                                                <button
                                                    onClick={() =>
                                                        setSort(col.key)
                                                    }
                                                    aria-pressed={
                                                        sort === col.key
                                                    }
                                                    className={cn(
                                                        'flex items-center gap-1 hover:text-foreground transition-colors',
                                                        sort === col.key &&
                                                            'text-foreground'
                                                    )}
                                                >
                                                    {col.label}
                                                    {sort === col.key && (
                                                        <ArrowDown className="size-3" />
                                                    )}
                                                </button>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((user) => (
                                        <tr
                                            key={user.discordId}
                                            className="border-b last:border-0"
                                        >
                                            <td className="py-2">
                                                <div className="flex items-center gap-2">
                                                    <DiscordAvatar
                                                        src={
                                                            user.member
                                                                ?.avatarUrl ??
                                                            getUserAvatarUrl(
                                                                user.discordId,
                                                                null,
                                                                32
                                                            )
                                                        }
                                                        alt={
                                                            user.member
                                                                ?.displayName ??
                                                            user.discordId
                                                        }
                                                        size={28}
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="truncate font-medium">
                                                            {user.member
                                                                ?.displayName ??
                                                                user.discordId}
                                                        </p>
                                                        {user.member && (
                                                            <p className="truncate text-xs text-muted-foreground">
                                                                @
                                                                {
                                                                    user.member
                                                                        .username
                                                                }
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-2">
                                                {user.balance}
                                            </td>
                                            <td className="py-2">
                                                {user.bank}
                                            </td>
                                            <td className="py-2">
                                                {user.experience}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
