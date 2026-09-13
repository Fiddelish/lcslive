(function createScheduleStore() {
  const storageKey = "lcsDemoClasses";
  const dayOrder = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];
  const defaultClasses = [
    { id: "class-1", name: "MMA", type: "MMA", day: "Måndag", time: "18:00", coach: "LCS Coach", active: true },
    { id: "class-2", name: "BJJ", type: "BJJ", day: "Tisdag", time: "18:00", coach: "LCS Coach", active: true },
    { id: "class-3", name: "Barnpass", type: "MMA", day: "Lördag", time: "10:00", coach: "LCS Coach", active: true }
  ];

  let cachedClasses = defaultClasses;
  let subscribers = [];

  function readAll() {
    try {
      const saved = localStorage.getItem(storageKey);
      const parsed = saved ? JSON.parse(saved) : defaultClasses;
      return Array.isArray(parsed) ? parsed : defaultClasses;
    } catch (error) {
      console.warn("Kunde inte läsa det lokala träningsschemat.", error);
      return defaultClasses;
    }
  }

  function sortClasses(classes) {
    return [...classes].sort((first, second) => {
      const dayDifference = dayOrder.indexOf(first.day) - dayOrder.indexOf(second.day);
      if (dayDifference !== 0) return dayDifference;
      return String(first.time).localeCompare(String(second.time), "sv");
    });
  }

  function getActive() {
    return sortClasses(cachedClasses.filter((trainingClass) => trainingClass.active !== false));
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
      
      cachedClasses = data || defaultClasses;
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
