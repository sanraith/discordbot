import { SlashCommandBuilder } from '@discordjs/builders';
import { AutocompleteInteraction, CommandInteraction, Message } from 'discord.js';
import ytpl from 'ytpl';
import ytsr, { Playlist } from 'ytsr';
import { asyncTake, asyncTakeFirst, convertSecondsToTimeString, isUrlRegex, iterateYoutubePages, trimDotDot } from '../core/helpers';
import { ServerManager } from '../core/manager';
import { IAutocompleteCommand, ICommandResult, ISlashCommand, SUCCESS_RESULT } from './command';

const nameParameter = 'name';

function generateConfig(commandName: string) {
    return new SlashCommandBuilder().setName(commandName)
        .setDescription('Plays a youtube playlist identified by its title or url.')
        .addStringOption(option => option
            .setName(nameParameter)
            .setDescription('The name or url of the playlist.')
            .setAutocomplete(true)
            .setRequired(true));
}

export class PlaylistCommand implements ISlashCommand, IAutocompleteCommand {
    slashSignatures = [
        generateConfig('playlist')
    ];

    constructor(private serverManager: ServerManager) { }

    async handleAutocomplete(autocomplete: AutocompleteInteraction): Promise<void> {
        const term = autocomplete.options.getFocused(true).value as string;
        if (term) {
            const results = ((await ytsr(await this.getPlaylistUrl(term), { pages: 1, safeSearch: false })).items
                .filter(x => x.type === 'playlist') as Playlist[])
                .filter((_, i) => i < 7)
                .map(x => ({
                    name: `${trimDotDot(x.title, 50)} (${x.length})`,
                    value: x.url
                }));
            await autocomplete.respond(results);
        } else {
            await autocomplete.respond([]);
        }
    }

    async executeInteraction(interaction: CommandInteraction): Promise<ICommandResult> {
        const canExecuteResult = this.assertPrerequisites(interaction);
        if (!canExecuteResult.success) { return canExecuteResult; }

        const searchTerm = interaction.options.getString(nameParameter);
        if (searchTerm === null) {
            return { success: false, errorMessage: 'No title provided!' };
        }

        const userId = interaction.member!.user.id;
        const member = interaction.guild!.members.cache.get(userId)!;
        const voiceChannel = member.voice.channel;
        const server = this.serverManager.getOrAdd(interaction.guildId!);

        console.log(`Looking for song: ${searchTerm}`);
        const isUrl = isUrlRegex.test(searchTerm);

        let url = '';
        if (isUrl) {
            url = /(?<=list=)[^&]*/.exec(searchTerm)?.[0] ?? searchTerm;
        } else {
            url = await this.getPlaylistUrl(searchTerm);
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
        const totalDurationSeconds = songQueueItems.reduce((a, x) => a + x.durationSeconds, 0);

        await interaction.editReply(`Searched for ${isUrl ? `<${searchTerm}>` : `'${searchTerm}'`}, ` +
            `queued playlist '${playlistInfo.title}' with ${songs.length} items for a duration of ${convertSecondsToTimeString(totalDurationSeconds)}` +
            `${isUrl ? '' : ` from <${url}>`}.`);
        await server.musicPlayer.playList({
            url: playlistInfo.url,
            title: playlistInfo.title,
            member: member,
            items: songQueueItems,
            totalDurationSeconds: totalDurationSeconds
        }, voiceChannel!);

        return SUCCESS_RESULT;
    }

    private async getPlaylistUrl(term: string) {
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
            const playlistsIterator = await this.searchPlaylists(playlistUrl);
            const playlistInfo = await asyncTakeFirst(playlistsIterator, x => (x as ytsr.Item).type === 'playlist') as ytsr.Playlist | null;

            return playlistInfo;
        } catch (error) {
            console.log(error);
        }

        console.log(`Could not find playlists for url: ${playlistUrl}`);
        return null;
    }

    private async searchPlaylists(playlistUrl: string) {
        const searchResults = await ytsr(playlistUrl, { pages: 1, safeSearch: false });
        const playlistsIterator = iterateYoutubePages(searchResults, (x: ytsr.Continuation) => ytsr.continueReq(x));

        return playlistsIterator;
    }

    private async getSongsFromPlaylist(playlistInfo: ytsr.Playlist) {
        try {
            const playlist = await ytpl(playlistInfo.playlistID, { pages: 1 });
            const songsIterator = iterateYoutubePages(playlist, (x: ytpl.Continuation) => ytpl.continueReq(x));
            const songs = await asyncTake(songsIterator) as ytpl.Item[];

            return songs;
        } catch (error) {
            console.log(error);
        }

        console.log(`Could not find songs for playlist: ${playlistInfo.url}`);
        return null;
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
