import { REST, Routes } from 'discord.js';
import { env } from '../config/env.js';
import { CommandLoader } from '../core/CommandLoader.js';
import { join } from 'node:path';
import { logger } from '../utils/logger.js';

const deploy = async () => {
    const loader = new CommandLoader();
    const modulesPath = join(process.cwd(), 'src', 'modules'); //TODO: use import.meta.dir
    await loader.loadCommands(modulesPath);

    const commandsData = loader.commands.map((cmd) => {
        const json = cmd.data.toJSON();
        // Enable DMs by setting contexts and integration types (Discord API v10)
        return {
            ...json,
            integration_types: [0, 1], // 0: GuildInstall, 1: UserInstall
            contexts: [0, 1, 2], // 0: Guild, 1: Bot DM, 2: Private Channel
        };
    });

    const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

    try {
        logger.info(
            `Started refreshing ${commandsData.length} application (/) commands.`
        );

        await rest.put(Routes.applicationCommands(env.CLIENT_ID), {
            body: commandsData,
        });

        logger.info(`Successfully reloaded application (/) commands.`);
        process.exit(0);
    } catch (error) {
        logger.error('Error deploying commands:', error);
        process.exit(1);
    }
};

deploy();
