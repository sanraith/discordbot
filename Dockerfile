FROM node:16

# Add label to find dangling images easier
LABEL name="sanraith/discordbot"

# Install ffmpeg
RUN apt-get -y update
RUN apt-get -y upgrade
RUN apt-get install -y ffmpeg

# Copy project
COPY . /home/node/app
WORKDIR /home/node/app

# Remove node_modules, and install deps
RUN rm -rf node_modules
RUN npm install --include=dev

# Start
CMD [ "npm", "start" ]
