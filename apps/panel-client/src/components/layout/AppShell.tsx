import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import {
    LayoutDashboard,
    Settings,
    ShieldAlert,
    Coins,
    LogOut,
    ChevronsUpDown,
    Moon,
    Sun,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';
import { getGuildIconUrl, getUserAvatarUrl } from '@/lib/discord';
import { DiscordAvatar } from '@/components/DiscordAvatar';

const navItems = [
    { to: '', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: 'config', label: 'Config', icon: Settings },
    { to: 'moderation', label: 'Modération', icon: ShieldAlert },
    { to: 'economy', label: 'Économie', icon: Coins },
];

export function AppShell() {
    const { guildId } = useParams();
    const { user, guilds, logout } = useAuth();
    const { theme, toggle } = useTheme();
    const guild = guilds.find((g) => g.id === guildId);
    const guildIconUrl = guild ? getGuildIconUrl(guild.id, guild.icon) : null;

    return (
        <div className="flex min-h-svh">
            <aside className="w-64 shrink-0 border-r bg-card px-4 py-6 flex flex-col gap-6">
                <Link
                    to="/guilds"
                    className="flex items-center gap-3 rounded-md p-2 -mx-2 transition-colors hover:bg-accent group"
                    title="Changer de serveur"
                >
                    {guildIconUrl ? (
                        <DiscordAvatar
                            src={guildIconUrl}
                            alt={guild?.name ?? ''}
                            size={36}
                        />
                    ) : (
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                            {guild?.name?.[0]?.toUpperCase() ?? 'S'}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Serveur
                        </p>
                        <p className="font-semibold truncate">
                            {guild?.name ?? 'Sakutina'}
                        </p>
                    </div>
                    <ChevronsUpDown className="size-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>

                <nav className="flex flex-col gap-1">
                    {navItems.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                            key={to}
                            to={`/g/${guildId}/${to}`}
                            end={end}
                            className={({ isActive }) =>
                                cn(
                                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                    isActive
                                        ? 'bg-accent text-accent-foreground'
                                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                )
                            }
                        >
                            <Icon className="size-4" />
                            {label}
                        </NavLink>
                    ))}
                </nav>

                <div className="mt-auto flex items-center gap-2">
                    {user && (
                        <DiscordAvatar
                            src={getUserAvatarUrl(user.id, user.avatar, 32)}
                            alt={user.username}
                            size={32}
                        />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {user?.username}
                    </span>
                    <button
                        onClick={toggle}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
                    >
                        {theme === 'dark' ? (
                            <Sun className="size-4" />
                        ) : (
                            <Moon className="size-4" />
                        )}
                    </button>
                    <button
                        onClick={() => logout()}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        title="Déconnexion"
                    >
                        <LogOut className="size-4" />
                    </button>
                </div>
            </aside>

            <main className="flex-1 p-8 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
}
