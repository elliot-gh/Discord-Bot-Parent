import { CommandInteraction, Intents } from "discord.js";
import { SlashCommandBuilder } from "@discordjs/builders";
import { BotInterface } from "../../BotInterface";
import { getPath, readYamlConfig } from "../../ConfigUtils";

type PingConfig = {
    pongMsg: string
};

/**
 * This bot replies to /ping with a message.
 */
export class PingBot implements BotInterface {
    public readonly intents: number[];
    public readonly slashCommands: [SlashCommandBuilder];
    private readonly slashPing: SlashCommandBuilder;
    private replyMsg: string;

    constructor() {
        this.intents = [Intents.FLAGS.GUILDS];
        this.slashPing = new SlashCommandBuilder()
            .setName("ping")
            .setDescription("Replies with a message. Simple command to test bot.");
        this.slashCommands = [this.slashPing];
        this.replyMsg = "pong";
    }

    async processSlashCommand(interaction: CommandInteraction): Promise<void> {
        console.log(`[PingBot]: got interaction: ${interaction}`);
        try {
            if (interaction.commandName === this.slashPing.name) {
                await interaction.reply(this.replyMsg);
            }
        } catch (error) {
            console.error(`[PingBot] Uncaught exception in processSlashCommand(): ${error}`);
        }
    }

    async init(): Promise<string | null> {
        const configPath = getPath(import.meta.url, "config.yaml");
        let config: PingConfig;
        try {
            config = await readYamlConfig<PingConfig>(configPath);
        } catch (error) {
            const errMsg = `[PingBot] Unable to read config: ${error}`;
            console.error(errMsg);
            return errMsg;
        }

        this.replyMsg = config.pongMsg;
        return null;
    }
}

