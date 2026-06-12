// รูปยืนยันลงเวลา (admin) — ใช้ component เดียวกับฝั่ง callcenter (สิทธิ์ API เปิดให้ทั้งสองบทบาท)
import PhotoWall from '../../callcenter/checkin-photos/PhotoWall';

export default function AdminCheckinPhotosPage() {
  return <PhotoWall />;
}
