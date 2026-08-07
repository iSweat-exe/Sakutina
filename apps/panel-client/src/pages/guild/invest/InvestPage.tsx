import * as React from 'react';
import { useParams } from 'react-router';
import { ArrowDown, ArrowUp, Clock, Minus, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { api, apiUrl, ApiError, isAbortError } from '@/lib/api';
import { useToast } from '@/lib/toast-context';

interface StockRow {
    id: number;
    ticker: string;
    name: string;
    price: number;
    previousPrice: number;
    updatedAt: string;
}

interface HoldingRow {
    id: number;
    ticker: string;
    quantity: number;
    avgBuyPrice: number;
    currentPrice: number;
    currentValue: number;
    profitLoss: number;
}

interface PricePoint {
    ticker: string;
    price: number;
    recordedAt: string;
}

interface TradeMarker {
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    createdAt: string;
}

const CHART_W = 640;
const CHART_H = 268;
const PAD_L = 56;
const PAD_R = 16;
const PAD_T = 20;
const PAD_B = 28;
const HISTORY_CAP = 120;
const FLASH_MS = 900;
const AXIS_TICKS = 4;
// Distinct from the up/down trend colors (emerald/destructive) on purpose —
// buy/sell is a separate identity channel from the price-delta status color,
// so a marker never reads as "the line just went up/down" by accident.
const BUY_COLOR = '#3b82f6'; // blue-500
const SELL_COLOR = '#d97706'; // amber-600
// StockPriceJob ticks every minute (`* * * * *`) — see apps/bot/src/jobs/StockPriceJob.ts.
const TICK_INTERVAL_MS = 60_000;

function buildSmoothPath(coords: [number, number][]): string {
    if (coords.length < 2) return '';
    if (coords.length === 2) {
        return `M${coords[0]![0]},${coords[0]![1]} L${coords[1]![0]},${coords[1]![1]}`;
    }
    let d = `M${coords[0]![0]},${coords[0]![1]}`;
    for (let i = 0; i < coords.length - 1; i++) {
        const p0 = coords[i - 1] ?? coords[i]!;
        const p1 = coords[i]!;
        const p2 = coords[i + 1]!;
        const p3 = coords[i + 2] ?? p2;
        const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
        const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
        const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
        const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
    }
    return d;
}

function formatClock(iso: string) {
    return new Date(iso).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function tradeTitle(trade: TradeMarker): string {
    const verb = trade.side === 'buy' ? 'Achat' : 'Vente';
    return `${verb} de ${trade.quantity} @ ${trade.price} 🪙 — ${formatClock(trade.createdAt)}`;
}

function PriceChart({
    points,
    trades,
    live,
}: {
    points: PricePoint[];
    trades: TradeMarker[];
    live: boolean;
}) {
    const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

    if (points.length < 2) {
        return (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Pas encore assez d'historique.
            </div>
        );
    }

    const times = points.map((p) => new Date(p.recordedAt).getTime());
    const minTime = times[0]!;
    const maxTime = times[times.length - 1]!;
    const timeRange = maxTime - minTime || 1;

    const prices = points.map((p) => p.price);
    const visibleTrades = trades.filter(
        (t) => t.price > 0 && new Date(t.createdAt).getTime() >= minTime
    );
    const rawMin = Math.min(...prices, ...visibleTrades.map((t) => t.price));
    const rawMax = Math.max(...prices, ...visibleTrades.map((t) => t.price));
    const pad = (rawMax - rawMin || rawMax * 0.05 || 1) * 0.15;
    const min = rawMin - pad;
    const max = rawMax + pad;
    const range = max - min || 1;

    const plotW = CHART_W - PAD_L - PAD_R;
    const plotH = CHART_H - PAD_T - PAD_B;

    const xForTime = (t: number) => PAD_L + ((t - minTime) / timeRange) * plotW;
    const yForPrice = (p: number) =>
        PAD_T + plotH - ((p - min) / range) * plotH;

    const coords: [number, number][] = points.map((p, i) => [
        xForTime(times[i]!),
        yForPrice(p.price),
    ]);

    const linePath = buildSmoothPath(coords);
    const first = points[0]!.price;
    const last = points[points.length - 1]!.price;
    const up = last >= first;
    const color = up
        ? 'var(--color-emerald-500, #10b981)'
        : 'var(--color-destructive, #ef4444)';
    const lastCoord = coords[coords.length - 1]!;
    const areaPath = `${linePath} L${lastCoord[0]},${PAD_T + plotH} L${coords[0]![0]},${PAD_T + plotH} Z`;
    const gradientId = `priceFill-${up ? 'up' : 'down'}`;

    const gridFracs = [0, 1 / 3, 2 / 3, 1];
    const axisTimeFracs = Array.from(
        { length: AXIS_TICKS },
        (_, i) => i / (AXIS_TICKS - 1)
    );

    const markers = visibleTrades.map((trade) => ({
        trade,
        x: Math.min(
            CHART_W - PAD_R,
            Math.max(PAD_L, xForTime(new Date(trade.createdAt).getTime()))
        ),
        y: yForPrice(trade.price),
    }));

    const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const relX = ((e.clientX - rect.left) / rect.width) * CHART_W;
        let nearest = 0;
        let nearestDist = Infinity;
        coords.forEach(([x], i) => {
            const dist = Math.abs(x - relX);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = i;
            }
        });
        setHoverIndex(nearest);
    };

    const hovered = hoverIndex !== null ? points[hoverIndex] : null;
    const hoveredCoord = hoverIndex !== null ? coords[hoverIndex]! : null;

    return (
        <div className="relative">
            <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="h-64 w-full"
                onMouseMove={handleMove}
                onMouseLeave={() => setHoverIndex(null)}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop
                            offset="0%"
                            stopColor={color}
                            stopOpacity={0.26}
                        />
                        <stop
                            offset="55%"
                            stopColor={color}
                            stopOpacity={0.08}
                        />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>

                {gridFracs.map((f) => {
                    const y = PAD_T + plotH * (1 - f);
                    const price = min + f * range;
                    return (
                        <g key={f}>
                            <line
                                x1={PAD_L}
                                x2={CHART_W - PAD_R}
                                y1={y}
                                y2={y}
                                className={
                                    f === 0
                                        ? 'stroke-border'
                                        : 'stroke-border/40'
                                }
                                strokeWidth={1}
                            />
                            <text
                                x={PAD_L - 8}
                                y={y}
                                textAnchor="end"
                                dominantBaseline="middle"
                                className="fill-muted-foreground text-[9px] tabular-nums"
                            >
                                {Math.round(price)}
                            </text>
                        </g>
                    );
                })}

                {axisTimeFracs.map((f) => {
                    const t = minTime + f * timeRange;
                    const x = xForTime(t);
                    return (
                        <text
                            key={f}
                            x={x}
                            y={CHART_H - 8}
                            textAnchor={
                                f === 0 ? 'start' : f === 1 ? 'end' : 'middle'
                            }
                            className="fill-muted-foreground text-[9px] tabular-nums"
                        >
                            {formatClock(new Date(t).toISOString())}
                        </text>
                    );
                })}

                <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
                <path
                    d={linePath}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                        filter: `drop-shadow(0 1px 3px color-mix(in srgb, ${color} 45%, transparent))`,
                    }}
                />

                <circle
                    cx={lastCoord[0]}
                    cy={lastCoord[1]}
                    r={4}
                    fill={color}
                    stroke="var(--color-card, white)"
                    strokeWidth={2}
                >
                    {live && (
                        <>
                            <animate
                                attributeName="r"
                                values="4;7;4"
                                dur="1.6s"
                                repeatCount="indefinite"
                            />
                            <animate
                                attributeName="opacity"
                                values="1;0.35;1"
                                dur="1.6s"
                                repeatCount="indefinite"
                            />
                        </>
                    )}
                </circle>

                {markers.map((m, i) => {
                    const markerColor =
                        m.trade.side === 'buy' ? BUY_COLOR : SELL_COLOR;
                    const dir = m.trade.side === 'buy' ? -1 : 1;
                    const ty = m.y + dir * 11;
                    const points3 = [
                        [m.x, ty - dir * 5],
                        [m.x - 4.5, ty + dir * 4],
                        [m.x + 4.5, ty + dir * 4],
                    ]
                        .map(([x, y]) => `${x},${y}`)
                        .join(' ');
                    return (
                        <g key={i} className="cursor-help">
                            <title>{tradeTitle(m.trade)}</title>
                            <line
                                x1={m.x}
                                x2={m.x}
                                y1={m.y}
                                y2={ty}
                                stroke={markerColor}
                                strokeWidth={1}
                                strokeOpacity={0.5}
                            />
                            {/* larger transparent hit area than the painted triangle */}
                            <circle
                                cx={m.x}
                                cy={ty}
                                r={10}
                                fill="transparent"
                            />
                            <polygon
                                points={points3}
                                fill={markerColor}
                                stroke="var(--color-card, white)"
                                strokeWidth={1.25}
                            />
                        </g>
                    );
                })}

                {hoveredCoord && (
                    <>
                        <line
                            x1={hoveredCoord[0]}
                            x2={hoveredCoord[0]}
                            y1={PAD_T}
                            y2={PAD_T + plotH}
                            className="stroke-muted-foreground/40"
                            strokeWidth={1}
                            strokeDasharray="3 3"
                        />
                        <circle
                            cx={hoveredCoord[0]}
                            cy={hoveredCoord[1]}
                            r={5}
                            fill={color}
                            stroke="var(--color-card, white)"
                            strokeWidth={2}
                        />
                    </>
                )}
            </svg>

            {hovered && hoveredCoord && (
                <div
                    className="pointer-events-none absolute top-1 rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-lg"
                    style={{
                        left: `${(hoveredCoord[0] / CHART_W) * 100}%`,
                        transform:
                            hoveredCoord[0] > CHART_W * 0.7
                                ? 'translateX(-100%)'
                                : hoveredCoord[0] < CHART_W * 0.3
                                  ? 'translateX(0)'
                                  : 'translateX(-50%)',
                    }}
                >
                    <p className="flex items-center gap-1.5 font-semibold tabular-nums">
                        <span
                            className="inline-block h-0.5 w-2.5 rounded-full"
                            style={{ backgroundColor: color }}
                        />
                        {hovered.price} 🪙
                    </p>
                    <p className="mt-0.5 text-muted-foreground tabular-nums">
                        {formatClock(hovered.recordedAt)}
                    </p>
                </div>
            )}

            <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                    <span
                        className="inline-block size-2 rounded-[2px]"
                        style={{ backgroundColor: BUY_COLOR }}
                    />
                    Achat
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span
                        className="inline-block size-2 rounded-[2px]"
                        style={{ backgroundColor: SELL_COLOR }}
                    />
                    Vente
                </span>
            </div>
        </div>
    );
}

