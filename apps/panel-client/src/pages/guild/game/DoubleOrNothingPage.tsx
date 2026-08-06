import * as React from 'react';
import { Repeat } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Confetti } from '@/components/Confetti';
import { cn } from '@/lib/utils';
import { GameHeader } from './GameHeader';
import { useCasinoGame } from './useCasinoGame';

export function DoubleOrNothingPage() {
    const { balance, playing, error, play } = useCasinoGame('donothing');
    const [bet, setBet] = React.useState(10);
    const [outcome, setOutcome] = React.useState<'win' | 'lose' | null>(null);
    const [winCount, setWinCount] = React.useState(0);

    const handlePlay = async () => {
        setOutcome(null);
        const result = await play(bet);
        if (result) {
            const outcome = result.outcome as 'win' | 'lose';
            setOutcome(outcome);
            if (outcome === 'win') setWinCount((c) => c + 1);
        }
    };

    return (
        <div className="mx-auto max-w-md">
            <GameHeader title="Quitte ou Double" balance={balance} />

            <Card className="relative overflow-hidden">
                <Confetti trigger={winCount} />
                <CardContent className="flex flex-col items-center gap-6 pt-2">
                    <Repeat
                        className={cn(
                            'size-16 text-primary transition-transform',
                            playing && 'animate-spin'
                        )}
                    />

                    {outcome && (
                        <p
                            className={cn(
                                'text-lg font-semibold',
                                outcome === 'win'
                                    ? 'win-pop text-emerald-500'
                                    : 'text-destructive'
                            )}
                        >
                            {outcome === 'win'
                                ? `Gagné ! Mise doublée.`
                                : 'Perdu !'}
                        </p>
                    )}

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
