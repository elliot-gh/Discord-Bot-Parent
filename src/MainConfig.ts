/**
 * Main configuration for starting everything.
 */
export type MainConfig = {
    token: string,
    clientId: string,
    guildId: string,
    loadedMessageId: string | null,
    unregisterAllId: string | null
};
