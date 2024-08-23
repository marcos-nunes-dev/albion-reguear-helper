import type { NextApiRequest, NextApiResponse } from 'next';

const fetchAlbionPlayerStats = async (playerId: string, retries: number = 3): Promise<any> => {
    try {
        const response = await fetch(`https://gameinfo.albiononline.com/api/gameinfo/players/${playerId}`);

        if (!response.ok) {
            console.error(`Failed to fetch player stats for ${playerId}: ${response.statusText}`);
            if (retries > 0) {
                console.log(`Retrying... (${retries} attempts left)`);
                await new Promise(res => setTimeout(res, 1000)); // Increase the delay before retrying
                return fetchAlbionPlayerStats(playerId, retries - 1);
            }
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error(`Error fetching player stats for ${playerId}:`, error);
        if (retries > 0) {
            console.log(`Retrying... (${retries} attempts left)`);
            await new Promise(res => setTimeout(res, 1000)); // Increase the delay before retrying
            return fetchAlbionPlayerStats(playerId, retries - 1);
        }
        return null;
    }
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    const { playerId } = req.query;

    if (!playerId || typeof playerId !== 'string') {
        return res.status(400).json({ error: 'Player ID is required' });
    }

    try {
        const data = await fetchAlbionPlayerStats(playerId);
        if (!data) {
            return res.status(404).json({ error: 'Player stats not found' });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching player stats:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export default handler;
