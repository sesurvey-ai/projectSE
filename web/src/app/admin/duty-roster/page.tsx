// จัดตารางเวร (admin) — แสดง UI เดียวกับ duty-demo2 (แบบ embedded ในเลย์เอาต์ admin)
// component กลางอยู่ที่ duty-demo2/DutyRoster.tsx; โหลด/บันทึกลง DB ได้ (role admin/callcenter)
import DutyRoster from '../../duty-demo2/DutyRoster';

export default function AdminDutyRosterPage() {
  return <DutyRoster embedded />;
}
