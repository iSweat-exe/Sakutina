import * as React from 'react';
import { useParams } from 'react-router';
import { api } from '@/lib/api';

export type CasinoGameId = 'coinflip' | 'rps' | 'slots' | 'donothing';

interface CasinoResult<TExtra> {
    outcome: 'win' | 'lose' | 'tie';
    payout: number;
    extra: TExtra;
    balance: number;
}

/** Shared balance + bet-and-play plumbing for every casino game page. */
export function useCasinoGame<TExtra = Record<string, unknown>>(
    game: CasinoGameId
) {
    const { guildId } = useParams();
    const [balance, setBalance] = React.useState<number | null>(null);
    const [playing, setPlaying] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const fetchBalance = React.useCallback(() => {
        if (!guildId) return;
        api.get<{ balance: number }>(`/api/guilds/${guildId}/game/me`)
            .then((data) => setBalance(data.balance))
            .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : String(err))
            );
    }, [guildId]);

    React.useEffect(() => {
        fetchBalance();
    }, [fetchBalance]);

    const play = React.useCallback(
        async (bet: number, choice?: string) => {
            if (!guildId) return null;
            setPlaying(true);
            setError(null);
            try {
                const result = await api.post<CasinoResult<TExtra>>(
                    `/api/guilds/${guildId}/game/casino/${game}`,
                    { bet, choice }
                );
                setBalance(result.balance);
                return result;
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
                return null;
            } finally {
                setPlaying(false);
            }
        },
        [guildId, game]
    );

    return { balance, playing, error, play };
}
