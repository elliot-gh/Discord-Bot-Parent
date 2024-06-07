import { GatewayIntentBits, Interaction, Message, SlashCommandBuilder } from "discord.js";
import { EventHandlerDict } from "../../../interfaces/IBot.js";
import { BaseBotWithConfig } from "../../../interfaces/BaseBotWithConfig.js";
import { ShouldIgnoreEvent } from "../../../utils/DiscordUtils.js";

type PingConfig = {
    pongMsg: string,
    enableMessageCommand: boolean
};

/**
 * This bot replies to /ping with a message.
 * If enabled, this bot will also reply to !ping messages.
 */
export class PingBot extends BaseBotWithConfig {
    private readonly intents: GatewayIntentBits[];
    private readonly commands: SlashCommandBuilder[];
    private readonly slashPing: SlashCommandBuilder;
    private readonly config: PingConfig;
    private readonly replyMsg: string;

    constructor() {
        super("PingBot", import.meta);
        this.intents = [GatewayIntentBits.Guilds];
        this.slashPing = new SlashCommandBuilder()
            .setName("ping")
            .setDescription("Replies with a message. Simple command to test the bot.")
            .setDMPermission(true);
        this.commands = [this.slashPing];
        this.config = this.readYamlConfig<PingConfig>("config.yaml");
        this.replyMsg = this.config.pongMsg;
    }

    getEventHandlers(): EventHandlerDict {
        const eventHandlers: EventHandlerDict = {
            interactionCreate: this.processCommand.bind(this)
            // interactionCreate: async (interaction: Interaction) => await this.processCommand(interaction)
        };

        if (this.config.enableMessageCommand) {
            eventHandlers.messageCreate = this.processMessage.bind(this);
        }

        return eventHandlers;
    }

    async processCommand(interaction: Interaction): Promise<void> {
        if (!interaction.isChatInputCommand()
            || ShouldIgnoreEvent(interaction)
            || interaction.commandName !== this.slashPing.name) {
            return;
        }

        this.logger.info(`Got chat interaction: ${interaction}`);
        try {
            await interaction.reply(this.replyMsg);
        } catch (error) {
            this.logger.error(`Uncaught exception in processSlashCommand(): ${error}`);
        }
    }

    async processMessage(message: Message): Promise<void> {
        if (ShouldIgnoreEvent(message) || message.content !== "!ping") {
            return;
        }

        this.logger.info(`Got message: ${message}`);
        try {
            await message.reply(this.replyMsg);
        } catch (error) {
            this.logger.error(`Exception in processMessage(): ${error}`);
        }
    }

    getIntents(): GatewayIntentBits[] {
        return this.intents;
    }

    getSlashCommands(): SlashCommandBuilder[] {
        return this.commands;
    }
}

