/** Formats a duration in seconds as a compact "Xm Ys" / "Ys" string. */
export function formatDuration(totalSeconds: number): string {
    const s = Math.max(0, Math.round(totalSeconds));
    const minutes = Math.floor(s / 60);
    const seconds = s % 60;
    return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`;
}
