import { RESTPostAPIApplicationCommandsJSONBody } from 'discord-api-types/v10';
import { CommandInteraction, Message } from 'discord.js';
import { config } from '../config';
import { escapeRegex } from '../core/helpers';

export type ICommandResult = SuccessResult | FailResult;

export interface SuccessResult {
    success: true;
}

export interface FailResult {
    success: false;
    errorMessage: string;
}

interface SlashCommandBuilderResult {
    readonly name: string;
    toJSON(): RESTPostAPIApplicationCommandsJSONBody;
}

export interface IMessageCommand {
    get messageSignatures(): RegExp[];
    executeMessage(message: Message, matchedFilter: RegExp): Promise<ICommandResult>;
}

export interface ISlashCommand {
    get slashSignatures(): SlashCommandBuilderResult[];
    executeInteraction(interaction: CommandInteraction): Promise<ICommandResult>;
}

export const SUCCESS_RESULT: ICommandResult = { success: true };
export const COMMAND_PREFIX_REGEX = escapeRegex(config.prefix);
