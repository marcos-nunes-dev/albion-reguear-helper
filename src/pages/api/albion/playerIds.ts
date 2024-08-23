import type { NextApiRequest, NextApiResponse } from 'next';

const fetchAlbionPlayerId = async (playerName: string, retries: number = 3): Promise<any> => {
    try {
        const response = await fetch(`https://gameinfo.albiononline.com/api/gameinfo/search?q=${encodeURIComponent(playerName)}`);
        
        if (!response.ok) {
            console.error(`Failed to fetch player ID for ${playerName}: ${response.statusText}`);
            if (retries > 0) {
                console.log(`Retrying... (${retries} attempts left)`);
                return fetchAlbionPlayerId(playerName, retries - 1);
            }
            return null;
        }

        const data = await response.json();
        const player = data.players.find((player: any) => 
            player.Name.toLowerCase() === playerName.toLowerCase() && 
            player.GuildName === "C A L A N G O S"
        );
        console.log(player)
        if (player) {        
            return {
                Id: player.Id,
                Name: player.Name
            };
        }
        return null;
    } catch (error) {
        console.error(`Error fetching player ID for ${playerName}:`, error);
        if (retries > 0) {
            console.log(`Retrying... (${retries} attempts left)`);
            return fetchAlbionPlayerId(playerName, retries - 1);
        }
        return null;
    }
};

export default async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        const { name } = req.query;
        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: 'Invalid request' });
        }

        const player = await fetchAlbionPlayerId(name);
        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }

        res.status(200).json(player);
    } catch (error) {
        console.error('Error fetching player ID:', error);
        res.status(500).json({ error: 'Failed to fetch player ID' });
    }
};
