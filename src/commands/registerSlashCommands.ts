import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { Message } from 'discord.js';
import { config } from '../config';
import { ServerManager } from '../core/manager';
import { COMMAND_PREFIX_REGEX, ICommandResult, IMessageCommand, ISlashCommand, SUCCESS_RESULT } from './command';

export class RegisterSlashCommands implements IMessageCommand {

    messageSignatures = [
        new RegExp(COMMAND_PREFIX_REGEX + 'register$'),
        new RegExp(COMMAND_PREFIX_REGEX + 'play .+'),
        new RegExp(COMMAND_PREFIX_REGEX + 'skip$'),
        new RegExp(COMMAND_PREFIX_REGEX + 'stop$'),
        new RegExp(COMMAND_PREFIX_REGEX + 'volume \\d+'),
        new RegExp(COMMAND_PREFIX_REGEX + 'vol \\d+'),
        new RegExp(COMMAND_PREFIX_REGEX + 'p .+'),
        new RegExp(COMMAND_PREFIX_REGEX + 's$'),
        new RegExp(COMMAND_PREFIX_REGEX + 'v \\d+')
    ];

    constructor(private serverManager: ServerManager, private commands: ISlashCommand[]) { }

    async executeMessage(message: Message): Promise<ICommandResult> {
        if (!message.guildId) {
            return { success: false, errorMessage: 'Not a guild message!' };
        }

        await message.react('✨');
        const result = await this.registerCommands(message.guildId);
        if (result.success) {
            await message.reply('music-bot now works with /slash commands. Use **/play** from now on!');
        }

        return result;
    }

    async registerCommands(guildId: string): Promise<ICommandResult> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            const convertedCommands = this.commands.flatMap(x => x.slashSignatures);
            const rest = new REST({ version: '10' }).setToken(config.discordToken);
            await rest.put(Routes.applicationGuildCommands(config.discordApplicationId, guildId), { body: convertedCommands });
            this.serverManager.getOrAdd(guildId).areSlashCommandsRegistered = true;
            console.log('Registered slash commands.');

            return SUCCESS_RESULT;
        } catch (error) {
            console.log(error);
            return { success: false, errorMessage: 'Error during registering guild commands!' };
        }
    }
}
