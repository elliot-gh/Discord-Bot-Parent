import { Client, ContextMenuCommandBuilder, GatewayIntentBits, SlashCommandBuilder } from "discord.js";
import { Logger } from "winston";
import { getPath, readYamlConfig } from "../utils/ConfigUtils.js";
import { createLogger } from "../utils/Logger.js";
import { EventHandlerDict, IBot, } from "./IBot.js";

/**
 * Base class for a bot that uses a config file.
 * See PingBot for an example.
 */
export abstract class BaseBotWithConfig implements IBot {
    // ----- implement the below -----
    abstract getIntents(): GatewayIntentBits[];
    abstract getSlashCommands(): (SlashCommandBuilder | ContextMenuCommandBuilder)[];
    abstract getEventHandlers(): EventHandlerDict;
    preInit?(): Promise<string | null>;
    postInit?(): Promise<void>;
    useClient?(client: Client): Promise<void>;
    // ----- implement the above -----

    protected readonly botName: string;
    protected readonly logger: Logger;
    private readonly implementedImportMeta: ImportMeta;

    /**
     * Base constructor that should be called by any class that extends this.
     * Inits the logger (and may do more in the future).
     * @param botName The name of this bot.
     * @param importMeta The import.meta of the class that extends this.
     */
    constructor(botName: string, importMeta: ImportMeta) {
        this.botName = botName;
        this.logger = createLogger(this.botName);
        this.implementedImportMeta = importMeta;
    }

    /**
     * Attempts to read the YAML config file for this bot with the specified file name. Throws an error if it is unable to do so.
     * @param path The YAML file path.
     * @returns The config object with the type passed in.
     */
    protected readYamlConfig<ConfigType>(path: string): ConfigType {
        return readYamlConfig(this.implementedImportMeta, path, this.logger);
    }

    /**
     * Does file URL/path stuff to get the path string of a dir/file.
     * @param path If string, the file path to get the path of. If null, this will just get this module's dir.
     * @returns The full path.
     */
    protected getPath(path: string | null,): string {
        return getPath(this.implementedImportMeta, path);
    }
}
