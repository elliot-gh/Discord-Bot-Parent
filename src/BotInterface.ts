/* eslint-disable no-unused-vars */
import { Client, CommandInteraction, ContextMenuCommandBuilder, GatewayIntentBits, SlashCommandBuilder } from "discord.js";

/**
 * The exported bot singleton in `bots/[bot name]/bot.ts` should implement this interface.
 */
export interface BotInterface {
    /**
     * Array of Discord intents for this bot. Try `Intents.FLAGS.` from discord.js.
     * Guaranteed to be called after preInit().
     * For list of intents @see {@link https://discord.com/developers/docs/topics/gateway#list-of-intents}
     * @returns Array of Discord intents for this bot.
     */
    getIntents(): GatewayIntentBits[],

    /**
     * Array of all commands your bot supports (ie slash or context menu commands).
     * Guaranteed to be called after preInit().
     * For more info @see {@link https://discordjs.guide/popular-topics/builders.html#slash-command-builders}
     * @returns Array of all commands your bot supports (slash or context menu commands).
     */
    getSlashCommands(): (SlashCommandBuilder | ContextMenuCommandBuilder)[],

    /**
     * The method to be called when an interaction arrives.
     * @param interaction: discord.js interaction
     * @returns Promise that resolves when the command is done processing.
     */
    processCommand(interaction: CommandInteraction): Promise<void>,

    /**
     * Optional function to be called if this bot module needs the discord.js Client directly -
     * for example, wanting to listen to events such as reactions or message deletions.
     * This will only be called once the Client is logged in and ready.
     * @param client The discord.js Client.
     * @returns Promise that resolves when the bot is done using the Client.
     */
    useClient?(client: Client): Promise<void>,

    /**
     * Optional function to be called to init this bot module BEFORE discord.js is ready.
     * @returns string with a message if init failed and this bot should NOT be loaded,
     *          or null if init is successful and this bot SHOULD be loaded.
     */
    preInit?(): Promise<string | null>,

    /**
     * Optional function to be called to init this bot module AFTER discord.js is ready, after useClient().
     * @returns Currently, nothing as it is not possible to unload a bot. Instead throw an Error.
     */
    postInit?(): Promise<void>
}
