import * as fs from 'fs';
import * as path from 'path';
import { Glob } from 'bun';

async function main() {
    const glob = new Glob('src/modules/*/commands/*.ts');
    for await (const file of glob.scan('.')) {
        let content = fs.readFileSync(file, 'utf8');
        
        if (file.includes('daily.ts')) continue;
        if (content.includes('createCommandHandler')) continue;

        // We want to match: async execute(interaction: ChatInputCommandInteraction) { ... }
        // We can do this safely by finding the start of async execute, and then matching braces.
        const executeStart = content.indexOf('async execute(interaction: ChatInputCommandInteraction) {');
        if (executeStart !== -1) {
            let braceCount = 0;
            let executeEnd = -1;
            let started = false;
            let innerStart = -1;
            for (let i = executeStart; i < content.length; i++) {
                if (content[i] === '{') {
                    if (!started) {
                        started = true;
                        innerStart = i + 1;
                    }
                    braceCount++;
                } else if (content[i] === '}') {
                    braceCount--;
                    if (started && braceCount === 0) {
                        executeEnd = i;
                        break;
                    }
                }
            }

            if (executeEnd !== -1) {
                let inner = content.substring(innerStart, executeEnd);
                
                // Remove try-catch if it encompasses the whole inner block, or we can just leave it?
                // The audit says remove boilerplate try-catch. Let's see if there's a top-level try catch.
                let match = inner.match(/^\s*const lang =[^;]+;\s*try\s*\{([\s\S]*?)\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}\s*$/);
                if (match) {
                    inner = match[1];
                } else {
                    // Try without try-catch (like ping)
                    let match2 = inner.match(/^\s*const lang =[^;]+;([\s\S]*)$/);
                    if (match2) {
                        inner = match2[1];
                    }
                }

                // Split lines, fix indentation
                let newBlock = 'execute: createCommandHandler(async (interaction, lang) => {\n' + 
                    inner.split('\n').filter(l => l.trim() !== '').map(l => {
                        return l;
                    }).join('\n') + 
                    '\n    })';

                const fullMatch = content.substring(executeStart, executeEnd + 1);
                content = content.replace(fullMatch, newBlock);

                if (!content.includes('createCommandHandler')) {
                    content = `import { createCommandHandler } from '../../../utils/index.js';\n` + content;
                }

                if (content.includes('GuildConfigService') && !content.includes('GuildConfigService.')) {
                    content = content.replace(/import \{ GuildConfigService \} from '[^']+';\n/, '');
                }

                fs.writeFileSync(file, content);
                console.log('Updated', file);
            }
        }
    }
}
main();
