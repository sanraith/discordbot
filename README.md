# discordbot

Custom discord bot for my servers.

## Install

Create ```src/config.ts``` with the correct IDs:  

```ts
export const config = {
    prefix: '-',
    discordApplicationId: '',
    discordToken: ''
};
```

```npm config set msvs_version 2015```  
```npm install```

## Build docker image

Create image: ```docker build -t discord-bot .```  
Create/update image and container and start in background: ```npm run docker```

## Configure image auto-restart

docker update --restart unless-stopped discordbot-main-1
