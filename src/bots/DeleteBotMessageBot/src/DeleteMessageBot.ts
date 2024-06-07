import { ApplicationCommandType, CommandInteraction, ContextMenuCommandBuilder, EmbedBuilder, GatewayIntentBits, Interaction } from "discord.js";
import { Logger } from "winston";
import { EventHandlerDict, IBot } from "../../../interfaces/IBot.js";
import { ShouldIgnoreEvent } from "../../../utils/DiscordUtils.js";
import { createLogger } from "../../../utils/Logger.js";

/**
 * This bot enables a content menu command to delete this bot's own message.
 */
export class DeleteMessageBot implements IBot {
    private readonly intents: GatewayIntentBits[];
    private readonly commands: ContextMenuCommandBuilder[];
    private readonly logger: Logger;
    private readonly contextDelete: ContextMenuCommandBuilder;

    constructor() {
        this.logger = createLogger("DeleteMessageBot");
        this.intents = [GatewayIntentBits.Guilds];
        this.contextDelete = new ContextMenuCommandBuilder()
            .setName("Delete Bot Message")
            .setDMPermission(false)
            .setType(ApplicationCommandType.Message) as ContextMenuCommandBuilder;
        this.commands = [this.contextDelete];
    }

    getEventHandlers(): EventHandlerDict {
        return {
            interactionCreate: this.processInteraction.bind(this)
        };
    }

    async processInteraction(interaction: Interaction): Promise<void> {
        if (ShouldIgnoreEvent(interaction)
            || !interaction.isMessageContextMenuCommand()
            || interaction.commandName !== this.contextDelete.name) {
            return;
        }

        this.logger.info(`Got context menu interaction: ${interaction}`);

        if (interaction.targetMessage.author.id !== interaction.client.user.id) {
            this.logger.info(`Ignoring context menu interaction: ${interaction} because it is not from this bot.`);
            await this.sendErrorMessage(interaction, `This command only allows for deleting messages sent from this bot (${interaction.client.user.toString()}).`);
            return;
        }

        try {
            await interaction.targetMessage.delete();
        } catch (error) {
            this.logger.error(`Failed to delete message: ${error}`);
            await this.sendErrorMessage(interaction, error);
            return;
        }

        await interaction.reply({ embeds: [
            new EmbedBuilder()
                .setTitle("Message Deleted")
                .setDescription("The bot message was successfully deleted.")
                .setColor(0x00FF00)
        ], ephemeral: true});
    }

    private async sendErrorMessage(interaction: CommandInteraction, error: unknown = null): Promise<void> {
        let description = "An unknown error occurred.";
        if (error instanceof Error) {
            description = error.message;
        } else if (typeof error === "string") {
            description = error;
        }

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Error Deleting Message")
                    .setDescription(description)
                    .setColor(0xFF0000)
            ],
            ephemeral: true
        });
    }

    getIntents(): GatewayIntentBits[] {
        return this.intents;
    }

    getSlashCommands(): ContextMenuCommandBuilder[] {
        return this.commands;
    }
}

