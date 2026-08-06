import { Link } from 'react-router';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DiscordAvatar } from '@/components/DiscordAvatar';
import { useAuth } from '@/lib/auth-context';
import { getGuildIconUrl } from '@/lib/discord';

export function GuildPickerPage() {
    const { guilds } = useAuth();

    return (
        <div className="mx-auto max-w-2xl p-8">
            <h1 className="mb-6 text-2xl font-semibold">Choisis un serveur</h1>

            {guilds.length === 0 ? (
                <p className="text-muted-foreground">
                    Aucun serveur commun trouvé. Le bot doit être présent sur le
                    serveur pour que tu puisses accéder au panel.
                </p>
            ) : (
                <div className="grid gap-3">
                    {guilds.map((guild) => {
                        const iconUrl = getGuildIconUrl(guild.id, guild.icon);
                        const target = guild.hasAccess
                            ? `/g/${guild.id}`
                            : `/g/${guild.id}/profile`;
                        return (
                            <Link key={guild.id} to={target}>
                                <Card className="transition-colors hover:bg-accent">
                                    <CardHeader className="flex-row items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {iconUrl ? (
                                                <DiscordAvatar
                                                    src={iconUrl}
                                                    alt={guild.name}
                                                    size={40}
                                                />
                                            ) : (
                                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                                                    {guild.name[0]?.toUpperCase()}
                                                </div>
                                            )}
                                            <CardTitle>{guild.name}</CardTitle>
                                        </div>
                                        <Badge variant="secondary">
                                            {guild.hasAccess
                                                ? 'Admin'
                                                : 'Membre'}
                                        </Badge>
                                    </CardHeader>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
