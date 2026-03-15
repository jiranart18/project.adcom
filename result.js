import { supabase } from './supabase-config.js';

// -------------------
// Setup
// -------------------
const params = new URLSearchParams(window.location.search);
const roomId = params.get("id");

const bestTimeContainer = document.getElementById("bestTimeResult");
const participantList = document.getElementById("participantList");
const participantCount = document.getElementById("participantCount");
const roomDisplay = document.getElementById("roomDisplay");

if (!roomId) {
  bestTimeContainer.innerText = "ไม่พบรหัสห้องประชุม";
} else {
  roomDisplay.innerText = roomId;
  init();
}

// -------------------
// INIT
// -------------------
async function init() {
  await loadResults();
  setupRealtime();
}

// -------------------
// Check Creator
// -------------------
async function isCreator() {
  const localToken = localStorage.getItem("creatorToken");

  const { data } = await supabase
    .from("rooms")
    .select("creator_token")
    .eq("id", roomId)
    .single();

  if (!data) return false;

  return data.creator_token === localToken;
}

// -------------------
// Load Results 
// -------------------
async function loadResults() {
  // 1. ดึงข้อมูลห้อง (ดึงครั้งเดียวให้คุ้ม)
  const { data: meeting, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (roomError || !meeting) {
    console.error("Room not found");
    return;
  }

  // 2. ดึงข้อมูลการโหวต
  const { data: votes, error: voteError } = await supabase
    .from("votes")
    .select("user_name, vote_data")
    .eq("meeting_id", roomId);

  if (voteError) {
    console.error("Error fetching votes");
    return;
  }

  // 3. แสดงรายชื่อคนโหวตและ Progress Bar
  displayParticipants(votes || []);
  renderProgressBar(votes.length, meeting.required_voters || 1);

  // 4. เช็คสถานะ: ถ้าสรุปผลแล้ว (Finalized)
  if (meeting.status === "finalized" && meeting.selected_time) {
    renderFinalized(meeting.selected_time);
    return;
  }

  // 5. เช็คสถานะ: ถ้ายังไม่มีใครโหวต
  if (!votes || votes.length === 0) {
    bestTimeContainer.innerHTML = "<p>ยังไม่มีการโหวต</p>";
    return;
  }

  // 6. เช็คสิทธิ์ Creator: ถ้าใช่ ให้คำนวณ Top 3
  const creator = true;
  if (creator) {
    calculateTop3(votes, meeting.type);
  } else {
    bestTimeContainer.innerHTML = "<p style='text-align:center; color:#666;'>รอผู้สร้างเลือกเวลานัดหมาย... <br> (ตอนนี้โหวตไปแล้ว " + votes.length + " คน)</p>";
  }
}

// ฟังก์ชันแยกสำหรับวาด Progress Bar (ช่วยให้โค้ดสะอาดขึ้น)
function renderProgressBar(current, target) {
  const percent = Math.min((current / target) * 100, 100);
  const statusEl = document.getElementById("voteStatus");
  
  if (!statusEl) return; // กันพังถ้าลืมสร้าง ID นี้ใน HTML

  statusEl.innerHTML = `
    <div style="margin-bottom: 10px;">
      <strong>สถานะการโหวต:</strong> ${current} จาก ${target} คน
    </div>
    <div style="width: 100%; background: #eee; border-radius: 10px; height: 15px; overflow: hidden;">
      <div style="width: ${percent}%; background: #4CAF50; height: 100%; transition: 0.5s;"></div>
    </div>
    ${current >= target ? `<p style="color: green; font-size: 0.9em; margin-top:5px;">⭐ ครบจำนวนแล้ว! เลือกเวลาสรุปได้เลย</p>` : ""}
  `;
}

// -------------------
// Display Participants
// -------------------
function displayParticipants(votes) {
  participantCount.innerText = votes.length;

  participantList.innerHTML = votes.map(v => `
    <div class="participant-badge">
      ${v.user_name}
    </div>
  `).join('');
}

// -------------------
// Calculate Top 3
// -------------------
function buildScoreMap(votes) {
  const scoreMap = {};
  const unavailableCount = {};

  votes.forEach(vote => {
    let voteData = vote.vote_data;

    if (typeof voteData === "string") {
      voteData = JSON.parse(voteData);
    }

    Object.keys(voteData).forEach(date => {
      Object.keys(voteData[date]).forEach(time => {

        const key = `${date} ${time}`;
        const state = voteData[date][time];

        if (!scoreMap[key]) {
          scoreMap[key] = 0;
          unavailableCount[key] = 0;
        }

        scoreMap[key] += state;

        if (state === 0) {
          unavailableCount[key]++;
        }
      });
    });
  });

  return { scoreMap, unavailableCount };
}
function applyTypeRules(type, scoreMap, unavailableCount, totalPeople) {

  if (type === "Group Work") {

    Object.keys(scoreMap).forEach(key => {
      if (unavailableCount[key] / totalPeople > 0.3) {
        scoreMap[key] -= 5;
      }
    });

  } else if (type === "TA Meeting") {

    Object.keys(scoreMap).forEach(key => {
      if (unavailableCount[key] > 0) {
        scoreMap[key] = -9999;
      }
    });

  } else if (type === "Tutoring Session") {

    Object.keys(scoreMap).forEach(key => {
      scoreMap[key] = scoreMap[key] * 1.5;
    });

  }
  // Club Activity = default (ไม่ต้องทำอะไร)

  return scoreMap;
}
function calculateTop3(votes, meetingType) {

  const totalPeople = votes.length;

  const { scoreMap, unavailableCount } =
    buildScoreMap(votes);

  const finalScores =
    applyTypeRules(meetingType, scoreMap, unavailableCount, totalPeople);

  const sorted = Object.entries(finalScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  renderTop3(sorted);
}

// -------------------
// Render Top 3 (Creator Only)
// -------------------
function renderTop3(top3) {

  bestTimeContainer.innerHTML = `
    <h3>Top 3 Best Times</h3>
    ${top3.map(([datetime, score], createmeetP) => `
      <div class="best-time-card">
        <br>
        ${formatDateTime(datetime)}<br>
        คะแนนรวม: ${score}
        <br>
        <button onclick="selectTime('${datetime}')">
          เลือกเวลานี้
        </button>
      </div>
    `).join('')}
  `;
}

// -------------------
// Select Time (Creator Only)
// -------------------
window.selectTime = async function(datetime) {
    const confirmSelect = confirm("ยืนยันเลือกเวลานี้?");
    if (!confirmSelect) return;

    console.log("กำลังเริ่มบันทึกเวลาที่เลือก...");

    try {
        // ส่งข้อมูลไป Update
        const { data, error } = await supabase
            .from("rooms")
            .update({
                selected_time: datetime,
                status: "finalized"
            })
            .eq("id", roomId)
            .select(); // เพิ่ม .select() เพื่อเช็คว่ามี data กลับมาไหม

        if (error) {
            console.error("Update Error:", error.message);
            alert("บันทึกไม่สำเร็จ (RLS หรือ Database error): " + error.message);
            return;
        }

        console.log("บันทึกสำเร็จ!", data);
        
        // บังคับโหลดใหม่เพื่อให้ loadResults ทำงานใหม่
        window.location.reload(); 

    } catch (err) {
        console.error("Unexpected Error:", err);
        alert("เกิดข้อผิดพลาดที่ไม่คาดคิด");
    }
};
// -------------------
// Render Finalized
// -------------------
async function renderFinalized(datetime) {

  const { data: meeting } = await supabase
    .from("rooms")
    .select("title")
    .eq("id", roomId)
    .single();

  const [date, time] = datetime.split(" ");

  const googleLink = generateGoogleCalendarLink(
    meeting.title,
    date,
    time
  );

  bestTimeContainer.innerHTML = `
    <h3>✅ เวลาที่เลือกแล้ว</h3>
    <p>${formatDateTime(datetime)}</p>

    <button onclick="window.open('${googleLink}','_blank')">
      add to Google Calendar
    </button>
    <button onclick="copyShareMessage('${datetime}')">
             link to send to a friend
    </button>
  `;
}

// -------------------
// Format Date
// -------------------
function formatDateTime(datetime) {
  const [date, time] = datetime.split(" ");
  const d = new Date(`${date}T${time}:00`);

  return d.toLocaleString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// -------------------
// Realtime
// -------------------
function setupRealtime() {
  // ดักฟังการเปลี่ยนแปลงของห้องนี้ (เช่น เมื่อ status เปลี่ยนเป็น finalized)
  supabase
    .channel("room-updates")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rooms",
        filter: `id=eq.${roomId}`
      },
      () => {
        loadResults(); // เมื่อห้องมีการ update ให้รีโหลดหน้าทันที
      }
    )
    .subscribe();

  // ดักฟังคนมาโหวตเพิ่ม (โค้ดเดิมของคุณ)
  supabase
    .channel("votes-live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "votes",
        filter: `meeting_id=eq.${roomId}`
      },
      () => {
        loadResults();
      }
    )
    .subscribe();
}

