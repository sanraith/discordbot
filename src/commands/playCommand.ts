import { Message } from 'discord.js';
import * as youtubeSearch from 'youtube-search';
import * as ytdl from 'ytdl-core';
import { config } from '../config';
import { ServerManager } from '../core/manager';
import { COMMAND_PREFIX_REGEX, ICommand, ICommandResult, SUCCESS_RESULT } from './command';
const isUrlRegex = /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/;

export class PlayCommand implements ICommand {

    messageFilters = [
        new RegExp(COMMAND_PREFIX_REGEX + 'p (.*)'),
        new RegExp(COMMAND_PREFIX_REGEX + 'play (.*)')
    ];
    searchCache: Record<string, string> = {};

    constructor(private serverManager: ServerManager) { }

    async execute(message: Message, matchedFilter: RegExp): Promise<ICommandResult> {
        const canExecuteResult = this.assertPrerequisites(message);
        if (!canExecuteResult.success) { return canExecuteResult; }
        const member = message.member!;
        const voiceChannel = member.voice.channel!; // Voice channel is asserted by canExecute
        const guildId = message.guild!.id;

        let [, url] = matchedFilter.exec(message.content) ?? [];
        console.log(`Looking for song: ${url}`);

        if (!isUrlRegex.test(url)) {
            url = await this.searchVideoOnYoutube(url);
        }

        const videoInfo = await this.getVideoInfo(url);
        if (!videoInfo) {
            // TODO fallback to YT search
            const errorMessage = `Cannot find video: ${url}`;
            console.log(errorMessage);
            return { success: false, errorMessage: errorMessage };
        }

        const server = this.serverManager.getOrAdd(guildId);
        await server.musicPlayer.play({ member, song: videoInfo }, voiceChannel, message.channel);
        return SUCCESS_RESULT;
    }

    private async searchVideoOnYoutube(term: string) {
        const opts: youtubeSearch.YouTubeSearchOptions = {
            maxResults: 1,
            key: config.youtubeKey
        };

        if (!this.searchCache[term]) {
            try {
                const { results } = await youtubeSearch(term, opts);
                this.searchCache[term] = results ? results[0].id : term;
            } catch (error) {
                console.log(error);
            }
            console.log(`Cache miss for search: ${term}`);
        } else {
            console.log(`Loaded search result from cache for: ${term} => ${this.searchCache[term]}`);
        }
        return this.searchCache[term] ?? term;
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
