import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://kqdjyqmdmmjdyfrooobs.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZGp5cW1kbW1qZHlmcm9vb2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NTkwMzIsImV4cCI6MjA4NjAzNTAzMn0.vIBOf5pxcs7FINIPVxx-C0BDnB-evINt40_E1imjm9M';


// สร้างตัวเชื่อมต่อและส่งออกไปให้ไฟล์อื่นใช้
export const supabase = createClient(supabaseUrl, supabaseKey)