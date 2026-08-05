import * as React from 'react';
import { api, ApiError } from './api';

export interface PanelUser {
    id: string;
    username: string;
    avatar: string | null;
}

export interface PanelGuild {
    id: string;
    name: string;
    icon: string | null;
    hasAccess: boolean;
}

interface AuthContextValue {
    user: PanelUser | null;
    guilds: PanelGuild[];
    loading: boolean;
    refresh: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = React.useState<PanelUser | null>(null);
    const [guilds, setGuilds] = React.useState<PanelGuild[]>([]);
    const [loading, setLoading] = React.useState(true);

    const refresh = React.useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get<{
                user: PanelUser;
                guilds: PanelGuild[];
            }>('/auth/me');
            setUser(data.user);
            setGuilds(data.guilds);
        } catch (error) {
            if (!(error instanceof ApiError && error.status === 401)) {
                console.error('[Auth] Failed to load session:', error);
            }
            setUser(null);
            setGuilds([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = React.useCallback(async () => {
        await api.post('/auth/logout');
        setUser(null);
        setGuilds([]);
    }, []);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    return (
        <AuthContext.Provider
            value={{ user, guilds, loading, refresh, logout }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = React.useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
}
