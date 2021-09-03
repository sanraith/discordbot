import { Message } from 'discord.js';
import * as ytdl from 'ytdl-core';
import * as ytsr from 'ytsr';
import { ServerManager } from '../core/manager';
import { COMMAND_PREFIX_REGEX, ICommand, ICommandResult, SUCCESS_RESULT } from './command';
const isUrlRegex = /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/;

export class PlayCommand implements ICommand {

    messageFilters = [
        new RegExp(COMMAND_PREFIX_REGEX + 'p (.*)'),
        new RegExp(COMMAND_PREFIX_REGEX + 'play (.*)')
    ];

    constructor(private serverManager: ServerManager) { }

    async execute(message: Message, matchedFilter: RegExp): Promise<ICommandResult> {
        const canExecuteResult = this.assertPrerequisites(message);
        if (!canExecuteResult.success) { return canExecuteResult; }

        const member = message.member!;
        const voiceChannel = member.voice.channel!; // Voice channel is asserted by canExecute
        const guildId = message.guild!.id;

        const server = this.serverManager.getOrAdd(guildId);
        void message.react(server.musicQueue.length > 0 ? '▶' : '🎵');

        let [, url] = matchedFilter.exec(message.content) ?? [];
        console.log(`Looking for song: ${url}`);

        if (!isUrlRegex.test(url)) {
            url = await this.searchVideoOnYoutube(url);
        }

        const videoInfo = await this.getVideoInfo(url);
        if (!videoInfo) {
            const errorMessage = `Cannot find video: ${url}`;
            console.log(errorMessage);
            return { success: false, errorMessage: errorMessage };
        }

        await server.musicPlayer.play({ member, song: videoInfo }, voiceChannel, message.channel);
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
            // video not found
        }
        return videoInfo;
    }

    private assertPrerequisites(message: Message) {
        const voiceChannel = message.member?.voice.channel;
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
