import { existsSync, readFileSync } from 'node:fs';
import YAML from 'yaml';

/**
 * Attempts to read the YAML config file at the path. Throws an error if it is unable to do so.
 * @param path The YAML config file path.
 * @returns The config object with the type passed in.
 */
export async function readConfig<ConfigType>(path: string): Promise<ConfigType> {
    if (!existsSync(path)) {
        const errMsg = `Configuration was not found: ${path}`;
        console.error(errMsg);
        throw new Error(errMsg);
    }

    let configFileText: string;
    try {
        configFileText = readFileSync(path, 'utf-8');
    } catch (error) {
        const errMsg = `Error during configuration loading: ${path}`;
        console.error(errMsg);
        throw new Error(errMsg);
    }

    const config = YAML.parse(configFileText) as ConfigType;
    return config;
}
