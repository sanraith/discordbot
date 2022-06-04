import { generateDependencyReport } from '@discordjs/voice';
import { DiscordBot } from './discordbot';

console.log(generateDependencyReport());
console.log('Bot starting...');

const bot = new DiscordBot();
void bot.init();
