import { Message } from 'discord.js';
import * as ytpl from 'ytpl';
import * as ytsr from 'ytsr';
import { asyncTakeAll, asyncTakeFirst, isUrlRegex, iterateYoutubePages } from '../core/helpers';
import { ServerManager } from '../core/manager';
import { COMMAND_PREFIX_REGEX, ICommand, ICommandResult, SUCCESS_RESULT } from './command';

export class PlaylistCommand implements ICommand {
    messageFilters = [
        new RegExp(COMMAND_PREFIX_REGEX + 'pl (.*)'),
        new RegExp(COMMAND_PREFIX_REGEX + 'play[lL]ist (.*)'),
        new RegExp(COMMAND_PREFIX_REGEX + 'play list (.*)')
    ];

    constructor(private serverManager: ServerManager) { }

    async execute(message: Message, matchedFilter: RegExp): Promise<ICommandResult> {
        const canExecuteResult = this.assertPrerequisites(message);
        if (!canExecuteResult.success) { return canExecuteResult; }

        const member = message.member!;
        const voiceChannel = member.voice.channel!; // Voice channel is asserted by canExecute
        const guildId = message.guild!.id;

        const server = this.serverManager.getOrAdd(guildId);
        void message.react('🎵');
        void message.react('📃');

        let [, url] = matchedFilter.exec(message.content) ?? [];
        url = url.trim();
        console.log(`Looking for playlist: ${url}`);
        if (!isUrlRegex.test(url)) {
            url = await this.searchPlaylistsOnYoutube(url);
        }

        const playlistInfo = await this.getPlaylistInfo(url);
        if (!playlistInfo) {
            return { success: false, errorMessage: `Could not find playlist on url: ${url}` };
        }

        const songs = await this.getSongsFromPlaylist(playlistInfo);
        if (!songs) {
            return { success: false, errorMessage: `Could not find songs on playlist '${playlistInfo.title}', ${url}` };
        }

        const songQueueItems = songs.map(x => ({
            id: x.id,
            url: x.url,
            title: x.title,
            durationSeconds: x.durationSec ?? 0
        }));

        await server.musicPlayer.playList({
            url: playlistInfo.url,
            title: playlistInfo.title,
            member: member,
            items: songQueueItems,
            totalDurationSeconds: songQueueItems.reduce((a, x) => a + x.durationSeconds, 0)
        }, voiceChannel, message.channel);

        return SUCCESS_RESULT;
    }

    private async searchPlaylistsOnYoutube(term: string) {
        try {
            const filters = await ytsr.getFilters(term);
            const playlistFilterUrl = filters.get('Type')?.get('Playlist')?.url ?? 'term';

            return playlistFilterUrl;
        } catch (error) {
            console.log(error);
        }

        return term;
    }

    private async getPlaylistInfo(playlistUrl: string) {
        try {
            const searchResults = await ytsr(playlistUrl, { pages: 1, safeSearch: false });
            const playlistsIterator = iterateYoutubePages(searchResults, (x: ytsr.Continuation) => ytsr.continueReq(x));
            const playlistInfo = await asyncTakeFirst(playlistsIterator, x => (x as ytsr.Item).type === 'playlist') as ytsr.Playlist | null;

            return playlistInfo;
        } catch (error) {
            console.log(error);
        }

        console.log(`Could not find playlists for url: ${playlistUrl}`);
        return null;
    }

    private async getSongsFromPlaylist(playlistInfo: ytsr.Playlist) {
        try {
            const playlist = await ytpl(playlistInfo.playlistID, { pages: 1 });
            const songsIterator = iterateYoutubePages(playlist, (x: ytpl.Continuation) => ytpl.continueReq(x));
            const songs = await asyncTakeAll(songsIterator) as ytpl.Item[];

            return songs;
        } catch (error) {
            console.log(error);
        }

        console.log(`Could not find songs for playlist: ${playlistInfo.url}`);
        return null;
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
