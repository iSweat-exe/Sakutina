/**
 * Gini coefficient over an array of non-negative wealth values. 0 means
 * perfect equality, values approach 1 as wealth concentrates into fewer
 * hands. Uses the standard sorted-array formula (O(n log n)) rather than
 * the O(n^2) pairwise-difference definition, since this runs once per
 * simulated day across potentially thousands of players.
 */
export function computeGini(values: number[]): number {
    const n = values.length;
    if (n <= 1) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const total = sorted.reduce((sum, v) => sum + v, 0);
    if (total === 0) return 0;

    let weightedSum = 0;
    for (let i = 0; i < n; i++) {
        weightedSum += (i + 1) * sorted[i]!;
    }

    return (2 * weightedSum) / (n * total) - (n + 1) / n;
}

export function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1]! + sorted[mid]!) / 2
        : sorted[mid]!;
}
