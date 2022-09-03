import { CommandInteraction, GatewayIntentBits, SlashCommandBuilder } from "discord.js";
import { BotInterface } from "../../BotInterface";
import { readYamlConfig } from "../../ConfigUtils";

type PingConfig = {
    pongMsg: string
};

/**
 * This bot replies to /ping with a message.
 */
export class PingBot implements BotInterface {
    public readonly intents: GatewayIntentBits[];
    public readonly commands: [SlashCommandBuilder];
    private readonly slashPing: SlashCommandBuilder;
    private replyMsg: string;

    constructor() {
        this.intents = [GatewayIntentBits.Guilds];
        this.slashPing = new SlashCommandBuilder()
            .setName("ping")
            .setDescription("Replies with a message. Simple command to test bot.");
        this.commands = [this.slashPing];
        this.replyMsg = "pong";
    }

    async processCommand(interaction: CommandInteraction): Promise<void> {
        if (!interaction.isChatInputCommand()) {
            return;
        }

        console.log(`[PingBot] got interaction: ${interaction}`);
        try {
            if (interaction.commandName === this.slashPing.name) {
                await interaction.reply(this.replyMsg);
            }
        } catch (error) {
            console.error(`[PingBot] Uncaught exception in processSlashCommand(): ${error}`);
        }
    }

    async init(): Promise<string | null> {
        let config: PingConfig;
        try {
            config = await readYamlConfig<PingConfig>(import.meta, "config.yaml");
        } catch (error) {
            const errMsg = `[PingBot] Unable to read config: ${error}`;
            console.error(errMsg);
            return errMsg;
        }

        this.replyMsg = config.pongMsg;
        return null;
    }
}

