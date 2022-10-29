/**
 * Main configuration for starting everything.
 */
export type MainConfig = {
    debug: boolean,
    token: string,
    clientId: string,
    guildId: string,
    loadedMessageId: string | null,
    unregisterAllId: string | null,
    allowlistEnabled: boolean,
    allowlist: string[] | null
};
