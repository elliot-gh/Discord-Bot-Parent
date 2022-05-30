# Discord-Bot-Parent

A basic TypeScript parent project for discord.js bots. Dynamically loads bot projects that implement the interface. Currently is really only meant to run on a single server.

## Setup

1) You'll need yarn 3.2.1 and Node 16.15.0 or higher.

2) Copy `config.example.yaml` as `config.yaml` and fill in as appropriate.

3) New bots should go under `src/bots`. You can take a look at the example `PingBot` as an example. Specifically, `BotInterface` needs to be implemented for any bots, and there needs to be a `bot.ts` file at the root that exports an instance of the bot as default. Configuration YAML files will get auto copied with the current scripts.

4) `yarn run build`

5) `yarn run start` to start the bot. If this is your first time or adding new commands, you must run `yarn run startAndRegister` to register these commands with the guild. Try not to use this on every start - there is a cap on how many slash commands you can register a day.

## TODO

* Cleanup and improve project structure

* Improve the interface (ie make things static, etc)

* Multiple guilds?

* Guild specific settings backed by a database?

## License

GNU GPL v3.0
