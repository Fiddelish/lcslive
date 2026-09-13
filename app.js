const publicClassesList = document.getElementById("publicClassesList");

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

  const classesByDay = classes.reduce((days, trainingClass) => {
    if (!days.has(trainingClass.day)) days.set(trainingClass.day, []);
    days.get(trainingClass.day).push(trainingClass);
    return days;
  }, new Map());

  classesByDay.forEach((dayClasses, day) => {
    const dayGroup = document.createElement("section");
    dayGroup.className = "schedule-day";

    const dayHeading = document.createElement("h3");
    dayHeading.className = "schedule-day-name";
    dayHeading.textContent = day;
    dayGroup.appendChild(dayHeading);

    const classesList = document.createElement("div");
    classesList.className = "schedule-day-classes";

    dayClasses.forEach((trainingClass) => {
      const row = document.createElement("article");
      row.className = "schedule-session";

      const time = document.createElement("time");
      time.className = "schedule-session-time";
      time.textContent = trainingClass.time;

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
