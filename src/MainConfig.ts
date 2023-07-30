/**
 * Main configuration for starting everything.
 */
export type MainConfig = {
    debug: boolean,
    token: string,
    clientId: string,
    guildIds: string[] | null,
    presenceName: string | null | undefined,
    presenceType: number | null | undefined,
    loadedMessageId: string | null,
    unregisterAllId: string | null,
    allowlistEnabled: boolean,
    allowlist: string[] | null,
    blocklist: string[] | null | undefined,
    exitOnWsZombie: boolean
};
