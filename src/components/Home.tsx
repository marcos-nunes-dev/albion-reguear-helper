"use client";
import { Event } from "@/interface/common";
import { getEquipmentCounts, getItemImageUrl, isHealerOrSupport, isTank, isWithHeavyMount } from "@/utils/helpers";
import { useState } from "react";
import { saveAs } from 'file-saver';

export default function Home() {
    const [LinkList, setLinkList] = useState<string[]>([]);
    const [text, setText] = useState("");
    const [eventData, setEventData] = useState<Event[]>([]);
    const [loading, setLoading] = useState(false);
    const [allowBag, setAllowBag] = useState(false);
    const [healerSupportIP, setHealerSupportIP] = useState(1400);
    const [dpsTankIP, setDpsTankIP] = useState(1450);
    const [exceptions, setExceptions] = useState<{ [key: number]: boolean }>({});
    const [error, setError] = useState<string | null>(null);
    const [itemPrices, setItemPrices] = useState<{ [key: string]: { avg: string; min: string; max: string } | null }>({});
    const [manualPrices, setManualPrices] = useState<{ [key: string]: string }>({});
    const [hoveredPlayer, setHoveredPlayer] = useState<number | null>(null);

    const fetchEventData = async (id: string, attempts: number = 3): Promise<Event | null> => {
        try {
            const response = await fetch(`/api/getEventData?id=${id}`);
            if (!response.ok) {
                throw new Error("Failed to fetch data");
            }
            return response.json();
        } catch (error) {
            if (attempts > 1) {
                return fetchEventData(id, attempts - 1);
            } else {
                return null;
            }
        }
    };

    const generateItemVariations = (itemName: string): string[] => {
        const baseName = itemName.replace(/^T\d+_/, '').replace(/@\d+$/, '');
        const variations = [
            `T8_${baseName}`,
            `T7_${baseName}@1`,
            `T6_${baseName}@2`,
            `T5_${baseName}@3`
        ];
        return variations;
    };

    const fetchItemPrices = async (items: string[]): Promise<{ [key: string]: { avg: string; min: string; max: string } | null }> => {
        const itemVariations = items.flatMap(generateItemVariations);
        const baseUrl = 'https://west.albion-online-data.com/api/v2/stats/history/';
        const timeScale = '?time-scale=24';
        const maxUrlLength = 2000;
        let prices: { [key: string]: { avg: string; min: string; max: string } | null } = {};

        const fetchPricesForSubset = async (subset: string[]) => {
            const url = `${baseUrl}${subset.join(',')}${timeScale}`;
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error("Failed to fetch item prices");
                }
                const data = await response.json();
                return data;
            } catch (error) {
                console.error("Failed to fetch item prices:", error);
                return [];
            }
        };

        let currentSubset: string[] = [];
        let currentUrlLength = baseUrl.length + timeScale.length;

        const fetchAllSubsets = async () => {
            let allPrices: any[] = [];
            for (const variation of itemVariations) {
                const newUrlLength = currentUrlLength + variation.length + 1;
                if (newUrlLength > maxUrlLength) {
                    const subsetPrices = await fetchPricesForSubset(currentSubset);
                    allPrices = [...allPrices, ...subsetPrices];
                    currentSubset = [];
                    currentUrlLength = baseUrl.length + timeScale.length;
                }
                currentSubset.push(variation);
                currentUrlLength += variation.length + 1;
            }

            if (currentSubset.length > 0) {
                const subsetPrices = await fetchPricesForSubset(currentSubset);
                allPrices = [...allPrices, ...subsetPrices];
            }

            return allPrices;
        };

        const formatPrice = (price: number): string => {
            if (price >= 1_000_000) {
                return (price / 1_000_000).toFixed(1) + 'm';
            } else if (price >= 1_000) {
                return (price / 1_000).toFixed(1) + 'k';
            } else {
                return price.toFixed(0);
            }
        };

        const allPrices = await fetchAllSubsets();

        allPrices.forEach((price: any) => {
            const itemId = price.item_id;

            if (!prices[itemId]) {
                prices[itemId] = { avg: "0", min: "0", max: "0" };
            }

            if (price.data && price.data.length > 0) {
                const avgPrice = price.data.reduce((acc: number, dataPoint: any) => acc + dataPoint.avg_price, 0) / price.data.length;
                const minPrice = Math.min(...price.data.map((dataPoint: any) => dataPoint.avg_price));
                const maxPrice = Math.max(...price.data.map((dataPoint: any) => dataPoint.avg_price));

                prices[itemId].avg = formatPrice(avgPrice);
                prices[itemId].min = formatPrice(minPrice);
                prices[itemId].max = formatPrice(maxPrice);
            } else {
                prices[itemId] = null;
            }
        });

        return prices;
    };

    const handleCreateList = async () => {
        setLoading(true);
        setError(null);
        const urlRegex = /(https?:\/\/albiononline\.com\/(?:en\/)?killboard\/kill\/(\d+)(?:\?server=\w+)?)/g;
        const links = [...text.matchAll(urlRegex)].map((match) => match[2]);
        setLinkList(links);

        const data = await Promise.all(links.map(async (id) => {
            const result = await fetchEventData(id);
            if (result === null) {
                setError("Não foi possível carregar os dados de alguns eventos. Por favor, tente novamente mais tarde.");
            }
            return result;
        }));

        setEventData(data.filter((event) => event !== null) as Event[]);

        const equipmentItems = Object.keys(getEquipmentCounts(data.filter((event) => event !== null) as Event[]));
        const prices = await fetchItemPrices(equipmentItems);
        setItemPrices(prices);

        setLoading(false);
    };

    const getCheckOrX = (event: Event) => {
        if (exceptions[event.EventId]) {
            return { check: "✔️", reason: "" };
        }

        const victimIP = event.Victim.AverageItemPower;
        const mainHand = event.Victim.Equipment.MainHand;
        const mount = event.Victim.Equipment.Mount?.Type;
        const bag = event.Victim.Equipment.Bag?.Type;

        if (!allowBag && !isTank(mainHand.Type) && bag) {
            return { check: "❌", reason: "Bag" };
        }

        if (isWithHeavyMount(mount || "")) {
            return { check: "❌", reason: "Mount Peso" };
        }

        if (mainHand) {
            if (isHealerOrSupport(mainHand.Type) && victimIP < healerSupportIP) {
                return { check: "❌", reason: `IP | H/S ${healerSupportIP}+` };
            }
            if (victimIP < dpsTankIP) {
                return { check: "❌", reason: `IP | D/T ${dpsTankIP}+` };
            }
        }

        return { check: "✔️", reason: "" };
    };

    const handleExceptionChange = (eventId: number, isChecked: boolean) => {
        setExceptions((prevExceptions) => ({
            ...prevExceptions,
            [eventId]: isChecked,
        }));
    };

    const handleManualPriceChange = (itemName: string, value: string) => {
        setManualPrices((prevPrices) => ({
            ...prevPrices,
            [itemName]: value,
        }));
    };

    const calculateTotalSetPrice = (event: Event): string => {
        const equipment = event.Victim.Equipment;
        const items = Object.values(equipment).filter(item => item !== null).map(item => item.Type);

        const totalPrice = items.reduce((sum, item) => {
            const baseName = `T8_${item.replace(/^T\d+_/, '').replace(/@\d+$/, '')}`;
            const price = manualPrices[baseName]
                ? parseFloat(manualPrices[baseName].replace(/[km]/, '')) * (manualPrices[baseName].includes('m') ? 1_000_000 : manualPrices[baseName].includes('k') ? 1_000 : 1)
                : itemPrices[baseName]
                    ? parseFloat(itemPrices[baseName]!.avg.replace(/[km]/, '')) * (itemPrices[baseName]!.avg.includes('m') ? 1_000_000 : itemPrices[baseName]!.avg.includes('k') ? 1_000 : 1)
                    : 0;
            return sum + price;
        }, 0);

        return totalPrice >= 1_000_000 ? (totalPrice / 1_000_000).toFixed(1) + 'm' : totalPrice >= 1_000 ? (totalPrice / 1_000).toFixed(1) + 'k' : totalPrice.toFixed(0);
    };

    const equipmentCounts = getEquipmentCounts(eventData.filter(event => getCheckOrX(event).check === "✔️" || exceptions[event.EventId]));

    const calculateTotalTableCost = (): string => {
        const totalCost = Object.entries(equipmentCounts).reduce((sum, [itemName, itemData]) => {
            const price = manualPrices[itemName]
                ? parseFloat(manualPrices[itemName].replace(/[km]/, '')) * (manualPrices[itemName].includes('m') ? 1_000_000 : manualPrices[itemName].includes('k') ? 1_000 : 1)
                : itemPrices[itemName]
                    ? parseFloat(itemPrices[itemName]!.avg.replace(/[km]/, '')) * (itemPrices[itemName]!.avg.includes('m') ? 1_000_000 : itemPrices[itemName]!.avg.includes('k') ? 1_000 : 1)
                    : 0;
            return sum + (price * itemData.count);
        }, 0);

        return totalCost >= 1_000_000 ? (totalCost / 1_000_000).toFixed(1) + 'm' : totalCost >= 1_000 ? (totalCost / 1_000).toFixed(1) + 'k' : totalCost.toFixed(0);
    };

    const exportToCSV = () => {
        const csvRows = [
            ['Foto do Item', 'Nome do Item', 'Quantidade', 'Preço Médio/u']
        ];

        Object.values(equipmentCounts).forEach((item) => {
            const row = [
                getItemImageUrl(item.name),
                item.name,
                item.count,
                itemPrices[item.name] ? itemPrices[item.name]!.avg : manualPrices[item.name] || 'N/A'
            ];
            csvRows.push(row as any);
        });

        const totalCostRow = [
            '',
            'Custo Médio Total',
            '',
            calculateTotalTableCost()
        ];
        csvRows.push(totalCostRow);

        const csvContent = csvRows.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'equipment_data.csv');
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-between p-10 bg-gray-900 text-white">
            <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
                <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-800 bg-gray-800 pb-6 pt-8 backdrop-blur-2xl lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-800 lg:p-4">
                    Developed with ❤️ by Sabio
                </p>
            </div>

            <div className="flex flex-col items-center">
                <div className="flex flex-row items-center space-x-4 mb-4">
                    <label className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            checked={allowBag}
                            onChange={(e) => setAllowBag(e.target.checked)}
                            className="form-checkbox"
                        />
                        <span>Permitir bag</span>
                    </label>
                    <label className="flex items-center space-x-2">
                        <span>IP Healer e Suporte:</span>
                        <input
                            type="number"
                            value={healerSupportIP}
                            onChange={(e) => setHealerSupportIP(Number(e.target.value))}
                            className="form-input p-1 border rounded-md bg-gray-700"
                            defaultValue={1400}
                        />
                    </label>
                    <label className="flex items-center space-x-2">
                        <span>IP DPS e Tank:</span>
                        <input
                            type="number"
                            value={dpsTankIP}
                            onChange={(e) => setDpsTankIP(Number(e.target.value))}
                            className="form-input p-1 border rounded-md bg-gray-700"
                            defaultValue={1450}
                        />
                    </label>
                </div>

                <textarea
                    className="p-2 border rounded-md bg-gray-700 mb-4 w-full"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={10}
                    cols={10}
                />
                <button
                    className="p-2 bg-blue-500 text-white rounded-md"
                    onClick={handleCreateList}
                    disabled={loading}
                >
                    {loading ? "Carregando..." : "Criar lista"}
                </button>
            </div>

            {error && <div className="text-red-500 mt-4">{error}</div>}

            <div className="mt-8 w-full max-w-5xl">
                <h2 className="text-2xl mb-4">Dados dos Eventos:</h2>
                {loading ? (
                    <p>Carregando dados dos eventos...</p>
                ) : (
                    <div>
                        <table className="table-auto w-full text-left mb-8">
                            <thead>
                                <tr>
                                    <th className="px-4 py-2 border-b border-gray-800">Exceção</th>
                                    <th className="px-4 py-2 border-b border-gray-800">Nome do Jogador</th>
                                    <th className="px-4 py-2 border-b border-gray-800">Guilda</th>
                                    <th className="px-4 py-2 border-b border-gray-800">IP</th>
                                    <th className="px-4 py-2 border-b border-gray-800">Data do Evento</th>
                                    <th className="px-4 py-2 border-b border-gray-800">Check</th>
                                    <th className="px-4 py-2 border-b border-gray-800">Motivo</th>
                                    <th className="px-4 py-2 border-b border-gray-800">Preço Total do Set</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...eventData]
                                    .sort((a, b) => {
                                        const checkOrXa = getCheckOrX(a);
                                        const checkOrXb = getCheckOrX(b);
                                        return checkOrXa.check === "❌" ? -1 : checkOrXb.check === "❌" ? 1 : 0;
                                    })
                                    .map((event, index) => {
                                        const checkOrX = getCheckOrX(event);
                                        return (
                                            <tr key={index} className="bg-gray-800">
                                                <td className="border px-4 py-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={exceptions[event.EventId] || false}
                                                        onChange={(e) => handleExceptionChange(event.EventId, e.target.checked)}
                                                    />
                                                </td>
                                                <td className="border px-4 py-2 ">
                                                    <span>{event.Victim.Name}</span>
                                                    <span
                                                        className="ml-2 cursor-pointer"
                                                        onMouseEnter={() => setHoveredPlayer(event.EventId)}
                                                        onMouseLeave={() => setHoveredPlayer(null)}
                                                    >
                                                        👤
                                                    </span>
                                                    {hoveredPlayer === event.EventId && (
                                                        <div className="absolute bg-gray-400 p-2 rounded-md shadow-lg z-10">
                                                            {event.Victim.Equipment.Head?.Type && <img src={getItemImageUrl(event.Victim.Equipment.Head?.Type)} alt="Head" width="50" height="50" />}
                                                            {event.Victim.Equipment.Armor?.Type && <img src={getItemImageUrl(event.Victim.Equipment.Armor?.Type)} alt="Armor" width="50" height="50" />}
                                                            {event.Victim.Equipment.MainHand?.Type && <img src={getItemImageUrl(event.Victim.Equipment.MainHand?.Type)} alt="MainHand" width="50" height="50" />}
                                                            {event.Victim.Equipment.OffHand?.Type && <img src={getItemImageUrl(event.Victim.Equipment.OffHand?.Type)} alt="OffHand" width="50" height="50" />}
                                                            {event.Victim.Equipment.Shoes?.Type && <img src={getItemImageUrl(event.Victim.Equipment.Shoes?.Type)} alt="Shoes" width="50" height="50" />}
                                                            {event.Victim.Equipment.Cape?.Type && <img src={getItemImageUrl(event.Victim.Equipment.Cape?.Type)} alt="Cape" width="50" height="50" />}
                                                            {event.Victim.Equipment.Mount?.Type && <img src={getItemImageUrl(event.Victim.Equipment.Mount?.Type)} alt="Mount" width="50" height="50" />}
                                                            {event.Victim.Equipment.Potion?.Type && <img src={getItemImageUrl(event.Victim.Equipment.Potion?.Type)} alt="Potion" width="50" height="50" />}
                                                            {event.Victim.Equipment.Food?.Type && <img src={getItemImageUrl(event.Victim.Equipment.Food?.Type)} alt="Food" width="50" height="50" />}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="border px-4 py-2">{event.Victim.GuildName}</td>
                                                <td className="border px-4 py-2">{event.Victim.AverageItemPower}</td>
                                                <td className="border px-4 py-2">{new Date(event.TimeStamp).toLocaleString()}</td>
                                                <td className="border px-4 py-2">{checkOrX.check}</td>
                                                <td className="border px-4 py-2">{checkOrX.reason}</td>
                                                <td className="border px-4 py-2">{calculateTotalSetPrice(event)}</td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>

                        <h2 className="text-2xl mb-4">Somatório de Itens:</h2>
                        <button
                            className="p-2 bg-green-500 text-white rounded-md mb-4"
                            onClick={exportToCSV}
                        >
                            Exportar para CSV
                        </button>
                        <table className="table-auto w-full text-left mt-4">
                            <thead>
                                <tr>
                                    <th className="px-4 py-2 border-b border-gray-800">Foto do Item</th>
                                    <th className="px-4 py-2 border-b border-gray-800">Nome do Item</th>
                                    <th className="px-4 py-2 border-b border-gray-800">Quantidade</th>
                                    <th className="px-4 py-2 border-b border-gray-800">Preço Médio/u</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.values(equipmentCounts).map((item, index) => (
                                    <tr key={index} className="bg-gray-800">
                                        <td className="border px-4 py-2">
                                            <img src={getItemImageUrl(item.name)} alt={item.name} width="50" height="50" />
                                        </td>
                                        <td className="border px-4 py-2">{item.name}</td>
                                        <td className="border px-4 py-2">{item.count}</td>
                                        <td className="border px-4 py-2">
                                            {itemPrices[item.name] ? (
                                                <>
                                                    <div>Avg: {itemPrices[item.name]!.avg}</div>
                                                    <div className="opacity-35">Min: {itemPrices[item.name]!.min}</div>
                                                    <div className="opacity-35">Max: {itemPrices[item.name]!.max}</div>
                                                </>
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={manualPrices[item.name] || ""}
                                                    onChange={(e) => handleManualPriceChange(item.name, e.target.value)}
                                                    className="form-input p-1 border rounded-md bg-gray-700"
                                                    placeholder="N/A"
                                                />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-gray-800 font-bold">
                                    <td className="border px-4 py-2" colSpan={3}>Custo Médio Total</td>
                                    <td className="border px-4 py-2">{calculateTotalTableCost()}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </main>
    );
}
