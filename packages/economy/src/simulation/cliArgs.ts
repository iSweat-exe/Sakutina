export interface CliArgs {
    days?: number;
    players?: number;
    jsonPath?: string;
    csvPath?: string;
    htmlPath?: string;
}

/** Hand-rolled `--flag=value` parsing — the repo has no argv library. */
export function parseSimulateArgs(argv: string[]): CliArgs {
    const args: CliArgs = {};
    for (const token of argv) {
        const eq = token.indexOf('=');
        if (eq === -1) continue;
        const key = token.slice(0, eq).replace(/^--/, '');
        const value = token.slice(eq + 1);
        switch (key) {
            case 'days':
                args.days = Number(value);
                break;
            case 'players':
                args.players = Number(value);
                break;
            case 'json':
                args.jsonPath = value;
                break;
            case 'csv':
                args.csvPath = value;
                break;
            case 'html':
                args.htmlPath = value;
                break;
        }
    }
    return args;
}
