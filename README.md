# Discord-Bot-Parent

A basic TypeScript parent project for discord.js bots. Dynamically loads bot projects that extend the base bot class.

## Setup

1) You'll need yarn 3.5.1 and Node 18.15.0 or higher.

2) Copy `config.example.yaml` as `config.yaml` and fill in as appropriate.

3) New bots should go under `src/bots`. You can take a look at the example `PingBot` as an example. Specifically, `BotWithConfig` needs to be extended by any bots, and there needs to be a `bot.ts` file at the root that exports an instance of the bot as default. Configuration YAML files will get auto copied with the current scripts.

4) `yarn run build`

5) `yarn run start` to start the bot. If this is your first time or adding new commands, you must run `yarn run startAndRegister` to register these commands with the guild. Try not to use this on every start - there is a cap on how many slash commands you can register a day.

## TODO

* Guild specific settings backed by a database?

## License

GNU GPL v3.0
