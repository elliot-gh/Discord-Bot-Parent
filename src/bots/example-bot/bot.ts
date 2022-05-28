import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CacheType, Intents, Interaction } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { BotInterface } from '../../BotInterface';
import { readConfig } from '../../utils/ConfigUtils';

type PingConfig = {
    pongMsg: string
};

class PingBot implements BotInterface {
    intents: number[];
    slashCommands: [SlashCommandBuilder];
    slashPing: SlashCommandBuilder;
    replyMsg: string;

    constructor() {
        this.intents = [Intents.FLAGS.GUILDS];
        this.slashPing = new SlashCommandBuilder()
            .setName('ping')
            .setDescription('Replies with a message. Simple command to test bot.');
        this.slashCommands = [this.slashPing];
        this.replyMsg = 'pong';
    }

    async execute(interaction: Interaction<CacheType>): Promise<void> {
        if (!interaction.isCommand()) {
            return;
        }

        console.log(`[PingBot]: got interaction: ${interaction}`);
        if (interaction.commandName === this.slashPing.name) {
            await interaction.reply(this.replyMsg);
        }
    }

    async init(): Promise<string | null> {
        const configPath = join(dirname(fileURLToPath(import.meta.url)), 'config.yaml');
        let config: PingConfig;
        try {
            config = await readConfig<PingConfig>(configPath);
        } catch (error) {
            const errMsg = `[PingBot] Unable to read config: ${error}`;
            console.error(errMsg);
            return errMsg;
        }

        this.replyMsg = config.pongMsg;
        return null;
    }
}

export default new PingBot();
