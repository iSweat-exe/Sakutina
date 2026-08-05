import { Collection } from 'discord.js';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from '../types/Command.js';
import { logger } from '../utils/logger.js';

export class CommandLoader {
    public commands = new Collection<string, Command>();

    public async loadCommands(modulesPath: string): Promise<void> {
        const modules = await readdir(modulesPath).catch(() => []);

        for (const module of modules) {
            const commandsPath = join(modulesPath, module, 'commands');
            // Handle silently if the 'commands' directory doesn't exist
            const files = await readdir(commandsPath).catch(() => []);

            for (const file of files.filter(
                (f) => f.endsWith('.ts') || f.endsWith('.js')
            )) {
                try {
                    const commandModule = await import(
                        join(commandsPath, file)
                    );
                    const command: Command = commandModule.default;

                    if (command && 'data' in command && 'execute' in command) {
                        this.commands.set(command.data.name, command);
                        logger.info(
                            `[CommandLoader] Loaded command: /${command.data.name}`
                        );
                    } else {
                        logger.warn(
                            `[CommandLoader] File ${file} does not export a valid command.`
                        );
                    }
                } catch (error) {
                    logger.error(
                        `[CommandLoader] Failed to load command file ${file}`,
                        error
                    );
                }
            }
        }
    }
}


