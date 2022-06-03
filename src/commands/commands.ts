import { ServerManager } from '../core/manager';
import { PlayCommand } from './playCommand';
import { PlaylistCommand } from './playListCommand';
import { SkipCommand } from './skipCommand';
import { SkipListCommand } from './skipListCommand';
import { StopCommand } from './stopCommand';
import { VolumeCommand } from './volumeCommand';

const serverManager = new ServerManager();

export const COMMANDS = [
    new PlaylistCommand(serverManager),
    new PlayCommand(serverManager),
    new SkipListCommand(serverManager),
    new SkipCommand(serverManager),
    new StopCommand(serverManager),
    new VolumeCommand(serverManager)
];
