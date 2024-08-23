"use client";
import React, { useEffect, useState } from 'react';
import "../app/globals.css";
import stringSimilarity from 'string-similarity';
import { useTable, Column } from 'react-table';
import { formatDistanceToNow, addMinutes } from 'date-fns';

type Player = {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    online: boolean;
    nickname: string | null;
    roles: string[];
};

type AlbionPlayer = {
    characterName: string;
    lastSeen: string;
    roles: string[];
};

type GameInfoPlayer = {
    Id: string;
    Name: string;
};

type FameStats = {
    total: number;
    change: number;
    direction: 'up' | 'none';
};

type PlayerStats = {
    name: string;
    id: string;
    pveFame: FameStats;
    pvpFame: FameStats;
    gatheringFame: FameStats;
    craftingFame: FameStats;
    crystalFame: FameStats;
    fishingFame: FameStats;
    farmingFame: FameStats;
    lastSeen: string;
    lastSeenChanged: boolean;
};

const fetchAlbionPlayerStats = async (playerId: string) => {
    const response = await fetch(`/api/albion/stats?playerId=${playerId}`);
    if (!response.ok) {
        console.error(`Failed to fetch player stats for ${playerId}`);
        return null;
    }
    return response.json();
};

const getPlayerFromLocalStorage = (playerName: string): GameInfoPlayer | null => {
    const storedPlayers = localStorage.getItem('albionPlayers');
    if (storedPlayers) {
        const players = JSON.parse(storedPlayers);
        return players[playerName] || null;
    }
    return null;
};

