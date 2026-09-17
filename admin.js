// Supabase-klient (från supabase-init.js)
(() => {

let supabase = null;

function initSupabase() {
  if (!window.LCS_SUPABASE || !window.LCS_SUPABASE.isConnected()) {
    console.warn("Supabase är inte initialiserat. Använd setupSupabaseKeys() för att ansluta.");
    return false;
  }
  supabase = window.LCS_SUPABASE.getClient();
  return true;
}

async function requireAdmin() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    sessionStorage.setItem("lcsPostLoginDestination", "admin.html");
    window.location.replace("login.html");
    return false;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    await supabase.auth.signOut();
    sessionStorage.setItem("lcsPostLoginDestination", "admin.html");
    window.location.replace("login.html");
    return false;
  }

  document.getElementById("adminUserEmail").textContent = user.email;
  return true;
}

// Data-state
let members = [];
let classes = [];
let membershipTypes = ["Barn", "Ungdom", "Vuxen"];
let demoPayments = []; // Fallback för demo
let trialRequests = [];
let membershipRequests = [];
let participantRegistrations = [];
let selectedClass = null;
let selectedClassDate = null;

const dayNumbers = {
  "Söndag": 0,
  "Måndag": 1,
  "Tisdag": 2,
  "Onsdag": 3,
  "Torsdag": 4,
  "Fredag": 5,
  "Lördag": 6
};
const dayNames = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];

function toLocalDateValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function nextClassDate(day) {
  const date = new Date();
  date.setDate(date.getDate() + (dayNumbers[day] - date.getDay() + 7) % 7);
  return toLocalDateValue(date);
}

function classDateFor(trainingClass) {
  return trainingClass.class_date || nextClassDate(trainingClass.day);
}

function dayForDate(dateValue) {
  return dayNames[new Date(`${dateValue}T12:00:00`).getDay()];
}

function formatClassDate(dateValue) {
  if (!dateValue) return "–";
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(`${dateValue}T12:00:00`));
}

