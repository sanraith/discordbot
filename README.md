# discordbot

Custom discord music bot for my servers.

## Install

Create ```src/config.ts``` with the correct IDs:  

```ts
export const config = {
    prefix: '-',
    discordApplicationId: '',
    discordToken: ''
};
```

- Make sure node is installed with build tools included.
- Install ffmpeg by ```winget install --id=Gyan.FFmpeg  -e``` or other means.
- Add ffmpeg bin directory to path.
- ```npm config edit``` ➡️ add line ```msvs_version=2015```
- ```npm install```

## Build docker image

Create image: ```docker build -t discord-bot .```  
Create/update image and container and start in background: ```npm run docker```

## Configure image auto-restart

docker update --restart unless-stopped discordbot-main-1

## Commands

- /play
- /playlist
- /skip
- /skiplist
- /stop
- /volume
