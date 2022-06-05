import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { nothingAsync } from '../core/helpers';
import { ServerManager } from '../core/manager';
import { ICommandResult, ISlashCommand, SUCCESS_RESULT } from './command';

const valueParameterName = 'level';

function generateConfig(commandName: string) {
    return new SlashCommandBuilder()
        .setName(commandName)
        .setDescription('Changes the volume to a new % value.')
        .addIntegerOption(option => option
            .setName(valueParameterName)
            .setDescription('The new volume level in %.')
            .setMinValue(0)
            .setMaxValue(300)
            .setRequired(true));
}

export class VolumeCommand implements ISlashCommand {
    slashSignatures = [
        generateConfig('volume')
    ];

    constructor(private serverManager: ServerManager) { }

    async executeInteraction(message: CommandInteraction): Promise<ICommandResult> {
        await nothingAsync();
        const volume = message.options.getInteger(valueParameterName)!;
        const server = this.serverManager.getOrAdd(message.guild!.id);
        await server.musicPlayer.setVolume(volume);
        await message.editReply(`Set playback volume to ${volume}%.`);

        return SUCCESS_RESULT;
    }
}
