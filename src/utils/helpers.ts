import { Event } from "@/interface/common";

export const getStandardizedItemType = (type: string) => {
    const regex = /^[T\d]+_/;
    return type.replace(regex, 'T8_').replace(/@\d+$/, '');
};

export const getEquipmentCounts = (events: Event[]) => {
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

export const getItemImageUrl = (itemType: string) => {
    return `https://render.albiononline.com/v1/item/${itemType}.png`;
};

export const tankItems = ["MAIN_MACE", "2H_DUALMACE_AVALON", "MAIN_MACE_HELL", "2H_ICEGAUNTLETS_HELL", "2H_IRONGAUNTLETS_HELL", "2H_HAMMER_AVALON", "MAIN_MACE_CRYSTAL", "2H_MACE_MORGANA", "2H_HAMMER_UNDEAD", "MAIN_ROCKMACE_KEEPER", "2H_DUALHAMMER_HELL", "2H_POLEHAMMER", "2H_HAMMER", "2H_MACE", "MAIN_HAMMER"];
export const healerSupportItems = ["2H_HOLYSTAFF", "2H_HOLYSTAFF_UNDEAD", "MAIN_HOLYSTAFF_AVALON", "MAIN_HOLYSTAFF", "2H_DIVINESTAFF", "MAIN_HOLYSTAFF_MORGANA", "2H_HOLYSTAFF_CRYSTAL", "2H_HOLYSTAFF_HELL", "2H_ARCANESTAFF_HELL", "MAIN_ARCANESTAFF_UNDEAD", "2H_ARCANESTAFF_CRYSTAL", "2H_ENIGMATICSTAFF", "2H_ARCANESTAFF", "MAIN_ARCANESTAFF", "2H_ARCANE_RINGPAIR_AVALON"];
export const transportMounts = [
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

export const isWithHeavyMount = (mount: string) => {
    return transportMounts.some(item => mount.includes(item));
};

export const isHealerOrSupport = (itemType: string) => {
    return healerSupportItems.some(item => itemType.includes(item));
};

export const isTank = (itemType: string) => {
    return tankItems.some(item => itemType.includes(item));
};