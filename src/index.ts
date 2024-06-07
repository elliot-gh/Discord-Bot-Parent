import { REST } from "@discordjs/rest";
import { Client, ClientEvents, ContextMenuCommandBuilder, GatewayIntentBits, IntentsBitField, Message, Routes, SlashCommandBuilder, TextChannel } from "discord.js";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { exit } from "node:process";
import { pathToFileURL } from "node:url";
import { MainConfig } from "./MainConfig.js";
import { IBot } from "./interfaces/IBot.js";
import { getPath, readYamlConfig } from "./utils/ConfigUtils.js";
import { ShouldIgnoreEvent } from "./utils/DiscordUtils.js";
import { createLogger } from "./utils/Logger.js";

const __dirname = getPath(import.meta, null);

// using any because array of handler functions creates a union of types too large for typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenericAsyncFunction = (...arg: any) => Promise<void>;
type AllEventHandlerDict = {
    [Event in keyof ClientEvents]?: GenericAsyncFunction[]
};

// ---------- init basic objects ----------

const allIntents = new IntentsBitField();
allIntents.add(GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages);
const allCommands: (SlashCommandBuilder | ContextMenuCommandBuilder)[] = [];
const allHandlers: AllEventHandlerDict = {};
const loadedBots: IBot[] = [];
const loadedBotsStr: string[] = [];

const indexLogger = createLogger("index");
const discordJsLogger = createLogger("discord.js");

indexLogger.info("Starting...");

function errorHandler(error: Error) {
    indexLogger.error(`Uncaught exception or promise, exiting: ${error}`);
    // exit(1);
}

process.on("uncaughtException", errorHandler);
process.on("unhandledRejection", errorHandler);

// ---------- load config file ----------
let config: MainConfig;
try {
    config = readYamlConfig<MainConfig>(import.meta, "config.yaml", indexLogger);
} catch (error) {
    indexLogger.error(`Unable to read config, exiting: ${error}`);
    exit(1);
}

if (config.unregisterAllId !== null) {
    allIntents.add(GatewayIntentBits.MessageContent);
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

const blockedBots: { [key: string]: boolean } = {};
if (config.blocklist !== undefined && config.blocklist !== null) {
    for (const bot of config.blocklist) {
        blockedBots[bot] = true;
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

    if (botDir.name in blockedBots) {
        indexLogger.info(`skipping bot since it is in the blocklist: ${botDir.name}`);
        continue;
    }

    const botFilePath = join(botsPath, botDir.name, "src", "bot.js");
    if (!existsSync(botFilePath)) {
        indexLogger.error(`Skipping non-existant bot. Does bot.js exist in ${botFilePath}?`);
        continue;
    }

    try {
        indexLogger.info(`trying to import ${botFilePath}`);
        const importedBot: IBot = (await import(pathToFileURL(botFilePath).toString())).default;
        indexLogger.info(`imported ${botFilePath}`);

        if (importedBot.preInit) {
            indexLogger.info(`running preInit() on ${botFilePath}`);
            const result = await importedBot.preInit();
            if (result !== null) {
                indexLogger.error(`not loading ${botFilePath} due to failed preInit(): ${result}`);
                continue;
            }
        }

        for (const cmd of importedBot.getSlashCommands()) {
            allCommands.push(cmd);
        }

        for (const [event, handler] of Object.entries(importedBot.getEventHandlers())) {
            const castEvent = event as keyof ClientEvents;
            if (allHandlers[castEvent] === undefined) {
                allHandlers[castEvent] = [];
            }

            allHandlers[castEvent]!.push(handler);
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

// create event listeners for handlers
for (const [event, handlers] of Object.entries(allHandlers)) {
    client.on(event, (...args) => {
        for (const handler of handlers) {
            void handler(...args);
        }
    });

}

client.on("warn", (msg) => {
    discordJsLogger.warn(msg);
});

if (config.debug) {
    client.on("debug", (msg) => {
        discordJsLogger.debug(msg);
    });
}

if (config.unregisterAllId !== null) {
    client.on("messageCreate", (message) => {
        if (ShouldIgnoreEvent(message)) {
            return;
        }

        const msgContent = message.content.trim();
        if (msgContent.startsWith("!unregisterAll")) {
            void unregisterAll(message);
        } else if (msgContent === "!loaded") {
            loadedMessage();
        }
    });
}

if (config.loadedMessageId !== null) {
    client.on("ready", () => {
        loadedMessage();

        for (const bot of loadedBots) {
            if (bot.postInit) {
                try {
                    void bot.postInit();
                } catch (error) {
                    indexLogger.error(`Received error for postInit() on ${bot.constructor.name}, exiting: ${error}`);
                    exit(1);
                }
            }

            if (bot.useClient) {
                void bot.useClient(client);
            }
        }
    });
}

try {
    await client.login(config.token);

    if (config.presenceName !== undefined && config.presenceName !== null
        && config.presenceType !== undefined && config.presenceType !== null) {
        client.user?.setPresence({
            "activities": [{
                name: config.presenceName,
                type: config.presenceType
            }]
        });
    }
} catch (error) {
    indexLogger.error(`Error on login, exiting:\n${error}`);
    exit(1);
}
indexLogger.info(`Finished loading. Loaded bots:\n${getBots()}`);

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
