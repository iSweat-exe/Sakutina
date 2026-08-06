import { describe, expect, test } from 'bun:test';
import { buildMultiLineChartSvg } from './svgChart.js';

describe('buildMultiLineChartSvg', () => {
    test('renders a valid svg with one polyline per series', () => {
        const svg = buildMultiLineChartSvg({
            title: 'Test chart',
            xLabels: [0, 1, 2],
            series: [
                { label: 'A', color: '#111111', points: [1, 2, 3] },
                { label: 'B', color: '#222222', points: [3, 2, 1] },
            ],
        });

        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toContain('Test chart');
        expect(svg.match(/<polyline/g)).toHaveLength(2);
        expect(svg).toContain('stroke="#111111"');
        expect(svg).toContain('stroke="#222222"');
    });

    test('renders a legend only when there is more than one series', () => {
        const single = buildMultiLineChartSvg({
            title: 'Single',
            xLabels: [0, 1],
            series: [{ label: 'Only', color: '#111111', points: [1, 2] }],
        });
        const multi = buildMultiLineChartSvg({
            title: 'Multi',
            xLabels: [0, 1],
            series: [
                { label: 'A', color: '#111111', points: [1, 2] },
                { label: 'B', color: '#222222', points: [2, 1] },
            ],
        });

        expect(single).not.toContain('>A<');
        expect(multi).toContain('>A</text>');
        expect(multi).toContain('>B</text>');
    });

    test('does not throw on an empty series list', () => {
        const svg = buildMultiLineChartSvg({
            title: 'Empty',
            xLabels: [],
            series: [],
        });
        expect(svg.startsWith('<svg')).toBe(true);
    });

    test('escapes XML-sensitive characters in title and labels', () => {
        const svg = buildMultiLineChartSvg({
            title: 'A & B <test>',
            xLabels: [0, 1],
            series: [
                { label: 'X & Y', color: '#111111', points: [1, 2] },
                { label: 'Z', color: '#222222', points: [2, 1] },
            ],
        });
        expect(svg).toContain('A &amp; B &lt;test&gt;');
        expect(svg).toContain('X &amp; Y');
    });
});
