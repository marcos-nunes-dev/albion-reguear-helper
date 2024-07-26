"use client";
import { useState } from "react";


type EquipmentItem = {
    Type: string;
    Count: number;
    Quality: number;
    ActiveSpells: any[];
    PassiveSpells: any[];
    LegendarySoul: any | null;
};

type Equipment = {
    MainHand: EquipmentItem;
    OffHand: EquipmentItem | null;
    Head: EquipmentItem | null;
    Armor: EquipmentItem | null;
    Shoes: EquipmentItem | null;
    Bag: EquipmentItem | null;
    Cape: EquipmentItem | null;
    Mount: EquipmentItem | null;
    Potion: EquipmentItem | null;
    Food: EquipmentItem | null;
};

type PvEStats = {
    Total: number;
    Royal: number;
    Outlands: number;
    Avalon: number;
    Hellgate: number;
    CorruptedDungeon: number;
    Mists: number;
};

type GatheringStats = {
    Fiber: PvEStats;
    Hide: PvEStats;
    Ore: PvEStats;
    Rock: PvEStats;
    Wood: PvEStats;
    All: PvEStats;
};

type LifetimeStatistics = {
    PvE: PvEStats;
    Gathering: GatheringStats;
    Crafting: PvEStats;
    CrystalLeague: number;
    FishingFame: number;
    FarmingFame: number;
    Timestamp: string | null;
};

type Player = {
    AverageItemPower: number;
    Equipment: Equipment;
    Inventory: (EquipmentItem | null)[];
    Name: string;
    Id: string;
    GuildName: string;
    GuildId: string;
    AllianceName: string;
    AllianceId: string;
    AllianceTag: string;
    Avatar: string;
    AvatarRing: string;
    DeathFame: number;
    KillFame: number;
    FameRatio: number;
    LifetimeStatistics: LifetimeStatistics;
    DamageDone: number;
    SupportHealingDone: number;
};

type Event = {
    groupMemberCount: number;
    numberOfParticipants: number;
    EventId: number;
    TimeStamp: string;
    Version: number;
    Killer: Player;
    Victim: Player;
    TotalVictimKillFame: number;
    Location: string | null;
    Participants: Player[];
    GroupMembers: Player[];
    GvGMatch: string | null;
    BattleId: number;
    KillArea: string;
    Category: string | null;
    Type: string;
};

