/**
 * Main configuration for starting everything.
 */
export type MainConfig = {
    debug: boolean,
    token: string,
    clientId: string,
    guildIds: string[] | null,
    loadedMessageId: string | null,
    unregisterAllId: string | null,
    allowlistEnabled: boolean,
    allowlist: string[] | null,
    exitOnWsZombie: boolean
};
