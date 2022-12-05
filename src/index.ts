import { existsSync, readdirSync } from "node:fs";
import { exit } from "node:process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Client, GatewayIntentBits, IntentsBitField, Message, Routes, TextChannel } from "discord.js";
import { REST } from "@discordjs/rest";
import { BotInterface } from "./BotInterface";
import { MainConfig } from "./MainConfig";
import { getPath, readYamlConfig } from "./utils/ConfigUtils";

const __dirname = getPath(import.meta, null);

const loadedBots: string[] = [];
const allIntents = new IntentsBitField();
allIntents.add(GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
const allCommands = [];
const slashToBots: { [key: string]: BotInterface } = {};
const useClientBots: BotInterface[] = [];

function errorHandler(error: Error) {
    console.error(`Uncaught exception or promise, exiting: ${error}`);
    exit(1);
}

process.on("uncaughtException", errorHandler);
process.on("unhandledRejection", errorHandler);

// ---------- load config file ----------
let config: MainConfig;
try {
    config = await readYamlConfig<MainConfig>(import.meta, "config.yaml");
} catch (error) {
    console.error(`[index] Unable to read config, exiting: ${error}`);
    exit(1);
}

const allowedBots: { [key: string]: boolean } = {};
if (config.allowlistEnabled) {
    if (config.allowlist === undefined || config.allowlist === null || config.allowlist.length === 0) {
        console.error("[index] allowlistEnabled is true but invalid allowlist was detected");
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
        console.log(`[index]: skipping non-dir ${botDir.name}`);
        continue;
    }

    if (config.allowlistEnabled) {
        if (!(botDir.name in allowedBots)) {
            console.log(`[index] skipping bot since it is not in the allowlist: ${botDir.name}`);
            continue;
        }
    }

    const botFilePath = join(botsPath, botDir.name, "bot.js");
    if (!existsSync(botFilePath)) {
        console.log(`[index]: skipping non-existant bot ${botFilePath}`);
        continue;
    }

    try {
        const importedBot: BotInterface = (await import(pathToFileURL(botFilePath).toString())).default;
        console.log(`[index]: imported ${botFilePath}`);

        if (importedBot.init) {
            console.log(`[index] running init() on ${botFilePath}`);
            const result = await importedBot.init();
            if (result !== null) {
                console.log(`[index]: skipping ${botFilePath} due to failed init(): ${result}`);
                continue;
            }
        }

        allIntents.add(importedBot.intents);
        for (const cmd of importedBot.commands) {
            if (cmd.name in slashToBots) {
                console.error(`*** [index] WARNING WARNING WARNING: Duplicate command ${cmd.name} was found! Something will probably go wrong. ***`);
            }

            slashToBots[cmd.name] = importedBot;
            allCommands.push(cmd.toJSON());
        }

        if (importedBot.useClient) {
            useClientBots.push(importedBot);
        }

        loadedBots.push(botDir.name);
    } catch (err) {
        console.error(`[index]: Ran into error while trying to load bot ${botFilePath}, skipping: ${err}`);
        continue;
    }
}

if (loadedBots.length === 0) {
    console.error("[index] No bots were loaded, exiting.");
    exit(1);
}

// ---------- register guild slash commands ----------
const rest = new REST({ version: "10" }).setToken(config.token);
if ("REGISTER_CMDS" in process.env && process.env.REGISTER_CMDS === "true") {
    try {
        console.log("[index] Attempting to register guild slash commands");
        await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: allCommands });
        console.log("[index] Successfully registered guild slash commands");
    } catch (error) {
        console.error(`[index] Failed to register guild slash commands, exiting: ${error}`);
        exit(1);
    }
}

// ---------- setup event listeners and login ----------
const client = new Client({ intents: allIntents });
client.on("warn", console.warn);
if (config.debug) {
    client.on("debug", console.debug);
}


client.on("interactionCreate", async (interaction) => {
    if (
        (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand())
        || interaction.user.id === client.user?.id) {
        return;
    }

    const name = interaction.commandName;
    if (name in slashToBots) {
        console.log(`[index] got registered command: ${name}`);
        try {
            await slashToBots[name].processCommand(interaction);
        } catch (error) {
            console.error(`[index] Received unhandled execution error for command ${name}: ${error}`);
        }
    }
});

client.on("messageCreate", async (message) => {
    if (message.author.id === client.user?.id) {
        return;
    }

    const msgContent = message.content.trim();
    if (msgContent === "!unregisterAll") {
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
    console.error(`[index] Failed to login, exiting: ${error}`);
    exit(1);
}
console.log(`[index] Finished loading. Loaded bots: ${getBots()}`);

for (const clientBot of useClientBots) {
    if (!clientBot.useClient) {
        continue;
    }

    await clientBot.useClient(client);
}

if (config.exitOnWsZombie) {
    client.on("debug", async (debugStr) => {
        if (debugStr.indexOf("zombie connection") >= 0) {
            console.error(`Got discord.js WebSocket zombie string, restarting:\n${debugStr}`);
            process.exit(1);
        }
    });
}

// ---------- helper functions for main index file ----------
function getBots(): string {
    return JSON.stringify(loadedBots, null, 4);
}

function loadedMessage(): void {
    if (config.loadedMessageId === null) {
        return;
    }

    void (client.channels.cache.get(config.loadedMessageId) as TextChannel)?.send(`Finished starting, loaded:\n\`\`\`JSON\n${getBots()}\`\`\``);
}

async function unregisterAll(message: Message): Promise<void> {
    if (config.unregisterAllId === null || message.author.id !== config.unregisterAllId) {
        return;
    }

    try {
        console.log("[index] Attempting to unregister all guild slash commands");
        await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: [] });
        console.log("[index] Successfully unregistered all guild slash commands");
        await message.reply("Success");
    } catch (error) {
        console.error(`[index] Failed to unregister all guild slash commands: ${error}`);
        await message.reply("Failed");
    }
}
