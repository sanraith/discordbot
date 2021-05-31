import * as Discord from 'discord.js';
import * as ytdl from 'ytdl-core';
import { config } from './config';

export class DiscordBot {
    client: Discord.Client;

    constructor() {
        const client = new Discord.Client();
        this.client = client;
    }

    init(): void {
        this.client.login(config.token);
        this.client.once('ready', () => {
            console.log('Ready!');
        });
        this.client.once('reconnecting', () => {
            console.log('Reconnecting!');
        });
        this.client.once('disconnect', () => {
            console.log('Disconnect!');
        });

        this.client.on('message', this.onMessage.bind(this));
    }

    async onMessage(message: Discord.Message): Promise<void> {
        if (message.author.bot || !message.content.startsWith(config.prefix)) {
            return;
        }
        if (!this.client) { console.log('something is wrong...'); }
        console.log(`Read message: ${message.content}`);
        const textChannel = message.channel;

        if (message.content.startsWith(`${config.prefix}play`)) {
            const voiceChannel = message.member?.voice.channel;
            if (!voiceChannel) {
                await textChannel.send('You need to be in a voice channel to play music!');
                return;
            }

            const permissions = voiceChannel.permissionsFor(message.client.user!)!;
            if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
                await textChannel.send('I need the permissions to join and speak in your voice channel!');
                return;
            }

            let url = 'https://www.youtube.com/watch?v=wN9bXy_fiOE';
            const parts = message.content.split(' ');
            if (parts.length > 1) {
                url = parts[1];
            }
            console.log(parts);
            console.log(`Looking for song: ${url}`);

            const song = await ytdl.getInfo(url);
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
                message.channel.send('Playing song...');
            } catch (err) {
                console.log(err);
            }
        }
    }
}
