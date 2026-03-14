import { supabase } from './supabase-config.js';

const params = new URLSearchParams(window.location.search);
const roomId = params.get("id");

if (!roomId) {
  document.body.innerHTML = "ไม่พบรหัสห้อง";
}

loadICS();

async function loadICS() {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("id");

    if (!roomId) {
        document.body.innerHTML = "<h2>❌ ไม่พบรหัสห้องใน URL</h2>";
        return;
    }

    document.body.innerHTML = "<h2>⏳ กำลังดึงข้อมูลการนัดหมาย...</h2>";

    // เปลี่ยน "meetings" เป็นชื่อตารางที่คุณใช้จริงใน Supabase (เช่น "rooms")
    const { data: meeting, error } = await supabase
        .from("rooms") 
        .select("*")
        .eq("id", roomId)
        .single();

    if (error || !meeting) {
        console.error("Supabase Error:", error);
        document.body.innerHTML = "<h2>❌ ไม่พบข้อมูลห้องนี้ในฐานข้อมูล</h2>";
        return;
    }

    // ตรวจสอบชื่อ Column (ถ้าใน DB ใช้ meeting_name ให้แก้ตรงนี้)
    const title = meeting.title || meeting.meeting_name || "GroupSync Meeting";
    const timeValue = meeting.selected_time;

    if (!timeValue) {
        document.body.innerHTML = "<h2>⚠️ ห้องนี้ยังไม่ได้เลือกเวลานัดหมายที่สรุปผล</h2>";
        return;
    }

    try {
        const [date, time] = timeValue.split(" ");
        const start = new Date(`${date}T${time}:00`);
        const end = new Date(start.getTime() + 60 * 60 * 1000);

        const cal = ics();
        cal.addEvent(title, "Scheduled via GroupSync", "Online", start.toISOString(), end.toISOString());
        cal.download(title);

        document.body.innerHTML = `<h2>✅ ดาวน์โหลดไฟล์ ${title}.ics สำเร็จ!</h2><p><a href="dashboard.html">กลับไปหน้าหลัก</a></p>`;
    } catch (e) {
        document.body.innerHTML = "<h2>❌ รูปแบบวันที่ในฐานข้อมูลไม่ถูกต้อง</h2>";
    }
}

loadICS();