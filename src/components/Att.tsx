"use client";
import React, { useState, useEffect } from 'react';
import "../app/globals.css";
import { useTable, useSortBy } from 'react-table';

export default function Att() {
    const [playerList, setPlayerList] = useState('');
    const [playersData, setPlayersData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTextAreaChange = (event: any) => {
        setPlayerList(event.target.value);
    };

    const parsePlayerList = () => {
        const lines = playerList.trim().split('\n');
        const players = lines.slice(1).map(line => {
            const [name, lastSeen, roles] = line.split('","').map(field => field.replace(/(^"|"$)/g, ''));
            return { name, lastSeen, roles };
        });
        return players;
    };

    const fetchPlayerParticipation = async () => {
        const players = parsePlayerList();
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('https://api.albionbattles.com/player?guildSearch=C%20A%20L%20A%20N%20G%20O%20S&interval=28&minGP=20');
            if (!response.ok) {
                throw new Error('Failed to fetch data');
            }
            const data = await response.json();
            const playerParticipation = data.reduce((acc: any, player: any) => {
                acc[player.name] = {
                    battleNumber: player.battleNumber,
                    totalFame: player.totalFame,
                    totalKills: player.totalKills,
                    totalDeath: player.totalDeath,
                    averageIP: player.averageIP,
                };
                return acc;
            }, {});

            const combinedData: any = players.map(player => ({
                ...player,
                ...playerParticipation[player.name] || {
                    battleNumber: 0,
                    totalFame: 0,
                    totalKills: 0,
                    totalDeath: 0,
                    averageIP: 0,
                }
            })).sort((a, b) => b.battleNumber - a.battleNumber);

            setPlayersData(combinedData);
        } catch (error: any) {
            setError('Error fetching player participation: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const calculateAverages = () => {
        const totalPlayers = playersData.length;
        const totals = playersData.reduce((acc: any, player: any) => {
            acc.battleNumber += player.battleNumber;
            acc.totalFame += player.totalFame;
            acc.totalKills += player.totalKills;
            acc.totalDeath += player.totalDeath;
            acc.averageIP += player.averageIP;
            return acc;
        }, { battleNumber: 0, totalFame: 0, totalKills: 0, totalDeath: 0, averageIP: 0 });

        const playersWithThreeOrMoreBattles = playersData.filter((player: any) => player.battleNumber >= 3);
        const validIPPlayers = playersWithThreeOrMoreBattles.filter((player: any) => player.averageIP > 0);

        const averageBattleNumber = (totals.battleNumber / totalPlayers).toFixed(2);
        const averageBattleNumberThreeOrMore = (playersWithThreeOrMoreBattles.reduce((acc, player: any) => acc + player.battleNumber, 0) / playersWithThreeOrMoreBattles.length).toFixed(2);
        const averageKillsThreeOrMore = (playersWithThreeOrMoreBattles.reduce((acc, player: any) => acc + player.totalKills, 0) / playersWithThreeOrMoreBattles.length).toFixed(2);
        const averageDeathsThreeOrMore = (playersWithThreeOrMoreBattles.reduce((acc, player: any) => acc + player.totalDeath, 0) / playersWithThreeOrMoreBattles.length).toFixed(2);
        const averageIPThreeOrMore = (validIPPlayers.reduce((acc, player: any) => acc + player.averageIP, 0) / validIPPlayers.length).toFixed(2);

        return {
            averageBattleNumber,
            averageBattleNumberThreeOrMore,
            averageKillsThreeOrMore,
            averageDeathsThreeOrMore,
            averageIPThreeOrMore
        };
    };

    const averages = calculateAverages();

    const columns = React.useMemo(() => [
        {
            Header: 'Character Name',
            accessor: 'name',
        },
        {
            Header: 'Battle Number',
            accessor: 'battleNumber',
        },
        {
            Header: 'Total Fame',
            accessor: 'totalFame',
        },
        {
            Header: 'Total Kills',
            accessor: 'totalKills',
        },
        {
            Header: 'Total Death',
            accessor: 'totalDeath',
        },
        {
            Header: 'Average IP',
            accessor: 'averageIP',
        },
    ], []);

    const data = React.useMemo(() => playersData, [playersData]);

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
    } = useTable({ columns, data }, useSortBy);

    return (
        <main className="flex min-h-screen flex-col items-center justify-between p-10 bg-gray-900 text-white">
            <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
                <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-800 bg-gray-800 pb-6 pt-8 backdrop-blur-2xl lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-800 lg:p-4">
                    Developed with ❤️ by Sabio
                </p>
            </div>

            <div className="flex flex-col items-center">
                <textarea
                    className="p-2 border rounded-md bg-gray-700 mb-4 w-full"
                    value={playerList}
                    onChange={handleTextAreaChange}
                    rows={10}
                    cols={50}
                    placeholder='Paste player list here...'
                />
                <button
                    className="p-2 bg-blue-500 text-white rounded-md"
                    onClick={fetchPlayerParticipation}
                    disabled={loading}
                >
                    {loading ? "Carregando..." : "Fetch Participation"}
                </button>
            </div>

            {error && <div className="text-red-500 mt-4">{error}</div>}

            {playersData.length > 0 && (
                <div className="mt-8 w-full max-w-5xl">
                    <h2 className="text-2xl mb-4">Estatísticas Gerais dos Jogadores:</h2>
                    <div className="mb-8">
                        <p>Média geral de battle number: {averages.averageBattleNumber}</p>
                        <p>Média de battle number de quem participou 3 ou mais vezes: {averages.averageBattleNumberThreeOrMore}</p>
                        <p>Média de Kills de quem participou 3 ou mais vezes: {averages.averageKillsThreeOrMore}</p>
                        <p>Média de Deaths de quem participou 3 ou mais vezes: {averages.averageDeathsThreeOrMore}</p>
                        <p>Média de IP de quem participou 3 ou mais vezes: {averages.averageIPThreeOrMore}</p>
                    </div>

                    <h2 className="text-2xl mb-4">Dados dos Jogadores:</h2>
                    <table {...getTableProps()} className="table-auto w-full text-left mb-8">
                        <thead>
                            {headerGroups.map((headerGroup, index) => (
                                <tr {...headerGroup.getHeaderGroupProps()} key={index}>
                                    {headerGroup.headers.map((column: any, key) => (
                                        <th key={key} {...column.getHeaderProps(column.getSortByToggleProps())} className="px-4 py-2 border-b border-gray-800">
                                            {column.render('Header')}
                                            <span>
                                                {column.isSorted
                                                    ? column.isSortedDesc
                                                        ? ' 🔽'
                                                        : ' 🔼'
                                                    : ''}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody {...getTableBodyProps()}>
                            {rows.map((row, rowIndex) => {
                                prepareRow(row);
                                return (
                                    <tr {...row.getRowProps()} key={rowIndex} className="bg-gray-800">
                                        {row.cells.map((cell, cellIndex) => (
                                            <td {...cell.getCellProps()} key={cellIndex} className="border px-4 py-2">
                                                {cell.render('Cell')}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </main>
    );
}
