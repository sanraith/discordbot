import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, Message } from 'discord.js';
import * as ytdl from 'ytdl-core';
import * as ytsr from 'ytsr';
import { isUrlRegex } from '../core/helpers';
import { ServerManager } from '../core/manager';
import { ICommandResult, ISlashCommand, SUCCESS_RESULT } from './command';

const nameParameter = 'song';

function generateConfig(commandName: string) {
    return new SlashCommandBuilder().setName(commandName)
        .setDescription('Plays a youtube video identified by its title or url.')
        .addStringOption(option => option
            .setName(nameParameter)
            .setDescription('The title or url of the youtube video.')
            .setRequired(true));
}

export class PlayCommand implements ISlashCommand {

    slashSignatures = [
        generateConfig('play')
    ];

    constructor(private serverManager: ServerManager) { }

    async executeInteraction(interaction: CommandInteraction): Promise<ICommandResult> {
        const canExecuteResult = this.assertPrerequisites(interaction);
        if (!canExecuteResult.success) { return canExecuteResult; }

        const searchTerm = interaction.options.getString(nameParameter);
        if (searchTerm === null) {
            return { success: false, errorMessage: 'No title provided!' };
        }

        const userId = interaction.member!.user.id;
        const member = interaction.guild!.members.cache.get(userId)!;
        const voiceChannel = member.voice.channel!;
        const server = this.serverManager.getOrAdd(interaction.guildId!);

        console.log(`Looking for song: ${searchTerm}`);
        const isUrl = isUrlRegex.test(searchTerm);
        const url = isUrl ? searchTerm : await this.searchVideoOnYoutube(searchTerm);

        const videoInfo = await this.getVideoInfo(url);
        if (!videoInfo) {
            const errorMessage = `Cannot find video: ${url}`;
            console.log(errorMessage);
            return { success: false, errorMessage: errorMessage };
        }

        const song = {
            id: videoInfo.videoDetails.videoId,
            url: videoInfo.videoDetails.video_url,
            title: videoInfo.videoDetails.title,
            durationSeconds: parseInt(videoInfo.videoDetails.lengthSeconds)
        };
        const { mode } = await server.musicPlayer.play({ member, song }, voiceChannel);
        if (mode === 'queue') {
            await interaction.editReply(`Searched for '${isUrl ? `<${searchTerm}>` : searchTerm}', queued: '${song.title}' <${url}>`);
        } else {
            await interaction.editReply(`Searched for '${isUrl ? `<${searchTerm}>` : searchTerm}', found: '${song.title}'`);
        }

        return SUCCESS_RESULT;
    }

    private async searchVideoOnYoutube(term: string) {
        try {
            const results = await ytsr(term, { pages: 1, safeSearch: false });
            const videos = results.items.filter(x => x.type === 'video') as ytsr.Video[];
            console.log(`Found ${videos.length} videos.`);

            const firstVideo = videos[0];
            if (firstVideo) {
                return firstVideo.url;
            }
        } catch (error) {
            console.log(error);
        }

        console.log(`Could not find video for term: ${term}`);

        return term;
    }

    private async getVideoInfo(url: string): Promise<ytdl.videoInfo | null> {
        let videoInfo: ytdl.videoInfo | null = null;

        try {
            videoInfo = await ytdl.getInfo(url);
        } catch (err) {
            // video not found or error
            console.log(`Error during getting video info for url: ${url}`);
            console.log(err);
        }
        return videoInfo;
    }

    private assertPrerequisites(message: Message | CommandInteraction) {
        const userId = message.member?.user.id;
        if (!userId) {
            return { success: false, errorMessage: 'Cannot determine command user!' };
        }

        const member = message.guild?.members.cache.get(userId);
        const voiceChannel = member?.voice.channel;
        if (!voiceChannel) {
            return { success: false, errorMessage: 'You need to be in a voice channel to play music!' };
        }

        if (!message.client.user) {
            return { success: false, errorMessage: 'Cannot read my own user!' };
        }

        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions || !permissions.has('CONNECT') || !permissions.has('SPEAK')) {
            return { success: false, errorMessage: 'I need the permissions to join and speak in your voice channel!' };
        }

        if (!message.guild?.id) {
            return { success: false, errorMessage: 'I need to access the guild of your message!' };
        }

        return SUCCESS_RESULT;
    }
}
