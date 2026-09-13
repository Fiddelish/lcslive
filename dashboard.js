const userEmail = document.getElementById("userEmail");
const membershipType = document.getElementById("membershipType");
const membershipState = document.getElementById("membershipState");
const paymentStatus = document.getElementById("paymentStatus");
const logoutButton = document.getElementById("logoutBtn");
const dashboardClassesList = document.getElementById("dashboardClassesList");
const classRegistrationStatus = document.getElementById("classRegistrationStatus");
const paymentHistoryList = document.getElementById("paymentHistoryList");
const membershipRequestsList = document.getElementById("membershipRequestsList");
const membershipRequestStatus = document.getElementById("membershipRequestStatus");
const renewMembershipButton = document.getElementById("renewMembershipBtn");
const cancelMembershipButton = document.getElementById("cancelMembershipBtn");
let currentUserId = null;
let currentMemberId = null;
let currentMember = null;
let registrations = new Set();

const dayNumbers = {
  "Söndag": 0,
  "Måndag": 1,
  "Tisdag": 2,
  "Onsdag": 3,
  "Torsdag": 4,
  "Fredag": 5,
  "Lördag": 6
};

function nextClassDate(day) {
  const date = new Date();
  const daysUntilClass = (dayNumbers[day] - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + daysUntilClass);
  return date.toISOString().slice(0, 10);
}

function renderPaymentHistory(payments) {
  paymentHistoryList.replaceChildren();
  if (!payments.length) {
    const item = document.createElement("li");
    item.textContent = "Inga betalningar registrerade ännu.";
    paymentHistoryList.appendChild(item);
    return;
  }

  payments.forEach((payment) => {
    const item = document.createElement("li");
    const amount = Number(payment.amount).toLocaleString("sv-SE");
    item.textContent = `${payment.payment_date}: ${amount} kr - ${payment.status}`;
    paymentHistoryList.appendChild(item);
  });
}

