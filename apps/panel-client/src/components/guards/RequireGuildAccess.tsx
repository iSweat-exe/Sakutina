import { Navigate, Outlet, useParams } from 'react-router';
import { useAuth } from '@/lib/auth-context';

export function RequireGuildAccess() {
    const { guilds, loading } = useAuth();
    const { guildId } = useParams();

    if (loading) return null;

    const guild = guilds.find((g) => g.id === guildId);
    if (!guild || !guild.hasAccess) return <Navigate to="/guilds" replace />;

    return <Outlet />;
}
