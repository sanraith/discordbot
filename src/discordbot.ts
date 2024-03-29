import Discord, { CommandInteraction, IntentsBitField, Message } from 'discord.js';
import { isAutocompleteCommand } from './commands/command';
import { COMMANDS, registerSlashCommand, serverManager, SLASH_COMMANDS } from './commands/commands';
import { config } from './config';

export class DiscordBot {
    client: Discord.Client;

    constructor() {
        const client = new Discord.Client({
            intents: [
                IntentsBitField.Flags.Guilds,
                IntentsBitField.Flags.GuildMessages,
                IntentsBitField.Flags.GuildMessageReactions,
                IntentsBitField.Flags.GuildVoiceStates,
            ]
        });
        this.client = client;
    }

    async init(): Promise<void> {
        await this.client.login(config.discordToken);
        this.client.once('ready', () => {
            console.log('Ready!');
        });
        this.client.once('reconnecting', () => {
            console.log('Reconnecting!');
        });
        this.client.once('disconnect', () => {
            console.log('Disconnect!');
        });

        this.client.on('messageCreate', message => void this.onMessage(message));
        this.client.on('messageUpdate', (_, newMessage) => void this.onMessage(newMessage as Discord.Message));
        this.client.on('interactionCreate', interaction => void this.onInteraction(interaction));
    }

    private async onInteraction(interaction: Discord.Interaction): Promise<void> {
        try {
            if (!interaction.guildId || !interaction.channel) { return; }

            if (interaction.isAutocomplete()) {
                const command = SLASH_COMMANDS.find(x => x.slashSignatures.some(sc => sc.name === interaction.commandName));
                if (!command || !isAutocompleteCommand(command)) { return; }

                await command.handleAutocomplete(interaction);
            } else if (interaction.isCommand()) {
                await interaction.deferReply();

                const command = SLASH_COMMANDS.find(x => x.slashSignatures.some(sc => sc.name === interaction.commandName));
                if (!command) {
                    await interaction.editReply(`I do not understand the command: '${interaction.commandName}'`);
                    return;
                }

                await this.handleNewServerOrChannel(interaction);

                const result = await command.executeInteraction(interaction);
                if (!result.success) {
                    await interaction.editReply(result.errorMessage);
                }
            }
        } catch (err) {
            console.log(err);
        }
    }

    private async onMessage(message: Discord.Message): Promise<void> {
        try {
            if (message.author.bot || !message.guildId || !message.content.startsWith(config.prefix)) {
                return;
            }
            console.log(`Read message: ${message.content}`);

            const textChannel = message.channel;
            let matchedCommand = false;
            for (const command of COMMANDS) {
                for (const filter of command.messageSignatures) {
                    if (!filter.test(message.content)) { continue; }

                    await this.handleNewServerOrChannel(message);

                    const result = await command.executeMessage(message, filter);
                    if (!result.success) {
                        await textChannel.send(result.errorMessage);
                    }
                    matchedCommand = true;
                    break;
                }
                if (matchedCommand) { break; }
            }
        } catch (err) {
            console.log(err);
        }
    }

    private async handleNewServerOrChannel(message: Message | CommandInteraction) {
        const server = serverManager.getOrAdd(message.guildId!);
        if (!server.areSlashCommandsRegistered) {
            await registerSlashCommand.registerCommands(message.guildId!);
        }
        server.musicPlayer.switchTextChannel(message.channel!);
    }
}
