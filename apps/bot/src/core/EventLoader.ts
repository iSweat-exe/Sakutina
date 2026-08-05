import type { Client, ClientEvents } from 'discord.js';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Event } from '../types/Event.js';
import { logger } from '../utils/logger.js';

export class EventLoader {
    public async loadEvents(eventsPath: string, client: Client): Promise<void> {
        const files = await readdir(eventsPath).catch(() => []);

        for (const file of files.filter(
            (f) => f.endsWith('.ts') || f.endsWith('.js')
        )) {
            try {
                const eventModule = await import(join(eventsPath, file));
                const event: Event<keyof ClientEvents> = eventModule.default;

                if (event && 'name' in event && 'execute' in event) {
                    const dispatch = (
                        ...args: ClientEvents[typeof event.name]
                    ) => {
                        Promise.resolve(event.execute(...args)).catch(
                            (error) => {
                                logger.error(
                                    `[EventLoader] Unhandled error in event "${String(event.name)}"`,
                                    error
                                );
                            }
                        );
                    };

                    if (event.once) {
                        client.once(event.name, dispatch);
                    } else {
                        client.on(event.name, dispatch);
                    }
                    logger.info(`[EventLoader] Loaded event: ${event.name}`);
                } else {
                    logger.warn(
                        `[EventLoader] File ${file} does not export a valid event.`
                    );
                }
            } catch (error) {
                logger.error(
                    `[EventLoader] Failed to load event file ${file}`,
                    error
                );
            }
        }
    }
}


