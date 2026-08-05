import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DiscordAvatar } from '@/components/DiscordAvatar';
import { useAuth } from '@/lib/auth-context';
import { getGuildIconUrl } from '@/lib/discord';

export function GuildPickerPage() {
    const { guilds } = useAuth();
    const manageable = guilds.filter((g) => g.hasAccess);

    return (
        <div className="mx-auto max-w-2xl p-8">
            <h1 className="mb-6 text-2xl font-semibold">Choisis un serveur</h1>

            {manageable.length === 0 ? (
                <p className="text-muted-foreground">
                    Aucun serveur gérable trouvé. Le bot doit être présent sur le
                    serveur et tu dois y avoir la permission Administrateur ou
                    Gérer le serveur.
                </p>
            ) : (
                <div className="grid gap-3">
                    {manageable.map((guild) => {
                        const iconUrl = getGuildIconUrl(guild.id, guild.icon);
                        return (
                            <Link key={guild.id} to={`/g/${guild.id}`}>
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
                                        <Badge variant="secondary">Admin</Badge>
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


