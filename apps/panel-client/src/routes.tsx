import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from '@/components/guards/RequireAuth';
import { RequireGuildAccess } from '@/components/guards/RequireGuildAccess';
import { RequireGuildMember } from '@/components/guards/RequireGuildMember';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/pages/Login';
import { GuildPickerPage } from '@/pages/GuildPicker';
import { DashboardPage } from '@/pages/guild/DashboardPage';
import { ConfigPage } from '@/pages/guild/ConfigPage';
import { ModerationPage } from '@/pages/guild/ModerationPage';
import { EconomyPage } from '@/pages/guild/EconomyPage';
import { GamePage } from '@/pages/guild/game/GamePage';
import { CoinflipPage } from '@/pages/guild/game/CoinflipPage';
import { RpsPage } from '@/pages/guild/game/RpsPage';
import { SlotsPage } from '@/pages/guild/game/SlotsPage';
import { DoubleOrNothingPage } from '@/pages/guild/game/DoubleOrNothingPage';
import { ProfilePage } from '@/pages/guild/profile/ProfilePage';
import { WorkPage } from '@/pages/guild/work/WorkPage';
import { InvestPage } from '@/pages/guild/invest/InvestPage';

export function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<RequireAuth />}>
                <Route path="/guilds" element={<GuildPickerPage />} />

                <Route path="/g/:guildId" element={<RequireGuildMember />}>
                    <Route element={<AppShell />}>
                        <Route element={<RequireGuildAccess />}>
                            <Route index element={<DashboardPage />} />
                            <Route path="config" element={<ConfigPage />} />
                            <Route
                                path="moderation"
                                element={<ModerationPage />}
                            />
                            <Route path="economy" element={<EconomyPage />} />
                        </Route>

                        <Route path="profile" element={<ProfilePage />} />
                        <Route path="work" element={<WorkPage />} />
                        <Route path="invest" element={<InvestPage />} />

                        <Route path="game" element={<GamePage />} />
                        <Route
                            path="game/coinflip"
                            element={<CoinflipPage />}
                        />
                        <Route path="game/rps" element={<RpsPage />} />
                        <Route path="game/slots" element={<SlotsPage />} />
                        <Route
                            path="game/double-or-nothing"
                            element={<DoubleOrNothingPage />}
                        />
                    </Route>
                </Route>
            </Route>

            <Route path="*" element={<Navigate to="/guilds" replace />} />
        </Routes>
    );
}
