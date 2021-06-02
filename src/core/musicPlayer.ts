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
            const voiceConnection = await this.voiceChannel.join();
            const musicStream = ytdl(item.song.videoDetails.video_url);
            this.musicDispatcher = voiceConnection.play(musicStream)
                .on('finish', () => {
                    this.onPlayComplete();
                })
                .on('error', error => {
                    console.error(error);
                    this.onPlayComplete();
                });
            this.musicDispatcher.setVolumeLogarithmic(this.server.volume);

            await this.textChannel?.send(`Playing song: ${item.song.videoDetails.title}`);

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
}
