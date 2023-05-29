import Agenda, { Job } from "agenda";
import { ActionRowBuilder, BaseMessageOptions, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction,
    Client, ColorResolvable, EmbedBuilder, MessageEditOptions } from "discord.js";
import { ObjectId } from "mongodb";
import { ReminderJobData } from "./ReminderJobData";
import { BotWithConfig } from "../BotWithConfig";

/**
 * Abstract class for reminder bots, which is used in a few of my own bots.
 * @template ReminderDataType Type of reminder data stored in the job. @see {@link ReminderJobData}
 */
export abstract class AbstractReminderBot<ReminderDataType> extends BotWithConfig {
    /**
     * Prefix for the delete cancel button custom ID.
     */
    protected abstract readonly BTN_REM_DEL_CANCEL_PREFIX: string;

    /**
     * Prefix for the delete confirm button custom ID.
     */
    protected abstract readonly BTN_REM_DEL_CONFIRM_PREFIX: string;

    /**
     * Prefix for the delete prompt button custom ID.
     */
    protected abstract readonly BTN_REM_DEL_PROMPT_PREFIX: string;

    /**
     * Prefix for the reminder button next custom ID.
     */
    protected abstract readonly BTN_REM_NEXT: string;

    /**
     * Prefix for the reminder button previous custom ID.
     */
    protected abstract readonly BTN_REM_PREV: string;

    /**
     * String shown to user representing what kind of reminder this is.
     */
    protected abstract readonly REMINDER_TYPE: string;

    /**
     * String shown to user in reminder title navigation.
     */
    protected abstract readonly REMINDER_TYPE_TITLE: string;

    /**
     * String shown to user in reminder triggered embed.
     */
    protected abstract readonly REMINDER_TRIGGERED_TITLE: string;

    /**
     * discord.js client
     */
    protected abstract client: Client | null;

    /**
     * agenda instance
     */
    protected abstract agenda: Agenda | null;

    /**
     * Should handle button click interactions.
     * This is not implemented as some bots extending this class may have extra buttons.
     * @param interaction The discord.js button interaction.
    */
    // eslint-disable-next-line no-unused-vars
    protected abstract handleButtonClick(interaction: ButtonInteraction): Promise<void>;

    /**
     * Triggered by agenda when a reminder job is run.
     * @param job THe agenda job data.
     */
    // eslint-disable-next-line no-unused-vars
    protected abstract handleReminderJob(job: Job): Promise<void>;

    /**
     * Builds a discord.js embed for a reminder. This can be ussd in a job trigger or list.
     * @param title The title for the embed (needed for pagination in list).
     * @param data The data for the reminder.
     * @param color The color for the embed.
     * @returns The embed.
     */
    // eslint-disable-next-line no-unused-vars
    protected abstract buildReminderEmbed(title: string, data: ReminderJobData<ReminderDataType>, color: ColorResolvable): Promise<EmbedBuilder>;

    /**
     * Handles a command for when a user wants to list their reminders and replies as appropriate.
     * @param interaction The discord.js slash command interaction.
     */
    protected async handleSlashList(interaction: ChatInputCommandInteraction): Promise<void> {
        this.logger.info(`handleSlashList() from: ${interaction.user.id}`);
        const message = await this.buildReminderList(interaction.user.id, interaction.guildId, 0);
        await interaction.reply({
            ...message,
            ephemeral: true
        });
    }

    /**
     * Builds a message with a reminder list
     * @param userId The command user ID.
     * @param guildId The guild ID string if this was invoked in a guild. null if in DMs
     * @param newPos The reminder index to move to.
     * @returns A discord.js message to be replied with.
     */
    protected async buildReminderList(userId: string, guildId: string | null, newPos: number): Promise<BaseMessageOptions> {
        if (this.agenda === null) {
            throw Error("agenda is null");
        }

        if (guildId === null) {
            guildId = "@me";
        }

        const jobs = await this.agenda.jobs(
            { "data.userId": userId, "data.guildId": guildId },
            { nextRunAt: 1 } // sort
        );

        const count = jobs.length;
        if (count === 0) {
            const embed = this.buildErrorEmbed("Error Getting Reminder List", `You have no ${this.REMINDER_TYPE}s set.`);
            return { embeds: [embed], components: []};
        }

        if (newPos < 0) {
            newPos = count - 1;
        } else if (newPos >= count) {
            newPos = 0;
        }

        const currentJob = jobs[newPos];

        if (currentJob.attrs.nextRunAt == null) {
            throw Error("Got null or undefined date");
        }

        const embed = await this.buildReminderEmbed(
            this.serializeListString(newPos, count),
            currentJob.attrs.data as ReminderJobData<ReminderDataType>,
            0x8D8F91);
        const rowNextPrev = this.buildBackNextRow();
        const btnDelPrompt = this.buildButtonDeletePrompt(currentJob.attrs._id.toHexString());
        const rowDel = new ActionRowBuilder().addComponents(btnDelPrompt) as ActionRowBuilder<ButtonBuilder>;
        return {
            embeds: [embed],
            components: [rowNextPrev, rowDel]
        };
    }

