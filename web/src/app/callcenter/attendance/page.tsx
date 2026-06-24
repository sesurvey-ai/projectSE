// เวลาเข้า–ออกงาน (callcenter) — ตารางใช้ component ร่วมกับฝั่ง admin
// (บอร์ดสดประจำจุดย้ายไป /callcenter/checkin-board แล้ว)
import AttendanceTable from '@/components/attendance/AttendanceTable';

export default function CallcenterAttendancePage() {
  return <AttendanceTable />;
}
