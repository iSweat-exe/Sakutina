/**
 * Dependency-free multi-line SVG chart renderer. Colors mirror the bot's
 * QuickChart theme in apps/bot/src/modules/economy/chart.ts (dark Discord
 * surface, muted grid/text) but support N series instead of QuickChart's
 * single-line, URL-length-limited charts.
 */

export interface ChartSeries {
    label: string;
    color: string;
    points: number[];
}

export interface LineChartOptions {
    title: string;
    series: ChartSeries[];
    xLabels: (string | number)[];
    width?: number;
    height?: number;
    yFormat?: (value: number) => string;
}

const BG_COLOR = '#2B2D31';
const GRID_COLOR = 'rgba(255, 255, 255, 0.07)';
const AXIS_COLOR = 'rgba(255, 255, 255, 0.18)';
const TEXT_COLOR = '#B9BBBE';
const TITLE_COLOR = '#F2F3F5';
const FONT = 'Segoe UI, Helvetica, Arial, sans-serif';

/** Distinct, colorblind-tolerant palette; reused round-robin past 10 series. */
export const CHART_PALETTE = [
    '#5865F2',
    '#2ECC71',
    '#ED4245',
    '#FEE75C',
    '#EB459E',
    '#57F287',
    '#FAA61A',
    '#3BA55D',
    '#9B59B6',
    '#00B0F4',
];

function defaultYFormat(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(0);
}

function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Rough glyph width for the legend's 12px label font; used to flow-wrap items instead of assuming a fixed column width. */
const LEGEND_CHAR_WIDTH = 6.4;
const LEGEND_SWATCH_GAP = 16;
const LEGEND_ITEM_GAP = 20;
const LEGEND_ROW_HEIGHT = 20;

interface LegendPosition {
    x: number;
    y: number;
}

function layoutLegend(
    labels: string[],
    availableWidth: number,
    originX: number,
    originY: number
): { positions: LegendPosition[]; rows: number } {
    const positions: LegendPosition[] = [];
    let cursorX = 0;
    let row = 0;
    for (const label of labels) {
        const itemWidth = LEGEND_SWATCH_GAP + label.length * LEGEND_CHAR_WIDTH;
        if (cursorX > 0 && cursorX + itemWidth > availableWidth) {
            row++;
            cursorX = 0;
        }
        positions.push({
            x: originX + cursorX,
            y: originY + row * LEGEND_ROW_HEIGHT,
        });
        cursorX += itemWidth + LEGEND_ITEM_GAP;
    }
    return { positions, rows: row + 1 };
}

