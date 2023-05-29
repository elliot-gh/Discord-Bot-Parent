import { format } from "node:util";
import { Agenda } from "agenda";
import { createLogger } from "../utils/Logger";

let initOnce = false; // whether shutdown handlers are setup, only done if createAgenda() is called
const reminderLogger = createLogger("ReminderUtils");
const agendaInstances: {
    [url: string]: {
        [collection: string]: Agenda
    }
} = {};

/**
 * Creates an Agenda object, then sets up shutdown handlers. The Agenda object is NOT started.
 * https://www.npmjs.com/package/agenda/
 * @param url The MongoDB URL
 * @param username The MongoDB username
 * @param password The MongoDB password
 * @param collection The MongoDB collection name
 * @returns A started Agenda object
 */
export async function createAgenda(url: string, username: string, password: string, collection: string): Promise<Agenda> {
    if (agendaInstances[url] !== undefined && agendaInstances[url][collection] !== undefined) {
        reminderLogger.info(`found existing agenda for url ${url} with collection name ${collection}`);
        return agendaInstances[url][collection];
    }

    reminderLogger.info(`creating new agenda for collection name ${collection}`);

    const fullUrl = format(url,
        encodeURIComponent(username),
        encodeURIComponent(password));
    const newAgenda = new Agenda({
        db: {
            address: fullUrl,
            collection: collection
        }
    });

    if (agendaInstances[url] === undefined) {
        agendaInstances[url] = {};
    }
    agendaInstances[url][collection] = newAgenda;

    if (!initOnce) {
        initOnce = true;
        process.on("SIGTERM", handleAgendaShutdown);
        process.on("SIGINT", handleAgendaShutdown);
        process.on("SIGHUP", handleAgendaShutdown);
    }

    return newAgenda;
}

function handleAgendaShutdown() {
    const shutdownPromises = [];
    reminderLogger.info("Got shutdown signal, shutting down all Agenda instances");
    for (const url in agendaInstances) {
        for (const collection in agendaInstances[url]) {
            reminderLogger.info(`Shutting down Agenda instance for url ${url} collection ${collection}`);
            const agenda = agendaInstances[url][collection];
            shutdownPromises.push(agenda.stop());
        }
    }

    Promise.allSettled(shutdownPromises)
        .then(() => {
            reminderLogger.error(`handleAgendaShutdown() exitCode: ${process.exitCode}`);
            process.exit(process.exitCode);
        })
        .catch(() => {
            reminderLogger.error(`handleAgendaShutdown() exitCode: ${process.exitCode}`);
            process.exit(process.exitCode);
        });
}