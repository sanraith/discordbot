import { Message } from 'discord.js';
import { ServerManager } from '../core/manager';
import { COMMAND_PREFIX_REGEX, ICommand, ICommandResult, SUCCESS_RESULT } from './command';

export class StopCommand implements ICommand {

    messageFilters = [
        new RegExp(COMMAND_PREFIX_REGEX + 's$'),
        new RegExp(COMMAND_PREFIX_REGEX + 'stop')
    ];

    constructor(private serverManager: ServerManager) { }

    async execute(message: Message): Promise<ICommandResult> {
        const server = this.serverManager.getOrAdd(message.guild!.id);
        await server.musicPlayer.stop();

        return SUCCESS_RESULT;
    }
}
