// --- ส่วนของหน้า index.html ---
const btnCreate = document.getElementById('btnCreate');
if (btnCreate) {
btnCreate.onclick = function() {
const mockId = "ROOM123";
window.location.href = "vote.html?id=" + mockId;
};
}

// --- ส่วนของหน้า vote.html ---
const params = new URLSearchParams(window.location.search);
const id = params.get('id');
const roomDisplay = document.getElementById('roomName');

if (id && roomDisplay) {
roomDisplay.innerText = id;
}

// ส่วนที่ทำให้ไฟล์ลงคอม
const btnDownload = document.getElementById('btnDownload');
if (btnDownload) {
    btnDownload.onclick = function() {
        try {
            var cal = ics();
            cal.addEvent("นัดทำโปรเจกต์", "มาเจอกันนะ", "ตึกคอม", "2026-02-10 10:00", "2026-02-10 12:00");
            cal.download("my-plan");
            alert("กำลังดาวน์โหลดไฟล์...");
        } catch (error) {
            console.error(error);
            alert("เกิดข้อผิดพลาด: " + e.message);
        }
    };
}
