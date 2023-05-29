/**
 * Data stored in database and used for reminder jobs.
 * @template DataType Type of data stored in the job.
 */
export type ReminderJobData<DataType> = {
    userId: string,
    channelId: string,
    guildId: string,
    reminderTime: Date,
    data: DataType
};
