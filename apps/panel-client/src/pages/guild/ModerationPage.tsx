import * as React from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DiscordAvatar } from '@/components/DiscordAvatar';
import { api } from '@/lib/api';
import { getUserAvatarUrl } from '@/lib/discord';

interface ActionMember {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
}

interface ModAction {
    id: number;
    userId: string;
    moderatorId: string;
    actionType: string;
    reason: string;
    createdAt: string;
    member: ActionMember | null;
}

const ACTION_BADGE_VARIANT: Record<
    string,
    'default' | 'secondary' | 'destructive' | 'outline'
> = {
    WARN: 'secondary',
    MUTE: 'secondary',
    KICK: 'outline',
    BAN: 'destructive',
};

function toErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

export function ModerationPage() {
    const { guildId } = useParams();
    const [actions, setActions] = React.useState<ModAction[] | null>(null);
    const [userId, setUserId] = React.useState('');
    const [reason, setReason] = React.useState('');
    const [busy, setBusy] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const loadActions = React.useCallback(() => {
        if (!guildId) return;
        api
            .get<ModAction[]>(`/api/guilds/${guildId}/moderation/actions`)
            .then(setActions)
            .catch((err: unknown) => setError(toErrorMessage(err)));
    }, [guildId]);

    React.useEffect(loadActions, [loadActions]);

    async function runAction(type: 'warn' | 'mute' | 'kick' | 'ban') {
        if (!guildId || !userId) return;
        setBusy(type);
        setError(null);
        try {
            await api.post(`/api/guilds/${guildId}/moderation/${type}`, {
                userId,
                reason: reason || 'No reason provided',
            });
            setUserId('');
            setReason('');
            loadActions();
        } catch (err) {
            setError(toErrorMessage(err));
        } finally {
            setBusy(null);
        }
    }

    return (
        <div>
            <h1 className="mb-6 text-2xl font-semibold">Modération</h1>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Action rapide</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="userId">ID utilisateur</Label>
                            <Input
                                id="userId"
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="reason">Raison</Label>
                            <Input
                                id="reason"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            disabled={!userId || busy !== null}
                            onClick={() => runAction('warn')}
                        >
                            Avertir
                        </Button>
                        <Button
                            variant="secondary"
                            disabled={!userId || busy !== null}
                            onClick={() => runAction('mute')}
                        >
                            Muet (60 min)
                        </Button>
                        <Button
                            variant="secondary"
                            disabled={!userId || busy !== null}
                            onClick={() => runAction('kick')}
                        >
                            Expulser
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={!userId || busy !== null}
                            onClick={() => runAction('ban')}
                        >
                            Bannir
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Historique récent</CardTitle>
                </CardHeader>
                <CardContent>
                    {!actions && (
                        <div className="space-y-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    )}

                    {actions && actions.length === 0 && (
                        <p className="text-muted-foreground text-sm">
                            Aucune action enregistrée.
                        </p>
                    )}

                    {actions && actions.length > 0 && (
                        <div className="space-y-1">
                            {actions.map((action) => (
                                <div
                                    key={action.id}
                                    className="flex items-center justify-between gap-4 border-b py-2.5 text-sm last:border-0"
                                >
                                    <div className="flex min-w-0 items-center gap-2">
                                        <DiscordAvatar
                                            src={
                                                action.member?.avatarUrl ??
                                                getUserAvatarUrl(action.userId, null, 32)
                                            }
                                            alt={action.member?.displayName ?? action.userId}
                                            size={28}
                                        />
                                        <div className="min-w-0">
                                            <p className="truncate font-medium">
                                                {action.member?.displayName ?? action.userId}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {action.reason}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3">
                                        <Badge variant={ACTION_BADGE_VARIANT[action.actionType] ?? 'outline'}>
                                            {action.actionType}
                                        </Badge>
                                        <span className="text-muted-foreground whitespace-nowrap">
                                            {new Date(action.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}


