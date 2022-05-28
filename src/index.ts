import { existsSync, readdirSync } from 'node:fs';
import { exit } from 'node:process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client, Intents, Message, TextChannel } from 'discord.js';
import { RESTPostAPIApplicationCommandsJSONBody, Routes } from 'discord-api-types/v9';
import { REST } from '@discordjs/rest';
import { BotInterface } from './BotInterface';
import { Config } from './Config';
import { readConfig } from './utils/ConfigUtils';

const __dirname = dirname(fileURLToPath(import.meta.url));

const loadedBots: string[] = [];
const allIntents = new Intents();
allIntents.add(Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES);
const allCommands: RESTPostAPIApplicationCommandsJSONBody[] = [];
const slashToBots: { [key: string]: BotInterface } = {};
const clientFns: BotInterface['handleClient'][] = [];

// ---------- load config file ----------
const configPath = join(__dirname, 'config.yaml');
let config: Config;
try {
    config = await readConfig<Config>(configPath);
} catch (error) {
    console.error(`[index] Unable to read config, exiting: ${error}`);
    exit(1);
}

// ---------- import bot files ----------
const botsPath = join(__dirname, 'bots');
const botsDir = readdirSync(botsPath, { 'withFileTypes': true });
for (const botDir of botsDir) {
    if (!botDir.isDirectory()) {
        console.log(`[index]: skipping non-dir ${botDir.name}`);
        continue;
    }

    const botFilePath = join(botsPath, botDir.name, 'bot.js');
    if (!existsSync(botFilePath)) {
        console.log(`[index]: skipping non-existant bot ${botFilePath}`);
        continue;
    }

    try {
        const importedBot: BotInterface = (await import(pathToFileURL(botFilePath).toString())).default as BotInterface;
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
        for (const cmd of importedBot.slashCommands) {
            if (cmd.name in slashToBots) {
                console.error(`*** [index] WARNING WARNING WARNING: Duplicate command ${cmd.name} was found! Something will probably go wrong. ***`);
            }

            slashToBots[cmd.name] = importedBot;
            allCommands.push(cmd.toJSON());
        }

        if (importedBot.handleClient) {
            clientFns.push(importedBot.handleClient);
        }

        loadedBots.push(botDir.name);
    } catch (err) {
        console.error(`[index]: Ran into error while trying to load bot ${botFilePath}, skipping: ${err}`);
        continue;
    }
}

if (loadedBots.length === 0) {
    console.error('No bots were loaded, exiting.');
    exit(1);
}

// ---------- register guild slash commands ----------
const rest = new REST({ version: '9' }).setToken(config.token);
try {
    console.log('[index] Attempting to register guild slash commands');
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: allCommands });
    console.log('[index] Successfully registered guild slash commands');
} catch (error) {
    console.error(`[index] Failed to register guild slash commands, exiting: ${error}`);
    exit(1);
}

// ---------- setup event listeners and login ----------
const client = new Client({ intents: allIntents });
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) {
        return;
    }

    const name = interaction.commandName;
    if (name in slashToBots) {
        console.log(`[index] got registered command: ${name}`);
        slashToBots[name].execute(interaction);
    }
});

client.on('messageCreate', async (message) => {
    const msgContent = message.content.trim();
    if (msgContent === '!unregisterAll') {
        unregisterAll(message);
    } else if (msgContent === '!loaded') {
        loadedMessage();
    }
});

if (config.loadedMessageId !== null) {
    client.on('ready', () => {
        loadedMessage();
    });
}

for (const clientFn of clientFns) {
    clientFn?.(client);
}

client.login(config.token);
console.log(`[index] Finished loading. Loaded bots: ${getBots}`);

// ---------- helper functions for main index file ----------
function getBots(): string {
    return JSON.stringify(loadedBots, null, 4);
}

function loadedMessage(): void {
    if (config.loadedMessageId === null) {
        return;
    }

    (client.channels.cache.get(config.loadedMessageId) as TextChannel)?.send(`Finished starting, loaded:\n\`\`\`JSON\n${getBots()}\`\`\``);
}

async function unregisterAll(message: Message): Promise<void> {
    if (config.unregisterAllId === null || message.author.id !== config.unregisterAllId) {
        return;
    }

    try {
        console.log('[index] Attempting to unregister all guild slash commands');
        await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: [] });
        console.log('[index] Successfully unregistered all guild slash commands');
        message.reply('Success');
    } catch (error) {
        console.error(`[index] Failed to unregister all guild slash commands: ${error}`);
        message.reply('Failed');
    }
}
