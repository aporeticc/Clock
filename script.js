/* ==========================================================================
   AFTERGLOW — home screen behaviour
   1. Element references   2. Clock, date and greeting   3. Theme toggle
   4. Full-screen toggle   5. Start-up
   ========================================================================== */

"use strict";

/* --------------------------------------------------------------------------
   1. Element references
   Every ID below exists in index.html.
   -------------------------------------------------------------------------- */
const root = document.documentElement;
const body = document.body;

const clockElement = document.getElementById("clock");
const hoursElement = document.getElementById("clock-hours");
const minutesElement = document.getElementById("clock-minutes");
const dateElement = document.getElementById("date");
const weekdayElement = document.getElementById("date-weekday");
const dayMonthElement = document.getElementById("date-day-month");
const greetingElement = document.getElementById("greeting");
const themeToggle = document.getElementById("theme-toggle");
const fullscreenToggle = document.getElementById("fullscreen-toggle");
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

const THEME_STORAGE_KEY = "afterglow-theme";
const THEME_COLORS = { dark: "#11111B", light: "#F5F2FF" };

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* --------------------------------------------------------------------------
   2. Clock, date and greeting
   All three read the visitor's own device clock through new Date().
   -------------------------------------------------------------------------- */

// Intl formats the date in the visitor's own language and order.
const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "long" });
const dayMonthFormatter = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long" });

// Remember what is on screen so we only touch the page when something changes.
let shownTime = "";
let shownDate = "";
let shownPeriod = "";
let tickTimer = null;

// Morning is 05:00-11:59, afternoon 12:00-16:59, and evening is everything
// after that (including the small hours, when "Good evening" still feels right).
function getDayPeriod(hour) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function updateClock(now) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const time = hours + ":" + minutes;

  if (time === shownTime) return;
  shownTime = time;

  hoursElement.textContent = hours;
  minutesElement.textContent = minutes;
  clockElement.setAttribute("datetime", time);
  // Screen readers get the whole time as one phrase instead of two numbers.
  clockElement.setAttribute("aria-label", time);
}

function updateDate(now) {
  // Local year-month-day. (toISOString would give the UTC date, which can be
  // a day off near midnight.)
  const isoDate = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());

  if (isoDate === shownDate) return;
  shownDate = isoDate;

  weekdayElement.textContent = weekdayFormatter.format(now);
  dayMonthElement.textContent = dayMonthFormatter.format(now);
  dateElement.setAttribute("datetime", isoDate);
}

function updateGreeting(now) {
  const period = getDayPeriod(now.getHours());

  if (period === shownPeriod) return;
  shownPeriod = period;

  greetingElement.textContent = "Good " + period + ".";
  // The stylesheet reads this to tilt the background lighting.
  body.dataset.period = period;
}

// Runs once a second. It schedules itself for the start of the next second,
// so the clock never drifts, and it can be called again safely at any time.
function tick() {
  window.clearTimeout(tickTimer);

  const now = new Date();
  updateClock(now);
  updateDate(now);
  updateGreeting(now);

  tickTimer = window.setTimeout(tick, 1000 - now.getMilliseconds());
}

/* --------------------------------------------------------------------------
   3. Theme toggle
   Dark is the default. The choice is saved in localStorage when available.
   -------------------------------------------------------------------------- */

// Some browsers block storage (private modes, strict settings), so every
// access is wrapped. If it fails, the toggle still works for this visit.
function readSavedTheme() {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch (error) {
    return null;
  }
}

function saveTheme(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    // Nothing to do: the theme simply will not be remembered.
  }
}

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "light" : "dark";
  const label = "Switch to " + nextTheme + " theme";

  root.dataset.theme = theme;
  themeToggle.setAttribute("aria-label", label);
  themeToggle.setAttribute("title", label);

  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", THEME_COLORS[theme]);
  }
}

function toggleTheme() {
  const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";

  // Browsers that support View Transitions fade smoothly between themes.
  // Everywhere else (or with reduced motion) the change is instant.
  if (document.startViewTransition && !prefersReducedMotion.matches) {
    document.startViewTransition(function () {
      applyTheme(nextTheme);
    });
  } else {
    applyTheme(nextTheme);
  }

  saveTheme(nextTheme);
}

/* --------------------------------------------------------------------------
   4. Full-screen toggle
   Handy for leaving AFTERGLOW open on a second screen. The button is only
   shown in browsers that allow full screen (iPhone Safari does not).
   -------------------------------------------------------------------------- */
const fullscreenSupported = Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);

function isFullscreen() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

function updateFullscreenButton() {
  const active = isFullscreen();
  const label = active ? "Exit full screen" : "Enter full screen";

  fullscreenToggle.dataset.state = active ? "exit" : "enter";
  fullscreenToggle.setAttribute("aria-label", label);
  fullscreenToggle.setAttribute("title", label);
}

function toggleFullscreen() {
  let request;

  if (isFullscreen()) {
    request = document.exitFullscreen
      ? document.exitFullscreen()
      : document.webkitExitFullscreen();
  } else {
    request = root.requestFullscreen ? root.requestFullscreen() : root.webkitRequestFullscreen();
  }

  // The browser may refuse (for example inside a restricted frame). Ignore it.
  if (request && typeof request.catch === "function") {
    request.catch(function () {});
  }
}

/* --------------------------------------------------------------------------
   5. Start-up
   -------------------------------------------------------------------------- */

// Theme first, so the page paints in the right colours.
applyTheme(readSavedTheme() === "light" ? "light" : "dark");
themeToggle.addEventListener("click", toggleTheme);

// Full screen: reveal the button only when it can actually work.
if (fullscreenSupported) {
  fullscreenToggle.hidden = false;
  fullscreenToggle.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", updateFullscreenButton);
  document.addEventListener("webkitfullscreenchange", updateFullscreenButton);
  updateFullscreenButton();
}

// Start the clock, and catch up straight away when a hidden tab comes back,
// because browsers slow timers down in background tabs.
tick();
document.addEventListener("visibilitychange", function () {
  if (!document.hidden) tick();
});

// Only now allow the slow lighting transitions, so the very first values
// (set above) never animate while the page is loading.
window.requestAnimationFrame(function () {
  window.requestAnimationFrame(function () {
    body.classList.add("is-ready");
  });
});
