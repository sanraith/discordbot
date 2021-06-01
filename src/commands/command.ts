import { Message } from 'discord.js';
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

export interface ICommand {
    get messageFilters(): RegExp[];
    execute(message: Message, matchedFilter: RegExp): Promise<ICommandResult>;
}

export const SUCCESS_RESULT: ICommandResult = { success: true };
export const COMMAND_PREFIX_REGEX = escapeRegex(config.prefix);