    /**
     * Handles a delete button click. This will create a confirm/cancel prompt.
     * @param interaction The discord.js button interaction.
     * @returns A discord.js message to be used in an edit.
     */
    protected async handleDeletePrompt(interaction: ButtonInteraction): Promise<MessageEditOptions> {
        this.logger.info(`handleDeletePrompt() with customId: ${interaction.customId}`);
        const objId = this.deserializeObjectId(interaction.customId).toHexString();

        const btnDelPrompt = this.buildButtonDeletePrompt(objId).setDisabled(true);
        const btnConfirm = this.buildButtonDeleteConfirm(objId);
        const btnCancel = this.buildButtonDeleteCancel(objId);
        const rowNextPrev = this.buildBackNextRow();
        const rowDel = new ActionRowBuilder().addComponents(btnDelPrompt, btnConfirm, btnCancel) as ActionRowBuilder<ButtonBuilder>;
        return {
            components: [rowNextPrev, rowDel]
        };
    }

    /**
     * Handles a delete confirm button click. Deletes the agenda job.
     * @param interaction The discord.js button interaction.
     * @param currentPos The current reminder index.
     */
    protected async handleDeleteConfirm(interaction: ButtonInteraction, currentPos: number): Promise<void> {
        this.logger.info(`handleDeleteConfirm() with customId: ${interaction.customId}`);
        try {
            const objId = this.deserializeObjectId(interaction.customId);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const amountCanceled = await this.agenda!.cancel({ _id: objId });
            if (amountCanceled === 0) {
                throw new Error("No jobs were deleted");
            }

            const embed = new EmbedBuilder()
                .setTitle(`Deleted ${this.REMINDER_TYPE}`)
                .setColor(0x00FF00);
            const updateList = await this.buildReminderList(interaction.user.id, interaction.guildId, currentPos - 1);
            await interaction.update(updateList);
            await interaction.followUp({ embeds: [embed], ephemeral: true });
        } catch (error) {
            if (error instanceof Error) {
                const errStr = `Error deleting reminder: ${error}`;
                this.logger.error(errStr);
                const errorEmbed = this.buildErrorEmbed(`Failed to delete ${this.REMINDER_TYPE}`, error.message);
                await interaction.update({ components: [] });
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                const errStr = `Unknown error while deleting reminder: ${error}`;
                this.logger.error(errStr);
                throw new Error(errStr);
            }
        }
    }

    /**
     * Handles a delete cancel button click.
     * @param interaction The discord.js button interaction.
     * @returns A discord.js message to be used in an edit.
     */
    protected async handleDeleteCancel(interaction: ButtonInteraction): Promise<MessageEditOptions> {
        this.logger.info(`handleDeleteCancel() with customId: ${interaction.customId}`);
        const objId = this.deserializeObjectId(interaction.customId).toHexString();

        const btnDelPrompt = this.buildButtonDeletePrompt(objId);
        const rowNextPrev = this.buildBackNextRow();
        const rowDel = new ActionRowBuilder().addComponents(btnDelPrompt) as ActionRowBuilder<ButtonBuilder>;
        return {
            components: [rowNextPrev, rowDel]
        };
    }

    /**
     * Creates a reminder with agenda and schedules it.
     * @param jobData The reminder data (for the bot, not agenda).
     * @param when When the reminder will trigger.
     * @param jobName The name of the job.
     * @returns A discord.js embed to be used in a message.
     */
    protected async createReminder(jobData: ReminderJobData<ReminderDataType>, jobName: string): Promise<EmbedBuilder> {
        this.logger.info(`createReminder() with data at ${jobData.reminderTime} with JSON:\n${JSON.stringify(jobData)}`);
        let newReminder;
        let date;
        try {
            if (this.agenda == null) {
                throw Error("agenda is null");
            }

            newReminder = this.agenda.create(jobName, jobData);
            newReminder.schedule(jobData.reminderTime);
            date = newReminder.attrs.nextRunAt;
            this.logger.info(`agenda has determined nextRunAt ${date}`);
            if (date == null) {
                throw Error("Got null or undefined date");
            }
        } catch (error) {
            if (error instanceof Error) {
                this.logger.error(`Error creating reminder: ${error}`);
                const errorEmbed = this.buildErrorEmbed("Failed to create reminder", error.message);
                return errorEmbed;
            }

            this.logger.error(`Error creating reminder: ${error}`);
            const errorEmbed = this.buildErrorEmbed("Failed to create reminder", "Unknown error");
            return errorEmbed;
        }

        try {
            await newReminder.save();
            const embed = await this.buildReminderEmbed("Created new reminder", jobData, 0x00FF00);
            return embed;
        } catch (error) {
            if (error instanceof Error) {
                this.logger.error(`Error saving reminder: ${error}`);
                const errorEmbed = this.buildErrorEmbed("Failed to save reminder", error.message);
                return errorEmbed;
            }

            this.logger.error(`Error saving reminder: ${error}`);
            const errorEmbed = this.buildErrorEmbed("Failed to save reminder", "Unknown error");
            return errorEmbed;
        }
    }

