import { GuildMember } from 'discord.js';
import { MusicPlayer } from './musicPlayer';

const defaultVolume = .75;

interface VideoInfo {
    id: string;
    url: string;
    title: string;
    durationSeconds: number;
}

export interface PlaylistQueueItem {
    member: GuildMember;
    items: VideoInfo[];
    title: string;
    url: string;
    totalDurationSeconds: number;
}

export interface MusicQueueItem {
    member: GuildMember;
    song: VideoInfo;
    playlist?: PlaylistQueueItem;
}

export interface Server {
    id: string;
    volume: number;
    musicPlayer: MusicPlayer;
    musicQueue: MusicQueueItem[];
}

export class ServerManager {
    getOrAdd(guildId: string): Server {
        let server = this.servers.get(guildId);
        if (!server) {
            server = {
                id: guildId,
                volume: defaultVolume,
                musicPlayer: null!,
                musicQueue: []
            };
            server.musicPlayer = new MusicPlayer(server);

            this.servers.set(guildId, server);
        }

        return server;
    }

    private servers: Map<string, Server> = new Map<string, Server>();
}
