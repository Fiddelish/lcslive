const membershipForm = document.getElementById("membershipForm");
const planInputs = document.querySelectorAll('input[name="membership"]');
const planOptions = document.querySelectorAll(".plan-option");
const billingInputs = document.querySelectorAll('input[name="billingInterval"]');
const billingFrequencyGroup = document.getElementById("billingFrequencyGroup");
const guardianFields = document.getElementById("guardianFields");
const guardianInputs = guardianFields.querySelectorAll("input");
const birthDateInput = document.getElementById("birthDate");
const paymentStatus = document.getElementById("paymentStatus");
const checkoutButton = document.getElementById("checkoutButton");
const summaryPeriodNote = document.getElementById("summaryPeriodNote");
const startFee = 200;

const plans = {
  child: { name: "Barnmedlemskap", price: 3, period: "termin", recurring: false },
  youth: { name: "Ungdomsmedlemskap", price: 399, period: "månad", recurring: true },
  adult: { name: "Vuxenmedlemskap", price: 499, period: "månad", recurring: true }
};

function selectedPlanKey() {
  return membershipForm.elements.membership.value;
}

function selectedBillingInterval() {
  const plan = plans[selectedPlanKey()];
  if (!plan?.recurring) return "term";
  return membershipForm.elements.billingInterval.value || "monthly";
}

function billingPrice(plan, interval) {
  return interval === "quarterly" ? plan.price * 3 : plan.price;
}

function billingPeriodLabel(plan, interval) {
  if (!plan.recurring) return "termin";
  return interval === "quarterly" ? "kvartal" : "månad";
}

function updateSelectedPlan() {
  const planKey = selectedPlanKey();
  const plan = plans[planKey];
  const interval = selectedBillingInterval();

  planOptions.forEach((option) => {
    option.classList.toggle("selected", option.dataset.plan === planKey);
  });

  billingFrequencyGroup.hidden = !plan?.recurring;
  billingInputs.forEach((input) => {
    input.disabled = !plan?.recurring;
  });

  updateGuardianFields();

  const price = plan ? billingPrice(plan, interval) : 0;
  const currentStartFee = planKey === "child" ? 0 : startFee;
  const period = plan ? billingPeriodLabel(plan, interval) : "";
  document.getElementById("summaryPlan").textContent = plan?.name || "Välj medlemskap";
  document.getElementById("summaryPrice").textContent = plan
    ? `${price.toLocaleString("sv-SE")} kr/${period}`
    : "–";
  document.getElementById("summaryTotal").textContent = plan
    ? `${(price + currentStartFee).toLocaleString("sv-SE")} kr`
    : "–";
  document.getElementById("summaryStartFee").textContent = `${currentStartFee.toLocaleString("sv-SE")} kr`;
  summaryPeriodNote.textContent = plan?.recurring ? "Löpande medlemskap" : "Betalning per termin";
  document.getElementById("renewalPrice").textContent = plan
    ? plan.recurring
      ? `Därefter ${price.toLocaleString("sv-SE")} kr/${period}. Startavgiften betalas bara en gång.`
      : "Terminsavgiften betalas en gång per termin. Ingen startavgift tas ut för live-testet."
    : "";
  paymentStatus.textContent = "";
  paymentStatus.classList.remove("success");
}

function updateGuardianFields() {
  const planKey = selectedPlanKey();
  const age = birthDateInput.value ? ageFromBirthDate(birthDateInput.value) : null;
  const guardianRequired = planKey === "child" || (planKey === "youth" && (age === null || age < 18));

  guardianFields.hidden = !guardianRequired;
  guardianInputs.forEach((input) => {
    input.required = guardianRequired;
  });
}

