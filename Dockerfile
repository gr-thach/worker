FROM node:lts-alpine3.14 as dev
WORKDIR /app

ENV AMQP_HOST=rabbitmq:5672
EXPOSE 3000

# Adding dockerize for using features like "wait for the db to connect"
RUN apk add --no-cache openssl bash python3 make g++
ENV DOCKERIZE_VERSION v0.6.1
RUN wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
  && tar -C /usr/local/bin -xzvf dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
  && rm dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz

FROM dev as run

WORKDIR /app

# Create log file for New Relic. Otherwise New Relic will complain that it doesn't have permission to write to the log file (because we don't run as root user).
RUN touch newrelic_agent.log && \
    chown node:root newrelic_agent.log && \
    chmod g+rw newrelic_agent.log

COPY package*.json ./
RUN npm set progress=false && npm config set depth 0 && npm i --only=production

COPY src src
COPY config.js index.js newrelic.js ./

# We need to run as root because we need to have permissions to access /var/run/docker.sock.
# USER node

CMD dockerize -wait tcp://$AMQP_HOST -timeout 30s npm start
