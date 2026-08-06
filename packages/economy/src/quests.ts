export interface QuestDefinition {
    id: string;
    target: number;
    reward: number;
    desc: string;
}

/** Shared quest catalog — consumed by both the bot (assignment, DM rewards) and the panel (progress tracking). */
export const QUESTS_CONFIG: {
    daily: QuestDefinition[];
    weekly: QuestDefinition[];
} = {
    daily: [
        { id: 'work_3', target: 3, reward: 500, desc: 'Work 3 times' },
        { id: 'casino_5', target: 5, reward: 300, desc: 'Play casino 5 times' },
    ],
    weekly: [
        { id: 'work_15', target: 15, reward: 2000, desc: 'Work 15 times' },
        {
            id: 'casino_25',
            target: 25,
            reward: 1500,
            desc: 'Play casino 25 times',
        },
    ],
};