const savePlayerToLocalStorage = (player: GameInfoPlayer) => {
    const storedPlayers = localStorage.getItem('albionPlayers');
    const players = storedPlayers ? JSON.parse(storedPlayers) : {};
    players[player.Name] = player;
    localStorage.setItem('albionPlayers', JSON.stringify(players));
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function Skip() {
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [albionPlayers, setAlbionPlayers] = useState<AlbionPlayer[]>([]);
    const [observedPlayers, setObservedPlayers] = useState<PlayerStats[]>([]);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [nextFetch, setNextFetch] = useState<Date | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<string>("calculating...");

    useEffect(() => {
        const fetchPlayers = async () => {
            try {
                setLoadingMessage("Fetching Discord players...");
                const response = await fetch('/api/discord/players');
                if (!response.ok) {
                    throw new Error('Failed to fetch players');
                }
                const data = await response.json();
                setPlayers(data);
            } catch (error) {
                console.error('Failed to fetch players', error);
            } finally {
                setLoading(false);
            }
        };
        fetchPlayers();
    }, []);

    useEffect(() => {
        if (nextFetch) {
            const intervalId = setInterval(() => {
                const now = new Date();
                if (nextFetch > now) {
                    const secondsRemaining = Math.floor((nextFetch.getTime() - now.getTime()) / 1000);
                    const minutes = Math.floor(secondsRemaining / 60);
                    const seconds = secondsRemaining % 60;
                    setTimeRemaining(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
                } else {
                    setTimeRemaining("0:00");
                    clearInterval(intervalId);
                }
            }, 1000);

            return () => clearInterval(intervalId);
        }
    }, [nextFetch]);

    useEffect(() => {
        if (!nextFetch) return;

        const intervalId = setInterval(() => {
            const now = new Date();
            if (now >= nextFetch) {
                fetchPlayerStats();
            }
        }, 1000);

        return () => clearInterval(intervalId);
    }, [nextFetch]);

    const fetchPlayerStats = async () => {
        setLoadingMessage("Updating player stats...");
        setLoading(true);

        const updatedPlayers = await Promise.all(observedPlayers.map(async player => {
            await delay(500); // Increase delay to reduce the chance of overloading
            const newStats = await fetchAlbionPlayerStats(player.id);

            if (!newStats) {
                console.error(`Failed to update stats for player: ${player.name}`);
                return player; // Return the player without changes if the fetch fails
            }

            const updateFameStat = (currentStat: FameStats, newTotal: number): FameStats => {
                if (newTotal > currentStat.total) {
                    return {
                        total: newTotal,
                        change: newTotal - currentStat.total,
                        direction: 'up'
                    };
                }
                return { ...currentStat, change: 0, direction: 'none' };
            };

            const updatedPlayer = { ...player };
            updatedPlayer.pveFame = updateFameStat(player.pveFame, newStats.LifetimeStatistics.PvE.Total);
            updatedPlayer.pvpFame = updateFameStat(player.pvpFame, newStats.KillFame + newStats.DeathFame);
            updatedPlayer.gatheringFame = updateFameStat(player.gatheringFame, newStats.LifetimeStatistics.Gathering.All.Total);
            updatedPlayer.craftingFame = updateFameStat(player.craftingFame, newStats.LifetimeStatistics.Crafting.Total);
            updatedPlayer.crystalFame = updateFameStat(player.crystalFame, newStats.LifetimeStatistics.CrystalLeague);
            updatedPlayer.fishingFame = updateFameStat(player.fishingFame, newStats.LifetimeStatistics.FishingFame);
            updatedPlayer.farmingFame = updateFameStat(player.farmingFame, newStats.LifetimeStatistics.FarmingFame);

            const lastSeenChanged = new Date(newStats.LifetimeStatistics.Timestamp).getTime() !== new Date(player.lastSeen).getTime();
            updatedPlayer.lastSeen = newStats.LifetimeStatistics.Timestamp;
            updatedPlayer.lastSeenChanged = lastSeenChanged;

            return updatedPlayer;
        }));

        setObservedPlayers(updatedPlayers);
        setNextFetch(addMinutes(new Date(), 15)); // Set the next fetch for 15 minutes later
        setLoading(false);
    };

    const handleTextareaChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setLoading(true);
        setLoadingMessage("Processing Albion players...");

        const text = e.target.value;
        const rows = text.trim().split("\n").slice(1); // Remove header row
        const parsedPlayers = rows.map(row => {
            const [characterName, lastSeen, roles] = row.split('","').map(cell => cell.replace(/"/g, ''));
            return { characterName, lastSeen, roles: roles ? roles.split(",") : [] };
        });

        const now = new Date();

        const filteredPlayers = parsedPlayers.filter(player => {
            const lastSeenDate = new Date(player.lastSeen);
            const nowUTC = new Date(Date.now() + new Date().getTimezoneOffset() * 60000); // Convert to UTC
            const diffInMinutes = (nowUTC.getTime() - lastSeenDate.getTime()) / (1000 * 60);
            return diffInMinutes <= 40;
        });

        setAlbionPlayers(filteredPlayers);

        setLoadingMessage("Checking observed players...");

        const observed = filteredPlayers.filter(albionPlayer => {
            const isParticipating = players.some(discordPlayer => {
                const discordName = discordPlayer.nickname || discordPlayer.username;
                const similarity = stringSimilarity.compareTwoStrings(discordName.toLowerCase(), albionPlayer.characterName.toLowerCase());
                return similarity > 0.5; // Adjust the threshold as needed
            });
            return !isParticipating;
        });

        const observedNames = observed.map(player => player.characterName);
        const gameInfoPlayers = await Promise.all(observedNames.map(async name => {
            const localPlayer = getPlayerFromLocalStorage(name);
            if (localPlayer) {
                return localPlayer;
            } else {
                const fetchedPlayer = await fetch(`/api/albion/playerIds?name=${name}`);
                if (fetchedPlayer.ok) {
                    const fetchedData = await fetchedPlayer.json();
                    savePlayerToLocalStorage(fetchedData);
                    return fetchedData;
                }
                return null;
            }
        }));

        const initialStats = await Promise.all(gameInfoPlayers.filter(player => player !== null).map(async player => {
            await delay(200); // Add a delay between requests to avoid overloading the server
            const stats = await fetchAlbionPlayerStats(player!.Id);
            if (!stats) return null;

            const albionPlayer = filteredPlayers.find(p => p.characterName === player!.Name);

            return {
                name: player!.Name,
                id: player!.Id,
                pveFame: { total: stats.LifetimeStatistics.PvE.Total, change: 0, direction: 'none' },
                pvpFame: { total: stats.KillFame + stats.DeathFame, change: 0, direction: 'none' },
                gatheringFame: { total: stats.LifetimeStatistics.Gathering.All.Total, change: 0, direction: 'none' },
                craftingFame: { total: stats.LifetimeStatistics.Crafting.Total, change: 0, direction: 'none' },
                crystalFame: { total: stats.LifetimeStatistics.CrystalLeague, change: 0, direction: 'none' },
                fishingFame: { total: stats.LifetimeStatistics.FishingFame, change: 0, direction: 'none' },
                farmingFame: { total: stats.LifetimeStatistics.FarmingFame, change: 0, direction: 'none' },
                lastSeen: albionPlayer?.lastSeen || stats.LifetimeStatistics.Timestamp, // Use the initial lastSeen from the textarea or the stats Timestamp
                lastSeenChanged: false, // Initialize with no change detected
            };
        }));

        setObservedPlayers(initialStats.filter(player => player !== null) as PlayerStats[]);
        setLoading(false);
        setNextFetch(addMinutes(new Date(), 15)); // Schedule the next fetch for 15 minutes later
    };

    const columns: Column<PlayerStats>[] = React.useMemo(
        () => [
            {
                Header: 'Player Name',
                accessor: 'name',
            },
            {
                Header: 'PvE Fame',
                accessor: 'pveFame',
                Cell: ({ value }) => (
                    <span>
                        {value.total}
                        {value.direction === 'up' && <span style={{ color: 'green' }}> ↑ ({value.change})</span>}
                    </span>
                ),
            },
            {
                Header: 'PvP Fame',
                accessor: 'pvpFame',
                Cell: ({ value }) => (
                    <span>
                        {value.total}
                        {value.direction === 'up' && <span style={{ color: 'green' }}> ↑ ({value.change})</span>}
                    </span>
                ),
            },
            {
                Header: 'Gathering Fame',
                accessor: 'gatheringFame',
                Cell: ({ value }) => (
                    <span>
                        {value.total}
                        {value.direction === 'up' && <span style={{ color: 'green' }}> ↑ ({value.change})</span>}
                    </span>
                ),
            },
            {
                Header: 'Crafting Fame',
                accessor: 'craftingFame',
                Cell: ({ value }) => (
                    <span>
                        {value.total}
                        {value.direction === 'up' && <span style={{ color: 'green' }}> ↑ ({value.change})</span>}
                    </span>
                ),
            },
            {
                Header: 'Crystal Fame',
                accessor: 'crystalFame',
                Cell: ({ value }) => (
                    <span>
                        {value.total}
                        {value.direction === 'up' && <span style={{ color: 'green' }}> ↑ ({value.change})</span>}
                    </span>
                ),
            },
            {
                Header: 'Fishing Fame',
                accessor: 'fishingFame',
                Cell: ({ value }) => (
                    <span>
                        {value.total}
                        {value.direction === 'up' && <span style={{ color: 'green' }}> ↑ ({value.change})</span>}
                    </span>
                ),
            },
            {
                Header: 'Farming Fame',
                accessor: 'farmingFame',
                Cell: ({ value }) => (
                    <span>
                        {value.total}
                        {value.direction === 'up' && <span style={{ color: 'green' }}> ↑ ({value.change})</span>}
                    </span>
                ),
            },
            {
                Header: 'Seen At',
                accessor: 'lastSeen',
                Cell: ({ value, row }) => (
                    <span>
                        {new Date(value).toLocaleString()}
                        {row.original.lastSeenChanged && <span style={{ color: 'red' }}> ⚠️</span>}
                    </span>
                ),
            },
        ],
        []
    );

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
    } = useTable({ columns, data: observedPlayers });

    const onlineColumns: Column<Player>[] = React.useMemo(
        () => [
            {
                Header: 'Nickname',
                accessor: 'nickname',
            },
            {
                Header: 'Roles',
                accessor: 'roles',
                Cell: ({ value }) => <span>{value.join(', ')}</span>,
            },
        ],
        []
    );

    const {
        getTableProps: getOnlineTableProps,
        getTableBodyProps: getOnlineTableBodyProps,
        headerGroups: onlineHeaderGroups,
        rows: onlineRows,
        prepareRow: prepareOnlineRow,
    } = useTable({ columns: onlineColumns, data: players });

    return (
        <main className="flex min-h-screen flex-col items-center justify-between p-10 bg-gray-900 text-white">
            <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
                <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-800 bg-gray-800 pb-6 pt-8 backdrop-blur-2xl lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-800 lg:p-4">
                    Developed with ❤️ by Sabio
                </p>
            </div>

            <div className="flex flex-col items-center">
                <textarea
                    rows={10}
                    cols={50}
                    placeholder={`"Character Name","Last Seen","Roles"\n"0Profano","08/08/2024 15:21:27",""`}
                    onChange={handleTextareaChange}
                    className="text-black"
                />
                <div className="mt-4">
                    <p>Next fetch in: {timeRemaining}</p>
                </div>
                <table {...getTableProps()} className="table-auto mt-4">
                    <thead>
                        {headerGroups.map((headerGroup, index) => (
                            <tr {...headerGroup.getHeaderGroupProps()} key={index}>
                                {headerGroup.headers.map((column, key) => (
                                    <th {...column.getHeaderProps()} className="px-4 py-2" key={key}>{column.render('Header')}</th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody {...getTableBodyProps()}>
                        {rows.map((row, key) => {
                            prepareRow(row);
                            return (
                                <tr {...row.getRowProps()} key={key}>
                                    {row.cells.map((cell, key) => (
                                        <td {...cell.getCellProps()} className="border px-4 py-2" key={key}>{cell.render('Cell')}</td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="online-players-table">
                <h2>Online Players</h2>
                <table {...getOnlineTableProps()} className="table-auto mt-4">
                    <thead>
                        {onlineHeaderGroups.map((headerGroup, key) => (
                            <tr {...headerGroup.getHeaderGroupProps()} key={key}>
                                {headerGroup.headers.map((column, key) => (
                                    <th {...column.getHeaderProps()} className="px-4 py-2" key={key}>{column.render('Header')}</th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody {...getOnlineTableBodyProps()}>
                        {onlineRows.map((row, key) => {
                            prepareOnlineRow(row);
                            return (
                                <tr {...row.getRowProps()} key={key}>
                                    {row.cells.map((cell, key) => (
                                        <td {...cell.getCellProps()} className="border px-4 py-2" key={key}>{cell.render('Cell')}</td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </main>
    )
}
