// ตารางเวรประจำจุด (callcenter) — แสดง UI เดียวกับ duty-demo2 (แบบ embedded ในเลย์เอาต์ callcenter)
// อยู่ในเลย์เอาต์ที่ล็อกอินแล้ว → โหลด/บันทึกตารางลง DB ได้ (role callcenter/admin)
import DutyRoster from '../../duty-demo2/DutyRoster';

export default function CallcenterDutyRosterPage() {
  return <DutyRoster embedded />;
}
