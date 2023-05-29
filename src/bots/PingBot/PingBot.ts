import { CommandInteraction, ContextMenuCommandBuilder, GatewayIntentBits, SlashCommandBuilder } from "discord.js";
import { BotWithConfig } from "../../BotWithConfig";

type PingConfig = {
    pongMsg: string
};

/**
 * This bot replies to /ping with a message.
 */
export class PingBot extends BotWithConfig {
    public readonly intents: GatewayIntentBits[];
    public readonly commands: [SlashCommandBuilder];
    private readonly slashPing: SlashCommandBuilder;
    private replyMsg: string;

    constructor() {
        super("PingBot", import.meta);
        this.intents = [GatewayIntentBits.Guilds];
        this.slashPing = new SlashCommandBuilder()
            .setName("ping")
            .setDescription("Replies with a message. Simple command to test the bot.")
            .setDMPermission(true);
        this.commands = [this.slashPing];
        this.replyMsg = "pong";
    }

    async processCommand(interaction: CommandInteraction): Promise<void> {
        if (!interaction.isChatInputCommand()) {
            return;
        }

        this.logger.info(`[PingBot] got interaction: ${interaction}`);
        try {
            if (interaction.commandName === this.slashPing.name) {
                await interaction.reply(this.replyMsg);
            }
        } catch (error) {
            this.logger.error(`[PingBot] Uncaught exception in processSlashCommand(): ${error}`);
        }
    }

    async preInit(): Promise<string | null> {
        let config: PingConfig;
        try {
            config = this.readYamlConfig<PingConfig>("config.yaml");
        } catch (error) {
            const errMsg = `[PingBot] Unable to read config: ${error}`;
            this.logger.error(errMsg);
            return errMsg;
        }

        this.replyMsg = config.pongMsg;
        return null;
    }

    getIntents(): GatewayIntentBits[] {
        return this.intents;
    }

    getSlashCommands(): (SlashCommandBuilder | ContextMenuCommandBuilder)[] {
        return this.commands;
    }
}

