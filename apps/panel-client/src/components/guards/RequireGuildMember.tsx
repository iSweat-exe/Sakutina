import { Navigate, Outlet, useParams } from 'react-router';
import { useAuth } from '@/lib/auth-context';

/**
 * Unlike RequireGuildAccess, this only checks that the guild is in the
 * user's session (any membership) — used for player-facing routes like the
 * Game section, which is open to every member, not just admins.
 */
export function RequireGuildMember() {
    const { guilds, loading } = useAuth();
    const { guildId } = useParams();

    if (loading) return null;

    const guild = guilds.find((g) => g.id === guildId);
    if (!guild) return <Navigate to="/guilds" replace />;

    return <Outlet />;
}