async function loadMembershipRequests() {
  const supabase = window.LCS_SUPABASE.getClient();
  const { data, error } = await supabase
    .from("membership_requests")
    .select("request_type, status, created_at")
    .eq("member_id", currentMemberId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  membershipRequestsList.replaceChildren();
  if (!data?.length) {
    const item = document.createElement("li");
    item.textContent = "Inga medlemsärenden inskickade.";
    membershipRequestsList.appendChild(item);
    return;
  }

  data.forEach((request) => {
    const item = document.createElement("li");
    const date = new Intl.DateTimeFormat("sv-SE").format(new Date(request.created_at));
    item.textContent = `${request.request_type} - ${request.status} (${date})`;
    membershipRequestsList.appendChild(item);
  });
}

async function invokeStripeFunction(body) {
  const supabase = window.LCS_SUPABASE.getClient();
  const functionName = window.LCS_CONFIG?.stripeFunctionName || "stripe-payments";
  const { data, error } = await supabase.functions.invoke(functionName, { body });

  if (error) {
    let message = error.message || "Stripe-funktionen svarade med ett fel.";
    if (error.context instanceof Response) {
      try {
        const details = await error.context.json();
        message = details.error || message;
      } catch {
        // Behåll standardmeddelandet om svaret inte är JSON.
      }
    }
    if (/Failed to send a request to the Edge Function|FunctionsFetchError/i.test(message)) {
      message = "Stripe-betalningen är inte aktiverad i Supabase ännu. Kontakta klubben eller försök igen senare.";
    }
    throw new Error(message);
  }

  return data;
}

async function startSubscriptionCheckout() {
  if (!currentMemberId) return;

  try {
    renewMembershipButton.disabled = true;
    membershipRequestStatus.textContent = "Öppnar säker betalning ...";
    membershipRequestStatus.classList.remove("success");

    const result = await invokeStripeFunction({
      action: "create_checkout",
      requestId: crypto.randomUUID(),
      membership: currentMember?.membership_key,
      billingInterval: currentMember?.billing_interval,
      returnTo: "dashboard"
    });

    if (!result?.url) throw new Error("Checkout-URL saknas.");
    window.location.assign(result.url);
  } catch (error) {
    console.error("Stripe Checkout kunde inte startas:", error);
    membershipRequestStatus.textContent = `Betalningen kunde inte startas: ${error.message}`;
    membershipRequestStatus.classList.remove("success");
    renewMembershipButton.disabled = false;
  }
}

async function submitCancellationRequest() {
  if (!currentMemberId || !window.confirm(
    "Vill du säga upp medlemskapet? Stripe schemalägger avslutet tre månader från idag och betalningar fortsätter under uppsägningstiden."
  )) return;

  cancelMembershipButton.disabled = true;
  membershipRequestStatus.textContent = "Schemalägger uppsägningen hos Stripe ...";
  membershipRequestStatus.classList.remove("success");

  try {
    const result = await invokeStripeFunction({ action: "schedule_cancellation" });
    const endDate = new Intl.DateTimeFormat("sv-SE").format(new Date(result.cancelAt));
    membershipRequestStatus.textContent = `Uppsägningen är registrerad. Medlemskapet avslutas ${endDate}.`;
    membershipRequestStatus.classList.add("success");
    await loadMembershipRequests();
    await loadMembershipData();
  } catch (error) {
    console.error("Kunde inte schemalägga uppsägningen:", error);
    membershipRequestStatus.textContent = `Kunde inte registrera uppsägningen: ${error.message}`;
    membershipRequestStatus.classList.remove("success");
    cancelMembershipButton.disabled = false;
  }
}

async function loadRegistrations() {
  const supabase = window.LCS_SUPABASE.getClient();
  const { data, error } = await supabase
    .from("class_registrations")
    .select("training_class_id, class_date")
    .eq("member_id", currentMemberId)
    .gte("class_date", new Date().toISOString().slice(0, 10));

  if (error) throw error;
  registrations = new Set((data || []).map((registration) => `${registration.training_class_id}:${registration.class_date}`));
}

async function toggleClassRegistration(trainingClass) {
  const supabase = window.LCS_SUPABASE.getClient();
  const classDate = nextClassDate(trainingClass.day);
  const registrationKey = `${trainingClass.id}:${classDate}`;
  const isRegistered = registrations.has(registrationKey);

  try {
    if (isRegistered) {
      const { error } = await supabase
        .from("class_registrations")
        .delete()
        .eq("training_class_id", trainingClass.id)
        .eq("member_id", currentMemberId)
        .eq("class_date", classDate);
      if (error) throw error;
      registrations.delete(registrationKey);
      classRegistrationStatus.textContent = "Din anmälan är avbokad.";
    } else {
      const { error } = await supabase.from("class_registrations").insert([{
        training_class_id: trainingClass.id,
        member_id: currentMemberId,
        class_date: classDate
      }]);
      if (error) throw error;
      registrations.add(registrationKey);
      classRegistrationStatus.textContent = `Du är anmäld till ${trainingClass.name} ${classDate}.`;
    }
    classRegistrationStatus.classList.add("success");
    renderDashboardClasses();
  } catch (error) {
    console.error("Kunde inte uppdatera passanmälan:", error);
    classRegistrationStatus.textContent = `Fel: ${error.message}`;
    classRegistrationStatus.classList.remove("success");
  }
}

async function loadMembershipData() {
  if (!window.LCS_SUPABASE || !window.LCS_SUPABASE.isConnected()) {
    window.location.replace("login.html");
    return;
  }

  const supabase = window.LCS_SUPABASE.getClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      window.location.replace("login.html");
      return;
    }

    currentUserId = user.id;
    userEmail.textContent = user.email;

    const { data: memberData, error: memberError } = await supabase
      .from("members")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (memberError && memberError.code !== "PGRST116") {
      console.error("Fel vid hämtning av medlemsdata:", memberError);
    }

    if (memberData) {
      currentMemberId = memberData.id;
      currentMember = memberData;
      membershipType.textContent = memberData.membership || "Ingen medlemskap";
      const intervalLabels = {
        monthly: "månadsvis betalning",
        quarterly: "kvartalsvis betalning",
        term: "betalning per termin"
      };
      const stateParts = [
        memberData.status || "Status saknas",
        intervalLabels[memberData.billing_interval]
      ].filter(Boolean);
      if (memberData.cancellation_effective_at) {
        const cancelDate = new Intl.DateTimeFormat("sv-SE").format(new Date(memberData.cancellation_effective_at));
        stateParts.push(`avslutas ${cancelDate}`);
      }
      membershipState.textContent = stateParts.join(" • ");

      const hasSubscription = Boolean(memberData.stripe_subscription_id);
      const cancellationScheduled = Boolean(memberData.cancellation_effective_at);
      renewMembershipButton.disabled = hasSubscription || cancellationScheduled;
      renewMembershipButton.textContent = hasSubscription
        ? "Medlemskapet förnyas automatiskt"
        : "Teckna eller förläng via Stripe";
      cancelMembershipButton.disabled = !hasSubscription || cancellationScheduled;
    } else {
      currentMemberId = null;
      currentMember = null;
      membershipType.textContent = "Ingen medlemskap registrerad";
      membershipState.textContent = "";
      renewMembershipButton.disabled = true;
      cancelMembershipButton.disabled = true;
    }

    // Hämta betalningsstatus
    if (memberData) {
      const { data: paymentData } = await supabase
        .from("payments")
        .select("*")
        .eq("member_id", memberData.id)
        .order("payment_date", { ascending: false });

      if (paymentData && paymentData.length > 0) {
        paymentStatus.textContent = `Senaste betalning: ${paymentData[0].payment_date} (${paymentData[0].status})`;
      } else {
        paymentStatus.textContent = "Ingen betalning registrerad";
      }
      renderPaymentHistory(paymentData || []);
      await loadMembershipRequests();
    }
    
    if (currentMemberId) {
      await loadRegistrations();
      renderDashboardClasses();
    }
  } catch (error) {
    console.error("Fel vid hämtning av medlemsdata:", error);
    membershipType.textContent = "Kunde inte hämta medlemsdata";
  }
}

