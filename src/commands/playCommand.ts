import { Message } from 'discord.js';
import * as ytdl from 'ytdl-core';
import { COMMAND_PREFIX_REGEX, ICommand, ICommandResult, SUCCESS_RESULT } from './command';

export class PlayCommand implements ICommand {

    messageFilters = [
        new RegExp(COMMAND_PREFIX_REGEX + 'play (.*)')
    ];

    async execute(message: Message, matchedFilter: RegExp): Promise<ICommandResult> {
        const canExecuteResult = this.assertPrerequisites(message);
        if (!canExecuteResult.success) { return canExecuteResult; }
        const voiceChannel = message.member!.voice.channel!; // Voice channel is asserted by canExecute

        const [, url] = matchedFilter.exec(message.content) ?? [];
        console.log(`Looking for song: ${url}`);

        const videoInfo = await this.getVideoInfo(url);
        if (!videoInfo) {
            // TODO fallback to YT search
            const errorMessage = `Cannot find video with url: ${url}`;
            console.log(errorMessage);
            return { success: false, errorMessage: errorMessage };
        }

        const connection = await voiceChannel.join();
        try {
            const stream = ytdl(url);
            const dispatcher = connection.play(stream)
                .on('finish', () => {
                    voiceChannel.leave();
                    // TODO on complete
                })
                .on('error', error => {
                    console.error(error);
                    voiceChannel.leave();
                });
            dispatcher.setVolumeLogarithmic(.8);
            await message.channel.send(`Playing song: ${videoInfo.videoDetails.title}`);
        } catch (err) {
            console.log(err);
        }

        return SUCCESS_RESULT;
    }

    private async getVideoInfo(url: string): Promise<ytdl.videoInfo | null> {
        let videoInfo: ytdl.videoInfo | null = null;
        try {
            videoInfo = await ytdl.getInfo(url);
            console.log(videoInfo);
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

        return SUCCESS_RESULT;
    }
}
