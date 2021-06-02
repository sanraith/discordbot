import { ServerManager } from '../core/manager';
import { PlayCommand } from './playCommand';
import { SkipCommand } from './skipCommand';
import { StopCommand } from './stopCommand';
import { VolumeCommand } from './volumeCommand';

const serverManager = new ServerManager();

export const COMMANDS = [
    new PlayCommand(serverManager),
    new StopCommand(serverManager),
    new SkipCommand(serverManager),
    new VolumeCommand(serverManager)
];