function renderDashboardClasses(classes = window.LCSSchedule.getActive()) {
  dashboardClassesList.replaceChildren();

  if (classes.length === 0) {
    const item = document.createElement("li");
    item.textContent = "Inga aktiva träningspass är publicerade just nu.";
    dashboardClassesList.appendChild(item);
    return;
  }

  classes.forEach((trainingClass) => {
    const item = document.createElement("li");
    const coach = trainingClass.coach ? ` • Coach: ${trainingClass.coach}` : "";
    const details = document.createElement("span");
    details.textContent = `${trainingClass.name} – ${trainingClass.day} ${trainingClass.time}${coach}`;
    const button = document.createElement("button");
    const isRegistered = registrations.has(`${trainingClass.id}:${nextClassDate(trainingClass.day)}`);
    button.type = "button";
    button.className = "admin-secondary-btn";
    button.textContent = isRegistered ? "Avboka" : "Anmäl";
    button.disabled = !currentMemberId;
    button.addEventListener("click", () => toggleClassRegistration(trainingClass));
    item.append(details, button);
    dashboardClassesList.appendChild(item);
  });
}

renderDashboardClasses();
window.LCSSchedule.subscribe(renderDashboardClasses);
renewMembershipButton.addEventListener("click", startSubscriptionCheckout);
cancelMembershipButton.addEventListener("click", submitCancellationRequest);
renewMembershipButton.disabled = true;
cancelMembershipButton.disabled = true;

const checkoutResult = new URLSearchParams(window.location.search).get("checkout");
if (checkoutResult === "success") {
  membershipRequestStatus.textContent = "Betalningen är mottagen. Medlemsstatusen uppdateras strax.";
  membershipRequestStatus.classList.add("success");
} else if (checkoutResult === "cancelled") {
  membershipRequestStatus.textContent = "Betalningen avbröts. Inga pengar har dragits.";
  membershipRequestStatus.classList.remove("success");
}

// Ladda medlemsdata från Supabase
loadMembershipData();

logoutButton.addEventListener("click", async () => {
  if (window.LCS_SUPABASE && window.LCS_SUPABASE.isConnected()) {
    try {
      const supabase = window.LCS_SUPABASE.getClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Fel vid utloggning:", error);
    }
  }
  
  sessionStorage.removeItem("lcsMemberEmail");
  window.location.href = "login.html";
});
