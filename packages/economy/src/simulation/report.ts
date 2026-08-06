import {
    CHART_PALETTE,
    buildMultiLineChartSvg,
    type ChartSeries,
} from './svgChart.js';
import type { DailyFlowBreakdown, DailySnapshot } from './tick.js';
import type { SimulationParams } from './params.js';

const FLOW_KEYS: (keyof DailyFlowBreakdown)[] = [
    'daily',
    'work',
    'casino',
    'bankInterest',
    'weeklyLeaderboard',
    'quests',
    'randomEvents',
    'shop',
    'stockNet',
    'robNet',
];

const FLOW_LABELS: Record<keyof DailyFlowBreakdown, string> = {
    daily: 'Daily claim',
    work: 'Work',
    casino: 'Casino',
    bankInterest: 'Bank interest',
    weeklyLeaderboard: 'Weekly leaderboard',
    quests: 'Quests',
    randomEvents: 'Random events',
    shop: 'Shop',
    stockNet: 'Stocks',
    robNet: 'Rob',
};

function usedFlowKeys(
    series: DailySnapshot[],
    pick: (s: DailySnapshot) => DailyFlowBreakdown
): (keyof DailyFlowBreakdown)[] {
    return FLOW_KEYS.filter((key) => series.some((s) => pick(s)[key] !== 0));
}

function flowSeries(
    series: DailySnapshot[],
    keys: (keyof DailyFlowBreakdown)[],
    pick: (s: DailySnapshot) => DailyFlowBreakdown
): ChartSeries[] {
    return keys.map((key, i) => ({
        label: FLOW_LABELS[key],
        color: CHART_PALETTE[i % CHART_PALETTE.length]!,
        points: series.map((s) => pick(s)[key]),
    }));
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
}

function paramsSummaryTable(params: SimulationParams): string {
    const rows: [string, string][] = [
        ['Players', params.playerCount.toLocaleString()],
        ['Days', params.days.toLocaleString()],
        ['Active fraction', formatPercent(params.activeFraction)],
        ['Daily claim rate', formatPercent(params.dailyClaimRate)],
        ['Work shifts/active day', params.avgWorkShiftsPerActiveDay.toFixed(2)],
        ['Casino participation', formatPercent(params.casinoParticipationRate)],
        [
            'Casino bets/active player',
            params.avgCasinoBetsPerActivePlayer.toFixed(2),
        ],
        ['Avg bet fraction', formatPercent(params.avgBetFraction)],
        ['Deposit rate', formatPercent(params.depositRate)],
        ['Rob attempt rate', formatPercent(params.robAttemptRate)],
    ];
    return `<table class="params">${rows
        .map(
            ([label, value]) =>
                `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
        )
        .join('')}</table>`;
}

function chartCard(svg: string): string {
    return `<div class="card">${svg}</div>`;
}

/**
 * Inner report content only (no <!DOCTYPE>/<html>/<head>/<body>) — used both
 * to build the standalone CLI report and to publish as a chat artifact.
 */
export function buildReportBody(
    series: DailySnapshot[],
    params: SimulationParams
): string {
    if (series.length === 0) {
        return '<p>No days simulated.</p>';
    }

    const days = series.map((s) => s.day);
    const inflowKeys = usedFlowKeys(series, (s) => s.inflow);
    const outflowKeys = usedFlowKeys(series, (s) => s.outflow);
    const netKeys = Array.from(new Set([...inflowKeys, ...outflowKeys]));

    const supplyChart = buildMultiLineChartSvg({
        title: 'Total money supply',
        xLabels: days,
        series: [
            {
                label: 'Total supply',
                color: CHART_PALETTE[0]!,
                points: series.map((s) => s.totalSupply),
            },
        ],
    });

    const wealthChart = buildMultiLineChartSvg({
        title: 'Wealth distribution — mean vs median',
        xLabels: days,
        series: [
            {
                label: 'Mean wealth',
                color: CHART_PALETTE[0]!,
                points: series.map((s) => s.meanWealth),
            },
            {
                label: 'Median wealth',
                color: CHART_PALETTE[1]!,
                points: series.map((s) => s.medianWealth),
            },
        ],
    });

    const giniChart = buildMultiLineChartSvg({
        title: 'Inequality (Gini coefficient)',
        xLabels: days,
        yFormat: (v) => v.toFixed(2),
        series: [
            {
                label: 'Gini',
                color: CHART_PALETTE[2]!,
                points: series.map((s) => s.gini),
            },
        ],
    });

    const inflowChart = buildMultiLineChartSvg({
        title: 'Inflow by source',
        xLabels: days,
        series: flowSeries(series, inflowKeys, (s) => s.inflow),
    });

    const outflowChart = buildMultiLineChartSvg({
        title: 'Outflow by sink',
        xLabels: days,
        series: flowSeries(series, outflowKeys, (s) => s.outflow),
    });

    const netChart = buildMultiLineChartSvg({
        title: 'Net flow by category (inflow − outflow)',
        xLabels: days,
        series: netKeys.map((key, i) => ({
            label: FLOW_LABELS[key],
            color: CHART_PALETTE[i % CHART_PALETTE.length]!,
            points: series.map((s) => s.inflow[key] - s.outflow[key]),
        })),
    });

    return `<style>
    .sim-report { color: #DBDEE1; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; }
    .sim-report h1 { font-size: 20px; margin: 0 0 4px; color: #F2F3F5; }
    .sim-report .subtitle { color: #949BA4; font-size: 13px; margin: 0 0 18px; }
    .sim-report .params { border-collapse: collapse; margin-bottom: 22px; font-size: 13px; }
    .sim-report .params th { text-align: left; color: #949BA4; font-weight: 500; padding: 4px 20px 4px 0; }
    .sim-report .params td { text-align: left; color: #F2F3F5; padding: 4px 0; font-variant-numeric: tabular-nums; }
    .sim-report .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(560px, 1fr)); gap: 20px; }
    .sim-report .card { background: #2B2D31; border-radius: 10px; padding: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25); }
    .sim-report .card svg { width: 100%; height: auto; display: block; }
    </style>
    <div class="sim-report">
        <h1>Economy simulation report</h1>
        <p class="subtitle">${series.length} simulated day(s) &middot; ${params.playerCount.toLocaleString()} players</p>
        ${paramsSummaryTable(params)}
        <div class="grid">
            ${chartCard(supplyChart)}
            ${chartCard(wealthChart)}
            ${chartCard(giniChart)}
            ${chartCard(inflowChart)}
            ${chartCard(outflowChart)}
            ${chartCard(netChart)}
        </div>
    </div>`;
}

export function buildHtmlReport(
    series: DailySnapshot[],
    params: SimulationParams
): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Economy simulation report</title>
</head>
<body style="margin:0; padding:24px; background:#1E1F22;">
${buildReportBody(series, params)}
</body>
</html>
`;
}
