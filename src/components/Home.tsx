"use client";
import { Event } from "@/interface/common";
import { getEquipmentCounts, getItemImageUrl, isHealerOrSupport, isTank, isWithHeavyMount } from "@/utils/helpers";
import { useState } from "react";

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
    const [itemPrices, setItemPrices] = useState<{ [key: string]: { avg: string; min: string; max: string } }>({});

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
        // Remove o tier e o encantamento do itemName
        const baseName = itemName.replace(/^T\d+_/, '').replace(/@\d+$/, '');
        const variations = [
            `T8_${baseName}`,
            `T7_${baseName}@1`,
            `T6_${baseName}@2`,
            `T5_${baseName}@3`
        ];
        return variations;
    };

    const fetchItemPrices = async (items: string[]): Promise<{ [key: string]: { avg: string; min: string; max: string } }> => {
        const itemVariations = items.flatMap(generateItemVariations);
        const baseUrl = 'https://west.albion-online-data.com/api/v2/stats/history/';
        const timeScale = '?time-scale=24';
        const maxUrlLength = 2000; // Ajuste este valor conforme necessário
        let prices: { [key: string]: { avg: string; min: string; max: string } } = {};

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

        for (const variation of itemVariations) {
            const potentialUrlLength = currentUrlLength + variation.length + 1; // +1 for comma

            if (potentialUrlLength > maxUrlLength) {
                // Fetch prices for the current subset
                const data = await fetchPricesForSubset(currentSubset);
                prices = { ...prices, ...processPricesData(data, items) };

                // Reset for the next subset
                currentSubset = [variation];
                currentUrlLength = baseUrl.length + timeScale.length + variation.length + 1;
            } else {
                currentSubset.push(variation);
                currentUrlLength = potentialUrlLength;
            }
        }

        // Fetch prices for the last subset
        if (currentSubset.length > 0) {
            const data = await fetchPricesForSubset(currentSubset);
            prices = { ...prices, ...processPricesData(data, items) };
        }

        return prices;
    };

    const processPricesData = (data: any, items: string[]): { [key: string]: { avg: string; min: string; max: string } } => {
        const formatPrice = (price: number): string => {
            if (price >= 1_000_000) {
                return (price / 1_000_000).toFixed(1) + 'm';
            } else if (price >= 1_000) {
                return (price / 1_000).toFixed(1) + 'k';
            } else {
                return price.toFixed(0);
            }
        };

        const prices: { [key: string]: { avg: string; min: string; max: string } } = {};
        items.forEach(item => {
            const baseName = item.replace(/^T\d+_/, '').replace(/@\d+$/, '');
            const itemData = data.filter((d: any) => d.item_id.includes(baseName));
            const validPrices = itemData.flatMap((cur: any) => cur.data.map((entry: any) => entry.avg_price).filter((price: number) => price > 0));

            if (validPrices.length > 0) {
                const total = validPrices.reduce((sum: number, price: number) => sum + price, 0);
                const avgPrice = total / validPrices.length;

                // Filtrar preços discrepantes
                const filteredPrices = validPrices.filter((price: any) => price >= avgPrice * 0.65 && price <= avgPrice * 1.35);

                if (filteredPrices.length > 0) {
                    const totalFiltered = filteredPrices.reduce((sum: number, price: number) => sum + price, 0);
                    const avgFilteredPrice = totalFiltered / filteredPrices.length;
                    const minPrice = Math.min(...filteredPrices);
                    const maxPrice = Math.max(...filteredPrices);
                    prices[item] = { avg: formatPrice(avgFilteredPrice), min: formatPrice(minPrice), max: formatPrice(maxPrice) };
                } else {
                    prices[item] = { avg: '0', min: '0', max: '0' };
                }
            } else {
                prices[item] = { avg: '0', min: '0', max: '0' };
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

    const calculateTotalSetPrice = (event: Event): string => {
        const equipment = event.Victim.Equipment;
        const items = Object.values(equipment).filter(item => item !== null).map(item => item.Type);

        const totalPrice = items.reduce((sum, item) => {
            const baseName = `T8_${item.replace(/^T\d+_/, '').replace(/@\d+$/, '')}`;
            console.log(item, baseName, itemPrices)
            const price = itemPrices[baseName] ? parseFloat(itemPrices[baseName].avg.replace(/[km]/, '')) * (itemPrices[baseName].avg.includes('m') ? 1_000_000 : itemPrices[baseName].avg.includes('k') ? 1_000 : 1) : 0;
            return sum + price;
        }, 0);

        return totalPrice >= 1_000_000 ? (totalPrice / 1_000_000).toFixed(1) + 'm' : totalPrice >= 1_000 ? (totalPrice / 1_000).toFixed(1) + 'k' : totalPrice.toFixed(0);
    };

    const equipmentCounts = getEquipmentCounts(eventData.filter(event => getCheckOrX(event).check === "✔️" || exceptions[event.EventId]));

    const calculateTotalTableCost = (): string => {
        const totalCost = Object.entries(equipmentCounts).reduce((sum, [itemName, itemData]) => {
            const price = itemPrices[itemName] ? parseFloat(itemPrices[itemName].avg.replace(/[km]/, '')) * (itemPrices[itemName].avg.includes('m') ? 1_000_000 : itemPrices[itemName].avg.includes('k') ? 1_000 : 1) : 0;
            return sum + (price * itemData.count);
        }, 0);

        return totalCost >= 1_000_000 ? (totalCost / 1_000_000).toFixed(1) + 'm' : totalCost >= 1_000 ? (totalCost / 1_000).toFixed(1) + 'k' : totalCost.toFixed(0);
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
                                                <td className="border px-4 py-2">{event.Victim.Name}</td>
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
                        <table className="table-auto w-full text-left mt-4">
                            <thead>
                                <tr>
                                    <th className="px-4 py-2 border-b border-gray-800">Foto do Item</th>
                                    <th className="px-4 py-2 border-b border-gray-800">Nome do Item</th>
                                    <th className="px-4 py-2 border-b border-gray-800">Quantidade</th>
                                    <th className="px-4 py-2 border-b border-gray-800">Preço Médio</th>
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
                                                    <div>Avg: {itemPrices[item.name].avg}</div>
                                                    <div className="opacity-35">Min: {itemPrices[item.name].min}</div>
                                                    <div className="opacity-35">Max: {itemPrices[item.name].max}</div>
                                                </>
                                            ) : 'N/A'}
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
