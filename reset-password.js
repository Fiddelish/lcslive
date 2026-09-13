const resetForm = document.getElementById("resetForm");
const resetStatus = document.getElementById("resetStatus");
const resetIntro = document.getElementById("resetIntro");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const savePasswordBtn = document.getElementById("savePasswordBtn");

function showStatus(message, success = false) {
  resetStatus.textContent = message;
  resetStatus.classList.toggle("success", success);
}

function showResetForm() {
  if (!resetForm.hidden) return;
  resetIntro.textContent = "Länken är giltig. Välj ett nytt lösenord nedan.";
  resetForm.hidden = false;
  newPasswordInput.focus();
}

async function initPasswordReset() {
  if (!window.LCS_SUPABASE || !window.LCS_SUPABASE.isConnected()) {
    resetIntro.textContent = "Lösenordsåterställning är inte tillgänglig just nu. Försök igen senare.";
    return;
  }

  const supabase = window.LCS_SUPABASE.getClient();

  // Supabase skickar PASSWORD_RECOVERY när användaren landar via länken i mailet
  supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      showResetForm();
    }
  });

  // Om recovery-sessionen redan är etablerad när sidan laddas
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showResetForm();
    return;
  }

  // Ge Supabase en kort stund att tolka token i URL:en innan vi ger upp
  setTimeout(async () => {
    if (resetForm.hidden) {
      const { data: { session: retrySession } } = await supabase.auth.getSession();
      if (retrySession) {
        showResetForm();
      } else {
        resetIntro.textContent = "Länken är ogiltig eller har gått ut. Gå till inloggningssidan och be om en ny återställningslänk.";
      }
    }
  }, 2500);
}

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (newPassword !== confirmPassword) {
    showStatus("Lösenorden matchar inte. Försök igen.");
    return;
  }

  const supabase = window.LCS_SUPABASE.getClient();
  savePasswordBtn.disabled = true;
  savePasswordBtn.textContent = "Sparar ...";

  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;

    showStatus("Lösenordet är uppdaterat! Omdirigerar till inloggningen ...", true);
    resetForm.hidden = true;
    setTimeout(() => {
      window.location.replace("login.html");
    }, 2000);
  } catch (error) {
    console.error("Kunde inte uppdatera lösenordet:", error);
    showStatus(`Fel: ${error.message}`);
    savePasswordBtn.disabled = false;
    savePasswordBtn.textContent = "Spara nytt lösenord";
  }
});

initPasswordReset();
