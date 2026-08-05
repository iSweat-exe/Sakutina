import * as React from 'react';
import { useParams } from 'react-router-dom';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

interface GuildConfig {
    language: string;
    modLogChannel: string | null;
    maxWarns: number;
    modLogWarning: boolean;
    autoModEnabled: boolean;
    levelRoleId: string | null;
    levelRoleThreshold: number | null;
    leaderboardChannel: string | null;
}

function toErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function ToggleRow({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-4 py-1">
            <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    );
}

export function ConfigPage() {
    const { guildId } = useParams();
    const [config, setConfig] = React.useState<GuildConfig | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [saved, setSaved] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!guildId) return;
        api.get<GuildConfig>(`/api/guilds/${guildId}/config`)
            .then(setConfig)
            .catch((err: unknown) => setError(toErrorMessage(err)));
    }, [guildId]);

    async function save() {
        if (!guildId || !config) return;
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
            const updated = await api.patch<GuildConfig>(
                `/api/guilds/${guildId}/config`,
                config
            );
            setConfig(updated);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            setError(toErrorMessage(err));
        } finally {
            setSaving(false);
        }
    }

    if (error && !config) return <p className="text-destructive">{error}</p>;

    if (!config) {
        return (
            <div className="max-w-xl space-y-4">
                <h1 className="mb-6 text-2xl font-semibold">
                    Configuration du serveur
                </h1>
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
        );
    }

    return (
        <div className="max-w-xl space-y-6">
            <h1 className="text-2xl font-semibold">Configuration du serveur</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Général</CardTitle>
                    <CardDescription>
                        Langue et salons principaux
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="language">Langue</Label>
                        <Input
                            id="language"
                            value={config.language}
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    language: e.target.value,
                                })
                            }
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="leaderboardChannel">
                            Salon du classement (ID)
                        </Label>
                        <Input
                            id="leaderboardChannel"
                            value={config.leaderboardChannel ?? ''}
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    leaderboardChannel: e.target.value || null,
                                })
                            }
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Modération</CardTitle>
                    <CardDescription>
                        Avertissements et auto-modération
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="modLogChannel">
                            Salon de logs de modération (ID)
                        </Label>
                        <Input
                            id="modLogChannel"
                            value={config.modLogChannel ?? ''}
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    modLogChannel: e.target.value || null,
                                })
                            }
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="maxWarns">
                            Nombre max. d'avertissements avant ban auto
                        </Label>
                        <Input
                            id="maxWarns"
                            type="number"
                            min={1}
                            value={config.maxWarns}
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    maxWarns: Number(e.target.value),
                                })
                            }
                        />
                    </div>

                    <ToggleRow
                        label="Rappel dans les logs"
                        description="Rappelle le nombre d'avertissements dans le salon de logs"
                        checked={config.modLogWarning}
                        onChange={(v) =>
                            setConfig({ ...config, modLogWarning: v })
                        }
                    />

                    <ToggleRow
                        label="Auto-modération"
                        description="Détection automatique du spam et des liens"
                        checked={config.autoModEnabled}
                        onChange={(v) =>
                            setConfig({ ...config, autoModEnabled: v })
                        }
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Rôle de niveau</CardTitle>
                    <CardDescription>
                        Rôle attribué automatiquement à partir d'un certain
                        niveau
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="levelRoleId">ID du rôle</Label>
                        <Input
                            id="levelRoleId"
                            value={config.levelRoleId ?? ''}
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    levelRoleId: e.target.value || null,
                                })
                            }
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="levelRoleThreshold">
                            Niveau requis
                        </Label>
                        <Input
                            id="levelRoleThreshold"
                            type="number"
                            min={1}
                            value={config.levelRoleThreshold ?? ''}
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    levelRoleThreshold: e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                })
                            }
                        />
                    </div>
                </CardContent>
            </Card>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center gap-3">
                <Button onClick={save} disabled={saving}>
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
                {saved && (
                    <span className="text-sm text-muted-foreground">
                        Modifications enregistrées ✓
                    </span>
                )}
            </div>
        </div>
    );
}