function ageFromBirthDate(dateString) {
  const today = new Date();
  const birthDate = new Date(`${dateString}T00:00:00`);
  let age = today.getFullYear() - birthDate.getFullYear();
  const beforeBirthday = today.getMonth() < birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function validateMembershipAge() {
  const planKey = selectedPlanKey();
  const age = ageFromBirthDate(birthDateInput.value);
  birthDateInput.setCustomValidity("");

  if (planKey === "child" && (age < 8 || age > 12)) {
    birthDateInput.setCustomValidity("Barnmedlemskap gäller för barn mellan 8 och 12 år.");
  }

  if (planKey === "youth" && (age < 13 || age > 19)) {
    birthDateInput.setCustomValidity("Ungdomsmedlemskap gäller för ungdomar mellan 13 och 19 år.");
  }

  if (planKey === "adult" && age < 20) {
    birthDateInput.setCustomValidity("Vuxenmedlemskap gäller från 20 år.");
  }

  return birthDateInput.checkValidity();
}

function applicationPayload() {
  const values = new FormData(membershipForm);
  return {
    membership: values.get("membership"),
    billingInterval: selectedBillingInterval(),
    firstName: values.get("firstName"),
    lastName: values.get("lastName"),
    birthDate: values.get("birthDate"),
    personalNumber: values.get("personalNumber"),
    phone: values.get("phone"),
    email: values.get("email"),
    streetAddress: values.get("streetAddress"),
    postalCode: values.get("postalCode"),
    city: values.get("city"),
    accountPassword: values.get("accountPassword"),
    guardianName: values.get("guardianName") || null,
    guardianPhone: values.get("guardianPhone") || null,
    guardianEmail: values.get("guardianEmail") || null,
    emergencyName: values.get("emergencyName"),
    emergencyPhone: values.get("emergencyPhone"),
    termsAccepted: values.get("termsAccepted") === "on",
    healthConfirmed: values.get("healthConfirmed") === "on"
  };
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

  if (!data?.url) throw new Error("Checkout-URL saknas i svaret från Stripe.");
  return data;
}

async function createOrResumeMemberAccount(supabase, payload) {
  const signUpOptions = {
    emailRedirectTo: new URL("dashboard.html", window.location.href).href,
    data: {
      name: `${payload.firstName} ${payload.lastName}`,
      phone: payload.phone,
      birth_date: payload.birthDate,
      personal_number: payload.personalNumber,
      membership: plans[payload.membership].name,
      membership_key: payload.membership,
      billing_interval: payload.billingInterval,
      street_address: payload.streetAddress,
      postal_code: payload.postalCode,
      city: payload.city,
      guardian_name: payload.guardianName,
      guardian_phone: payload.guardianPhone,
      guardian_email: payload.guardianEmail,
      emergency_name: payload.emergencyName,
      emergency_phone: payload.emergencyPhone,
      terms_accepted: payload.termsAccepted,
      health_confirmed: payload.healthConfirmed
    }
  };

  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.accountPassword,
    options: signUpOptions
  });

  if (!error) return data;

  const canResumeExistingAccount = /email rate limit|rate limit.*email|already registered|already exists/i.test(
    error.message || ""
  );
  if (!canResumeExistingAccount) throw error;

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: payload.email,
    password: payload.accountPassword
  });

  if (!signInError && signInData.user) return signInData;
  if (/email not confirmed/i.test(signInError?.message || "")) {
    throw new Error(
      "Kontot finns redan men e-postadressen är inte bekräftad. Öppna det första bekräftelsemejlet från Supabase och försök sedan igen."
    );
  }
  if (/email rate limit|rate limit.*email/i.test(error.message || "")) {
    throw new Error(
      "Supabase har nått gränsen för bekräftelsemejl. Bekräfta det första mejlet om kontot redan skapats, eller försök igen senare."
    );
  }

  throw new Error("Kontot finns redan. Kontrollera lösenordet eller logga in från medlemssidan.");
}

planInputs.forEach((input) => input.addEventListener("change", updateSelectedPlan));
billingInputs.forEach((input) => input.addEventListener("change", updateSelectedPlan));
birthDateInput.addEventListener("change", () => {
  validateMembershipAge();
  updateGuardianFields();
});
birthDateInput.max = new Date().toISOString().slice(0, 10);

const requestedPlan = new URLSearchParams(window.location.search).get("plan");
const initialPlan = plans[requestedPlan] ? requestedPlan : "adult";
document.querySelector(`input[name="membership"][value="${initialPlan}"]`).checked = true;
updateSelectedPlan();

membershipForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  validateMembershipAge();

  if (!membershipForm.checkValidity()) {
    membershipForm.reportValidity();
    paymentStatus.textContent = "Kontrollera de markerade fälten innan du fortsätter.";
    return;
  }

  const payload = applicationPayload();

  if (!window.LCS_SUPABASE || !window.LCS_SUPABASE.isConnected()) {
    paymentStatus.textContent = "Medlemsansökan kan inte skickas eftersom Supabase inte är anslutet.";
    return;
  }

  checkoutButton.disabled = true;
  checkoutButton.textContent = "Skapar medlemskonto ...";

  try {
    const supabase = window.LCS_SUPABASE.getClient();
    const data = await createOrResumeMemberAccount(supabase, payload);
    if (!data.user?.id) throw new Error("Medlemskontot kunde inte identifieras.");

    sessionStorage.setItem("lcsMemberEmail", payload.email);
    checkoutButton.textContent = "Förbereder säker betalning ...";
    paymentStatus.textContent = "";

    const checkout = await invokeStripeFunction({
      action: "create_checkout",
      requestId: crypto.randomUUID(),
      userId: data.user.id,
      email: payload.email,
      membership: payload.membership,
      billingInterval: payload.billingInterval,
      returnTo: data.session ? "dashboard" : "login"
    });

    window.location.assign(checkout.url);
  } catch (error) {
    console.error("Medlemskonto eller Stripe Checkout kunde inte startas:", error);
    paymentStatus.textContent = `Det gick inte att starta betalningen: ${error.message}`;
    paymentStatus.classList.remove("success");
    checkoutButton.disabled = false;
    checkoutButton.textContent = "Fortsätt till säker betalning";
  }
});
