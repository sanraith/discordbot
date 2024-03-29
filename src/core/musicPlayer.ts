import { AudioPlayer, AudioPlayerStatus, AudioResource, createAudioPlayer, createAudioResource, demuxProbe, DiscordGatewayAdapterCreator, getVoiceConnection, joinVoiceChannel, NoSubscriberBehavior, PlayerSubscription } from '@discordjs/voice';
import { TextBasedChannel, VoiceBasedChannel } from 'discord.js';
import { Readable } from 'stream';
import ytdl from 'ytdl-core';
import { convertSecondsToTimeString, nothingAsync } from './helpers';
import { MusicQueueItem, PlaylistQueueItem, Server } from './manager';

interface SkipResult {
    success: boolean;
    skippedCount: number;
}

interface SkipListResult {
    success: boolean;
    skippedTitle?: string;
    skipCount?: number;
}

interface PlayResult { mode: 'play' | 'queue'; }

interface StopResult { success: boolean; }

export class MusicPlayer {
    private queue: MusicQueueItem[];
    private voiceChannel?: VoiceBasedChannel;
    private textChannel?: TextBasedChannel;

    private audioPlayer: AudioPlayer;
    private audioResource?: AudioResource;
    private playerSubscription?: PlayerSubscription;

    constructor(private server: Server) {
        this.queue = server.musicQueue;

        const endSong = () => this.onPlayComplete();
        this.audioPlayer = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
        this.audioPlayer
            .on(AudioPlayerStatus.Idle, endSong)
            .on(AudioPlayerStatus.Paused, endSong)
            .on('error', error => {
                console.error(error);
                console.log('music error');
                this.onPlayComplete();
            });
    }

    async playList(listItem: PlaylistQueueItem, voiceChannel: VoiceBasedChannel, isImmediate = false): Promise<void> {
        const items = listItem.items;
        if (isImmediate) {
            items.reverse();
        }

        for (const item of items) {
            const musicQueueItem: MusicQueueItem = {
                member: listItem.member,
                song: item,
                playlist: listItem
            };
            await this.play(musicQueueItem, voiceChannel, isImmediate);
        }
    }

    async play(queueItem: MusicQueueItem, voiceChannel: VoiceBasedChannel, isImmediate = false): Promise<PlayResult> {
        await nothingAsync();
        this.voiceChannel = voiceChannel;
        if (isImmediate) {
            this.queue.splice(1, 0, queueItem);
        } else {
            this.queue.push(queueItem);
        }
        if (this.queue.length === 1) {
            void this.playItem();
            return { mode: 'play' };

        }
        return { mode: 'queue' };
    }

    async skip(count = 1): Promise<SkipResult> {
        await nothingAsync();
        const currentItem = this.queue[0];
        const result: SkipResult = currentItem ?
            { success: true, skippedCount: Math.min(this.queue.length, count) } :
            { success: false, skippedCount: 0 };
        this.queue.splice(1, count - 1);
        this.audioPlayer?.stop();

        return result;
    }

    async skipList(): Promise<SkipListResult> {
        await nothingAsync();
        const currentItem = this.queue[0];
        if (!currentItem || !currentItem.playlist) {
            return { success: false };
        }

        // find next item from different playlist
        let nextDifferentIndex = this.queue.findIndex(x => x.playlist !== currentItem.playlist);
        if (nextDifferentIndex === -1) {
            nextDifferentIndex = this.queue.length;
        }
        this.queue.splice(1, nextDifferentIndex - 1);

        this.audioPlayer?.stop();

        return { success: true, skipCount: nextDifferentIndex, skippedTitle: currentItem.playlist.title };
    }

    async stop(): Promise<StopResult> {
        await nothingAsync();
        const queueHasItems = this.queue.length > 0;
        if (queueHasItems) {
            this.queue.splice(0, this.queue.length);
            this.audioPlayer?.stop();
        }

        return { success: queueHasItems };
    }

