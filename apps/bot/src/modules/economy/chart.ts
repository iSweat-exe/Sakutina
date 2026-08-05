import type { StockPriceHistoryRow } from '@sakutina/db';

const UP_COLOR = '#2ECC71';
const DOWN_COLOR = '#ED4245';
const GRID_COLOR = 'rgba(255, 255, 255, 0.07)';
const TEXT_COLOR = '#B9BBBE';
const BG_COLOR = '#2B2D31'; // Discord dark-theme surface, so the image blends into the embed

// Discord rejects embed image URLs over 2048 chars ("Invalid Form Body").
// QuickChart bakes the whole Chart.js config into the query string, so the
// history fed into it must stay short regardless of how much is in the DB.
const MAX_CHART_POINTS = 15;

/**
 * Builds a QuickChart (quickchart.io) line-chart image URL for a ticker's
 * recent price history. No local rendering/canvas dependency needed —
 * Discord fetches the image directly from the URL when the embed renders.
 */
export function buildStockChartUrl(
    ticker: string,
    history: StockPriceHistoryRow[],
    currentPrice: number
): string {
    const trimmed = history.slice(-MAX_CHART_POINTS);
    const prices = trimmed.map((h) => h.price);
    // Labels are hidden on the x-axis (see ticks.display below) — plain
    // indices keep the payload small instead of encoded timestamp strings.
    const labels = prices.map((_, i) => i);
    labels.push(labels.length);
    prices.push(currentPrice);

    const openPrice = prices[0] ?? currentPrice;
    const isUp = currentPrice >= openPrice;
    const lineColor = isUp ? UP_COLOR : DOWN_COLOR;
    const fillColor = isUp
        ? 'rgba(46, 204, 113, 0.15)'
        : 'rgba(237, 66, 69, 0.15)';

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = Math.max(1, Math.round((max - min) * 0.2));

    const config = {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: ticker,
                    data: prices,
                    fill: true,
                    backgroundColor: fillColor,
                    borderColor: lineColor,
                    borderWidth: 3,
                    tension: 0.35,
                    pointRadius: prices.map((_, i) =>
                        i === prices.length - 1 ? 5 : 0
                    ),
                    pointHoverRadius: 5,
                    pointBackgroundColor: lineColor,
                    pointBorderColor: BG_COLOR,
                    pointBorderWidth: 2,
                },
            ],
        },
        options: {
            layout: { padding: { top: 20, right: 20, bottom: 4, left: 4 } },
            plugins: {
                legend: { display: false },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { display: false },
                },
                y: {
                    min: Math.max(0, min - padding),
                    max: max + padding,
                    grid: { color: GRID_COLOR },
                    ticks: { color: TEXT_COLOR },
                },
            },
        },
    };

    const params = new URLSearchParams({
        width: '640',
        height: '340',
        backgroundColor: BG_COLOR,
        devicePixelRatio: '2',
        version: '4',
        f: 'png',
        c: JSON.stringify(config),
    });

    return `https://quickchart.io/chart?${params.toString()}`;
}
