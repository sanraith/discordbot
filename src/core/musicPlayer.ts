import { AudioPlayer, AudioPlayerStatus, AudioResource, createAudioPlayer, createAudioResource, DiscordGatewayAdapterCreator, getVoiceConnection, joinVoiceChannel, NoSubscriberBehavior, PlayerSubscription } from '@discordjs/voice';
import { TextBasedChannel, VoiceBasedChannel } from 'discord.js';
import { Readable } from 'stream';
import * as ytdl from 'ytdl-core';
import { MusicQueueItem, PlaylistQueueItem, Server } from './manager';

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
            .on(AudioPlayerStatus.AutoPaused, endSong)
            .on(AudioPlayerStatus.Idle, endSong)
            .on(AudioPlayerStatus.Paused, endSong)
            .on('error', error => {
                console.error(error);
                console.log('music error');
                this.onPlayComplete();
            });
    }

    async playList(listItem: PlaylistQueueItem, voiceChannel: VoiceBasedChannel, textChannel: TextBasedChannel): Promise<void> {
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

    async play(queueItem: MusicQueueItem, voiceChannel: VoiceBasedChannel, textChannel: TextBasedChannel, logQueue = true): Promise<void> {
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

        this.audioPlayer?.stop();
    }

    async skipList(): Promise<void> {
        const currentItem = this.queue[0];
        if (!currentItem || !currentItem.playlist) {
            await this.textChannel?.send(`Cannot skip playlist as none is playing currently.`);
            return;
        }

        // find next item from different playlist
        let nextDifferentIndex = this.queue.findIndex(x => x.playlist !== currentItem.playlist);
        if (nextDifferentIndex === -1) {
            nextDifferentIndex = this.queue.length;
        }
        this.queue.splice(1, nextDifferentIndex - 1);
        await this.textChannel?.send(`Skipped ${nextDifferentIndex} items from playlist '${currentItem.playlist.title}'.`);

        this.audioPlayer?.stop();
    }

    async stop(): Promise<void> {
        if (this.queue.length > 0) {
            this.queue.splice(0, this.queue.length);
            this.audioPlayer?.stop();
            await this.textChannel?.send(`Stopped playing.`);
        }
    }

    /**
     * Set current and future playback volume for server.
     * @param volume 100 === 100%
     */
    async setVolume(volume: number): Promise<void> {
        this.server.volume = volume / 100;
        this.audioResource?.volume?.setVolume(this.server.volume);
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

            const musicStream = await this.getMusicStream(item);
            if (!musicStream) {
                console.log(`Could not find audio for item: ${item.song.title}!`);
                this.onPlayComplete();
                return;
            }
            this.audioResource = createAudioResource(musicStream);
            this.audioResource?.volume?.setVolume(this.server.volume);

            // TODO handle rejoining the same channel
            const voiceConnection = joinVoiceChannel({
                channelId: this.voiceChannel.id,
                guildId: this.voiceChannel.guildId,
                adapterCreator: this.voiceChannel.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator
            });
            this.playerSubscription = voiceConnection.subscribe(this.audioPlayer);
            this.audioPlayer.play(this.audioResource);
        } catch (err) {
            console.log(err);
        }
    }

    private onPlayComplete() {
        // TODO check if same as musicstream created above
        (this.audioResource?.playStream as Readable)?.destroy();
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

    // TODO try opus again as libs are updated
    private async getMusicStream(item: MusicQueueItem) {
        const info = await ytdl.getInfo(item.song.id);
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        const sortedFormats = audioFormats.sort((a, b) => (a.audioBitrate ?? 0) - (b.audioBitrate ?? 0));
        const unwantedCodecs = 'opus';

        let bestFormat = sortedFormats[0];
        for (const format of sortedFormats) {
            const isHigherBitrate = (format.audioBitrate ?? 0) > (bestFormat.audioBitrate ?? 0);
            const isFormatBetterOrSame = bestFormat.codecs === unwantedCodecs || format.codecs !== unwantedCodecs;
            if (isHigherBitrate && isFormatBetterOrSame) {
                bestFormat = format;
            }

            const isBitrateSufficient = (bestFormat.audioBitrate ?? 0) > 64;
            const isCodecSufficient = bestFormat.codecs !== unwantedCodecs;
            if (isBitrateSufficient && isCodecSufficient) {
                break;
            }
        }

        if (!bestFormat) {
            return null;
        }

        console.log(`Picked audio format: ${bestFormat.codecs}, bitrate: ${bestFormat.bitrate ?? 'unknown'}, audioBitrate: ${bestFormat.audioBitrate ?? 'unknown'}`);
        const musicStream = ytdl(item.song.url, { format: bestFormat });

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
