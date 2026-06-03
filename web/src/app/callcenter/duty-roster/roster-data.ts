// metadata + types สำหรับหน้าตารางเวรประจำจุด (ข้อมูลจริงมาจาก GET /api/duty/roster)

export type ShiftKey = 'shift1' | 'shift2' | 'shift3' | 'fix1' | 'fix2';
export type RegionKey = 'bkk' | 'upc';
export type Status = 'present' | 'pending' | 'leave' | 'off';

export interface Person {
  user_id: number;
  code: string;
  name: string;
  phone: string;
  station: string;
  region: RegionKey;
  shift: ShiftKey;
  shift_label: string;
  status: Status;
  check_in: string | null;
  tags: string[];
  note: string | null;
}

export const SHIFTS: Record<ShiftKey, { short: string; range: string; label: string }> = {
  shift1: { short: 'เวร 1', range: '07.00–15.00', label: 'เวร 1 · เช้า' },
  shift2: { short: 'เวร 2', range: '15.00–23.00', label: 'เวร 2 · บ่าย' },
  shift3: { short: 'เวร 3', range: '23.00–07.00', label: 'เวร 3 · ดึก' },
  fix1: { short: 'Fix 1', range: '07.00–16.00', label: 'Fix 1' },
  fix2: { short: 'Fix 2', range: '14.00–23.00', label: 'Fix 2' },
};

export const SHIFT_ORDER: ShiftKey[] = ['shift1', 'shift2', 'shift3', 'fix1', 'fix2'];

export const REGIONS: Record<RegionKey, string> = {
  bkk: 'กรุงเทพฯ และปริมณฑล',
  upc: 'ต่างจังหวัด',
};

export const STATUS_META: Record<Status, { label: string; dot: string }> = {
  present: { label: 'เข้างานแล้ว', dot: 'var(--ok)' },
  pending: { label: 'รอเข้างาน', dot: 'var(--pending)' },
  leave: { label: 'ลา', dot: 'var(--leave)' },
  off: { label: 'วันหยุด', dot: 'var(--off)' },
};
