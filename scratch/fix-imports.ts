import * as fs from 'fs';
import * as path from 'path';
import { Glob } from 'bun';

async function main() {
    const glob = new Glob('src/modules/*/commands/*.ts');
    for await (const file of glob.scan('.')) {
        let content = fs.readFileSync(file, 'utf8');
        
        let changed = false;

        // Add import if missing
        if (content.includes('createCommandHandler') && !content.includes('import { createCommandHandler }')) {
            content = `import { createCommandHandler } from '../../../utils/index.js';\n` + content;
            changed = true;
        }

        // Add types to closure
        if (content.includes('execute: createCommandHandler(async (interaction, lang) => {')) {
            content = content.replace(
                'execute: createCommandHandler(async (interaction, lang) => {', 
                'execute: createCommandHandler(async (interaction: ChatInputCommandInteraction, lang: string) => {'
            );
            changed = true;
        }

        // 3. Remove duplicate const lang = ... in mod.ts (or any file)
        if (content.includes('const lang = await GuildConfigService.getGuildLanguage(')) {
            // we should remove the whole block of `const lang = ... interaction.guildId\n        );`
            content = content.replace(/const lang = await GuildConfigService\.getGuildLanguage\([\s\S]*?\);\n/, '');
            changed = true;
        }

        // 4. Remove unused GuildConfigService import
        if (content.includes('GuildConfigService') && !content.includes('GuildConfigService.')) {
            content = content.replace(/import \{ GuildConfigService \} from '[^']+';\n/, '');
            changed = true;
        }

        if (changed) {
            fs.writeFileSync(file, content);
            console.log('Fixed', file);
        }
    }
}
main();
