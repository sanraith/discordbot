import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { ServerManager } from '../core/manager';
import { ICommandResult, ISlashCommand, SUCCESS_RESULT } from './command';

const countParameterName = 'amount';

function generateConfig(commandName: string) {
    return new SlashCommandBuilder()
        .setName(commandName)
        .setDescription('Skips the currently playing song or a number of songs from the queue.')
        .addIntegerOption(option => option
            .setName(countParameterName)
            .setDescription('The number of songs to skip.')
            .setMinValue(1));
}

export class SkipCommand implements ISlashCommand {
    slashSignatures = [
        generateConfig('skip')
    ];

    constructor(private serverManager: ServerManager) { }

    async executeInteraction(interaction: CommandInteraction): Promise<ICommandResult> {
        const server = this.serverManager.getOrAdd(interaction.guild!.id);
        const count = interaction.options.getInteger(countParameterName) ?? 1;
        const { success, skippedCount } = await server.musicPlayer.skip(count);
        if (success) {
            await interaction.editReply(`Skipped ${skippedCount} songs.`);
        } else {
            await interaction.editReply('No songs to skip!');
        }

        return SUCCESS_RESULT;
    }
}
