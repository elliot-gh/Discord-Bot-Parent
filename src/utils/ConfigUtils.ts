import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Logger } from "winston";
import YAML from "yaml";

/**
 * You probably want BotWithConfig instead of this, which has config methods you can call.
 * Does file URL/path stuff to get the path string of a dir/file.
 * @param importUrl `import.meta`
 * @param path If string, the file path to get the path of. If null, this will just get this module's dir.
 * @returns The full path.
 */
export function getPath(importMeta: ImportMeta, path: string | null): string {
    const importUrl = importMeta.url;
    if (path === null) {
        return join(dirname(fileURLToPath(importUrl)));
    }

    return join(dirname(fileURLToPath(importUrl)), path);
}

/**
 * You probably want BotWithConfig instead of this, which has config methods you can call.
 * Attempts to read the YAML config file for this bot with the specified file name. Throws an error if it is unable to do so.
 * @param importMeta `import.meta`
 * @param path The YAML config file path.
 * @param logger The winston Logger to use.
 * @returns The config object with the type passed in.
 */
export function readYamlConfig<ConfigType>(importMeta: ImportMeta, path: string, logger: Logger): ConfigType {
    const fullPath = getPath(importMeta, path);

    if (!existsSync(fullPath)) {
        const errMsg = `Configuration was not found: ${fullPath}`;
        logger.error(errMsg);
        throw new Error(errMsg);
    }

    let configFileText: string;
    let config: ConfigType;
    try {
        configFileText = readFileSync(fullPath, "utf-8");
        config = YAML.parse(configFileText);
    } catch (error) {
        const errMsg = `Error during configuration loading: ${fullPath}`;
        logger.error(errMsg);
        throw new Error(errMsg);
    }

    return config;
}
