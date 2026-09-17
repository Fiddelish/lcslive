(function createScheduleStore() {
  const storageKey = "lcsDemoClasses";
  const dayOrder = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];
  const dayNumbers = { "Söndag": 0, "Måndag": 1, "Tisdag": 2, "Onsdag": 3, "Torsdag": 4, "Fredag": 5, "Lördag": 6 };

  function localDateValue(date) {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return localDate.toISOString().slice(0, 10);
  }

  function nextDateForDay(day) {
    const date = new Date();
    date.setDate(date.getDate() + (dayNumbers[day] - date.getDay() + 7) % 7);
    return localDateValue(date);
  }

  function defaultEndTime(startTime) {
    const [hours, minutes] = String(startTime || "18:00").split(":").map(Number);
    const endMinutes = hours * 60 + minutes + 60;
    return `${String(Math.floor(endMinutes / 60) % 24).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  }

  function normalizeClass(trainingClass) {
    return {
      ...trainingClass,
      class_date: trainingClass.class_date || nextDateForDay(trainingClass.day),
      end_time: trainingClass.end_time || defaultEndTime(trainingClass.time)
    };
  }

  const defaultClasses = [
    normalizeClass({ id: "class-1", name: "MMA", type: "MMA", day: "Måndag", time: "18:00", end_time: "19:30", coach: "LCS Coach", active: true }),
    normalizeClass({ id: "class-2", name: "BJJ", type: "BJJ", day: "Tisdag", time: "18:00", end_time: "19:30", coach: "LCS Coach", active: true }),
    normalizeClass({ id: "class-3", name: "Barnpass", type: "MMA", day: "Lördag", time: "10:00", end_time: "11:00", coach: "LCS Coach", active: true })
  ];

  let cachedClasses = defaultClasses;
  let subscribers = [];

  function readAll() {
    try {
      const saved = localStorage.getItem(storageKey);
      const parsed = saved ? JSON.parse(saved) : defaultClasses;
      return Array.isArray(parsed) ? parsed.map(normalizeClass) : defaultClasses;
    } catch (error) {
      console.warn("Kunde inte läsa det lokala träningsschemat.", error);
      return defaultClasses;
    }
  }

  function sortClasses(classes) {
    return [...classes].sort((first, second) => {
      if (first.class_date !== second.class_date) {
        return String(first.class_date).localeCompare(String(second.class_date), "sv");
      }
      const dayDifference = dayOrder.indexOf(first.day) - dayOrder.indexOf(second.day);
      if (dayDifference !== 0) return dayDifference;
      return String(first.time).localeCompare(String(second.time), "sv");
    });
  }

  function getActive() {
    const today = localDateValue(new Date());
    return sortClasses(cachedClasses.filter((trainingClass) => (
      trainingClass.active !== false && (!trainingClass.class_date || trainingClass.class_date >= today)
    )));
  }

  async function loadFromSupabase() {
    if (!window.LCS_SUPABASE || !window.LCS_SUPABASE.isConnected()) {
      cachedClasses = readAll();
      notifySubscribers();
      return;
    }

    try {
      const supabase = window.LCS_SUPABASE.getClient();
      const { data, error } = await supabase.from("training_classes").select("*");
      
      if (error) throw error;
      
      cachedClasses = (data || defaultClasses).map(normalizeClass);
      localStorage.setItem(storageKey, JSON.stringify(cachedClasses));
      notifySubscribers();
    } catch (error) {
      console.warn("Kunde inte ladda träningspass från Supabase, använder lokala data:", error);
      cachedClasses = readAll();
      notifySubscribers();
    }
  }

  function notifySubscribers() {
    subscribers.forEach(callback => callback(getActive()));
  }

  function subscribe(listener) {
    subscribers.push(listener);
    
    function handleStorage(event) {
      if (event.key === storageKey) {
        cachedClasses = readAll();
        notifySubscribers();
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      subscribers = subscribers.filter(cb => cb !== listener);
    };
  }

  window.LCSSchedule = Object.freeze({
    storageKey,
    defaultClasses: Object.freeze(defaultClasses),
    getActive,
    readAll,
    subscribe,
    loadFromSupabase
  });

  // Auto-load från Supabase när objektet skapas
  loadFromSupabase();
})();
