import { Message } from 'discord.js';
import { ServerManager } from '../core/manager';
import { COMMAND_PREFIX_REGEX, ICommand, ICommandResult, SUCCESS_RESULT } from './command';

export class VolumeCommand implements ICommand {

    messageFilters = [
        new RegExp(COMMAND_PREFIX_REGEX + 'vol (\\d+).*'),
        new RegExp(COMMAND_PREFIX_REGEX + 'volume (\\d+).*')
    ];

    constructor(private serverManager: ServerManager) { }

    async execute(message: Message, matchedFilter: RegExp): Promise<ICommandResult> {
        const [, volumeStr] = matchedFilter.exec(message.content) ?? [];
        const volume = Math.max(Math.min(parseInt(volumeStr), 200), 0);
        const server = this.serverManager.getOrAdd(message.guild!.id);
        await server.musicPlayer.setVolume(volume);

        return SUCCESS_RESULT;
    }

}
