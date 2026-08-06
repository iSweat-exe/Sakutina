import * as React from 'react';
import { useParams } from 'react-router';
import { Briefcase, Clock, LogOut, TrendingUp } from 'lucide-react';
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast-context';

interface JobRank {
    title: string;
    minShifts: number;
    salaryMin: number;
    salaryMax: number;
    cooldownSeconds: number;
}

interface JobInfo {
    id: string;
    minExperience: number;
    ranks: JobRank[];
}

interface WorkData {
    jobs: JobInfo[];
    currentJob: string | null;
    jobTitle: string | null;
    nextRankTitle: string | null;
    shiftsUntilNextRank: number | null;
    currentJobShifts: number;
    experience: number;
    shiftsDone: number;
    streak: number;
    cooldownRemainingSeconds: number;
}

interface ShiftResult {
    salary: number;
    expGain: number;
    jobTitle: string;
    newLevel: number;
    promoted: boolean;
    newRankTitle: string;
    streak: number;
    bonusMoneyActive: boolean;
    bonusXpActive: boolean;
}

export function WorkPage() {
    const { guildId } = useParams();
    const toast = useToast();
    const [data, setData] = React.useState<WorkData | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);
    const [lastShift, setLastShift] = React.useState<ShiftResult | null>(null);
    const [cooldown, setCooldown] = React.useState(0);

    const load = React.useCallback(() => {
        if (!guildId) return;
        api.get<WorkData>(`/api/guilds/${guildId}/work`)
            .then((res) => {
                setData(res);
                setCooldown(res.cooldownRemainingSeconds);
            })
            .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : String(err))
            );
    }, [guildId]);

    React.useEffect(() => {
        load();
    }, [load]);

    React.useEffect(() => {
        const id = setInterval(() => {
            setCooldown((s) => (s > 0 ? s - 1 : s));
        }, 1000);
        return () => clearInterval(id);
    }, []);

    const handleShift = async () => {
        if (!guildId) return;
        setBusy(true);
        setError(null);
        try {
            const result = await api.post<ShiftResult>(
                `/api/guilds/${guildId}/work/shift`
            );
            setLastShift(result);
            toast.success(
                result.promoted
                    ? `+${result.salary} 🪙 · Promu·e ${result.newRankTitle} !`
                    : `+${result.salary} 🪙 · +${result.expGain} XP`
            );
            load();
        } catch (err) {
            const message = err instanceof ApiError ? err.message : String(err);
            setError(message);
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    const handleJoin = async (jobId: string) => {
        if (!guildId) return;
        setBusy(true);
        setError(null);
        try {
            await api.post(`/api/guilds/${guildId}/work/join`, { jobId });
            setLastShift(null);
            toast.success(`Poste rejoint : ${jobId}`);
            load();
        } catch (err) {
            const message = err instanceof ApiError ? err.message : String(err);
            setError(message);
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    const handleLeave = async () => {
        if (!guildId) return;
        setBusy(true);
        setError(null);
        try {
            await api.post(`/api/guilds/${guildId}/work/leave`);
            setLastShift(null);
            toast.info('Poste quitté');
            load();
        } catch (err) {
            const message = err instanceof ApiError ? err.message : String(err);
            setError(message);
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="mx-auto max-w-3xl">
            <h1 className="mb-6 text-2xl font-semibold">Travail</h1>

            {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

            <Card className="mb-6">
                <CardHeader className="flex-row items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Briefcase className="size-5" />
                    </div>
                    <div className="flex-1">
                        <CardTitle>
                            {data
                                ? (data.jobTitle ?? 'Sans emploi')
                                : 'Chargement...'}
                        </CardTitle>
                        {data?.nextRankTitle && (
                            <CardDescription>
                                Prochain rang : {data.nextRankTitle} (
                                {data.shiftsUntilNextRank} shifts restants)
                            </CardDescription>
                        )}
                    </div>
                    {data && (
                        <Badge variant="secondary">
                            Streak x{data.streak || 1}
                        </Badge>
                    )}
                </CardHeader>
                <CardContent>
                    {!data ? (
                        <Skeleton className="h-16 w-full" />
                    ) : lastShift ? (
                        <div className="rounded-md bg-accent p-3 text-sm">
                            <p className="font-medium text-emerald-500">
                                +{lastShift.salary} 🪙 · +{lastShift.expGain} XP
                            </p>
                            {lastShift.promoted && (
                                <p className="text-muted-foreground">
                                    Promu·e : {lastShift.newRankTitle} !
                                </p>
                            )}
                            {(lastShift.bonusMoneyActive ||
                                lastShift.bonusXpActive) && (
                                <p className="text-muted-foreground">
                                    Bonus actif appliqué
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {data.currentJob
                                ? 'Prêt à travailler.'
                                : 'Rejoins un poste ci-dessous pour commencer à travailler.'}
                        </p>
                    )}
                </CardContent>
                {data?.currentJob && (
                    <CardFooter className="gap-2">
                        <Button
                            className="flex-1"
                            disabled={busy || cooldown > 0}
                            onClick={handleShift}
                        >
                            {cooldown > 0 ? (
                                <>
                                    <Clock className="size-4" />
                                    {formatTime(cooldown)}
                                </>
                            ) : busy ? (
                                'En cours...'
                            ) : (
                                'Travailler'
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={handleLeave}
                        >
                            <LogOut className="size-4" />
                            Quitter
                        </Button>
                    </CardFooter>
                )}
            </Card>

            <h2 className="mb-3 text-lg font-semibold">Postes disponibles</h2>
            <div className="grid gap-3 sm:grid-cols-2">
                {!data
                    ? Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-28 w-full" />
                      ))
                    : data.jobs.map((job) => {
                          const baseRank = job.ranks[0]!;
                          const isCurrent = data.currentJob === job.id;
                          const canJoin = data.experience >= job.minExperience;
                          return (
                              <Card key={job.id}>
                                  <CardHeader>
                                      <CardTitle className="capitalize">
                                          {job.id}
                                      </CardTitle>
                                      <CardDescription>
                                          {baseRank.salaryMin}-
                                          {baseRank.salaryMax} 🪙 par shift ·
                                          dès {job.minExperience} XP
                                      </CardDescription>
                                  </CardHeader>
                                  <CardFooter>
                                      {isCurrent ? (
                                          <Badge>Poste actuel</Badge>
                                      ) : (
                                          <Button
                                              size="sm"
                                              variant="outline"
                                              disabled={busy || !canJoin}
                                              onClick={() => handleJoin(job.id)}
                                          >
                                              <TrendingUp className="size-4" />
                                              {canJoin
                                                  ? 'Rejoindre'
                                                  : `Requiert ${job.minExperience} XP`}
                                          </Button>
                                      )}
                                  </CardFooter>
                              </Card>
                          );
                      })}
            </div>
        </div>
    );
}
