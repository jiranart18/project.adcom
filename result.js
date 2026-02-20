import { supabase } from './supabase-config.js';

const params = new URLSearchParams(window.location.search);
const roomId = params.get('id');

if (roomId) {
    document.getElementById('roomDisplay').innerText = roomId;
}

// 1. ฟังก์ชันดึงรายชื่อคนที่โหวตแล้วจาก Database
async function fetchParticipants() {
    try {
        const { data, error } = await supabase
            .from('votes')
            .select('user_name')
            .eq('meeting_id', roomId);

        if (error) throw error;

        displayParticipants(data);
    } catch (err) {
        console.error("Error fetching data:", err.message);
    }
}

// 2. ฟังก์ชันแสดงรายชื่อบนหน้าจอ
function displayParticipants(votes) {
    const listContainer = document.getElementById('participantList');
    const countDisplay = document.getElementById('participantCount');

    // แสดงจำนวนคน
    countDisplay.innerText = votes.length;

    // สร้างป้ายชื่อเพื่อน 
    listContainer.innerHTML = votes.map(v => `
        <div class="participant-badge">
            ${v.participant_name}
        </div>
    `).join('');
}

// 3. ระบบ Real-time (หัวใจของอาทิตย์ที่ 3)
// เมื่อมีคนกด Submit ปุ๊บ ชื่อจะโผล่ในหน้านี้ปั๊บโดยไม่ต้อง Refresh
const voteChannel = supabase
    .channel('custom-filter-channel')
    .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes', filter: `room_id=eq.${roomId}` },
        (payload) => {
            console.log('New vote received!', payload.new);
            fetchParticipants(); // โหลดรายชื่อใหม่เมื่อมีการ Insert ข้อมูล
        }
    )
    .subscribe();

// 4. โหลดข้อมูลครั้งแรกเมื่อเปิดหน้า
if (roomId) {
    fetchParticipants();
}

// ปุ่ม Refresh เผื่อผู้ใช้ต้องการกดเอง
document.getElementById('btnRefresh').onclick = fetchParticipants;