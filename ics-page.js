import { supabase } from './supabase-config.js';

const params = new URLSearchParams(window.location.search);
const roomId = params.get("id");

if (!roomId) {
  document.body.innerHTML = "ไม่พบรหัสห้อง";
}

async function loadICS() {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("id");

    if (!roomId) {
        document.body.innerHTML = "<h2>❌ ไม่พบ ID ในลิงก์</h2>";
        return;
    }

    // ลองดึงข้อมูลจากตาราง 'rooms' (ถ้าชื่อตารางคุณคือ meetings ให้แก้กลับนะครับ)
    const { data: meeting, error } = await supabase
        .from("rooms") 
        .select("*")
        .eq("id", roomId)
        .single();

    if (error || !meeting) {
        console.error("Supabase Error:", error);
        document.body.innerHTML = "<h2>❌ หาข้อมูลไม่เจอ (ตรวจสอบชื่อตารางในโค้ด)</h2>";
        return;
    }

    // เช็คชื่อ Column ว่าใช้อันไหนกันแน่
    const title = meeting.meeting_name || meeting.title || "GroupSync Meeting";
    const timeValue = meeting.selected_time || (meeting.dates ? meeting.dates.start : null);

    if (!timeValue) {
        document.body.innerHTML = `<h2>⚠️ ห้อง "${title}" ยังไม่มีเวลาที่สรุปไว้</h2>`;
        return;
    }

    try {
        // เตรียมข้อมูลไฟล์ ICS
        const cal = ics();
        const start = new Date(timeValue.replace(" ", "T"));
        const end = new Date(start.getTime() + 60 * 60 * 1000); // บวกไป 1 ชม.

        cal.addEvent(title, "นัดหมายจาก GroupSync", "Online", start, end);
        cal.download(title);

        document.body.innerHTML = `<h2>✅ ดาวน์โหลดไฟล์ "${title}" สำเร็จ!</h2>`;
    } catch (e) {
        document.body.innerHTML = "<h2>❌ เกิดข้อผิดพลาดในการสร้างไฟล์</h2>";
        console.error(e);
    }
}

loadICS();