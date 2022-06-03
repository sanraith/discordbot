import { Message } from 'discord.js';
import { ServerManager } from '../core/manager';
import { COMMAND_PREFIX_REGEX, ICommand, ICommandResult, SUCCESS_RESULT } from './command';

export class SkipListCommand implements ICommand {

    messageFilters = [
        new RegExp(COMMAND_PREFIX_REGEX + 'sl$'),
        new RegExp(COMMAND_PREFIX_REGEX + 'skip list'),
        new RegExp(COMMAND_PREFIX_REGEX + 'skip[lL]ist')
    ];

    constructor(private serverManager: ServerManager) { }

    async execute(message: Message): Promise<ICommandResult> {
        const server = this.serverManager.getOrAdd(message.guild!.id);

        void message.react('⏭');
        void message.react('📃');
        await server.musicPlayer.skipList();

        return SUCCESS_RESULT;
    }
}
