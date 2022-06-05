import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { ServerManager } from '../core/manager';
import { ICommandResult, ISlashCommand, SUCCESS_RESULT } from './command';

function generateConfig(commandName: string) {
    return new SlashCommandBuilder()
        .setName(commandName)
        .setDescription('Skips the currently playing list.');
}

export class SkipListCommand implements ISlashCommand {
    slashSignatures = [
        generateConfig('skip-list')
    ];

    constructor(private serverManager: ServerManager) { }

    async executeInteraction(message: CommandInteraction): Promise<ICommandResult> {
        const server = this.serverManager.getOrAdd(message.guild!.id);
        const { success, skipCount, skippedTitle } = await server.musicPlayer.skipList();
        if (success) {
            await message.editReply(`Skipped ${skipCount ?? 0} items from playlist '${skippedTitle ?? '?'}'.`);
        } else {
            await message.editReply(`No playlist is currently playing!`);
        }

        return SUCCESS_RESULT;
    }
}