    /**
     * Creates a delete cancel button.
     * @param agendaObjectId The agenda job ID.
     * @returns A discord.js button.
     */
    protected buildButtonDeleteCancel(agendaObjectId: string): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(`${this.BTN_REM_DEL_CANCEL_PREFIX}${agendaObjectId}`)
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary);
    }

    /**
     * Creates a delete prompt button.
     * @param agendaObjectId The agenda job ID.
     * @returns A discord.js button.
     */
    protected buildButtonDeletePrompt(agendaObjectId: string): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(`${this.BTN_REM_DEL_PROMPT_PREFIX}${agendaObjectId}`)
            .setLabel("Delete")
            .setStyle(ButtonStyle.Danger);
    }

    /**
     * Creates a delete confirm button.
     * @param agendaObjectId The agenda job ID.
     * @returns A discord.js button.
     */
    protected buildButtonDeleteConfirm(agendaObjectId: string): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(`${this.BTN_REM_DEL_CONFIRM_PREFIX}${agendaObjectId}`)
            .setLabel("Confirm")
            .setStyle(ButtonStyle.Danger);
    }

    /**
     * Creates a reminder list navigation row.
     * @returns A discord.js row with buttons.
     */
    protected buildBackNextRow(): ActionRowBuilder<ButtonBuilder> {
        const btnPrev = new ButtonBuilder()
            .setCustomId(this.BTN_REM_PREV)
            .setLabel("Previous")
            .setStyle(ButtonStyle.Primary);
        const btnNext = new ButtonBuilder()
            .setCustomId(this.BTN_REM_NEXT)
            .setLabel("Next")
            .setStyle(ButtonStyle.Primary);
        const rowNextPrev = new ActionRowBuilder().addComponents(btnPrev, btnNext) as ActionRowBuilder<ButtonBuilder>;
        return rowNextPrev;
    }

    /**
     * Attempts to deserialize an agenda job ID from a discord.js custom ID on a button.
     * @param buttonId discord.js button custom ID
     * @returns ObjectId object representing the agenda job ID.
     */
    protected deserializeObjectId(buttonId: string): ObjectId {
        let id;
        if (buttonId.startsWith(this.BTN_REM_DEL_PROMPT_PREFIX)) {
            id = buttonId.substring(this.BTN_REM_DEL_PROMPT_PREFIX.length);
        } else if (buttonId.startsWith(this.BTN_REM_DEL_CONFIRM_PREFIX)) {
            id = buttonId.substring(this.BTN_REM_DEL_CONFIRM_PREFIX.length);
        } else if (buttonId.startsWith(this.BTN_REM_DEL_CANCEL_PREFIX)) {
            id = buttonId.substring(this.BTN_REM_DEL_CANCEL_PREFIX.length);
        } else {
            throw new Error(`Got unknown buttonId in deserializeObjectId(): ${buttonId}`);
        }

        const objectId = new ObjectId(id);
        return objectId;
    }

    /**
     * Serializes list index/total into a string to be used in an reminder list embed title.
     * @param current The current index.
     * @param total The total number of reminders.
     * @returns A string to be used in an embed title.
     */
    protected serializeListString(current: number, total: number): string {
        return `${this.REMINDER_TYPE_TITLE} ${current + 1} of ${total}`;
    }

    /**
     * Deserializes list index from a reminder list embed title.
     * @param str The embed title string.
     * @returns The current index (zero indexed).
     */
    protected deserializeListString(str: string): number {
        const currentPageStr = str.substring(`${this.REMINDER_TYPE_TITLE} `.length, str.indexOf(" of "));
        return parseInt(currentPageStr) - 1;
    }

    /**
     * Builds an error discord.js embed.
     * @param title Error title.
     * @param reason Error reason, set as the embed description.
     * @returns A discord.js embed.
     */
    protected buildErrorEmbed(title: string, reason: string): EmbedBuilder {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(reason)
            .setColor(0xFF0000);
        return embed;
    }
}