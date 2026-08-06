import * as React from 'react';
import { Hand } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Confetti } from '@/components/Confetti';
import { cn } from '@/lib/utils';
import { GameHeader } from './GameHeader';
import { useCasinoGame } from './useCasinoGame';

type RpsChoice = 'rock' | 'paper' | 'scissors';

const CHOICE_LABEL: Record<RpsChoice, string> = {
    rock: 'Pierre',
    paper: 'Papier',
    scissors: 'Ciseaux',
};

export function RpsPage() {
    const { balance, playing, error, play } = useCasinoGame<{
        botChoice: RpsChoice;
    }>('rps');
    const [bet, setBet] = React.useState(10);
    const [choice, setChoice] = React.useState<RpsChoice>('rock');
    const [outcome, setOutcome] = React.useState<{
        state: 'win' | 'lose' | 'tie';
        botChoice: RpsChoice;
    } | null>(null);
    const [winCount, setWinCount] = React.useState(0);

    const handlePlay = async () => {
        setOutcome(null);
        const result = await play(bet, choice);
        if (result) {
            setOutcome({
                state: result.outcome,
                botChoice: result.extra.botChoice,
            });
            if (result.outcome === 'win') setWinCount((c) => c + 1);
        }
    };

    return (
        <div className="mx-auto max-w-md">
            <GameHeader title="Pierre-Papier-Ciseaux" balance={balance} />

            <Card className="relative overflow-hidden">
                <Confetti trigger={winCount} />
                <CardContent className="flex flex-col items-center gap-6 pt-2">
                    <Hand className="size-16 text-primary" />

                    {outcome && (
                        <p
                            className={cn(
                                'text-lg font-semibold',
                                outcome.state === 'win'
                                    ? 'win-pop text-emerald-500'
                                    : outcome.state === 'tie'
                                      ? 'text-muted-foreground'
                                      : 'text-destructive'
                            )}
                        >
                            J'ai choisi {CHOICE_LABEL[outcome.botChoice]} —{' '}
                            {outcome.state === 'win'
                                ? 'Gagné !'
                                : outcome.state === 'tie'
                                  ? 'Égalité'
                                  : 'Perdu !'}
                        </p>
                    )}

                    <div className="flex w-full gap-2">
                        {(['rock', 'paper', 'scissors'] as RpsChoice[]).map(
                            (c) => (
                                <Button
                                    key={c}
                                    type="button"
                                    variant={
                                        choice === c ? 'default' : 'outline'
                                    }
                                    className="flex-1"
                                    onClick={() => setChoice(c)}
                                >
                                    {CHOICE_LABEL[c]}
                                </Button>
                            )
                        )}
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
