import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { ServerManager } from '../core/manager';
import { ICommandResult, ISlashCommand, SUCCESS_RESULT } from './command';

function generateConfig(commandName: string) {
    return new SlashCommandBuilder()
        .setName(commandName)
        .setDescription('Stops all playback.');
}

export class StopCommand implements ISlashCommand {

    slashSignatures = [
        generateConfig('stop')
    ];

    constructor(private serverManager: ServerManager) { }

    async executeInteraction(message: CommandInteraction): Promise<ICommandResult> {
        const server = this.serverManager.getOrAdd(message.guild!.id);
        const { success } = await server.musicPlayer.stop();
        if (success) {
            await message.editReply('Stopped playing.');
        } else {
            await message.editReply('Nothing is currently playing.');
        }

        return SUCCESS_RESULT;
    }
}
