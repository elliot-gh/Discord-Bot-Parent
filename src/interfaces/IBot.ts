import { Client, ClientEvents, ContextMenuCommandBuilder, GatewayIntentBits, SlashCommandBuilder } from "discord.js";

/**
 * Event handler for a specific event.
 */
// export type IEventHandler<Event extends keyof ClientEvents> = {
//     event: Event;
//     execute(...args: ClientEvents[Event]): Promise<void>;
// }

/**
 * Object where an event name is the key and the value is the event handler function.
 * For example:
 * ```
 * {
 *     interactionCreate: this.processCommand,
 *     messageCreate: this.processMessage
 * }
 * ```
 */
export type EventHandlerDict = {
    [Event in keyof ClientEvents]?: (...args: ClientEvents[Event]) => Promise<void>
};

/**
 * The exported bot instance in `bots/[bot name]/bot.ts` should implement this interface.
 * All bots are expected to be a singleton and instantiated once.
 */
export interface IBot {
    /**
     * Array of Discord intents for this bot. Try `GatewayIntentBits.` from discord.js.
     * Guaranteed to be called after preInit().
     * @see {@link https://discord.com/developers/docs/topics/gateway#list-of-intents}
     * @returns Array of Discord intents for this bot.
     */
    getIntents(): GatewayIntentBits[];

    /**
     * Array of all commands your bot supports (ie slash or context menu commands).
     * Guaranteed to be called after preInit().
     * @see {@link https://discordjs.guide/popular-topics/builders.html#slash-command-builders}
     * @returns Array of all commands your bot supports (slash or context menu commands).
     */
    getSlashCommands(): (SlashCommandBuilder | ContextMenuCommandBuilder)[];

    /**
     * Event handlers for this bot.
     * Guaranteed to be called after preInit().
     * @see {@link EventHandlerDict}
     * @returns Dictionary of event names mapped to their event handler functions.
     */
    getEventHandlers(): EventHandlerDict;

    /**
     * Optional function to be called to init this bot module BEFORE discord.js is ready.
     * @returns string with a message if init failed and this bot should NOT be loaded,
     *          or null if init is successful and this bot SHOULD be loaded.
     */
    preInit?(): Promise<string | null>;

    /**
    * Optional function to be called to init this bot module AFTER discord.js is ready, after preInit(), but before useClient().
    * @returns Unlike preInit(), nothing. Throw an Error if needed.
    */
    postInit?(): Promise<void>;

    /**
     * Optional function to be called if this bot module needs the discord.js Client directly, after useClient().
     * This will only be called once the Client is logged in and ready.
     * Should probably be avoided unless there is a good reason to do so.
     * @param client The discord.js Client.
     * @returns Promise that resolves when the bot is done using the Client.
     */
    useClient?(client: Client): Promise<void>;
}
