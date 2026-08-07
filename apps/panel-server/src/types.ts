import type { SessionPayload } from './auth/session.js';

export interface AppEnv {
    Variables: {
        session: SessionPayload;
        guildId: string;
    };
}
