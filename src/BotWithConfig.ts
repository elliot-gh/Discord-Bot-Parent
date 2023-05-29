/* eslint-disable no-unused-vars */
import { Client, CommandInteraction, ContextMenuCommandBuilder, GatewayIntentBits, SlashCommandBuilder } from "discord.js";
import { Logger } from "winston";
import { BotInterface } from "./BotInterface";
import { createLogger } from "./utils/Logger";
import { getPath, readYamlConfig } from "./utils/ConfigUtils";

export abstract class BotWithConfig implements BotInterface {
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
     * @param fileName The YAML file name.
     * @returns The config object with the type passed in.
     */
    protected readYamlConfig<ConfigType>(fileName: string): ConfigType {
        return readYamlConfig(this.implementedImportMeta, fileName, this.logger);
    }

    /**
     * Does file URL/path stuff to get the path string of a dir/file.
     * @param fileName If string, the file name to get the path of. If null, this will just get a dir.
     * @returns The full path.
     */
    protected getPath(fileName: string | null): string {
        return getPath(this.implementedImportMeta, fileName);
    }

    // jsdoc comments inherited from interface
    abstract getIntents(): GatewayIntentBits[];
    abstract getSlashCommands(): (SlashCommandBuilder | ContextMenuCommandBuilder)[];
    abstract processCommand(interaction: CommandInteraction): Promise<void>;
    useClient?(client: Client): Promise<void>;
    preInit?(): Promise<string | null>;
    postInit?(): Promise<void>;
}