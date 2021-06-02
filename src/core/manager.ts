import { GuildMember } from 'discord.js';
import { MusicPlayer } from './musicPlayer';
import ytdl = require('ytdl-core');

const defaultVolume = .75;

export interface MusicQueueItem {
    member: GuildMember;
    song: ytdl.videoInfo;
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
