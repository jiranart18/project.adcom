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

  const { data: meeting } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  const { data: votes } = await supabase
    .from("votes")
    .select("user_name, vote_data")
    .eq("meeting_id", roomId);

  displayParticipants(votes || []);

  // ถ้า finalize แล้ว
  if (meeting.status === "finalized" && meeting.selected_time) {
    renderFinalized(meeting.selected_time);
    return;
  }

  // ถ้ายัง voting
  if (!votes || votes.length === 0) {
    bestTimeContainer.innerHTML = "<p>ยังไม่มีการโหวต</p>";
    return;
  }

  const creator = await isCreator();

  if (creator) {
    calculateTop3(votes, meeting.type);
  } else {
    bestTimeContainer.innerHTML =
      "<p>รอผู้สร้างเลือกเวลานัดหมาย...</p>";
  }
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
    ${top3.map(([datetime, score], index) => `
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

  await supabase
    .from("rooms")
    .update({
      selected_time: datetime,
      status: "finalized"
    })
    .eq("id", roomId);

  loadResults();
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

  const icsLink =
    `${window.location.origin}/ics.html?id=${roomId}`;

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