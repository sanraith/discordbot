import { DMChannel, NewsChannel, StreamDispatcher, TextChannel, VoiceChannel } from 'discord.js';
import * as ytdl from 'ytdl-core';
import { MusicQueueItem, PlaylistQueueItem, Server } from './manager';

type SourceTextChannel = TextChannel | DMChannel | NewsChannel;

export class MusicPlayer {
    private queue: MusicQueueItem[];
    private voiceChannel?: VoiceChannel;
    private textChannel?: SourceTextChannel;
    private musicDispatcher?: StreamDispatcher;

    constructor(private server: Server) {
        this.queue = server.musicQueue;
    }

    async playList(listItem: PlaylistQueueItem, voiceChannel: VoiceChannel, textChannel: SourceTextChannel): Promise<void> {
        await textChannel.send(
            `Queued playlist '${listItem.title}' with ${listItem.items.length} items for a duration of ${this.convertSecondsToTimeString(listItem.totalDurationSeconds)}.`
        );

        for (const item of listItem.items) {
            const musicQueueItem: MusicQueueItem = {
                member: listItem.member,
                song: item,
                playlist: listItem
            };
            await this.play(musicQueueItem, voiceChannel, textChannel, false);
        }

        console.log('finished playlist queue');
    }

    async play(queueItem: MusicQueueItem, voiceChannel: VoiceChannel, textChannel: SourceTextChannel, logQueue = true): Promise<void> {
        this.voiceChannel = voiceChannel;
        this.textChannel = textChannel;
        this.queue.push(queueItem);
        if (this.queue.length === 1) {
            void this.playItem();
        } else if (logQueue) {
            await this.textChannel.send(`Queued song: ${queueItem.song.title}`);
        }
    }

    async skip(): Promise<void> {
        const currentItem = this.queue[0];
        if (currentItem) {
            await this.textChannel?.send(`Skipped song: ${currentItem.song.title}.`);
        }

        this.musicDispatcher?.end();
    }

    async skipList(): Promise<void> {
        const currentItem = this.queue[0];
        if (!currentItem || !currentItem.playlist) {
            await this.textChannel?.send(`Cannot skip playlist as none is playing currently.`);
            return;
        }

        // find next item from different playlist
        let nextDifferentIndex = this.queue.findIndex(x => x.playlist !== currentItem.playlist);
        if (nextDifferentIndex === -1) { nextDifferentIndex = this.queue.length; }
        this.queue.splice(1, nextDifferentIndex - 1);
        await this.textChannel?.send(`Skipped ${nextDifferentIndex} items from playlist '${currentItem.playlist.title}'.`);

        this.musicDispatcher?.end();
    }

    async stop(): Promise<void> {
        if (this.queue.length > 0) {
            this.queue.splice(0, this.queue.length);
            this.musicDispatcher?.end();
            await this.textChannel?.send(`Stopped playing.`);
        }
    }

    /**
     * Set current and future playback volume for server.
     * @param volume 100 === 100%
     */
    async setVolume(volume: number): Promise<void> {
        this.server.volume = volume / 100;
        this.musicDispatcher?.setVolumeLogarithmic(this.server.volume);
        await this.textChannel?.send(`Set playback volume to: ${volume}%`);
    }

    private async playItem(): Promise<void> {
        const item = this.queue[0];
        if (!item || !this.voiceChannel) { return; }

        try {
            void this.textChannel?.send(
                `Playing: ` +
                `${this.convertSecondsToTimeString(item.song.durationSeconds)} | ` +
                `${item.song.title} <${item.song.url}>`);

            const voiceConnection = await this.voiceChannel.join();
            const musicStream = await this.getMusicStream(item);
            if (!musicStream) {
                console.log(`Could not find audio for item: ${item.song.title}!`);
                this.onPlayComplete();
                return;
            }

            this.musicDispatcher = voiceConnection.play(musicStream)
                .on('finish', () => {
                    this.onPlayComplete();
                    console.log('music finish');
                })
                .on('error', error => {
                    console.error(error);
                    console.log('music error');
                    this.onPlayComplete();
                });
            this.musicDispatcher.setVolumeLogarithmic(this.server.volume);
        } catch (err) {
            console.log(err);
        }
    }

    private onPlayComplete() {
        this.queue.shift();
        if (this.queue.length === 0) {
            this.voiceChannel?.leave();
        } else {
            void this.playItem();
        }
    }

    private async getMusicStream(item: MusicQueueItem) {
        const info = await ytdl.getInfo(item.song.id);
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        const sortedFormats = audioFormats.sort((a, b) => (a.audioBitrate ?? 0) - (b.audioBitrate ?? 0));

        let bestAudio = sortedFormats[0];
        for (const format of sortedFormats) {
            if (format.audioBitrate ?? 0 > (bestAudio.audioBitrate ?? 0)) { bestAudio = format; }
            if (bestAudio.audioBitrate ?? 0 > 64) { break; }
        }

        if (!bestAudio) {
            return null;
        }

        console.log(`Picked audio format: ${bestAudio.codecs}, bitrate: ${bestAudio.bitrate ?? 'unknown'}, audioBitrate: ${bestAudio.audioBitrate ?? 'unknown'}`);
        const musicStream = ytdl(item.song.url, { format: bestAudio });

        return musicStream;
    }

    private convertSecondsToTimeString(seconds: number): string {
        if (seconds < 3600) {
            return new Date(seconds * 1000).toISOString().substr(14, 5);
        } else if (seconds < 86400) {
            return new Date(seconds * 1000).toISOString().substr(11, 8);
        } else {
            return '> 24h';
        }
    }
}
