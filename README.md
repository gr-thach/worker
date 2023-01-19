# guardrailsio/worker

> 🔍 GuardRails Worker processing scan requests

## Install

```bash
$ git clone git@github.com:guardrailsio/worker.git
$ cd worker
$ npm install
```

## Usage

```bash
$ npm start

> @guardrails/worker@1.53.5 start /Users/kytwb/Desktop/devops/worker
> node index.js

================================
 Missing environment variables:
    DOCKER_HOST: undefined
    AMQP_URI: undefined
    DOCKER_HUB_AUTH_BASE64: undefined
    GITHUB_APP_ISSUER_ID: undefined
    GITHUB_APP_PRIVATE_KEY_BASE64: undefined
```

You can add a `.env` file with the missing environment variables and manage your own databases/docker host, or use [guardrails/devops](https://github.com/guardrailsio/devops) development environment that will take care of setting up most of that with Docker Compose.