export function buildMultiLineChartSvg(options: LineChartOptions): string {
    const width = options.width ?? 760;
    const height = options.height ?? 340;
    const yFormat = options.yFormat ?? defaultYFormat;
    const margin = { top: 34, right: 20, bottom: 30, left: 66 };

    const showLegend = options.series.length > 1;
    const legend = showLegend
        ? layoutLegend(
              options.series.map((s) => s.label),
              width - margin.left - margin.right,
              margin.left,
              margin.top + 12
          )
        : null;
    const legendHeight = legend ? legend.rows * LEGEND_ROW_HEIGHT + 8 : 0;

    const plotTop = margin.top + legendHeight;
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - plotTop - margin.bottom;

    const allPoints = options.series.flatMap((s) => s.points);
    const dataMin = allPoints.length > 0 ? Math.min(...allPoints) : 0;
    const dataMax = allPoints.length > 0 ? Math.max(...allPoints) : 1;
    const rawMin = Math.min(0, dataMin);
    const rawMax = dataMax === rawMin ? rawMin + 1 : dataMax;
    const pad = (rawMax - rawMin) * 0.08;
    const yMin = dataMin >= 0 ? Math.max(0, rawMin - pad) : rawMin - pad;
    const yMax = rawMax + pad;

    const pointCount = options.xLabels.length;
    const xStep = pointCount > 1 ? plotWidth / (pointCount - 1) : 0;
    const xForIndex = (i: number): number => margin.left + i * xStep;
    const yForValue = (v: number): number =>
        plotTop + plotHeight - ((v - yMin) / (yMax - yMin)) * plotHeight;

    const gridLineCount = 5;
    const gridLines: string[] = [];
    const yTickLabels: string[] = [];
    for (let i = 0; i <= gridLineCount; i++) {
        const v = yMin + ((yMax - yMin) * i) / gridLineCount;
        const y = yForValue(v);
        gridLines.push(
            `<line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${(width - margin.right).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${GRID_COLOR}" stroke-width="1" />`
        );
        yTickLabels.push(
            `<text x="${margin.left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="12" fill="${TEXT_COLOR}" font-family="${FONT}">${escapeXml(yFormat(v))}</text>`
        );
    }

    const maxXTicks = 8;
    const xTickStride = Math.max(1, Math.ceil(pointCount / maxXTicks));
    const xTicks: string[] = [];
    const verticalGridLines: string[] = [];
    for (let i = 0; i < pointCount; i += xTickStride) {
        const x = xForIndex(i);
        xTicks.push(
            `<text x="${x.toFixed(1)}" y="${(height - margin.bottom + 19).toFixed(1)}" text-anchor="middle" font-size="12" fill="${TEXT_COLOR}" font-family="${FONT}">${escapeXml(String(options.xLabels[i]))}</text>`
        );
        verticalGridLines.push(
            `<line x1="${x.toFixed(1)}" y1="${plotTop.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(plotTop + plotHeight).toFixed(1)}" stroke="${GRID_COLOR}" stroke-width="1" />`
        );
    }

    // Marking every vertex gets noisy once there are many days; only draw them
    // for shorter runs where each point stays individually readable.
    const showMarkers = pointCount > 1 && pointCount <= 45;

    const lines = options.series.map((s) => {
        if (s.points.length === 0) return '';
        const coords = s.points.map(
            (v, i) => [xForIndex(i), yForValue(v)] as const
        );
        const pts = coords
            .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
            .join(' ');
        const polyline = `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />`;
        if (!showMarkers) return polyline;
        const markers = coords
            .map(
                ([x, y]) =>
                    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${BG_COLOR}" stroke="${s.color}" stroke-width="2" />`
            )
            .join('');
        return polyline + markers;
    });

    const legendItems =
        legend?.positions.map((pos, i) => {
            const s = options.series[i]!;
            return `<rect x="${pos.x}" y="${pos.y - 9}" width="10" height="10" rx="2" fill="${s.color}" /><text x="${pos.x + 15}" y="${pos.y}" font-size="13" fill="${TEXT_COLOR}" font-family="${FONT}">${escapeXml(s.label)}</text>`;
        }) ?? [];

    return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(options.title)}">
    <rect x="0" y="0" width="${width}" height="${height}" fill="${BG_COLOR}" rx="10" />
    <text x="${margin.left}" y="23" font-size="16" font-weight="600" fill="${TITLE_COLOR}" font-family="${FONT}">${escapeXml(options.title)}</text>
    ${legendItems.join('\n    ')}
    ${verticalGridLines.join('\n    ')}
    ${gridLines.join('\n    ')}
    ${yTickLabels.join('\n    ')}
    ${xTicks.join('\n    ')}
    <line x1="${margin.left}" y1="${plotTop}" x2="${margin.left}" y2="${(plotTop + plotHeight).toFixed(1)}" stroke="${AXIS_COLOR}" stroke-width="1" />
    <line x1="${margin.left}" y1="${(plotTop + plotHeight).toFixed(1)}" x2="${(width - margin.right).toFixed(1)}" y2="${(plotTop + plotHeight).toFixed(1)}" stroke="${AXIS_COLOR}" stroke-width="1" />
    ${lines.join('\n    ')}
</svg>`;
}
