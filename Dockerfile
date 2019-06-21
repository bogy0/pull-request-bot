FROM alpine:latest

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY . .

ARG SLACK_HOOK
ENV SLACK_HOOK=$SLACK_HOOK

ARG GITHUB_ACCESS_TOKKEN
ENV GITHUB_ACCESS_TOKKEN=$GITHUB_ACCESS_TOKKEN

RUN apk update
RUN apk add --update nodejs nodejs-npm
RUN npm ci

# Create the log file to be able to run tail
RUN touch /var/log/cron.log
RUN (crontab -l ; echo "0 9 * * * export GITHUB_ACCESS_TOKKEN=$GITHUB_ACCESS_TOKKEN; export SLACK_HOOK=$SLACK_HOOK; /usr/bin/node /usr/src/app/index.js >> /var/log/cron.log") | crontab -

# Run the command on container startup
CMD crond && tail -f /var/log/cron.log
