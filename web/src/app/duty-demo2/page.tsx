// หน้า standalone (ไม่ต้องล็อกอิน) สำหรับพรีวิว/ดีไซน์ — เนื้อหาจริงอยู่ใน DutyRoster
// หน้า /callcenter/duty-roster ก็ render component ตัวเดียวกันนี้ (แบบ embedded)
import DutyRoster from './DutyRoster';

export default function DutyDemo2Page() {
  return <DutyRoster />;
}
