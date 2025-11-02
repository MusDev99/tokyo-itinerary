import React, { useState, useRef, useEffect, useMemo } from 'react';

// --- MOCK DATA (For self-contained runnable component) ---
const mockPrayerData = {
  location_data: [
    {
      city: "Tokyo",
      schedule: [
        { date: "2025-11-20", day: "Thursday", Fajr: "4:50 AM", Dhuhr: "11:27 AM", Asr: "2:12 PM", Maghrib: "4:30 PM", Isha: "5:54 PM" },
        { date: "2025-11-21", day: "Friday", Fajr: "4:51 AM", Dhuhr: "11:27 AM", Asr: "2:11 PM", Maghrib: "4:30 PM", Isha: "5:54 PM" },
      ]
    },
    {
      city: "Fuji",
      schedule: [
        { date: "2025-11-23", day: "Sunday", Fajr: "4:59 AM", Dhuhr: "11:33 AM", Asr: "2:16 PM", Maghrib: "4:35 PM", Isha: "5:59 PM" },
        { date: "2025-11-24", day: "Monday", Fajr: "5:00 AM", Dhuhr: "11:33 AM", Asr: "2:16 PM", Maghrib: "4:35 PM", Isha: "5:59 PM" }
      ]
    }
  ]
};

// --- CONSTANTS ---
const CANVAS_SIZE = 350;
const CENTER = CANVAS_SIZE / 2;
const RADIUS = 120;
const LINE_WIDTH = 25;
const PRAYER_NAMES = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

// Use emojis, color is now handled by theme
const PRAYER_ICONS = {
  Fajr: { emoji: '🌅', description: 'Sunrise' },
  Dhuhr: { emoji: '☀️', description: 'Midday Sun' },
  Asr: { emoji: '🌤️', description: 'Day Clouds' },
  Maghrib: { emoji: '🌇', description: 'Sunset' },
  Isha: { emoji: '🌙', description: 'Night Clear' },
  Shab: { emoji: '✨', description: 'Night Rest' },
};

const PRAYER_COLOR_MAP = {
    Fajr: 'accent',
    Dhuhr: 'primary',
    Asr: 'secondary',
    Maghrib: 'accent',
    Isha: 'text',
    Shab: 'bg',
};


// --- UTILITY FUNCTIONS ---

/** Converts HH:MM AM/PM to minutes from midnight */
const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(' ');
    let time = parts[0];
    let modifier = parts.length > 1 ? parts[1].toUpperCase() : '';

    let [hours, minutes] = time.split(':').map(Number);

    if (modifier === 'PM' && hours < 12) {
        hours += 12;
    } else if (modifier === 'AM' && hours === 12) { // Midnight 12:xx AM
        hours = 0;
    }
    return hours * 60 + minutes;
};

/** Converts minutes from midnight to a canvas angle (radians) */
const minutesToRadians = (minutes) => {
    // 1440 minutes in a day (24 * 60). We subtract 90 degrees (Math.PI/2)
    // so 0:00 (midnight) starts at the top (12 o'clock position).
    const angleInRadians = (minutes / 1440) * 2 * Math.PI;
    return angleInRadians - Math.PI / 2;
};

// --- MAIN COMPONENT ---

