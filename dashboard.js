// --- หน้า dashboard.html (My Meetings) ---
async function loadMyMeetings() {
    try {
        const { data: rooms, error } = await supabase
            .from('rooms')
            .select('*');

        if (error) throw error;

        const container = document.getElementById('meetingsContainer');
        if (rooms.length === 0) {
            // แสดงสถานะ No meetings yet
            container.innerHTML = `<p>No meetings yet. Create one to get started!</p>`;
        } else {
            // วนลูปสร้าง Card ตามข้อมูลจริง (Realistic Data)
            container.innerHTML = rooms.map(room => `
                <div class="meeting-card">
                    <h3>${room.meeting_name} <span class="badge">Active</span></h3>
                    <p>${room.start_date} - ${room.end_date}</p>
                    <button onclick="location.href='results.html?id=${room.id}'">View Results</button>
                    <button onclick="location.href='vote.html?id=${room.id}'">Add Availability</button>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error("Error loading meetings:", err.message);
    }
}