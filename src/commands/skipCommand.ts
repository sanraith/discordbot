import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { ServerManager } from '../core/manager';
import { ICommandResult, ISlashCommand, SUCCESS_RESULT } from './command';

function generateConfig(commandName: string) {
    return new SlashCommandBuilder()
        .setName(commandName)
        .setDescription('Skips the currently playing song.');
}

export class SkipCommand implements ISlashCommand {
    slashSignatures = [
        generateConfig('skip')
    ];

    constructor(private serverManager: ServerManager) { }

    async executeInteraction(interaction: CommandInteraction): Promise<ICommandResult> {
        const server = this.serverManager.getOrAdd(interaction.guild!.id);
        const { success, skippedTitle } = await server.musicPlayer.skip();
        if (success) {
            await interaction.editReply(`Skipped song: ${skippedTitle ?? '?'}.`);
        } else {
            await interaction.editReply('No song to skip!');
        }

        return SUCCESS_RESULT;
    }
}
