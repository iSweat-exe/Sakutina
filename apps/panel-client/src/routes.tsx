import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from '@/components/guards/RequireAuth';
import { RequireGuildAccess } from '@/components/guards/RequireGuildAccess';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/pages/Login';
import { GuildPickerPage } from '@/pages/GuildPicker';
import { DashboardPage } from '@/pages/guild/DashboardPage';
import { ConfigPage } from '@/pages/guild/ConfigPage';
import { ModerationPage } from '@/pages/guild/ModerationPage';
import { EconomyPage } from '@/pages/guild/EconomyPage';

export function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<RequireAuth />}>
                <Route path="/guilds" element={<GuildPickerPage />} />

                <Route path="/g/:guildId" element={<RequireGuildAccess />}>
                    <Route element={<AppShell />}>
                        <Route index element={<DashboardPage />} />
                        <Route path="config" element={<ConfigPage />} />
                        <Route path="moderation" element={<ModerationPage />} />
                        <Route path="economy" element={<EconomyPage />} />
                    </Route>
                </Route>
            </Route>

            <Route path="*" element={<Navigate to="/guilds" replace />} />
        </Routes>
    );
}