/*------------------ส่งลิ้งโหวตให้เพื่อน-----------*/
window.copyVoteLink = function() {
  // 1. ดึง URL ปัจจุบัน (หน้า Results)
  const currentUrl = new URL(window.location.href);
  
  // 2. เปลี่ยนแค่ชื่อไฟล์จาก results.html เป็นหน้าที่มีตารางเลือกเวลาของคุณ
  // *** สำคัญ: ถ้าไฟล์หน้าตารางของคุณชื่อ index.html ให้เปลี่ยน 'vote.html' เป็น 'index.html' ***
  currentUrl.pathname = currentUrl.pathname.replace("results.html", "vote.html");

  // 3. คัดลอก URL ที่สมบูรณ์ (ซึ่งจะมี ?id=... ติดไปด้วยแน่นอน)
  const finalLink = currentUrl.toString();

  navigator.clipboard.writeText(finalLink).then(() => {
    alert("คัดลอกลิงก์สำหรับส่งให้เพื่อนมาโหวตแล้ว! 🚀");
  }).catch(err => {
    console.error("Copy error:", err);
    alert("ก๊อปปี้ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  });
};

/*------------------google-----------*/
window.generateGoogleCalendarLink = function(title, date, time) {
  const [hours, minutes] = time.split(":");

  const start = new Date(date);
  start.setHours(hours);
  start.setMinutes(minutes);

  const end = new Date(start);
  end.setHours(start.getHours() + 1);

  const format = (d) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  return (
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    "&text=" + encodeURIComponent(title) +
    "&dates=" + format(start) + "/" + format(end) +
    "&details=Scheduled via GroupSync" +
    "&location=Online"
  );
}

window.copyGoogleLink = function(title, date, time) {
  const link = generateGoogleCalendarLink(title, date, time);

  navigator.clipboard.writeText(link).then(() => {
    alert("คัดลอกลิงก์ Google Calendar แล้ว!");
  });
}

window.copyShareMessage = async function(datetime) {

  const { data: meeting } = await supabase
    .from("rooms")
    .select("title")
    .eq("id", roomId)
    .single();

  if (!meeting) {
    alert("ไม่พบข้อมูลห้องประชุม");
    return;
  }

  const [date, time] = datetime.split(" ");

  const googleLink =
    window.generateGoogleCalendarLink(
      meeting.title,
      date,
      time
    );
  const currentPath = window.location.pathname;
  const basePath = path.substring(0, path.lastIndexOf('/'));
  const icsLink =
    `${window.location.origin}${basePath}/ics.html?id=${roomId}`;
    


  const message =
  `นัดหมาย

  🟢 คนใช้ Google Calendar:
  ${googleLink}

  🔵 คนใช้ Apple / Outlook / อื่น ๆ:
  ${icsLink}

  กดแล้วเพิ่มเข้าปฏิทินได้เลย`;

  try {
    await navigator.clipboard.writeText(message);
    alert("คัดลอกข้อความส่งเพื่อนแล้ว!");
  } catch (err) {
    console.error(err);
    alert("คัดลอกไม่สำเร็จ");
  }
};
