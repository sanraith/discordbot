import { Message } from 'discord.js';
import { ServerManager } from '../core/manager';
import { COMMAND_PREFIX_REGEX, ICommand, ICommandResult, SUCCESS_RESULT } from './command';

export class SkipCommand implements ICommand {

    messageFilters = [
        new RegExp(COMMAND_PREFIX_REGEX + 'skip')
    ];

    constructor(private serverManager: ServerManager) { }

    async execute(message: Message): Promise<ICommandResult> {
        const server = this.serverManager.getOrAdd(message.guild!.id);

        await message.react('⏭');
        await server.musicPlayer.skip();

        return SUCCESS_RESULT;
    }
}
