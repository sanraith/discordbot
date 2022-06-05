import { ServerManager } from '../core/manager';
import { IMessageCommand, ISlashCommand } from './command';
import { PlayCommand } from './playCommand';
import { PlaylistCommand } from './playListCommand';
import { RegisterSlashCommands } from './registerSlashCommands';
import { SkipCommand } from './skipCommand';
import { SkipListCommand } from './skipListCommand';
import { StopCommand } from './stopCommand';
import { VolumeCommand } from './volumeCommand';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isSlashCommand(command: any): command is ISlashCommand {
    return (command as ISlashCommand).slashSignatures !== undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isMessageCommand(command: any): command is IMessageCommand {
    return (command as IMessageCommand).messageSignatures !== undefined;
}

export const serverManager = new ServerManager();

export const SLASH_COMMANDS: ISlashCommand[] = [];
export const registerSlashCommand = new RegisterSlashCommands(serverManager, SLASH_COMMANDS);
const allCommands: (IMessageCommand | ISlashCommand)[] = [
    new PlaylistCommand(serverManager),
    new PlayCommand(serverManager),
    new SkipListCommand(serverManager),
    new SkipCommand(serverManager),
    new StopCommand(serverManager),
    new VolumeCommand(serverManager),
    registerSlashCommand
];
SLASH_COMMANDS.push(...allCommands.filter(x => isSlashCommand(x)).map(x => x as ISlashCommand));

export const COMMANDS: IMessageCommand[] = allCommands.filter(x => isMessageCommand(x)).map(x => x as IMessageCommand);

