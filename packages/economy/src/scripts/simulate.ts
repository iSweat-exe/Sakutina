/**
 * Monte-Carlo simulation of a server's virtual economy — money supply and
 * wealth distribution over N days — using the real production formulas from
 * @sakutina/economy and @sakutina/games wherever they exist, so results
 * don't drift from actual bot behavior.
 *
 * Usage: bun run economy:simulate -- [--days=90] [--players=200] [--json=./scenario.json] [--csv=./out.csv] [--html=./report.html]
 */
import {
    DEFAULT_PARAMS,
    buildHtmlReport,
    parseSimulateArgs,
    runSimulation,
    type DailyFlowBreakdown,
    type DailySnapshot,
    type SimulationParams,
} from '../simulation/index.js';

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

function emptyFlow(): DailyFlowBreakdown {
    return {
        daily: 0,
        work: 0,
        casino: 0,
        bankInterest: 0,
        weeklyLeaderboard: 0,
        quests: 0,
        randomEvents: 0,
        shop: 0,
        stockNet: 0,
        robNet: 0,
    };
}

function sumFlow(
    series: DailySnapshot[],
    pick: (s: DailySnapshot) => DailyFlowBreakdown
): DailyFlowBreakdown {
    const total = emptyFlow();
    for (const snapshot of series) {
        const flow = pick(snapshot);
        for (const key of FLOW_KEYS) total[key] += flow[key];
    }
    return total;
}

function formatRow(snapshot: DailySnapshot): string {
    return [
        `day ${snapshot.day.toString().padStart(4)}`,
        `supply ${Math.round(snapshot.totalSupply).toLocaleString()}`,
        `gini ${snapshot.gini.toFixed(3)}`,
        `median ${Math.round(snapshot.medianWealth).toLocaleString()}`,
        `mean ${Math.round(snapshot.meanWealth).toLocaleString()}`,
    ].join('  |  ');
}

function printSummary(series: DailySnapshot[]): void {
    if (series.length === 0) {
        console.log('[simulate] No days simulated.');
        return;
    }
    const first = series[0]!;
    const mid = series[Math.floor(series.length / 2)]!;
    const last = series[series.length - 1]!;

    console.log(`[simulate] Ran ${series.length} simulated day(s).\n`);
    console.log(formatRow(first));
    console.log(formatRow(mid));
    console.log(formatRow(last));

    const inflow = sumFlow(series, (s) => s.inflow);
    const outflow = sumFlow(series, (s) => s.outflow);
    console.log('\n[simulate] Totals over the run (inflow / outflow / net):');
    for (const key of FLOW_KEYS) {
        const inValue = Math.round(inflow[key]);
        const outValue = Math.round(outflow[key]);
        console.log(
            `  ${key.padEnd(18)} +${inValue.toLocaleString()} / -${outValue.toLocaleString()} / net ${(inValue - outValue).toLocaleString()}`
        );
    }

    const delta = last.totalSupply - first.totalSupply;
    console.log(
        `\n[simulate] Total supply: ${Math.round(first.totalSupply).toLocaleString()} -> ${Math.round(last.totalSupply).toLocaleString()} (${delta >= 0 ? '+' : ''}${Math.round(delta).toLocaleString()})`
    );
}

function toCsv(series: DailySnapshot[]): string {
    const header = [
        'day',
        'totalSupply',
        'gini',
        'medianWealth',
        'meanWealth',
        ...FLOW_KEYS.map((k) => `inflow_${k}`),
        ...FLOW_KEYS.map((k) => `outflow_${k}`),
    ];
    const rows = series.map((s) =>
        [
            s.day,
            s.totalSupply,
            s.gini,
            s.medianWealth,
            s.meanWealth,
            ...FLOW_KEYS.map((k) => s.inflow[k]),
            ...FLOW_KEYS.map((k) => s.outflow[k]),
        ].join(',')
    );
    return [header.join(','), ...rows].join('\n') + '\n';
}

const cliArgs = parseSimulateArgs(process.argv.slice(2));
const fileOverrides: Partial<SimulationParams> = cliArgs.jsonPath
    ? JSON.parse(await Bun.file(cliArgs.jsonPath).text())
    : {};

const params: SimulationParams = {
    ...DEFAULT_PARAMS,
    ...fileOverrides,
    ...(cliArgs.days !== undefined ? { days: cliArgs.days } : {}),
    ...(cliArgs.players !== undefined ? { playerCount: cliArgs.players } : {}),
};

const series = runSimulation(params);
printSummary(series);

if (cliArgs.csvPath) {
    await Bun.write(cliArgs.csvPath, toCsv(series));
    console.log(
        `\n[simulate] Wrote ${series.length} day(s) to ${cliArgs.csvPath}`
    );
}

if (cliArgs.htmlPath) {
    await Bun.write(cliArgs.htmlPath, buildHtmlReport(series, params));
    console.log(`[simulate] Wrote HTML report to ${cliArgs.htmlPath}`);
}

process.exit(0);
