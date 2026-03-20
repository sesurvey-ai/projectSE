# Use Supabase with Next.js

Learn how to create a Supabase project, add some sample data, and query from a Next.js app.

---

## 1. Create a Supabase project

Go to [database.new](https://database.new) and create a new Supabase project.

หรือสร้างโปรเจกต์ผ่าน Management API:

```bash
# Get your access token from https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN="your-access-token"

# List your organizations to get the organization ID
curl -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  https://api.supabase.com/v1/organizations

# Create a new project (replace <org-id> with your organization ID)
curl -X POST https://api.supabase.com/v1/projects \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "<org-id>",
    "name": "My Project",
    "region": "us-east-1",
    "db_pass": "<your-secure-password>"
  }'
```

เมื่อโปรเจกต์พร้อมแล้ว ไปที่ **Table Editor** สร้างตารางใหม่และเพิ่มข้อมูล หรือรันคำสั่ง SQL ต่อไปนี้ใน **SQL Editor**:

```sql
-- Create the table
create table instruments (
  id bigint primary key generated always as identity,
  name text not null
);

-- Insert some sample data into the table
insert into instruments (name)
values
  ('violin'),
  ('viola'),
  ('cello');

alter table instruments enable row level security;
```

ทำให้ข้อมูลในตารางอ่านได้แบบ public โดยเพิ่ม RLS policy:

```sql
create policy "public can read instruments"
on public.instruments
for select to anon
using (true);
```

---

## 2. Create a Next.js app

ใช้คำสั่ง `create-next-app` พร้อม template `with-supabase` ซึ่งมาพร้อมกับ:

- Cookie-based Auth
- TypeScript
- Tailwind CSS

```bash
npx create-next-app -e with-supabase
```

---

## 3. Declare Supabase Environment Variables

เปลี่ยนชื่อไฟล์ `.env.example` เป็น `.env.local` แล้วเพิ่มค่าต่อไปนี้:

```env
NEXT_PUBLIC_SUPABASE_URL=<SUBSTITUTE_SUPABASE_URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<SUBSTITUTE_SUPABASE_PUBLISHABLE_KEY>
```

สามารถดู Project URL และ Key ได้จาก **Connect dialog** ในหน้า Dashboard ของโปรเจกต์

> **หมายเหตุเรื่อง API Keys:** Supabase กำลังเปลี่ยนระบบ Key เพื่อเพิ่มความปลอดภัย ในช่วงเปลี่ยนผ่านสามารถใช้ทั้ง `anon` / `service_role` key แบบเดิม และ publishable key แบบใหม่ (`sb_publishable_xxx`) ได้

---

## 4. Query Supabase data from Next.js

สร้างไฟล์ `app/instruments/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

async function InstrumentsData() {
  const supabase = await createClient();
  const { data: instruments } = await supabase.from("instruments").select();

  return <pre>{JSON.stringify(instruments, null, 2)}</pre>;
}

export default function Instruments() {
  return (
    <Suspense fallback={<div>Loading instruments...</div>}>
      <InstrumentsData />
    </Suspense>
  );
}
```

---

## 5. Start the app

รัน development server แล้วเปิด [http://localhost:3000/instruments](http://localhost:3000/instruments) ในเบราว์เซอร์:

```bash
npm run dev
```

---

## Next steps

- ตั้งค่า [Auth](https://supabase.com/docs/guides/auth) สำหรับแอป
- [เพิ่มข้อมูล](https://supabase.com/docs/guides/database/import-data) เข้าฐานข้อมูล
- อัปโหลดและเสิร์ฟไฟล์ static ด้วย [Storage](https://supabase.com/docs/guides/storage)
