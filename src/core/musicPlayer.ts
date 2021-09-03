import { DMChannel, NewsChannel, StreamDispatcher, TextChannel, VoiceChannel } from 'discord.js';
import * as ytdl from 'ytdl-core';
import { MusicQueueItem, Server } from './manager';

type SourceTextChannel = TextChannel | DMChannel | NewsChannel;

export class MusicPlayer {
    private queue: MusicQueueItem[];
    private voiceChannel?: VoiceChannel;
    private textChannel?: SourceTextChannel;
    private musicDispatcher?: StreamDispatcher;

    constructor(private server: Server) {
        this.queue = server.musicQueue;
    }

    async play(queueItem: MusicQueueItem, voiceChannel: VoiceChannel, textChannel: SourceTextChannel): Promise<void> {
        this.voiceChannel = voiceChannel;
        this.textChannel = textChannel;
        this.queue.push(queueItem);
        if (this.queue.length === 1) {
            void this.playItem();
        } else {
            await this.textChannel.send(`Queued song: ${queueItem.song.videoDetails.title}`);
        }
    }

    async skip(): Promise<void> {
        const currentItem = this.queue[0];
        if (currentItem) {
            await this.textChannel?.send(`Skipped song: ${currentItem.song.videoDetails.title}.`);
        }

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
                `${this.convertSecondsToTimeString(item.song.videoDetails.lengthSeconds)} | ` +
                `${item.song.videoDetails.title} ${item.song.videoDetails.video_url}`);

            const voiceConnection = await this.voiceChannel.join();
            const musicStream = await this.getMusicStream(item);
            if (!musicStream) {
                console.log(`Could not find audio for item: ${item.song.videoDetails.title}!`);
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
        const info = await ytdl.getInfo(item.song.videoDetails.videoId);
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        const bestAudio = audioFormats.sort((a, b) => (b.audioBitrate ?? 0) - (a.audioBitrate ?? 0))[0];
        if (!bestAudio) {
            return null;
        }

        const musicStream = ytdl(item.song.videoDetails.video_url, { format: bestAudio });
        return musicStream;
    }

    private convertSecondsToTimeString(secondStr: string): string {
        const seconds = parseInt(secondStr);
        if (seconds < 3600) {
            return new Date(seconds * 1000).toISOString().substr(14, 5);
        } else if (seconds < 86400) {
            return new Date(seconds * 1000).toISOString().substr(11, 8);
        } else {
            return '> 24h';
        }
    }
}
