import { Message } from 'discord.js';
import { COMMAND_PREFIX_REGEX, ICommand, ICommandResult, SUCCESS_RESULT } from './command';

export class VolumeCommand implements ICommand {

    messageFilters = [
        new RegExp(COMMAND_PREFIX_REGEX + 'vol (\\d+)'),
        new RegExp(COMMAND_PREFIX_REGEX + 'volume (\\d+)')
    ];

    async execute(message: Message, matchedFilter: RegExp): Promise<ICommandResult> {
        await message.channel.send('Not implemented yet...');
        // TODO

        const [, volumeStr] = matchedFilter.exec(message.content) ?? [];
        const volume = Math.max(Math.min(parseInt(volumeStr), 200), 0);

        await message.channel.send(`Set volume to ${volume}`);
        return SUCCESS_RESULT;
    }

}
