# Discord-Bot-Parent

A basic TypeScript parent project for discord.js bots. Dynamically loads bot projects that extend the base bot class.

## Setup

1) You'll need yarn 4.2.2 and Node 20.14.0 or higher.

2) Copy `src/config.example.yaml` as `src/config.yaml` and fill in as appropriate.

3) New bots should go under `src/bots`. You can take a look at `PingBot` or `DeleteBotMessageBot` as examples. Specifically, `BotWithConfig` or `IBot` needs to be impleneted by any bots, and there needs to be a `bot.ts` file at that subfolder's `src/` that exports an instance of the bot as default. Configuration YAML files will get auto copied with the current scripts.

4) `yarn run build`

5) `yarn run start` to start the bot. If this is your first time or adding new commands, you must run `yarn run startAndRegister` to register these commands. Try not to use this on every start - there is a cap on how many slash commands you can register a day.

## TODO

* Guild specific settings backed by a database?

## License

MIT
