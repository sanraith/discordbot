import { PlayCommand } from './playCommand';
import { StopCommand } from './stopCommand';
import { VolumeCommand } from './volumeCommand';

export const COMMANDS = [
    new PlayCommand(),
    new StopCommand(),
    new VolumeCommand()
];
