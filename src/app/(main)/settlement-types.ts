export interface WeekOpt {
  id: number;
  label: string;
}
export interface GuildOpt {
  id: number;
  order: number;
  name: string;
}

export interface SettlementRow {
  memberId: number;
  name: string;
  guildId: number | null;
  statTotal: number;
  applied: number;
  score: number;
  attendanceRate: number;
  shareRatio: number;
  share: number;
  excluded: boolean;
  counts: Record<number, number>;
}

export interface SettlementResult {
  week: {
    id: number;
    number: number;
    name: string | null;
    excludeRatio: number;
    diamond: number;
  };
  categories: { id: number; name: string; weight: number }[];
  rows: SettlementRow[];
  pool: number;
  excludeAmount: number;
  distributable: number;
  totalScore: number;
}
