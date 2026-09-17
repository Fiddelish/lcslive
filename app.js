const publicClassesList = document.getElementById("publicClassesList");

function formatScheduleDate(trainingClass) {
  if (!trainingClass.class_date) return trainingClass.day;
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date(`${trainingClass.class_date}T12:00:00`));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatScheduleTime(trainingClass) {
  return trainingClass.end_time
    ? `${trainingClass.time}–${trainingClass.end_time}`
    : trainingClass.time;
}

function renderPublicClasses(classes = window.LCSSchedule.getActive()) {
  if (!publicClassesList) return;
  publicClassesList.replaceChildren();

  if (classes.length === 0) {
    const message = document.createElement("p");
    message.className = "schedule-empty";
    message.textContent = "Inga aktiva träningspass är publicerade just nu.";
    publicClassesList.appendChild(message);
    return;
  }

  const classesByDate = classes.reduce((dates, trainingClass) => {
    const key = trainingClass.class_date || trainingClass.day;
    if (!dates.has(key)) dates.set(key, []);
    dates.get(key).push(trainingClass);
    return dates;
  }, new Map());

  classesByDate.forEach((dateClasses) => {
    const dayGroup = document.createElement("section");
    dayGroup.className = "schedule-day";

    const dayHeading = document.createElement("h3");
    dayHeading.className = "schedule-day-name";
    dayHeading.textContent = formatScheduleDate(dateClasses[0]);
    dayGroup.appendChild(dayHeading);

    const classesList = document.createElement("div");
    classesList.className = "schedule-day-classes";

    dateClasses.forEach((trainingClass) => {
      const row = document.createElement("article");
      row.className = "schedule-session";

      const time = document.createElement("time");
      time.className = "schedule-session-time";
      time.textContent = formatScheduleTime(trainingClass);
      if (trainingClass.class_date) time.dateTime = `${trainingClass.class_date}T${trainingClass.time}`;

      const details = document.createElement("div");
      const name = document.createElement("h4");
      name.textContent = trainingClass.name;
      const meta = document.createElement("p");
      meta.textContent = [trainingClass.type, trainingClass.coach ? `Coach: ${trainingClass.coach}` : ""].filter(Boolean).join(" · ");
      details.append(name, meta);

      row.append(time, details);
      classesList.appendChild(row);
    });

    dayGroup.appendChild(classesList);
    publicClassesList.appendChild(dayGroup);
  });
}

renderPublicClasses();
window.LCSSchedule.subscribe(renderPublicClasses);
