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

        if (`${config.prefix}play` === message.content) {
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

            const url = 'https://www.youtube.com/watch?v=wN9bXy_fiOE';
            console.log('Looking for song...');
            const song = await ytdl.getInfo(url);
            console.log(song);

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
                dispatcher.setVolumeLogarithmic(1);
                message.channel.send('Playing song...');
            } catch (err) {
                console.log(err);
            }
        }
    }
}
