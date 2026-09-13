const loginForm = document.getElementById("loginForm");
const authStatus = document.getElementById("authStatus");
const resetPasswordButton = document.getElementById("resetPassword");

if (authStatus && new URLSearchParams(window.location.search).get("checkout") === "success") {
  authStatus.textContent = "Betalningen är mottagen. Bekräfta din e-post om det behövs och logga sedan in.";
  authStatus.classList.add("success");
}

if (loginForm && authStatus) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!window.LCS_SUPABASE || !window.LCS_SUPABASE.isConnected()) {
      authStatus.textContent = "Inloggning är tillfälligt otillgänglig. Kontrollera Supabase-anslutningen.";
      authStatus.classList.remove("success");
      return;
    }

    const supabase = window.LCS_SUPABASE.getClient();

    try {
      authStatus.textContent = "Loggar in ...";
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        authStatus.textContent = `Logga in misslyckades: ${error.message}`;
        authStatus.classList.remove("success");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      const requestedDestination = sessionStorage.getItem("lcsPostLoginDestination");
      const destination = profile?.role === "admin"
        ? requestedDestination || "admin.html"
        : "dashboard.html";

      sessionStorage.removeItem("lcsPostLoginDestination");
      authStatus.textContent = "Inloggad! Omdirigerar ...";
      authStatus.classList.add("success");
      setTimeout(() => {
        window.location.href = destination;
      }, 500);
    } catch (error) {
      authStatus.textContent = `Fel: ${error.message}`;
      authStatus.classList.remove("success");
    }
  });
}

if (resetPasswordButton && authStatus) {
  resetPasswordButton.addEventListener("click", async () => {
    const email = document.getElementById("email").value.trim();
    
    if (!email) {
      authStatus.textContent = "Ange din e-postadress först.";
      return;
    }

    if (!window.LCS_SUPABASE || !window.LCS_SUPABASE.isConnected()) {
      authStatus.textContent = "Lösenordsåterställning är inte tillgänglig i demoläge.";
      authStatus.classList.remove("success");
      return;
    }

    try {
      const supabase = window.LCS_SUPABASE.getClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL("reset-password.html", window.location.href).href
      });

      if (error) {
        authStatus.textContent = `Fel: ${error.message}`;
        authStatus.classList.remove("success");
        return;
      }

      authStatus.textContent = "Länk för lösenordsåterställning skickad till din e-post.";
      authStatus.classList.add("success");
    } catch (error) {
      authStatus.textContent = `Fel: ${error.message}`;
      authStatus.classList.remove("success");
    }
  });
}

