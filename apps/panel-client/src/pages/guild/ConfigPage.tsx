import * as React from 'react';
import { useParams } from 'react-router';
import { Award, Hash, Settings2, ShieldAlert } from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';

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

interface ChannelOption {
    id: string;
    name: string;
    type: number;
}

interface RoleOption {
    id: string;
    name: string;
    color: number;
}

interface ConfigMeta {
    channels: ChannelOption[];
    roles: RoleOption[];
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
                <p className="text-muted-foreground text-xs">{description}</p>
            </div>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    );
}

const NONE = '__none__';

function ChannelSelect({
    id,
    channels,
    value,
    onChange,
}: {
    id: string;
    channels: ChannelOption[];
    value: string | null;
    onChange: (value: string | null) => void;
}) {
    return (
        <Select
            value={value ?? NONE}
            onValueChange={(v) => onChange(v === NONE ? null : v)}
        >
            <SelectTrigger id={id}>
                <SelectValue placeholder="Aucun" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NONE}>Aucun</SelectItem>
                {channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                        # {ch.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function CardIcon({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-md">
            {children}
        </div>
    );
}

export function ConfigPage() {
    const { guildId } = useParams();
    const toast = useToast();
    const [config, setConfig] = React.useState<GuildConfig | null>(null);
    const [savedConfig, setSavedConfig] = React.useState<GuildConfig | null>(
        null
    );
    const [meta, setMeta] = React.useState<ConfigMeta | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!guildId) return;
        api.get<GuildConfig>(`/api/guilds/${guildId}/config`)
            .then((data) => {
                setConfig(data);
                setSavedConfig(data);
            })
            .catch((err: unknown) => setError(toErrorMessage(err)));
        api.get<ConfigMeta>(`/api/guilds/${guildId}/config/meta`)
            .then(setMeta)
            .catch(() => setMeta({ channels: [], roles: [] }));
    }, [guildId]);

    const dirty =
        config && savedConfig
            ? JSON.stringify(config) !== JSON.stringify(savedConfig)
            : false;

    async function save() {
        if (!guildId || !config) return;
        setSaving(true);
        try {
            const updated = await api.patch<GuildConfig>(
                `/api/guilds/${guildId}/config`,
                config
            );
            setConfig(updated);
            setSavedConfig(updated);
            toast.success('Configuration enregistrée');
        } catch (err) {
            toast.error(toErrorMessage(err));
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

    const channels = meta?.channels ?? [];

    return (
        <div className="max-w-xl space-y-6 pb-20">
            <h1 className="text-2xl font-semibold">Configuration du serveur</h1>

            <Card>
                <CardHeader className="flex-row items-center gap-3">
                    <CardIcon>
                        <Settings2 className="size-4" />
                    </CardIcon>
                    <div>
                        <CardTitle>Général</CardTitle>
                        <CardDescription>
                            Langue et salons principaux
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="language">Langue</Label>
                        <Select
                            value={config.language}
                            onValueChange={(v) =>
                                setConfig({ ...config, language: v })
                            }
                        >
                            <SelectTrigger id="language">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fr">Français</SelectItem>
                                <SelectItem value="en">English</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="leaderboardChannel">
                            Salon du classement
                        </Label>
                        <ChannelSelect
                            id="leaderboardChannel"
                            channels={channels}
                            value={config.leaderboardChannel}
                            onChange={(v) =>
                                setConfig({
                                    ...config,
                                    leaderboardChannel: v,
                                })
                            }
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex-row items-center gap-3">
                    <CardIcon>
                        <ShieldAlert className="size-4" />
                    </CardIcon>
                    <div>
                        <CardTitle>Modération</CardTitle>
                        <CardDescription>
                            Avertissements et auto-modération
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="modLogChannel">
                            Salon de logs de modération
                        </Label>
                        <ChannelSelect
                            id="modLogChannel"
                            channels={channels}
                            value={config.modLogChannel}
                            onChange={(v) =>
                                setConfig({ ...config, modLogChannel: v })
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
                <CardHeader className="flex-row items-center gap-3">
                    <CardIcon>
                        <Award className="size-4" />
                    </CardIcon>
                    <div>
                        <CardTitle>Rôle de niveau</CardTitle>
                        <CardDescription>
                            Rôle attribué automatiquement à partir d'un certain
                            niveau
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="levelRoleId">Rôle</Label>
                        <Select
                            value={config.levelRoleId ?? NONE}
                            onValueChange={(v) =>
                                setConfig({
                                    ...config,
                                    levelRoleId: v === NONE ? null : v,
                                })
                            }
                        >
                            <SelectTrigger id="levelRoleId">
                                <SelectValue placeholder="Aucun" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE}>Aucun</SelectItem>
                                {(meta?.roles ?? []).map((role) => (
                                    <SelectItem key={role.id} value={role.id}>
                                        {role.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="levelRoleThreshold">
                            Niveau requis
                        </Label>
                        <div className="relative">
                            <Hash className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                            <Input
                                id="levelRoleThreshold"
                                type="number"
                                min={1}
                                className="pl-7"
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
                    </div>
                </CardContent>
            </Card>

            <div className="bg-background/95 sticky bottom-0 -mx-1 flex items-center gap-3 border-t px-1 py-4 backdrop-blur-sm">
                <Button onClick={save} disabled={saving || !dirty}>
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
                {dirty && !saving && (
                    <span className="text-muted-foreground text-xs">
                        Modifications non enregistrées
                    </span>
                )}
            </div>
        </div>
    );
}