const PrayerDashboard =({ prayerData = mockPrayerData }) => {
  const [selectedCity, setSelectedCity] = useState(prayerData.location_data[0].city);
  const initialDate = prayerData.location_data[0].schedule[0].date;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const canvasRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [themeColors, setThemeColors] = useState({
    bg: '#fef3c7',
    text: '#78350f',
    primary: '#fbbf24',
    secondary: '#fde68a',
    accent: '#d97706',
  });

  useEffect(() => {
    const rootEl = document.documentElement;
    
    const updateThemeColors = () => {
      const rootStyle = getComputedStyle(rootEl);
      setThemeColors({
        bg: rootStyle.getPropertyValue('--color-bg').trim(),
        text: rootStyle.getPropertyValue('--color-text').trim(),
        primary: rootStyle.getPropertyValue('--color-primary').trim(),
        secondary: rootStyle.getPropertyValue('--color-secondary').trim(),
        accent: rootStyle.getPropertyValue('--color-accent').trim(),
      });
    };

    updateThemeColors(); // Initial fetch

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          updateThemeColors();
          break;
        }
      }
    });

    observer.observe(rootEl, { attributes: true });

    return () => observer.disconnect();
  }, []);

  // Set up a simple interval to update the clock every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000); // Update every 15 seconds for marker movement

    return () => clearInterval(timer);
  }, []);

  // --- Handlers from user's original component ---
  const handleCityChange = (event) => {
    const newCity = event.target.value;
    setSelectedCity(newCity);
    const newCityData = prayerData.location_data.find((city) => city.city === newCity);
    setSelectedDate(newCityData.schedule[0].date);
  };

  const handleDateChange = (event) => {
    setSelectedDate(event.target.value);
  };
  // --- END Handlers ---

  const cityData = prayerData.location_data.find((city) => city.city === selectedCity);
  const scheduleData = cityData.schedule.find((s) => s.date === selectedDate);

  // Find the next day's Fajr time for the Isha/Shab segment calculation
  const nextDaySchedule = cityData.schedule.find((s) => {
    const nextDay = new Date(new Date(selectedDate).getTime() + (24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    return s.date === nextDay;
  });

  // Use useMemo to calculate the segments only when the schedule data changes
  const segments = useMemo(() => {
    if (!scheduleData) return [];

    const times = PRAYER_NAMES.map(key => ({
      key,
      minutes: timeToMinutes(scheduleData[key]),
      time: scheduleData[key]
    }));

    // Determine the end of the 24-hour cycle (next Fajr)
    let nextFajrMinutes;
    if (nextDaySchedule) {
        // Next Fajr is 24 hours (1440 minutes) later
        nextFajrMinutes = timeToMinutes(nextDaySchedule.Fajr) + 1440;
    } else {
        // Fallback: Assume Fajr is roughly the same time the next day
        nextFajrMinutes = timeToMinutes(scheduleData.Fajr) + 1440;
    }

    const calculatedSegments = [];

    // 1. Calculate the five main prayer segments
    for (let i = 0; i < PRAYER_NAMES.length; i++) {
      const current = times[i];
      let endMinutes;

      if (i < PRAYER_NAMES.length - 1) {
        // Segment ends at the start of the next prayer
        endMinutes = times[i + 1].minutes;
      } else {
        // Isha segment ends at the start of the next Fajr
        endMinutes = nextFajrMinutes;
      }

      calculatedSegments.push({
        key: current.key,
        time: current.time,
        startMinutes: current.minutes,
        endMinutes: endMinutes
      });
    }

    // 2. Insert the Shab (Night Rest) segment between Isha and the *next* Fajr
    const lastIsha = calculatedSegments.find(s => s.key === 'Isha');

    // Shab starts at Isha's end time (the next Fajr time)
    calculatedSegments.push({
        key: 'Shab',
        time: 'Night Rest',
        startMinutes: lastIsha.endMinutes,
        // The segment should wrap around to the starting Fajr of the *current* day's schedule.
        // We ensure a full 24-hour cycle is visualized correctly.
        endMinutes: nextFajrMinutes,
    });

    // Sort all segments by their start time
    calculatedSegments.sort((a, b) => a.startMinutes - b.startMinutes);

    return calculatedSegments;

  }, [scheduleData, nextDaySchedule]);


  // --- CANVAS DRAWING LOGIC ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scheduleData) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Set canvas font and style for text elements
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';

    // --- 1. Draw the Base Wheel (Optional full circle track) ---
    ctx.beginPath();
    ctx.strokeStyle = themeColors.secondary;
    ctx.lineWidth = LINE_WIDTH;
    ctx.arc(CENTER, CENTER, RADIUS, 0, 2 * Math.PI);
    ctx.stroke();

    // --- 2. Draw Prayer Segments (The Color-Coded Roadmap) ---
    segments.forEach(segment => {
        ctx.beginPath();

        let startRad = minutesToRadians(segment.startMinutes);
        let endRad = minutesToRadians(segment.endMinutes);

        // For segments crossing midnight (Shab), ensure the end angle is greater than the start angle
        if (endRad < startRad) {
            endRad += 2 * Math.PI;
        }

        ctx.lineWidth = LINE_WIDTH;
        ctx.strokeStyle = themeColors[PRAYER_COLOR_MAP[segment.key]] || themeColors.text;

        ctx.arc(CENTER, CENTER, RADIUS, startRad, endRad);
        ctx.stroke();

        // Add prayer name labels on the outside
        if (segment.key !== 'Shab') {
            const midRad = startRad + (endRad - startRad) / 2;
            const textRadius = RADIUS + LINE_WIDTH + 8; // Outside the arc

            const x = CENTER + textRadius * Math.cos(midRad);
            const y = CENTER + textRadius * Math.sin(midRad);

            ctx.fillStyle = themeColors[PRAYER_COLOR_MAP[segment.key]] || themeColors.text;
            ctx.fillText(`${PRAYER_ICONS[segment.key].emoji} ${segment.time}`, x, y);
        }
    });

    // --- 3. Draw Current Time Marker (The "You Are Here" Marker ✈️) ---
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const currentRad = minutesToRadians(currentMinutes);

    // Marker Position (Inner line)
    const markerX_inner = CENTER + (RADIUS - LINE_WIDTH / 2) * Math.cos(currentRad);
    const markerY_inner = CENTER + (RADIUS - LINE_WIDTH / 2) * Math.sin(currentRad);
    // Marker Position (Outer line)
    const markerX_outer = CENTER + (RADIUS + LINE_WIDTH / 2) * Math.cos(currentRad);
    const markerY_outer = CENTER + (RADIUS + LINE_WIDTH / 2) * Math.sin(currentRad);

    // Draw the red marker line (kept for high visibility)
    ctx.beginPath();
    ctx.moveTo(markerX_inner, markerY_inner);
    ctx.lineTo(markerX_outer, markerY_outer);
    ctx.strokeStyle = '#EF4444'; // Tailwind red-500
    ctx.lineWidth = 4;
    ctx.stroke();

    // Draw a small circle at the marker position
    ctx.beginPath();
    const markerX = CENTER + RADIUS * Math.cos(currentRad);
    const markerY = CENTER + RADIUS * Math.sin(currentRad);
    ctx.fillStyle = '#EF4444';
    ctx.arc(markerX, markerY, 5, 0, 2 * Math.PI);
    ctx.fill();


    // --- 4. Draw Center Information ---
    ctx.fillStyle = themeColors.text;
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.fillText(selectedCity, CENTER, CENTER - 20);

    ctx.font = '14px Inter, sans-serif';
    ctx.fillText(scheduleData.date, CENTER, CENTER + 10);

    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText(currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }), CENTER, CENTER + 50);

  }, [segments, selectedCity, scheduleData, currentTime, themeColors]); // Redraw when segments, time or theme updates


  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 bg-[var(--color-bg)] rounded-xl shadow-xl text-[var(--color-text)]">
      <h1 className="text-3xl font-extrabold text-[var(--color-primary)] mb-6 text-center">
        ✈️ Time Wheel Dashboard: {selectedCity}
      </h1>

      {/* --- Controls: Location & Day Selector --- */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div className="flex-grow min-w-[150px]">
          <label htmlFor="city-select" className="sr-only">Select a city</label>
          <select
            id="city-select"
            onChange={handleCityChange}
            value={selectedCity}
            className="block w-full p-3 border border-[var(--color-secondary)] rounded-lg shadow-md bg-[var(--color-bg)] text-[var(--color-text)] font-semibold focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
          >
            {prayerData.location_data.map((location) => (
              <option key={location.city} value={location.city}>
                📍 {location.city}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-grow min-w-[150px]">
          <label htmlFor="date-select" className="sr-only">Select a date</label>
          <select
            id="date-select"
            onChange={handleDateChange}
            value={selectedDate}
            className="block w-full p-3 border border-[var(--color-secondary)] rounded-lg shadow-md bg-[var(--color-bg)] text-[var(--color-text)] font-semibold focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
          >
            {cityData?.schedule.map((s) => (
              <option key={s.date} value={s.date}>
                📅 {s.day}, {s.date}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* --- CANVAS VISUALIZATION --- */}
      <div className="flex justify-center items-center mb-10">
        <div className="bg-[var(--color-bg)] p-2 rounded-full shadow-2xl ring-4 ring-[var(--color-secondary)]">
          <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} />
        </div>
      </div>

      {/* --- Timeline Details (The original card data, now as a clean list) --- */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4 text-center">
          Schedule Details for {scheduleData?.day}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {scheduleData && PRAYER_NAMES.map((prayerName) => (
            <div
              key={prayerName}
              className="relative flex flex-col items-center p-3 rounded-lg shadow-md border-t-4 bg-[var(--color-bg)]"
              style={{ borderTopColor: themeColors[PRAYER_COLOR_MAP[prayerName]] }}
            >
              <div className="text-2xl mb-1">
                {PRAYER_ICONS[prayerName].emoji}
              </div>
              <h3 className="text-sm font-semibold">{prayerName}</h3>
              <p className="text-lg font-extrabold">{scheduleData[prayerName]}</p>
            </div>
          ))}
          {/* Night Rest Card */}
          <div
            className="relative flex flex-col items-center p-3 rounded-lg shadow-md border-t-4"
            style={{ borderTopColor: themeColors[PRAYER_COLOR_MAP.Shab], backgroundColor: themeColors.secondary }}
          >
            <div className="text-2xl mb-1">
              {PRAYER_ICONS.Shab.emoji}
            </div>
            <h3 className="text-sm font-semibold">Night Rest</h3>
            <p className="text-xs font-medium opacity-80 pt-1">(Until next Fajr)</p>
          </div>
        </div>
      </div>

    </div>
  );
}

export default PrayerDashboard;
