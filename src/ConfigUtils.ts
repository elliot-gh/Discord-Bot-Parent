import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

/**
 * Does file URL/path stuff to get the path string of a dir/file.
 * @param importUrl `import.meta`
 * @param fileName If string, the file name to get the path of. If null, this will just get a dir.
 * @returns The full path.
 */
export function getPath(importMeta: ImportMeta, fileName: string | null): string {
    const importUrl = importMeta.url;
    if (fileName === null) {
        return join(dirname(fileURLToPath(importUrl)));
    }

    return join(dirname(fileURLToPath(importUrl)), fileName);
}

/**
 * Attempts to read the YAML config file for this bot with the specified file name. Throws an error if it is unable to do so.
 * @param importMeta `import.meta`
 * @param path The YAML config file path.
 * @returns The config object with the type passed in.
 */
export async function readYamlConfig<ConfigType>(importMeta: ImportMeta, fileName: string): Promise<ConfigType> {
    const path = getPath(importMeta, fileName);

    if (!existsSync(path)) {
        const errMsg = `Configuration was not found: ${path}`;
        console.error(errMsg);
        throw new Error(errMsg);
    }

    let configFileText: string;
    let config: ConfigType;
    try {
        configFileText = readFileSync(path, "utf-8");
        config = YAML.parse(configFileText);
    } catch (error) {
        const errMsg = `Error during configuration loading: ${path}`;
        console.error(errMsg);
        throw new Error(errMsg);
    }

    return config;
}
