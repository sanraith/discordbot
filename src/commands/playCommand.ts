import { SlashCommandBuilder } from '@discordjs/builders';
import { AutocompleteInteraction, CommandInteraction, Message, PermissionFlagsBits } from 'discord.js';
import ytdl from 'ytdl-core';
import ytsr from 'ytsr';
import { asyncFilter, asyncTakeFirst, asyncTakeWhile, isUrlRegex, iterateYoutubePages, trimDotDot } from '../core/helpers';
import { ServerManager } from '../core/manager';
import { IAutocompleteCommand, ICommandResult, ISlashCommand, SUCCESS_RESULT } from './command';

const nameParameter = 'song';
const immediateParameter = 'next';

function generateConfig(commandName: string) {
    return new SlashCommandBuilder().setName(commandName)
        .setDescription('Plays a youtube video identified by its title or url.')
        .addStringOption(option => option
            .setName(nameParameter)
            .setDescription('The title or url of the youtube video.')
            .setAutocomplete(true)
            .setRequired(true))
        .addStringOption(option => option
            .setName(immediateParameter)
            .setDescription('Queues the video immediately after the current one.')
            .setRequired(false)
            .addChoices(
                { name: 'yes', value: 'true' },
                { name: 'no', value: 'false' },
            ));
}

export class PlayCommand implements ISlashCommand, IAutocompleteCommand {

    slashSignatures = [
        generateConfig('play')
    ];

    constructor(private serverManager: ServerManager) { }

    async handleAutocomplete(autocomplete: AutocompleteInteraction): Promise<void> {
        const term = autocomplete.options.getFocused(true).value;
        if (term) {
            const firstFewVideos = await asyncTakeWhile(await this.getVideoSearchResults(term), (_, i) => i < 7);
            const results = firstFewVideos.map(x => ({
                name: `${trimDotDot(x.title, 50)} (${x.duration ?? ''})`,
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

        const searchTerm = interaction.options.get(nameParameter)?.value?.toString();
        if (searchTerm === undefined) {
            return { success: false, errorMessage: 'No title provided!' };
        }

        // Value should be string here, look into a better check than this
        const isImmediate = (interaction.options.get(immediateParameter, false)?.value ?? 'false').toString().toLowerCase() === 'true';
        const userId = interaction.member!.user.id;
        const member = interaction.guild!.members.cache.get(userId)!;
        const voiceChannel = member.voice.channel;
        const server = this.serverManager.getOrAdd(interaction.guildId!);

        console.log(`Looking for song: ${searchTerm}`);
        const isUrl = isUrlRegex.test(searchTerm);
        const url = isUrl ? searchTerm : await this.findFirstVideo(searchTerm);

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
        const { mode } = await server.musicPlayer.play({ member, song }, voiceChannel!, isImmediate);
        if (mode === 'queue') {
            await interaction.editReply(`Searched for ${isUrl ? `<${searchTerm}>` : `'${searchTerm}'`}, queued: '${song.title}'${isUrl ? '' : ` <${url}>`}`);
        } else {
            await interaction.editReply(`Searched for ${isUrl ? `<${searchTerm}>` : `'${searchTerm}'`}, found: '${song.title}'`);
        }

        return SUCCESS_RESULT;
    }

    private async findFirstVideo(term: string) {
        try {
            const searchResults = await this.getVideoSearchResults(term);
            const firstVideo = await asyncTakeFirst(searchResults);
            if (firstVideo) {
                return firstVideo.url;
            }
        } catch (error) {
            console.log(error);
        }

        console.log(`Could not find video for term: ${term}`);

        return term;
    }

    private async getVideoSearchResults(term: string) {
        const results = await ytsr(term, { pages: 1, safeSearch: false });
        const videoIterator = iterateYoutubePages(results, (x: ytsr.Continuation) => ytsr.continueReq(x)) as AsyncGenerator<ytsr.Item, void, unknown>;
        return asyncFilter(videoIterator, x => x.type === 'video') as AsyncGenerator<ytsr.Video, void, unknown>;
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
        if (!permissions || !permissions.has(PermissionFlagsBits.Connect | PermissionFlagsBits.Speak)) {
            return { success: false, errorMessage: 'I need the permissions to join and speak in your voice channel!' };
        }

        if (!message.guild?.id) {
            return { success: false, errorMessage: 'I need to access the guild of your message!' };
        }

        return SUCCESS_RESULT;
    }
}
