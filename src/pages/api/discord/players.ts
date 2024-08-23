import type { NextApiRequest, NextApiResponse } from 'next';
import { Client, GatewayIntentBits, Partials } from 'discord.js';

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!DISCORD_BOT_TOKEN || !GUILD_ID) {
    throw new Error("Both DISCORD_BOT_TOKEN and GUILD_ID must be defined in the environment variables.");
}

type Player = {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    online: boolean;
    nickname: string | null;
    roles: string[];
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.User, Partials.GuildMember], // Correctly using valid Partials
});

const getOnlinePlayers = async (): Promise<Player[]> => {
    try {
        console.log('Logging in...');
        await client.login(DISCORD_BOT_TOKEN);

        console.log('Fetching guild...');
        const guild = await client.guilds.fetch(GUILD_ID);
        await guild.members.fetch(); // Fetch all members to ensure they are cached

        console.log('Processing members...');
        const onlinePlayers: Player[] = guild.members.cache
            .filter(member => member.voice.channel?.name.toLowerCase().includes('zvz'))
            .map(member => ({
                id: member.user.id,
                username: member.user.username,
                discriminator: member.user.discriminator,
                avatar: member.user.avatar,
                online: member.presence?.status === 'online' || member.voice.channel !== null, // Check if online or in voice
                nickname: member.nickname || member.user.username,
                roles: member.roles.cache.map(role => role.name),
            }));

        console.log('Online players:', onlinePlayers);
        return onlinePlayers;
    } catch (error) {
        console.error('Error in getOnlinePlayers:', error);
        throw error;
    } finally {
        client.destroy(); // Ensure the client disconnects after the task is complete
    }
};

export default async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        const players = await getOnlinePlayers();
        res.status(200).json(players);
    } catch (error) {
        console.error('Error fetching players:', error);
        res.status(500).json({ error: 'Failed to fetch players' });
    }
};
