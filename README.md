# discordbot

Custom discord music bot for my servers.

## Setup dev environment (Windows)

Create ```src/config.ts``` with the correct IDs:  

```ts
export const config = {
    prefix: '-',
    discordApplicationId: '',
    discordToken: ''
};
```

- Make sure Node is installed with build tools included.
- Install ffmpeg by ```winget install --id=Gyan.FFmpeg  -e``` or other means.
- Add ffmpeg bin directory to PATH.
- ```npm config edit``` ➡️ add line ```msvs_version=2015```  
  Note: sodium requires msvs_version=2015, but newer node versions do not like this...  
  So on windows just unpack the `precompiled/sodium-win.zip` to the node_modules folder. In this case `msvs_version=2022` or other should be fine too.
- ```npm install```

## Build docker image

Create image: ```docker build -t discord-bot .```  
Create/update image and container and start in background: ```npm run docker```

## Configure image auto-restart

```docker update --restart unless-stopped discordbot-main-1```

## Check logs

```docker logs discordbot-main-1```

## Commands

- ```-register```: Use this once per server to "activate" the bot. Also needed after new commands are implemented to the bot.
- /play
- /playlist
- /skip
- /skiplist
- /stop
- /volume