function ChangeBadge({
    price,
    previousPrice,
}: {
    price: number;
    previousPrice: number;
}) {
    const diff = price - previousPrice;
    if (diff === 0) {
        return (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Minus className="size-3" />0
            </span>
        );
    }
    const up = diff > 0;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1',
                up ? 'text-emerald-500' : 'text-destructive'
            )}
        >
            {up ? (
                <ArrowUp className="size-3" />
            ) : (
                <ArrowDown className="size-3" />
            )}
            {Math.abs(diff)}
        </span>
    );
}

export function InvestPage() {
    const { guildId } = useParams();
    const toast = useToast();
    const [tab, setTab] = React.useState<'market' | 'portfolio'>('market');
    const [stocks, setStocks] = React.useState<StockRow[] | null>(null);
    const [portfolio, setPortfolio] = React.useState<HoldingRow[] | null>(null);
    const [quantities, setQuantities] = React.useState<Record<string, number>>(
        {}
    );
    const [selected, setSelected] = React.useState<string | null>(null);
    const [history, setHistory] = React.useState<PricePoint[] | null>(null);
    const [trades, setTrades] = React.useState<TradeMarker[]>([]);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [connected, setConnected] = React.useState(false);
    const [flash, setFlash] = React.useState<Record<string, 'up' | 'down'>>({});

    const selectedRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        selectedRef.current = selected;
    }, [selected]);

    const [now, setNow] = React.useState(() => Date.now());
    React.useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const secondsToNextTick = React.useMemo(() => {
        if (!stocks || stocks.length === 0) return null;
        const latestUpdatedAt = Math.max(
            ...stocks.map((s) => new Date(s.updatedAt).getTime())
        );
        const remaining = Math.ceil(
            (latestUpdatedAt + TICK_INTERVAL_MS - now) / 1000
        );
        return Math.min(60, Math.max(0, remaining));
    }, [stocks, now]);

    const loadMarket = React.useCallback(
        (signal?: AbortSignal) => {
            if (!guildId) return;
            api.get<StockRow[]>(`/api/guilds/${guildId}/invest/market`, {
                signal,
            })
                .then(setStocks)
                .catch((err: unknown) => {
                    if (isAbortError(err)) return;
                    setError(err instanceof Error ? err.message : String(err));
                });
        },
        [guildId]
    );

    const loadPortfolio = React.useCallback(
        (signal?: AbortSignal) => {
            if (!guildId) return;
            api.get<HoldingRow[]>(`/api/guilds/${guildId}/invest/portfolio`, {
                signal,
            })
                .then(setPortfolio)
                .catch((err: unknown) => {
                    if (isAbortError(err)) return;
                    setError(err instanceof Error ? err.message : String(err));
                });
        },
        [guildId]
    );

    React.useEffect(() => {
        const controller = new AbortController();
        loadMarket(controller.signal);
        loadPortfolio(controller.signal);
        return () => controller.abort();
    }, [loadMarket, loadPortfolio]);

    // Live price feed: the bot's StockPriceJob ticks prices once a minute,
    // this pushes that same snapshot to the panel the moment it changes
    // instead of waiting for a manual refresh.
    React.useEffect(() => {
        if (!guildId) return;

        const es = new EventSource(
            apiUrl(`/api/guilds/${guildId}/invest/stream`),
            { withCredentials: true }
        );

        es.onopen = () => setConnected(true);
        es.onerror = () => setConnected(false);

        es.addEventListener('market', (event) => {
            const rows = JSON.parse(
                (event as MessageEvent<string>).data
            ) as StockRow[];

            setStocks((prev) => {
                const prevByTicker = new Map(
                    (prev ?? []).map((s) => [s.ticker, s])
                );
                const changed: Record<string, 'up' | 'down'> = {};
                for (const row of rows) {
                    const prevRow = prevByTicker.get(row.ticker);
                    if (prevRow && prevRow.price !== row.price) {
                        changed[row.ticker] =
                            row.price > prevRow.price ? 'up' : 'down';
                    }
                }
                if (Object.keys(changed).length > 0) {
                    setFlash((f) => ({ ...f, ...changed }));
                    for (const ticker of Object.keys(changed)) {
                        setTimeout(() => {
                            setFlash((f) => {
                                if (!(ticker in f)) return f;
                                const next = { ...f };
                                delete next[ticker];
                                return next;
                            });
                        }, FLASH_MS);
                    }
                }
                return rows;
            });

            setHistory((prev) => {
                if (!prev || !selectedRef.current) return prev;
                const row = rows.find((r) => r.ticker === selectedRef.current);
                if (!row) return prev;
                const lastPoint = prev[prev.length - 1];
                if (lastPoint && lastPoint.price === row.price) return prev;
                const next = [
                    ...prev,
                    {
                        ticker: row.ticker,
                        price: row.price,
                        recordedAt: row.updatedAt,
                    },
                ];
                return next.length > HISTORY_CAP
                    ? next.slice(next.length - HISTORY_CAP)
                    : next;
            });
        });

        return () => {
            es.close();
            setConnected(false);
        };
    }, [guildId]);

    const loadTrades = React.useCallback(
        (ticker: string) => {
            if (!guildId) return;
            api.get<TradeMarker[]>(
                `/api/guilds/${guildId}/invest/market/${ticker}/trades`
            )
                .then(setTrades)
                .catch(() => setTrades([]));
        },
        [guildId]
    );

    const toggleHistory = async (ticker: string) => {
        if (selected === ticker) {
            setSelected(null);
            setHistory(null);
            setTrades([]);
            return;
        }
        setSelected(ticker);
        setHistory(null);
        setTrades([]);
        if (!guildId) return;
        try {
            const rows = await api.get<PricePoint[]>(
                `/api/guilds/${guildId}/invest/market/${ticker}/history`
            );
            setHistory(rows);
            loadTrades(ticker);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const handleBuy = async (ticker: string) => {
        if (!guildId) return;
        const quantity = quantities[ticker] || 0;
        if (quantity <= 0) return;
        setBusy(true);
        setError(null);
        try {
            await api.post(`/api/guilds/${guildId}/invest/buy`, {
                ticker,
                quantity,
            });
            toast.success(`Achat : ${quantity}x ${ticker}`);
            loadMarket();
            loadPortfolio();
            if (selectedRef.current === ticker) loadTrades(ticker);
        } catch (err) {
            const message = err instanceof ApiError ? err.message : String(err);
            setError(message);
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    const handleSellAll = async (ticker: string) => {
        if (!guildId) return;
        setBusy(true);
        setError(null);
        try {
            await api.post(`/api/guilds/${guildId}/invest/sell-all`, {
                ticker,
            });
            toast.success(`Position vendue : ${ticker}`);
            loadMarket();
            loadPortfolio();
            if (selectedRef.current === ticker) loadTrades(ticker);
        } catch (err) {
            const message = err instanceof ApiError ? err.message : String(err);
            setError(message);
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    const selectedStock = stocks?.find((s) => s.ticker === selected) ?? null;

    // Reprices holdings against the live SSE feed so P/L updates in step
    // with the market table instead of only refreshing after a trade.
    const livePortfolio = React.useMemo(() => {
        if (!portfolio) return null;
        if (!stocks) return portfolio;
        return portfolio.map((h) => {
            const live = stocks.find((s) => s.ticker === h.ticker);
            if (!live) return h;
            const currentValue = live.price * h.quantity;
            return {
                ...h,
                currentPrice: live.price,
                currentValue,
                profitLoss: currentValue - h.avgBuyPrice * h.quantity,
            };
        });
    }, [portfolio, stocks]);

    return (
        <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Bourse</h1>
                <div className="flex items-center gap-2">
                    {secondsToNextTick !== null && (
                        <span
                            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground"
                            title="Le cours des actions évolue une fois par minute"
                        >
                            <Clock className="size-3" />
                            Actualisation dans {secondsToNextTick}s
                        </span>
                    )}
                    <span
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                            connected
                                ? 'border-emerald-500/30 text-emerald-500'
                                : 'text-muted-foreground'
                        )}
                    >
                        <span
                            className={cn(
                                'size-1.5 rounded-full',
                                connected
                                    ? 'animate-pulse bg-emerald-500'
                                    : 'bg-muted-foreground'
                            )}
                        />
                        {connected ? 'En direct' : 'Connexion...'}
                    </span>
                </div>
            </div>

            <div className="mb-4 flex gap-2">
                <Button
                    size="sm"
                    variant={tab === 'market' ? 'default' : 'outline'}
                    onClick={() => setTab('market')}
                >
                    Marché
                </Button>
                <Button
                    size="sm"
                    variant={tab === 'portfolio' ? 'default' : 'outline'}
                    onClick={() => setTab('portfolio')}
                >
                    Portefeuille
                </Button>
            </div>

            {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

            {tab === 'market' && selected && (
                <Card className="mb-4">
                    <CardContent className="p-4">
                        <div className="mb-3 flex items-start justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">
                                    {selectedStock?.name ?? selected}
                                </p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-semibold">
                                        {selectedStock?.price ?? '—'} 🪙
                                    </span>
                                    {selectedStock && (
                                        <ChangeBadge
                                            price={selectedStock.price}
                                            previousPrice={
                                                selectedStock.previousPrice
                                            }
                                        />
                                    )}
                                </div>
                            </div>
                            <button
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                    setSelected(null);
                                    setHistory(null);
                                }}
                                aria-label="Fermer le graphique"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                        {history ? (
                            <PriceChart
                                points={history}
                                trades={trades}
                                live={connected}
                            />
                        ) : (
                            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                                Chargement de l'historique...
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {tab === 'market' && (
                <Card>
                    <CardContent className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                    <th className="py-2 font-medium">Action</th>
                                    <th className="py-2 font-medium">Prix</th>
                                    <th className="py-2 font-medium">
                                        Variation
                                    </th>
                                    <th className="py-2 font-medium">
                                        Quantité
                                    </th>
                                    <th className="py-2 font-medium" />
                                </tr>
                            </thead>
                            <tbody>
                                {!stocks && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="py-4 text-center text-muted-foreground"
                                        >
                                            Chargement...
                                        </td>
                                    </tr>
                                )}
                                {stocks?.map((stock) => (
                                    <tr
                                        key={stock.ticker}
                                        className={cn(
                                            'border-b transition-colors duration-700 last:border-0',
                                            selected === stock.ticker &&
                                                'bg-accent/40',
                                            flash[stock.ticker] === 'up' &&
                                                'bg-emerald-500/15',
                                            flash[stock.ticker] === 'down' &&
                                                'bg-red-500/15'
                                        )}
                                    >
                                        <td className="py-2">
                                            <button
                                                className="text-left hover:underline"
                                                onClick={() =>
                                                    toggleHistory(stock.ticker)
                                                }
                                            >
                                                <span className="font-semibold">
                                                    {stock.ticker}
                                                </span>
                                                <span className="ml-2 text-muted-foreground">
                                                    {stock.name}
                                                </span>
                                            </button>
                                        </td>
                                        <td className="py-2">
                                            {stock.price} 🪙
                                        </td>
                                        <td className="py-2">
                                            <ChangeBadge
                                                price={stock.price}
                                                previousPrice={
                                                    stock.previousPrice
                                                }
                                            />
                                        </td>
                                        <td className="py-2">
                                            <Input
                                                type="number"
                                                min={1}
                                                className="h-8 w-20"
                                                value={
                                                    quantities[stock.ticker] ??
                                                    ''
                                                }
                                                onChange={(e) =>
                                                    setQuantities((q) => ({
                                                        ...q,
                                                        [stock.ticker]:
                                                            Number(
                                                                e.target.value
                                                            ) || 0,
                                                    }))
                                                }
                                            />
                                        </td>
                                        <td className="py-2">
                                            <Button
                                                size="sm"
                                                disabled={
                                                    busy ||
                                                    (quantities[stock.ticker] ??
                                                        0) <= 0
                                                }
                                                onClick={() =>
                                                    handleBuy(stock.ticker)
                                                }
                                            >
                                                Acheter
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            {tab === 'portfolio' && (
                <Card>
                    <CardContent className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                    <th className="py-2 font-medium">Action</th>
                                    <th className="py-2 font-medium">
                                        Quantité
                                    </th>
                                    <th className="py-2 font-medium">
                                        Prix moyen
                                    </th>
                                    <th className="py-2 font-medium">
                                        Valeur actuelle
                                    </th>
                                    <th className="py-2 font-medium">P/L</th>
                                    <th className="py-2 font-medium" />
                                </tr>
                            </thead>
                            <tbody>
                                {!livePortfolio && (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="py-4 text-center text-muted-foreground"
                                        >
                                            Chargement...
                                        </td>
                                    </tr>
                                )}
                                {livePortfolio?.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="py-4 text-center text-muted-foreground"
                                        >
                                            Aucune position.
                                        </td>
                                    </tr>
                                )}
                                {livePortfolio?.map((h) => (
                                    <tr
                                        key={h.ticker}
                                        className={cn(
                                            'border-b transition-colors duration-700 last:border-0',
                                            flash[h.ticker] === 'up' &&
                                                'bg-emerald-500/15',
                                            flash[h.ticker] === 'down' &&
                                                'bg-red-500/15'
                                        )}
                                    >
                                        <td className="py-2 font-semibold">
                                            {h.ticker}
                                        </td>
                                        <td className="py-2">{h.quantity}</td>
                                        <td className="py-2">
                                            {h.avgBuyPrice} 🪙
                                        </td>
                                        <td className="py-2">
                                            {h.currentValue} 🪙
                                        </td>
                                        <td
                                            className={cn(
                                                'py-2 font-medium',
                                                h.profitLoss >= 0
                                                    ? 'text-emerald-500'
                                                    : 'text-destructive'
                                            )}
                                        >
                                            {h.profitLoss >= 0 ? '+' : ''}
                                            {h.profitLoss} 🪙
                                        </td>
                                        <td className="py-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={busy}
                                                onClick={() =>
                                                    handleSellAll(h.ticker)
                                                }
                                            >
                                                Tout vendre
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
