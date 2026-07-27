import type { Client, ClientEvents } from "discord.js";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Event } from "../types/Event.js";
import { logger } from "../utils/logger.js";

export class EventLoader {
  public async loadEvents(eventsPath: string, client: Client): Promise<void> {
    const files = await readdir(eventsPath).catch(() => []);

    for (const file of files.filter((f) => f.endsWith(".ts") || f.endsWith(".js"))) {
      const eventModule = await import(join(eventsPath, file));
      const event: Event<keyof ClientEvents> = eventModule.default;

      if (event && "name" in event && "execute" in event) {
        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args));
        } else {
          client.on(event.name, (...args) => event.execute(...args));
        }
        logger.info(`[EventLoader] Loaded event: ${event.name}`);
      } else {
        logger.warn(`[EventLoader] File ${file} does not export a valid event.`);
      }
    }
  }
}