function defaultEndTime(startTime) {
  const [hours, minutes] = String(startTime || "18:00").split(":").map(Number);
  const endMinutes = hours * 60 + minutes + 60;
  return `${String(Math.floor(endMinutes / 60) % 24).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
}

function classTimeRange(trainingClass) {
  return trainingClass.end_time
    ? `${trainingClass.time}–${trainingClass.end_time}`
    : trainingClass.time;
}

function showConnectionStatus() {
  const status = document.getElementById("adminStatus");
  const banner = document.getElementById("demoBanner");
  
  if (supabase) {
    if (banner) banner.textContent = "✅ Supabase är ansluten. All data sparas automatiskt.";
    if (banner) banner.style.backgroundColor = "#d4af3730";
  } else {
    if (banner) banner.textContent = "⚠️ Supabase är inte ansluten. Ändringar sparas bara lokalt i denna webbläsare.";
    status.innerHTML = '⚠️ Supabase är inte ansluten. <a href="#" id="setupSupabaseLink">Ställ in nycklar här</a>';
    const link = document.getElementById("setupSupabaseLink");
    if (link) {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        if (window.LCS_SUPABASE.setupKeys()) {
          location.reload();
        }
      });
    }
  }
}

function showAdminStatus(message, success = false) {
  const status = document.getElementById("adminStatus");
  status.textContent = message;
  status.classList.toggle("success", success);
}

const navItems = document.querySelectorAll(".admin-nav-item");
const views = document.querySelectorAll(".admin-view");

navItems.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.view;
    navItems.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    views.forEach((view) => view.classList.toggle("active", view.id === `view-${target}`));
  });
});

function appendCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value ?? "–";
  row.appendChild(cell);
  return cell;
}

function createActionButton(label, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "admin-secondary-btn";
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

function renderMembers() {
  const tableBody = document.getElementById("membersTableBody");
  tableBody.replaceChildren();

  [...members]
    .sort((a, b) => a.name.localeCompare(b.name, "sv"))
    .forEach((member) => {
      const row = document.createElement("tr");
      appendCell(row, member.name);
      appendCell(row, member.email);
      appendCell(row, member.personal_number);
      appendCell(row, member.membership);
      appendCell(row, member.status);
      appendCell(row, member.last_payment || "–");
      appendCell(row, "").appendChild(createActionButton("Redigera", () => openEditMember(member.id)));
      tableBody.appendChild(row);
    });
}

async function loadMembers() {
  if (!supabase) return;
  
  try {
    const { data, error } = await supabase.from("members").select("*");
    if (error) throw error;
    members = data || [];
    renderMembers();
  } catch (error) {
    console.error("Kunde inte ladda medlemmar:", error);
    showAdminStatus("Fel vid hämtning av medlemmar från Supabase.", false);
  }
}

function renderClasses() {
  const tableBody = document.getElementById("classesTableBody");
  tableBody.replaceChildren();

  [...classes]
    .sort((first, second) => `${classDateFor(first)} ${first.time}`.localeCompare(`${classDateFor(second)} ${second.time}`, "sv"))
    .forEach((trainingClass) => {
    const row = document.createElement("tr");
    appendCell(row, trainingClass.name);
    appendCell(row, trainingClass.type);
    appendCell(row, formatClassDate(classDateFor(trainingClass)));
    appendCell(row, trainingClass.day);
    appendCell(row, trainingClass.time);
    appendCell(row, trainingClass.end_time || "–");
    appendCell(row, trainingClass.coach);
    appendCell(row, trainingClass.active ? "Ja" : "Nej");
    const actions = appendCell(row, "");
    actions.append(
      createActionButton("Deltagare", () => openParticipantsModal(trainingClass)),
      createActionButton("Redigera", () => openClassModal(trainingClass.id))
    );
    tableBody.appendChild(row);
  });
}

async function loadClasses() {
  if (!supabase) return;
  
  try {
    const { data, error } = await supabase.from("training_classes").select("*");
    if (error) throw error;
    classes = data || [];
    renderClasses();
  } catch (error) {
    console.error("Kunde inte ladda träningspass:", error);
    showAdminStatus("Fel vid hämtning av träningspass från Supabase.", false);
  }
}

function renderPayments() {
  const tableBody = document.getElementById("paymentsTableBody");
  tableBody.replaceChildren();

  demoPayments.forEach((payment) => {
    const row = document.createElement("tr");
    appendCell(row, payment.member_name || payment.memberName);
    appendCell(row, payment.type);
    appendCell(row, `${payment.amount} kr`);
    appendCell(row, payment.payment_date || payment.date);
    appendCell(row, payment.method);
    appendCell(row, payment.status);
    tableBody.appendChild(row);
  });
}

async function loadPayments() {
  if (!supabase) return;
  
  try {
    const { data, error } = await supabase
      .from("payments")
      .select("*, members(name)");
    if (error) throw error;
    
    demoPayments = (data || []).map((payment) => ({
      ...payment,
      member_name: payment.members?.name || "Okänd",
      memberName: payment.members?.name || "Okänd"
    }));
    
    renderPayments();
  } catch (error) {
    console.error("Kunde inte ladda betalningar:", error);
  }
}

function formatDate(value) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("sv-SE").format(new Date(value));
}

function renderMembershipRequests() {
  const tableBody = document.getElementById("membershipRequestsTableBody");
  tableBody.replaceChildren();

  membershipRequests.forEach((request) => {
    const row = document.createElement("tr");
    appendCell(row, request.members?.name || "Okänd");
    appendCell(row, request.members?.email || "–");
    appendCell(row, request.request_type);
    appendCell(row, formatDate(request.created_at));
    appendCell(row, request.status);
    const actions = appendCell(row, "");
    if (request.status !== "Hanterad") {
      actions.appendChild(createActionButton("Markera hanterad", () => markMembershipRequestHandled(request.id)));
    }
    tableBody.appendChild(row);
  });
}

async function loadMembershipRequests() {
  try {
    const { data, error } = await supabase
      .from("membership_requests")
      .select("id, request_type, status, created_at, members(name, email)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    membershipRequests = data || [];
    renderMembershipRequests();
  } catch (error) {
    console.error("Kunde inte ladda medlemsärenden:", error);
    showAdminStatus("Fel vid hämtning av medlemsärenden.");
  }
}

async function markMembershipRequestHandled(id) {
  try {
    const { error } = await supabase
      .from("membership_requests")
      .update({ status: "Hanterad" })
      .eq("id", id);
    if (error) throw error;
    await loadMembershipRequests();
    showAdminStatus("Medlemsärendet markerades som hanterat.", true);
  } catch (error) {
    console.error("Kunde inte uppdatera medlemsärende:", error);
    showAdminStatus(`Fel: ${error.message}`);
  }
}

function renderTrialRequests() {
  const tableBody = document.getElementById("trialsTableBody");
  tableBody.replaceChildren();

  trialRequests.forEach((request) => {
    const row = document.createElement("tr");
    appendCell(row, request.name);
    appendCell(row, request.email);
    appendCell(row, request.phone);
    appendCell(row, formatDate(request.created_at));
    appendCell(row, request.status);

    const actions = appendCell(row, "");
    if (request.status !== "Hanterad") {
      actions.appendChild(createActionButton("Markera hanterad", () => markTrialRequestHandled(request.id)));
    }
    tableBody.appendChild(row);
  });
}

async function loadTrialRequests() {
  try {
    const { data, error } = await supabase
      .from("trial_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    trialRequests = data || [];
    renderTrialRequests();
  } catch (error) {
    console.error("Kunde inte ladda prova på-förfrågningar:", error);
    showAdminStatus("Fel vid hämtning av prova på-förfrågningar.");
  }
}

async function markTrialRequestHandled(id) {
  try {
    const { error } = await supabase
      .from("trial_requests")
      .update({ status: "Hanterad" })
      .eq("id", id);
    if (error) throw error;
    await loadTrialRequests();
    showAdminStatus("Förfrågan markerades som hanterad.", true);
  } catch (error) {
    console.error("Kunde inte uppdatera prova på-förfrågan:", error);
    showAdminStatus(`Fel: ${error.message}`);
  }
}

function setSelectOptions(select, options) {
  const currentValue = select.value;
  select.replaceChildren();
  options.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  if (options.includes(currentValue)) select.value = currentValue;
}

function renderMembershipTypes() {
  const list = document.getElementById("membershipTypesList");
  list.replaceChildren();

  membershipTypes.forEach((type) => {
    const item = document.createElement("li");
    item.className = "admin-tag";
    item.textContent = type;
    list.appendChild(item);
  });

  setSelectOptions(document.getElementById("newMemberMembership"), membershipTypes);
  setSelectOptions(document.getElementById("editMemberMembership"), membershipTypes);
}

const addMemberModal = document.getElementById("addMemberModal");
const editMemberModal = document.getElementById("editMemberModal");
const classModal = document.getElementById("classModal");
const membershipTypesModal = document.getElementById("membershipTypesModal");
const participantsModal = document.getElementById("participantsModal");

async function openParticipantsModal(trainingClass) {
  const classDate = classDateFor(trainingClass);
  selectedClass = trainingClass;
  selectedClassDate = classDate;
  document.getElementById("participantsModalTitle").textContent = `${trainingClass.name} - ${trainingClass.coach || "Ingen tränare angiven"}`;
  document.getElementById("participantsModalDate").textContent = `${trainingClass.day} ${formatClassDate(classDate)} kl. ${classTimeRange(trainingClass)}`;
  const list = document.getElementById("participantsList");
  list.replaceChildren();
  showModal(participantsModal);

  try {
    const { data, error } = await supabase
      .from("class_registrations")
      .select("id, attended, members(name, personal_number)")
      .eq("training_class_id", trainingClass.id)
      .eq("class_date", classDate)
      .order("created_at");
    if (error) throw error;

    participantRegistrations = data || [];
    if (!participantRegistrations.length) {
      const item = document.createElement("li");
      item.textContent = "Inga deltagare är anmälda ännu.";
      list.appendChild(item);
      return;
    }

    participantRegistrations.forEach((registration) => {
      const item = document.createElement("li");
      const label = document.createElement("label");
      label.className = "attendance-row";

      const member = document.createElement("span");
      member.className = "attendance-member";
      member.textContent = registration.members?.name || "Okänd medlem";

      const personalNumber = document.createElement("span");
      personalNumber.className = "attendance-personal-number";
      personalNumber.textContent = registration.members?.personal_number || "Personnummer saknas";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = registration.attended === true;
      checkbox.dataset.registrationId = registration.id;
      checkbox.setAttribute("aria-label", `Närvarande: ${member.textContent}`);
      label.append(member, personalNumber, checkbox);
      item.appendChild(label);
      list.appendChild(item);
    });
  } catch (error) {
    console.error("Kunde inte ladda deltagare:", error);
    showAdminStatus(`Fel: ${error.message}`);
  }
}

async function saveAttendance() {
  if (!participantRegistrations.length) return;

  const checkedIds = new Set(
    [...document.querySelectorAll("#participantsList input[type='checkbox']:checked")]
      .map((checkbox) => checkbox.dataset.registrationId)
  );

  try {
    const updates = participantRegistrations.map((registration) => supabase
      .from("class_registrations")
      .update({ attended: checkedIds.has(registration.id) })
      .eq("id", registration.id));
    const results = await Promise.all(updates);
    const failedUpdate = results.find((result) => result.error);
    if (failedUpdate) throw failedUpdate.error;

    participantRegistrations = participantRegistrations.map((registration) => ({
      ...registration,
      attended: checkedIds.has(registration.id)
    }));
    showAdminStatus("Närvaron sparades.", true);
  } catch (error) {
    console.error("Kunde inte spara närvaro:", error);
    showAdminStatus(`Fel: ${error.message}`);
  }
}

function downloadAttendancePdf() {
  if (!window.jspdf?.jsPDF || !selectedClass || !selectedClassDate) {
    showAdminStatus("PDF-biblioteket kunde inte laddas.");
    return;
  }

  const checkedIds = new Set(
    [...document.querySelectorAll("#participantsList input[type='checkbox']:checked")]
      .map((checkbox) => checkbox.dataset.registrationId)
  );
  const pdf = new window.jspdf.jsPDF();
  const lines = [
    "Laholms Combat Sports",
    `Narvarolista: ${selectedClass.name}`,
    `${selectedClass.day} ${selectedClassDate} kl. ${classTimeRange(selectedClass)}`,
    "",
    "Namn                                              Narvarande"
  ];

  participantRegistrations.forEach((registration) => {
    const name = registration.members?.name || "Okänd medlem";
    lines.push(`${name} ${checkedIds.has(registration.id) ? "Ja" : "Nej"}`);
  });

  if (!participantRegistrations.length) lines.push("Inga deltagare var anmälda.");
  pdf.setFontSize(16);
  pdf.text(lines.slice(0, 3), 16, 20);
  pdf.setFontSize(11);
  pdf.text(lines.slice(3), 16, 46);
  pdf.save(`narvaro-${selectedClass.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-${selectedClassDate}.pdf`);
}

function showModal(modal) {
  modal.classList.add("active");
  const firstInput = modal.querySelector('input:not([type="hidden"])');
  if (firstInput) firstInput.focus();
}

function hideModal(modal) {
  modal.classList.remove("active");
}

document.getElementById("addMemberBtn").addEventListener("click", () => {
  document.getElementById("newMemberName").value = "";
  document.getElementById("newMemberEmail").value = "";
  document.getElementById("newMemberPersonalNumber").value = "";
  document.getElementById("newMemberStatus").value = "Aktiv";
  showModal(addMemberModal);
});

document.getElementById("closeAddMember").addEventListener("click", () => hideModal(addMemberModal));

document.getElementById("saveNewMember").addEventListener("click", async () => {
  const name = document.getElementById("newMemberName").value.trim();
  const emailInput = document.getElementById("newMemberEmail");
  const email = emailInput.value.trim();
  const personalNumberInput = document.getElementById("newMemberPersonalNumber");
  const personalNumber = personalNumberInput.value.trim();

  if (!name || !email || !emailInput.checkValidity() || !personalNumberInput.checkValidity()) {
    showAdminStatus("Fyll i namn, giltig e-postadress och personnummer.");
    return;
  }

  if (!supabase) {
    showAdminStatus("Supabase är inte ansluten.");
    return;
  }

  try {
    const { error } = await supabase.from("members").insert([{
      name,
      email,
      personal_number: personalNumber,
      membership: document.getElementById("newMemberMembership").value,
      status: document.getElementById("newMemberStatus").value,
      last_payment: null
    }]);

    if (error) throw error;

    showAdminStatus("Medlemmen sparades.", true);
    loadMembers();
    hideModal(addMemberModal);
  } catch (error) {
    console.error("Fel vid spara medlem:", error);
    showAdminStatus(`Fel: ${error.message}`, false);
  }
});

function openEditMember(id) {
  const member = members.find((item) => item.id === id);
  if (!member) return;

  document.getElementById("editMemberId").value = member.id;
  document.getElementById("editMemberName").value = member.name;
  document.getElementById("editMemberEmail").value = member.email;
  document.getElementById("editMemberPersonalNumber").value = member.personal_number || "";
  document.getElementById("editMemberMembership").value = member.membership;
  document.getElementById("editMemberStatus").value = member.status;
  showModal(editMemberModal);
}

document.getElementById("closeEditMember").addEventListener("click", () => hideModal(editMemberModal));

document.getElementById("saveEditMember").addEventListener("click", async () => {
  const id = document.getElementById("editMemberId").value;
  const member = members.find((item) => item.id === id);
  const name = document.getElementById("editMemberName").value.trim();
  const emailInput = document.getElementById("editMemberEmail");
  const email = emailInput.value.trim();
  const personalNumberInput = document.getElementById("editMemberPersonalNumber");
  const personalNumber = personalNumberInput.value.trim();

  if (!member || !name || !email || !emailInput.checkValidity() || !personalNumberInput.checkValidity()) {
    showAdminStatus("Fyll i namn, giltig e-postadress och personnummer.");
    return;
  }

  if (!supabase) {
    showAdminStatus("Supabase är inte ansluten.");
    return;
  }

  try {
    const { error } = await supabase
      .from("members")
      .update({
        name,
        email,
        personal_number: personalNumber,
        membership: document.getElementById("editMemberMembership").value,
        status: document.getElementById("editMemberStatus").value
      })
      .eq("id", id);

    if (error) throw error;

    showAdminStatus("Medlemmen uppdaterades.", true);
    loadMembers();
    hideModal(editMemberModal);
  } catch (error) {
    console.error("Fel vid uppdatera medlem:", error);
    showAdminStatus(`Fel: ${error.message}`, false);
  }
});

function openClassModal(id = "") {
  const trainingClass = classes.find((item) => item.id === id);
  const startTime = trainingClass?.time || "18:00";
  document.getElementById("classModalTitle").textContent = trainingClass ? "Redigera träningspass" : "Nytt träningspass";
  document.getElementById("classId").value = trainingClass?.id || "";
  document.getElementById("className").value = trainingClass?.name || "";
  document.getElementById("classType").value = trainingClass?.type || "";
  document.getElementById("classDate").value = trainingClass ? classDateFor(trainingClass) : toLocalDateValue(new Date());
  document.getElementById("classTime").value = startTime;
  document.getElementById("classEndTime").value = trainingClass?.end_time || defaultEndTime(startTime);
  document.getElementById("classCoach").value = trainingClass?.coach || "";
  document.getElementById("classActive").value = String(trainingClass?.active ?? true);
  showModal(classModal);
}

document.getElementById("addClassBtn").addEventListener("click", () => openClassModal());
document.getElementById("closeClassModal").addEventListener("click", () => hideModal(classModal));

document.getElementById("saveClass").addEventListener("click", async () => {
  const id = document.getElementById("classId").value;
  const name = document.getElementById("className").value.trim();
  const type = document.getElementById("classType").value.trim();
  const classDate = document.getElementById("classDate").value;
  const time = document.getElementById("classTime").value;
  const endTime = document.getElementById("classEndTime").value;
  const coach = document.getElementById("classCoach").value.trim();

  if (!name || !type || !classDate || !time || !endTime || !coach) {
    showAdminStatus("Fyll i alla uppgifter för träningspasset.");
    return;
  }

  if (endTime <= time) {
    showAdminStatus("Sluttiden måste vara senare än starttiden.");
    return;
  }

  if (!supabase) {
    showAdminStatus("Supabase är inte ansluten.");
    return;
  }

  const values = {
    name,
    type,
    class_date: classDate,
    day: dayForDate(classDate),
    time,
    end_time: endTime,
    coach,
    active: document.getElementById("classActive").value === "true"
  };

  try {
    if (id) {
      const { error } = await supabase.from("training_classes").update(values).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("training_classes").insert([values]);
      if (error) throw error;
    }

    showAdminStatus("Träningspasset sparades.", true);
    loadClasses();
    hideModal(classModal);
  } catch (error) {
    console.error("Fel vid spara träningspass:", error);
    showAdminStatus(`Fel: ${error.message}`, false);
  }
});

const savedSettings = {
  clubName: localStorage.getItem("clubName") || "Laholms Combat Sports",
  clubEmail: localStorage.getItem("clubEmail") || "info@laholmcombatsports.se"
};

document.getElementById("clubNameInput").value = savedSettings.clubName;
document.getElementById("clubEmailInput").value = savedSettings.clubEmail;

document.getElementById("saveClubSettingsBtn").addEventListener("click", async () => {
  const clubName = document.getElementById("clubNameInput").value.trim();
  const emailInput = document.getElementById("clubEmailInput");
  const clubEmail = emailInput.value.trim();

  if (!clubName || !clubEmail || !emailInput.checkValidity()) {
    showAdminStatus("Fyll i ett klubbnamn och en giltig e‑postadress.");
    return;
  }

  // Spara lokalt (för snabb åtkomst)
  localStorage.setItem("clubName", clubName);
  localStorage.setItem("clubEmail", clubEmail);
  
  document.querySelector(".admin-title").textContent = clubName;
  showAdminStatus("Klubbinställningarna sparades.", true);
});

document.getElementById("editMembershipTypesBtn").addEventListener("click", () => {
  document.getElementById("membershipTypesInput").value = membershipTypes.join(", ");
  showModal(membershipTypesModal);
});

document.getElementById("closeMembershipTypes").addEventListener("click", () => hideModal(membershipTypesModal));
document.getElementById("closeParticipantsModal").addEventListener("click", () => hideModal(participantsModal));
document.getElementById("saveAttendance").addEventListener("click", saveAttendance);
document.getElementById("downloadAttendancePdf").addEventListener("click", downloadAttendancePdf);

document.getElementById("saveMembershipTypes").addEventListener("click", () => {
  const answer = document.getElementById("membershipTypesInput").value;

  const updatedTypes = [...new Set(answer.split(",").map((value) => value.trim()).filter(Boolean))];
  if (updatedTypes.length === 0) {
    showAdminStatus("Ange minst en medlemskapstyp.");
    return;
  }

  membershipTypes = updatedTypes;
  localStorage.setItem("membershipTypes", JSON.stringify(membershipTypes));
  renderMembershipTypes();
  hideModal(membershipTypesModal);
  showAdminStatus("Medlemskapstyperna sparades.", true);
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  const button = document.getElementById("logoutBtn");
  button.disabled = true;

  try {
    if (supabase) await supabase.auth.signOut();
  } catch (error) {
    console.error("Utloggningen från Supabase misslyckades:", error);
  } finally {
    sessionStorage.removeItem("lcsPostLoginDestination");
    window.location.replace("login.html");
  }
});

[addMemberModal, editMemberModal, classModal, membershipTypesModal, participantsModal].forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) hideModal(modal);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    [addMemberModal, editMemberModal, classModal, membershipTypesModal, participantsModal].forEach(hideModal);
  }
});

// Initiera på sidladdning
async function initAdmin() {
  if (!initSupabase()) {
    showConnectionStatus();
    return;
  }

  if (!await requireAdmin()) return;

  showAdminStatus("✅ Supabase ansluten", true);
  showConnectionStatus();
  await loadMembers();
  await loadClasses();
  await loadPayments();
  await loadMembershipRequests();
  await loadTrialRequests();
}

renderMembershipTypes();

// Vänta på att LCS_SUPABASE och DOM är redo
function waitForSupabaseAndInit() {
  if (typeof window.LCS_SUPABASE === 'undefined') {
    // LCS_SUPABASE är inte definierat ännu, försök igen
    setTimeout(waitForSupabaseAndInit, 100);
    return;
  }
  
  // Nu kan vi initiera admin-panelen
  initAdmin();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", waitForSupabaseAndInit);
} else {
  waitForSupabaseAndInit();
}

})();
