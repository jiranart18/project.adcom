import { supabase } from './supabase-config.js';

// 1. รับ ID จาก URL
const params = new URLSearchParams(window.location.search);
const roomId = params.get('id');

// 2. เริ่มต้นหน้าเว็บ
async function initVotingPage() {
  if (!roomId) {
    alert("ไม่พบรหัสห้องประชุม");
    return;
  }

  // ดึงข้อมูลการนัดหมายจาก Supabase
  const { data: meeting, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', roomId)
    .single();

  if (error || !meeting) {
    console.error("Error fetching meeting:", error);
    document.getElementById('roomNameDisplay').innerText =
      "ไม่พบข้อมูลห้องประชุม";
    return;
  }

  // 3. แสดงชื่อห้องจริงแทน ID
  document.getElementById(
    'roomNameDisplay'
  ).innerText = `คุณกำลังอยู่ในห้อง: ${meeting.title}`;

  // 4. สร้างรายการวันที่ (Logic: วนลูปจาก Start Date ถึง End Date)
  const startDate = new Date(meeting.dates.start);
  const endDate = new Date(meeting.dates.end);
  const dateList = [];

  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    dateList.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 5. สั่งวาดตาราง
  renderGrid(dateList);
}

// ฟังก์ชันวาดตาราง HTML
function renderGrid(dateList) {
  const tableHeader = document.getElementById('tableHeader');
  const tableBody = document.getElementById('tableBody');

  tableHeader.innerHTML =  '';
  tableBody.innerHTML = '';

  // กำหนดช่วงเวลา (แก้ไขเพิ่ม/ลดได้ตรงนี้)
  const timeSlots = [
    "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00",
    "17:00", "18:00"
  ];

  // วาดหัวตาราง (วันที่)
  let headerHTML = '<th>เวลา</th>';

  dateList.forEach(date => {
    const dStr = date.toLocaleDateString('th-TH', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
    });

    headerHTML += `<th>${dStr}</th>`;
  });

  tableHeader.innerHTML = headerHTML;

  // วาดแถวเวลาและช่องโหวต
  let bodyHTML = '';

  timeSlots.forEach(time => {
    bodyHTML += `<tr><td class="time-label">${time}</td>`;

    dateList.forEach(date => {
      const dateISO = date.toISOString().split('T')[0];

      // สร้างช่องโหวตพร้อมเก็บข้อมูลเวลาและวันที่ไว้ใน Dataset
      bodyHTML += `
        <td class="vote-cell state-0"
            data-state="0"
            data-time="${time}"
            data-date="${dateISO}">
        </td>
      `;
    });

    bodyHTML += '</tr>';
  });

  tableBody.innerHTML = bodyHTML;

  // เมื่อวาดเสร็จ ให้เปิดใช้งานระบบคลิกเปลี่ยนสี
  attachVotingLogic();
}

// ฟังก์ชันเปลี่ยนสีเมื่อคลิก (Logic 0 -> 1 -> 2)
function attachVotingLogic() {
  const cells = document.querySelectorAll('.vote-cell');

  cells.forEach(cell => {
    cell.addEventListener('click', () => {
      let currentState = parseInt(cell.getAttribute('data-state'));
      let nextState = (currentState + 1) % 3;

      cell.setAttribute('data-state', nextState);
      cell.className = `vote-cell state-${nextState}`;

      // ปรับสีด่วนด้วย JS (เพื่อให้เห็นผลทันทีแม้ CSS ยังไม่โหลด)
      const colors = [
        "#ffffff", // ขาว
        "#006400", // เขียวเข้ม
        "#90EE90"  // เขียวอ่อน
      ];

      cell.style.backgroundColor = colors[nextState];
    });
  });
}

// รันฟังก์ชันหลัก
initVotingPage();

function copyInviteLink() {
  // ดึง URL ปัจจุบันของหน้านี้ (ที่มี ?id=... ติดมาด้วย)
  const currentUrl = window.location.href;

  // ใช้คำสั่งก๊อปปี้ลง Clipboard
  navigator.clipboard
    .writeText(currentUrl)
    .then(() => {
      alert("ก๊อปปี้ลิงก์เชิญเพื่อนแล้ว! ส่งให้เพื่อนโหวตได้เลย");
    })
    .catch(err => {
      console.error("Error in copying: ", err);
    });
}

// ผูกฟังก์ชันกับปุ่ม (ถ้าคุณมีปุ่ม Share ใน HTML)
const btnShare = document.getElementById("btnShare");

if (btnShare) {
  btnShare.onclick = copyInviteLink;
}

async function submitAvailability() {
  const nameInput = document.getElementById("nickname"); // ตรวจสอบ ID ช่องกรอกชื่อใน HTML
  const userName = nameInput ? nameInput.value.trim() : "";

  // 1. ตรวจสอบว่ากรอกชื่อหรือยัง
  if (!userName) {
    alert("กรุณากรอกชื่อของคุณก่อนบันทึก");
    return;
  }

  // 2. รวบรวมข้อมูลการโหวตจากตาราง
  const voteData = {};
  const cells = document.querySelectorAll(".vote-cell");

  cells.forEach(cell => {
    const time = cell.getAttribute("data-time");
    const date = cell.getAttribute("data-date");
    const state = parseInt(cell.getAttribute("data-state"));

    // เก็บข้อมูลในรูปแบบ:
    // { "2026-02-20": { "09:00": 1, "10:00": 2 }, ... }
    if (!voteData[date]) {
      voteData[date] = {};
    }

    voteData[date][time] = state;
  });

  try {
    // 3. ส่งข้อมูลไปที่ตาราง 'votes' ใน Supabase
    const { data, error } = await supabase
      .from("votes")
      .insert([
        {
          meeting_id: roomId,   // ID ของห้องประชุมจาก URL
          user_name: userName,  // ชื่อคนโหวต
          vote_data: voteData   // ก้อนข้อมูลการโหวตแบบ JSON
        }
      ])
      .select();

    if (error) throw error;

    // 4. เมื่อบันทึกสำเร็จ ให้ไปหน้าแสดงผลลัพธ์
    alert("บันทึกข้อมูลเรียบร้อยแล้ว!");
    window.location.href = `results.html?id=${roomId}`;

  } catch (err) {
    console.error("Error submitting vote:", err.message);
    alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + err.message);
  }
}

// 5. ผูกฟังก์ชันกับปุ่ม Submit ในหน้า HTML
const btnSubmit = document.getElementById("btnSubmit"); // ตรวจสอบ ID ปุ่มใน HTML

if (btnSubmit) {
  btnSubmit.onclick = submitAvailability;
}