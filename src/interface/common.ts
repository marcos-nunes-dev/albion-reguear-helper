export type EquipmentItem = {
    Type: string;
    Count: number;
    Quality: number;
    ActiveSpells: any[];
    PassiveSpells: any[];
    LegendarySoul: any | null;
};

export type Equipment = {
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

export type PvEStats = {
    Total: number;
    Royal: number;
    Outlands: number;
    Avalon: number;
    Hellgate: number;
    CorruptedDungeon: number;
    Mists: number;
};

export type GatheringStats = {
    Fiber: PvEStats;
    Hide: PvEStats;
    Ore: PvEStats;
    Rock: PvEStats;
    Wood: PvEStats;
    All: PvEStats;
};

export type LifetimeStatistics = {
    PvE: PvEStats;
    Gathering: GatheringStats;
    Crafting: PvEStats;
    CrystalLeague: number;
    FishingFame: number;
    FarmingFame: number;
    Timestamp: string | null;
};

export type Player = {
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

export type Event = {
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