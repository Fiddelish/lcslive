const trialForm = document.getElementById("trialForm");
const trialStatus = document.getElementById("trialStatus");

trialForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();

  // Kolla om Supabase är ansluten
  if (!window.LCS_SUPABASE || !window.LCS_SUPABASE.isConnected()) {
    trialStatus.textContent = "Formuläret är korrekt ifyllt, men inget har skickats eftersom Supabase inte är anslutet ännu.";
    trialStatus.classList.remove("success");
    return;
  }

  try {
    const supabase = window.LCS_SUPABASE.getClient();

    const { error } = await supabase.from("trial_requests").insert([{
      name,
      phone,
      email
    }]);

    if (error) throw error;

    trialStatus.textContent = "Tack! Vi kontaktar dig snart.";
    trialStatus.classList.add("success");
    trialForm.reset();
  } catch (error) {
    console.error("Fel vid sparande av prövningsansökan:", error);
    trialStatus.textContent = `Fel: ${error.message}`;
    trialStatus.classList.remove("success");
  }
});
