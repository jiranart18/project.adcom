import { supabase } from './supabase-config.js';

// เช็คว่าล็อกอินอยู่แล้วไหม
const { data } = await supabase.auth.getSession();

// --------------------
// Login
// --------------------
const btnLogin = document.getElementById("btnLogin");

btnLogin.addEventListener("click", async () => {

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Please fill in all fields");
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert("Login failed: " + error.message);
  } else {
    window.location.href = "dashboard.html";
  }
});

// --------------------
// Sign Up
// --------------------
const btnSignup = document.getElementById("btnSignup");

btnSignup.addEventListener("click", async () => {

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  console.log("EMAIL:", email);

  if (!email || !password) {
    alert("Please fill in all fields");
    return;
  }

  const { error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    alert("Signup failed: " + error.message);
  } else {
    alert("Signup successful! You can now login.");
  }
});