import { supabase } from './supabase-config.js';

const params = new URLSearchParams(window.location.search);
const roomId = params.get("id");

if (!roomId) {
  document.body.innerHTML = "ไม่พบรหัสห้อง";
}

loadICS();

async function loadICS() {

  const { data: meeting, error } = await supabase
    .from("meetings")
    .select("title, selected_time")
    .eq("id", roomId)
    .single();

  if (error || !meeting || !meeting.selected_time) {
    document.body.innerHTML = "ยังไม่ได้เลือกเวลานัดหมาย";
    return;
  }

  const [date, time] = meeting.selected_time.split(" ");
  const start = new Date(`${date}T${time}:00`);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const cal = ics();
  cal.addEvent(
    meeting.title,
    "Scheduled via GroupSync",
    "Online",
    start,
    end
  );

  cal.download("GroupSync-Meeting");

  document.body.innerHTML = "กำลังดาวน์โหลดไฟล์...";
}