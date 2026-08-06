import * as React from 'react';
import { Coins as CoinsIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Confetti } from '@/components/Confetti';
import { cn } from '@/lib/utils';
import { GameHeader } from './GameHeader';
import { useCasinoGame } from './useCasinoGame';

type CoinSide = 'heads' | 'tails';

const SIDE_LABEL: Record<CoinSide, string> = {
    heads: 'Pile',
    tails: 'Face',
};

export function CoinflipPage() {
    const { balance, playing, error, play } = useCasinoGame<{
        result: CoinSide;
    }>('coinflip');
    const [bet, setBet] = React.useState(10);
    const [choice, setChoice] = React.useState<CoinSide>('heads');
    const [outcome, setOutcome] = React.useState<{
        win: boolean;
        result: CoinSide;
    } | null>(null);
    const [winCount, setWinCount] = React.useState(0);

    const handlePlay = async () => {
        setOutcome(null);
        const result = await play(bet, choice);
        if (result) {
            const win = result.outcome === 'win';
            setOutcome({ win, result: result.extra.result });
            if (win) setWinCount((c) => c + 1);
        }
    };

    return (
        <div className="mx-auto max-w-md">
            <GameHeader title="Pile ou Face" balance={balance} />

            <Card className="relative overflow-hidden">
                <Confetti trigger={winCount} />
                <CardContent className="flex flex-col items-center gap-6 pt-2">
                    <CoinsIcon
                        className={cn(
                            'size-16 text-primary transition-transform',
                            playing && 'animate-bounce'
                        )}
                    />

                    {outcome && (
                        <p
                            className={cn(
                                'text-lg font-semibold',
                                outcome.win
                                    ? 'win-pop text-emerald-500'
                                    : 'text-destructive'
                            )}
                        >
                            {SIDE_LABEL[outcome.result]} —{' '}
                            {outcome.win ? 'Gagné !' : 'Perdu !'}
                        </p>
                    )}

                    <div className="flex w-full gap-2">
                        {(['heads', 'tails'] as CoinSide[]).map((side) => (
                            <Button
                                key={side}
                                type="button"
                                variant={
                                    choice === side ? 'default' : 'outline'
                                }
                                className="flex-1"
                                onClick={() => setChoice(side)}
                            >
                                {SIDE_LABEL[side]}
                            </Button>
                        ))}
                    </div>

                    <div className="w-full space-y-2">
                        <Label htmlFor="bet">Mise</Label>
                        <Input
                            id="bet"
                            type="number"
                            min={1}
                            value={bet}
                            onChange={(e) =>
                                setBet(Number(e.target.value) || 0)
                            }
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}

                    <Button
                        className="w-full"
                        disabled={playing || bet <= 0}
                        onClick={handlePlay}
                    >
                        {playing ? 'En cours...' : 'Jouer'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
