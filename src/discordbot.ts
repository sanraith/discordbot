import * as Discord from 'discord.js';
import { COMMANDS } from './commands/commands';
import { config } from './config';

export class DiscordBot {
    client: Discord.Client;

    constructor() {
        const client = new Discord.Client({
            intents: [
                'GUILDS',
                'GUILD_MESSAGES',
                'GUILD_MESSAGE_REACTIONS',
                'GUILD_VOICE_STATES'
            ]
        });
        this.client = client;
    }

    async init(): Promise<void> {
        await this.client.login(config.discordToken);
        this.client.once('ready', () => {
            console.log('Ready!');
        });
        this.client.once('reconnecting', () => {
            console.log('Reconnecting!');
        });
        this.client.once('disconnect', () => {
            console.log('Disconnect!');
        });

        this.client.on('messageCreate', message => void this.onMessage(message));
        this.client.on('messageUpdate', (_, newMessage) => void this.onMessage(newMessage as Discord.Message));
    }

    async onMessage(message: Discord.Message): Promise<void> {
        if (message.author.bot || !message.content.startsWith(config.prefix)) {
            return;
        }
        if (!this.client) { console.log('something is wrong...'); }
        console.log(`Read message: ${message.content}`);

        const textChannel = message.channel;
        let matchedCommand = false;
        for (const command of COMMANDS) {
            for (const filter of command.messageFilters) {
                if (!filter.test(message.content)) { continue; }

                await message.reactions.removeAll();
                const result = await command.execute(message, filter);
                if (!result.success) {
                    await textChannel.send(result.errorMessage);
                }
                matchedCommand = true;
                break;
            }
            if (matchedCommand) { break; }
        }
    }
}
