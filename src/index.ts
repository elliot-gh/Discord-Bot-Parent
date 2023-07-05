import { existsSync, readdirSync } from "node:fs";
import { exit } from "node:process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Client, GatewayIntentBits, IntentsBitField, Message, Routes, TextChannel } from "discord.js";
import { REST } from "@discordjs/rest";
import { BotInterface } from "./BotInterface";
import { MainConfig } from "./MainConfig";
import { getPath, readYamlConfig } from "./utils/ConfigUtils";
import { createLogger } from "./utils/Logger";

const __dirname = getPath(import.meta, null);

const allIntents = new IntentsBitField();
allIntents.add(GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
const allCommands = [];
const slashToBots: { [key: string]: BotInterface } = {};
const loadedBotsStr: string[] = [];
const loadedBots: BotInterface[] = [];

const indexLogger = createLogger("index");
const discordJsLogger = createLogger("discord.js");

indexLogger.info("Starting...");

function errorHandler(error: Error) {
    indexLogger.error(`Uncaught exception or promise, exiting: ${error}`);
    exit(1);
}

process.on("uncaughtException", errorHandler);
process.on("unhandledRejection", errorHandler);

// ---------- load config file ----------
let config: MainConfig;
try {
    config = await readYamlConfig<MainConfig>(import.meta, "config.yaml", indexLogger);
} catch (error) {
    indexLogger.error(`Unable to read config, exiting: ${error}`);
    exit(1);
}

const allowedBots: { [key: string]: boolean } = {};
if (config.allowlistEnabled) {
    if (config.allowlist === undefined || config.allowlist === null || config.allowlist.length === 0) {
        indexLogger.error("allowlistEnabled is true but invalid allowlist was detected. exiting");
        exit(1);
    }

    for (const bot of config.allowlist) {
        allowedBots[bot] = true;
    }
}

// ---------- import bot files ----------
const botsPath = join(__dirname, "bots");
const botsDir = readdirSync(botsPath, { "withFileTypes": true });
for (const botDir of botsDir) {
    if (!botDir.isDirectory()) {
        indexLogger.info(`skipping non-dir ${botDir.name}`);
        continue;
    }

    if (config.allowlistEnabled) {
        if (!(botDir.name in allowedBots)) {
            indexLogger.info(`skipping bot since it is not in the allowlist: ${botDir.name}`);
            continue;
        }
    }

    if (config.blocklist !== undefined && config.blocklist !== null) {
        if (config.blocklist.includes(botDir.name)) {
            indexLogger.info(`skipping bot since it is in the blocklist: ${botDir.name}`);
            continue;
        }
    }

    const botFilePath = join(botsPath, botDir.name, "bot.js");
    if (!existsSync(botFilePath)) {
        indexLogger.info(`skipping non-existant bot ${botFilePath}`);
        continue;
    }

    try {
        const importedBot: BotInterface = (await import(pathToFileURL(botFilePath).toString())).default;
        indexLogger.info(`imported ${botFilePath}`);

        if (importedBot.preInit) {
            indexLogger.info(`running preInit() on ${botFilePath}`);
            const result = await importedBot.preInit();
            if (result !== null) {
                indexLogger.info(`not loading ${botFilePath} due to failed preInit(): ${result}`);
                continue;
            }
        }

        const cmds = importedBot.getSlashCommands();
        for (const cmd of cmds) {
            if (cmd.name in slashToBots) {
                const errMsg = `duplicate command ${cmd.name} was found. not loading ${botFilePath}`;
                throw new Error(errMsg);
            }
        }

        for (const cmd of cmds) {
            allCommands.push(cmd);
            slashToBots[cmd.name] = importedBot;
        }

        allIntents.add(importedBot.getIntents());
        loadedBots.push(importedBot);
        loadedBotsStr.push(botDir.name);
    } catch (err) {
        indexLogger.error(`Ran into error while trying to load bot ${botFilePath}, skipping: ${err}`);
        continue;
    }
}

if (loadedBotsStr.length === 0) {
    indexLogger.error("No bots were loaded, exiting.");
    exit(1);
}

// ---------- register guild slash commands ----------
const rest = new REST({ version: "10" }).setToken(config.token);
if ("REGISTER_CMDS" in process.env && process.env.REGISTER_CMDS === "true") {
    try {
        indexLogger.info("Attempting to register guild slash commands");
        if (config.guildIds === null || config.guildIds.length === 0) {
            indexLogger.info("Registering global slash commands");
            await rest.put(Routes.applicationCommands(config.clientId), { body: allCommands });
        } else {
            for (const guildId of config.guildIds) {
                indexLogger.info(`Registering slash commands for guild ${guildId}`);
                await rest.put(Routes.applicationGuildCommands(config.clientId, guildId), { body: allCommands });
            }
        }
        indexLogger.info("Successfully registered guild slash commands");
    } catch (error) {
        indexLogger.error(`Failed to register guild slash commands, exiting: ${error}`);
        exit(1);
    }
}

// ---------- !unregisterAll handling ----------
const unregisterToken = `${Math.random().toString(36).slice(2)}${Date.now()}`;
if (config.unregisterAllId !== null) {
    indexLogger.info("----------------------------------------");
    indexLogger.info("----------------------------------------");
    indexLogger.info("----------------------------------------");
    indexLogger.info(`Unregister token: ${unregisterToken}`);
    indexLogger.info(`To unregister all commands, type in Discord: "!unregisterAll ${unregisterToken}"`);
    indexLogger.info(`The user must be user id: ${config.unregisterAllId}`);
    indexLogger.info("This token changes on every startup");
    indexLogger.info("----------------------------------------");
    indexLogger.info("----------------------------------------");
    indexLogger.info("----------------------------------------");
}

// ---------- setup event listeners and login ----------
const client = new Client({ intents: allIntents });

for (const clientBot of loadedBots) {
    if (clientBot.useClient) {
        await clientBot.useClient(client);
    }

    if (clientBot.postInit) {
        try {
            await clientBot.postInit();
        } catch (error) {
            indexLogger.error(`Received error for postInit() on ${clientBot.constructor.name}, exiting: ${error}`);
            exit(1);
        }
    }
}

client.on("warn", (msg) => {
    discordJsLogger.warn(msg);
});

if (config.debug) {
    client.on("debug", (msg) => {
        discordJsLogger.debug(msg);
    });
}


client.on("interactionCreate", async (interaction) => {
    if (interaction.user.id === client.user?.id ||
        (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand())) {
        return;
    }

    const name = interaction.commandName;
    if (name in slashToBots) {
        indexLogger.info(`got registered command: ${name}`);
        try {
            await slashToBots[name].processCommand(interaction);
        } catch (error) {
            indexLogger.error(`Received unhandled error for command ${name}:\n${error}`);
        }
    } else {
        indexLogger.error(`got unknown command: ${name}`);
    }
});

client.on("messageCreate", async (message) => {
    if (message.author.id === client.user?.id) {
        return;
    }

    const msgContent = message.content.trim();
    if (msgContent.startsWith("!unregisterAll")) {
        await unregisterAll(message);
    } else if (msgContent === "!loaded") {
        loadedMessage();
    }
});

if (config.loadedMessageId !== null) {
    client.on("ready", () => {
        loadedMessage();
    });
}

try {
    await client.login(config.token);
} catch (error) {
    indexLogger.error(`Error on login, exiting:\n${error}`);
    exit(1);
}
indexLogger.info(`Finished loading. Loaded bots:\n${getBots()}`);

if (config.exitOnWsZombie) {
    client.on("debug", async (debugStr) => {
        if (debugStr.indexOf("zombie connection") >= 0) {
            indexLogger.error(`Got discord.js WebSocket zombie string, exiting:\n${debugStr}`);
            process.exit(1);
        }
    });
}

// ---------- helper functions for main index file ----------
function getBots(): string {
    return JSON.stringify(loadedBotsStr, null, 4);
}

function loadedMessage(): void {
    if (config.loadedMessageId === null) {
        return;
    }

    void (client.channels.cache.get(config.loadedMessageId) as TextChannel)?.send(`Finished starting, loaded:\n\`\`\`JSON\n${getBots()}\`\`\``);
}

async function unregisterAll(message: Message): Promise<void> {
    if (message.author.id !== config.unregisterAllId) {
        return;
    }

    try {
        const token = message.content.substring("!unregisterAll ".length);
        if (token !== unregisterToken) {
            return;
        }

        indexLogger.info("Attempting to unregister all guild slash commands");
        if (config.guildIds === null || config.guildIds.length === 0) {
            indexLogger.info("Unregistering global slash commands");
            await rest.put(Routes.applicationCommands(config.clientId), { body: [] });
        } else {
            for (const guildId of config.guildIds) {
                indexLogger.info(`Unregistering slash commands for guild ${guildId}`);
                await rest.put(Routes.applicationGuildCommands(config.clientId, guildId), { body: [] });
            }
        }
        indexLogger.info("Successfully unregistered all guild slash commands, exiting");
        await message.reply("Successfully unregistered all guild slash commands, exiting");
        exit(0);
    } catch (error) {
        indexLogger.error(`Failed to unregister all guild slash commands: ${error}`);
        await message.reply("Failed to unregister all commands");
    }
}
