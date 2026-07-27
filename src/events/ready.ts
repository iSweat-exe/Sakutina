import type { Client } from "discord.js";
import type { Event } from "../types/Event.js";
import { logger } from "../utils/logger.js";
import { checkDbConnection } from "../repositories/db.js";

const event: Event<"clientReady"> = {
  name: "clientReady",
  once: true,
  async execute(client: Client) {
    logger.info(`[Ready] Logged in as ${client.user?.tag}`);
    await checkDbConnection();
  },
};

export default event;
