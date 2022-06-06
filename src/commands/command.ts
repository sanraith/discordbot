import { RESTPostAPIApplicationCommandsJSONBody } from 'discord-api-types/v10';
import { AutocompleteInteraction, CommandInteraction, Message } from 'discord.js';
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

export interface IAutocompleteCommand {
    handleAutocomplete(autocomplete: AutocompleteInteraction): Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isAutocompleteCommand(handler: any): handler is IAutocompleteCommand {
    return (handler as IAutocompleteCommand).handleAutocomplete !== undefined;
}

export const SUCCESS_RESULT: ICommandResult = { success: true };
export const COMMAND_PREFIX_REGEX = escapeRegex(config.prefix);
