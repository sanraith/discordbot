import { Message } from 'discord.js';
import { COMMAND_PREFIX_REGEX, ICommand, ICommandResult, SUCCESS_RESULT } from './command';

export class StopCommand implements ICommand {

    messageFilters = [
        new RegExp(COMMAND_PREFIX_REGEX + 'stop')
    ];

    async execute(message: Message): Promise<ICommandResult> {
        await message.channel.send('Not implemented yet...');
        // TODO

        await message.channel.send('Stopped.');
        return SUCCESS_RESULT;
    }
}
