import { Interaction, Message } from "discord.js";

/**
 * Basic event ignore check (bot or self).
 * @param event discord.js event or message
 * @returns true to be ignored, false to process.
 */
export function ShouldIgnoreEvent(event: Message | Interaction) {
    if (event instanceof Message) {
        return event.author.bot || event.author.id === event.client.user.id;
    }

    return event.user.bot || event.user.id === event.client.user.id;
}
