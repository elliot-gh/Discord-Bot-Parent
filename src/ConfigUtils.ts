import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

/**
 * Does file URL/path stuff to get the path string of a dir/file.
 * @param importUrl The `import.meta.url` of the module.
 * @param fileName If string, the file name to get the path of. If null, this will just get a dir.
 * @returns The full path.
 */
export function getPath(importUrl: ImportMeta["url"], fileName: string | null): string {
    if (fileName === null) {
        return join(dirname(fileURLToPath(importUrl)));
    }

    return join(dirname(fileURLToPath(importUrl)), fileName);
}

/**
 * Attempts to read the YAML config file at the path. Throws an error if it is unable to do so.
 * @param path The YAML config file path.
 * @returns The config object with the type passed in.
 */
export async function readYamlConfig<ConfigType>(path: string): Promise<ConfigType> {
    if (!existsSync(path)) {
        const errMsg = `Configuration was not found: ${path}`;
        console.error(errMsg);
        throw new Error(errMsg);
    }

    let configFileText: string;
    try {
        configFileText = readFileSync(path, "utf-8");
    } catch (error) {
        const errMsg = `Error during configuration loading: ${path}`;
        console.error(errMsg);
        throw new Error(errMsg);
    }

    const config: ConfigType = YAML.parse(configFileText);
    return config;
}