export default function Home() {
    const [LinkList, setLinkList] = useState<string[]>([]);
    const [text, setText] = useState("");
    const [eventData, setEventData] = useState<Event[]>([]);
    const [loading, setLoading] = useState(false);
    const [allowBag, setAllowBag] = useState(false);
    const [healerSupportIP, setHealerSupportIP] = useState(1400);
    const [dpsTankIP, setDpsTankIP] = useState(1450);

    const handleCreateList = async () => {
        setLoading(true);
        const urlRegex = /(https?:\/\/albiononline\.com\/en\/killboard\/kill\/(\d+))/g;
        const links = [...text.matchAll(urlRegex)].map((match) => match[2]);
        setLinkList(links);

        // Fazer uma requisição à API para cada ID através do servidor Next.js
        const data = await Promise.all(links.map(async (id) => {
            const response = await fetch(`/api/getEventData?id=${id}`);
            return response.json();
        }));

        setEventData(data);
        setLoading(false);  // Finaliza o carregamento
    };

    const getStandardizedItemType = (type: string) => {
        const regex = /^[T\d]+_/;
        return type.replace(regex, 'T8_').replace(/@\d+$/, '');
    };

    const getEquipmentCounts = (events: Event[]) => {
        const equipmentCounts: { [key: string]: { name: string; count: number } } = {};
        const relevantKeys = ["MainHand", "OffHand", "Head", "Armor", "Shoes"];

        events.forEach((event) => {
            relevantKeys.forEach((key) => {
                const item = event.Victim.Equipment[key as keyof typeof event.Victim.Equipment];
                if (item) {
                    const standardizedType = getStandardizedItemType(item.Type);
                    if (equipmentCounts[standardizedType]) {
                        equipmentCounts[standardizedType].count += 1;
                    } else {
                        equipmentCounts[standardizedType] = { name: standardizedType, count: 1 };
                    }
                }
            });
        });
        return equipmentCounts;
    };

    const equipmentCounts = getEquipmentCounts(eventData);

    const getItemImageUrl = (itemType: string) => {
        return `https://render.albiononline.com/v1/item/${itemType}.png`;
    };

    const tankItems = ["MAIN_MACE", "2H_DUALMACE_AVALON", "MAIN_MACE_HELL", "2H_ICEGAUNTLETS_HELL", "2H_IRONGAUNTLETS_HELL", "2H_HAMMER_AVALON", "MAIN_MACE_CRYSTAL", "2H_MACE_MORGANA", "2H_HAMMER_UNDEAD", "MAIN_ROCKMACE_KEEPER", "2H_DUALHAMMER_HELL", "2H_POLEHAMMER", "2H_HAMMER", "2H_MACE", "MAIN_HAMMER"];
    const healerSupportItems = ["2H_HOLYSTAFF", "2H_HOLYSTAFF_UNDEAD", "MAIN_HOLYSTAFF_AVALON", "MAIN_HOLYSTAFF", "2H_DIVINESTAFF", "MAIN_HOLYSTAFF_MORGANA", "2H_HOLYSTAFF_CRYSTAL", "2H_HOLYSTAFF_HELL", "2H_ARCANESTAFF_HELL", "MAIN_ARCANESTAFF_UNDEAD", "2H_ARCANESTAFF_CRYSTAL", "2H_ENIGMATICSTAFF", "2H_ARCANESTAFF", "MAIN_ARCANESTAFF", "2H_ARCANE_RINGPAIR_AVALON"];
    const transportMounts = [
        "T2_MOUNT_MULE",
        "T3_MOUNT_OX",
        "T4_MOUNT_OX",
        "T5_MOUNT_OX",
        "T6_MOUNT_OX",
        "T7_MOUNT_OX",
        "T8_MOUNT_OX",
        "T4_MOUNT_GIANTSTAG",
        "T6_MOUNT_GIANTSTAG_MOOSE",
        "T8_MOUNT_MAMMOTH_TRANSPORT",
        "T5_MOUNT_DIREBEAR_FW_FORTSTERLING",
        "T5_MOUNT_DIREBOAR_FW_LYMHURST",
        "T8_MOUNT_DIREBEAR_FW_FORTSTERLING_ELITE",
        "T8_MOUNT_DIREBOAR_FW_LYMHURST_ELITE"
    ];

    const isWithHeavyMount = (mount: string) => {
        return transportMounts.some(item => mount.includes(item));
    };

    const isHealerOrSupport = (itemType: string) => {
        return healerSupportItems.some(item => itemType.includes(item));
    };

    const isTank = (itemType: string) => {
        return tankItems.some(item => itemType.includes(item));
    };

    const getCheckOrX = (event: Event) => {
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
                    className="p-2 border rounded-md bg-gray-700 mb-4"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={10}
                    cols={10}
                />
                <button
                    className="p-2 bg-blue-500 text-white rounded-md"
                    onClick={handleCreateList}
                    disabled={loading}  // Desativa o botão durante o carregamento
                >
                    {loading ? "Carregando..." : "Criar lista"}
                </button>
            </div>


            <div className="mt-8 w-full max-w-5xl">
                <h2 className="text-2xl mb-4">Dados dos Eventos:</h2>
                {loading ? (
                    <p>Carregando dados dos eventos...</p>
                ) : (
                    <div>
                        <table className="table-auto w-full text-left mb-8">
                            <thead>
                                <tr>
                                    <th className="px-4 py-2 border-b border-gray-800">Nome do Jogador</th>
                                    <th className="px-4 py-2 border-b border-gray-800">Guilda</th>
                                    <th className="px-4 py-2 border-b border-gray-800">IP</th>
                                    <th className="px-4 py-2 border-b border-gray-800">Data do Evento</th>
                                    <th className="px-4 py-2 border-b border-gray-800">Check</th>
                                    <th className="px-4 py-2 border-b border-gray-800">Motivo</th>
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
                                                <td className="border px-4 py-2">{event.Victim.Name}</td>
                                                <td className="border px-4 py-2">{event.Victim.GuildName}</td>
                                                <td className="border px-4 py-2">{event.Victim.AverageItemPower}</td>
                                                <td className="border px-4 py-2">{new Date(event.TimeStamp).toLocaleString()}</td>
                                                <td className="border px-4 py-2">{checkOrX.check}</td>
                                                <td className="border px-4 py-2">{checkOrX.reason}</td>
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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </main>
    );
}