    /**
     * Set current and future playback volume for server.
     * @param volume 100 === 100%
     */
    async setVolume(volume: number): Promise<void> {
        await nothingAsync();
        this.server.volume = volume / 100;
        this.audioResource?.volume?.setVolume(this.server.volume);
    }

    switchTextChannel(channel: TextBasedChannel): void {
        this.textChannel = channel;
    }

    private async playItem(): Promise<void> {
        const item = this.queue[0];
        if (!item || !this.voiceChannel) { return; }

        try {
            void this.textChannel?.send(
                `Playing: ` +
                `${convertSecondsToTimeString(item.song.durationSeconds)} | ` +
                `${item.song.title} <${item.song.url}>`);

            const musicStream = await this.getMusicStream(item);
            if (!musicStream) {
                console.log(`Could not find audio for item: ${item.song.title}!`);
                this.onPlayComplete();
                return;
            }
            this.audioResource = await this.probeAndCreateResource(musicStream);

            const voiceConnection = joinVoiceChannel({
                channelId: this.voiceChannel.id,
                guildId: this.voiceChannel.guildId,
                adapterCreator: this.voiceChannel.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator
            });
            this.playerSubscription?.unsubscribe();
            this.playerSubscription = voiceConnection.subscribe(this.audioPlayer);
            this.audioPlayer.play(this.audioResource);
        } catch (err) {
            console.log(err);
        }
    }

    private onPlayComplete() {
        this.audioResource!.playStream.destroy();
        console.log('music finish');

        this.queue.shift();
        if (this.queue.length === 0) {
            if (this.voiceChannel) {
                this.playerSubscription?.unsubscribe();
                getVoiceConnection(this.voiceChannel.guildId)?.destroy();
            }
        } else {
            void this.playItem();
        }
    }

    private async probeAndCreateResource(readableStream: Readable): Promise<AudioResource<null>> {
        const { stream, type } = await demuxProbe(readableStream);
        const audioResource = createAudioResource(stream, { inputType: type, inlineVolume: true });
        audioResource?.volume?.setVolume(this.server.volume);

        return audioResource;
    }

    private async getMusicStream(item: MusicQueueItem) {
        try {
            const info = await ytdl.getInfo(item.song.id);
            const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
            const sortedFormats = audioFormats.sort((a, b) => (a.audioBitrate ?? 0) - (b.audioBitrate ?? 0));
            const preferredCodecs = 'opus';

            let bestFormat = sortedFormats[0];
            for (const format of sortedFormats) {
                const isHigherBitrate = (format.audioBitrate ?? 0) > (bestFormat.audioBitrate ?? 0);
                const isFormatBetterOrSame = bestFormat.codecs !== preferredCodecs || format.codecs === preferredCodecs;
                if (isHigherBitrate && isFormatBetterOrSame) {
                    bestFormat = format;
                }

                const isBitrateSufficient = (bestFormat.audioBitrate ?? 0) >= 64;
                const isCodecSufficient = bestFormat.codecs === preferredCodecs;
                if (isBitrateSufficient && isCodecSufficient) {
                    break;
                }
            }

            if (!bestFormat) {
                return null;
            }

            console.log(`Picked audio format: ${bestFormat.codecs}, bitrate: ${bestFormat.bitrate ?? 'unknown'}, audioBitrate: ${bestFormat.audioBitrate ?? 'unknown'}`);
            const musicStream = ytdl(item.song.url, {
                format: bestFormat,
                highWaterMark: 1 << 62, // To fix disconnecting issues, referenced from: https://github.com/fent/node-ytdl-core/issues/902#issuecomment-1086880966
                liveBuffer: 1 << 62,
                dlChunkSize: 0 //disabling chunking is recommended in discord bot
            });

            return musicStream;
        } catch (err) {
            console.log('musicPlayer>getMusicStream');
            console.log(err);
            return null;
        }
    }
}
