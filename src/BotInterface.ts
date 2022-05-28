import { Client, Interaction } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';

/**
 * The exported bot singleton in `bots/[bot name]/bot.ts` should implement this interface.
 */
export interface BotInterface {
    /**
    * Array of Discord intents for this bot. Try `Intents.FLAGS.` from discord.js.
    * For list of intents @see {@link https://discord.com/developers/docs/topics/gateway#list-of-intents}
    */
    intents: number[],

    /**
     * Array of all slash commands your bot supports.
     * For more info @see {@link https://discordjs.guide/popular-topics/builders.html#slash-command-builders}
     */
    slashCommands: [SlashCommandBuilder],

    /**
     * The method to be called when an interaction arrives.
     * @param interaction: discord.js interaction
     */
    execute(interaction: Interaction): Promise<void>,

    /**
     * Optional function to be called if this bot module needs the discord.js Client directly,
     * for example wanting to listen to events such as reactions or message deletions.
     * @param client The discord.js Client.
     */
    handleClient?(client: Client): void,

    /**
     * Optional function to be called to init this bot module BEFORE discord.js is ready.
     * @returns string with a message if init failed and this bot should NOT be loaded,
     *          or null if init is successful and this bot SHOULD be loaded.
     */
    init?(): Promise<string | null>
}
