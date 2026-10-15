/**
 * Shared Scene UI — Audio Control
 *
 * Provides a callback-based API for scene audio toggle and volume control.
 *
 * Usage:
 *   initSceneAudio({
 *     onStart()          — called when user clicks play
 *     onStop()           — called when user clicks stop
 *     onVolumeChange(v)  — called with slider value 0-100
 *   });
 *
 * Scenes with a day-night cycle can also add a time-of-day picker to the
 * panel with initTimeControl() (see below).
 *
 * URL param ?ui=0 hides the back button and audio panel — used for
 * clean captures (thumbnails via tools/thumbs.sh, screenshots).
 */

// Every floating UI element over the scene: hidden together, and taps on
// them never count as "tap the scene"
const SCENE_UI_SEL = '.ap, .back, .tod';

if (new URLSearchParams(location.search).get('ui') === '0') {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll(SCENE_UI_SEL).forEach((el) => { el.style.display = 'none'; });
  });
}

// Fullscreen button
(function () {
  // Inline style ensures these SVGs stay 14×14 even when scene CSS has a global svg{width:100%;height:100%} rule.
  // stroke="currentColor" + square caps/joins keep the icon crisp/blocky and let it
  // follow .ab's colour (including the brighter .ab.on state) with no extra JS.
  const SVG_OPEN = '<svg style="display:block;width:14px;height:14px;min-width:14px;flex-shrink:0" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" xmlns="http://www.w3.org/2000/svg">';
  const EXPAND   = SVG_OPEN + '<polyline points="3,0 0,0 0,3"/><polyline points="9,0 12,0 12,3"/><polyline points="12,9 12,12 9,12"/><polyline points="3,12 0,12 0,9"/></svg>';
  const CONTRACT = SVG_OPEN + '<polyline points="0,3 3,3 3,0"/><polyline points="9,0 9,3 12,3"/><polyline points="12,9 9,9 9,12"/><polyline points="0,9 3,9 3,12"/></svg>';

  document.addEventListener('DOMContentLoaded', () => {
    const fsBtn = document.getElementById('fsBtn');
    if (!fsBtn) return;
    if (!document.fullscreenEnabled) { fsBtn.style.display = 'none'; return; }

    function updateIcon() {
      const active = !!document.fullscreenElement;
      fsBtn.innerHTML = active ? CONTRACT : EXPAND;
      active ? fsBtn.classList.add('on') : fsBtn.classList.remove('on');
    }
    updateIcon();

    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    document.addEventListener('fullscreenchange', updateIcon);
  });
}());

// UI visibility toggle: tap on scene hides/shows; auto-hides after 3 s in fullscreen
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const ui = () => document.querySelectorAll(SCENE_UI_SEL);
    let hidden = false;
    let timer;

    function armAutoHide() {
      clearTimeout(timer);
      if (document.fullscreenElement) {
        timer = setTimeout(hide, 3000);
      }
    }
    function show() {
      hidden = false;
      ui().forEach(el => el.classList.remove('ui-hidden'));
      armAutoHide();
    }
    function hide() {
      // Never pull the UI away while a menu is open — wait until it closes
      if (document.querySelector('.tod:not([hidden])')) { armAutoHide(); return; }
      hidden = true;
      clearTimeout(timer);
      ui().forEach(el => el.classList.add('ui-hidden'));
    }

    // Tap anywhere except on UI elements toggles visibility
    document.addEventListener('click', (e) => {
      if (e.target.closest(SCENE_UI_SEL)) return;
      hidden ? show() : hide();
    });

    // Using the controls in fullscreen restarts the 3 s countdown
    document.addEventListener('pointerdown', (e) => {
      if (!hidden && e.target.closest(SCENE_UI_SEL)) armAutoHide();
    });

    document.addEventListener('fullscreenchange', () => {
      // Always show on transition; start auto-hide timer only inside fullscreen
      show();
    });
  });
}());

// Pixel speaker icon: a stepped cone (crispEdges rects, fill="currentColor") plus
// either a small diagonal mute-X or two ascending sound-wave bars.
const SPK_OPEN = '<svg style="display:block;width:14px;height:14px;min-width:14px;flex-shrink:0" viewBox="0 0 12 12" shape-rendering="crispEdges" fill="currentColor" xmlns="http://www.w3.org/2000/svg">';
const SPK_CONE = '<rect x="1" y="4" width="2" height="4"/><rect x="3" y="3" width="2" height="6"/><rect x="5" y="1" width="2" height="10"/>';
const SPEAKER_OFF = SPK_OPEN + SPK_CONE
  + '<rect x="8" y="2" width="1" height="1"/><rect x="9" y="3" width="1" height="1"/><rect x="10" y="4" width="1" height="1"/><rect x="11" y="5" width="1" height="1"/>'
  + '<rect x="11" y="2" width="1" height="1"/><rect x="10" y="3" width="1" height="1"/><rect x="9" y="4" width="1" height="1"/><rect x="8" y="5" width="1" height="1"/>'
  + '</svg>';
const SPEAKER_ON = SPK_OPEN + SPK_CONE
  + '<rect x="8" y="4" width="1" height="4"/><rect x="10" y="2" width="1" height="8"/>'
  + '</svg>';

function initSceneAudio({ onStart, onStop, onVolumeChange }) {
  const btn = document.getElementById('aBtn');
  const icon = document.getElementById('spkIcon');
  const slider = document.getElementById('vSl');
  const label = document.getElementById('vLb');
  let isPlaying = false;
  icon.innerHTML = SPEAKER_OFF;

  btn.addEventListener('click', () => {
    if (isPlaying) {
      isPlaying = false;
      btn.classList.remove('on');
      icon.innerHTML = SPEAKER_OFF;
      onStop();
    } else {
      isPlaying = true;
      btn.classList.add('on');
      icon.innerHTML = SPEAKER_ON;
      onStart(Number(slider.value));
    }
  });

  slider.addEventListener('input', () => {
    const v = Number(slider.value);
    label.textContent = v + '%';
    if (isPlaying) {
      onVolumeChange(v);
    }
  });
}

/**
 * Time-of-day picker for scenes with a day-night cycle.
 *
 * Markup: a trigger inside the panel, e.g. first in .ap:
 *   <button class="ab" id="todBtn"></button>
 * The menu itself is built here and pops up above the panel, so the
 * control costs one panel button while closed.
 *
 *   const tod = initTimeControl({
 *     presets: ['morning', 'day', 'sunset', 'night'],  // ids from TOD_ITEMS (also 'dawn')
 *     value: 'auto',          // initial selection ('auto', a preset, or null)
 *     onSelect(id) { ... },   // user picked a different entry
 *   });
 *   tod.set(id);              // reflect a change made elsewhere
 *
 * 'auto' (let the cycle run) is always offered, below the presets. The
 * trigger shows the selected entry's icon and lights up (.on) while a
 * fixed time is selected.
 */
const TOD_SVG = '<svg style="display:block;width:14px;height:14px;min-width:14px;flex-shrink:0" viewBox="0 0 12 12" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">';
// Half sun on the horizon; the chevron above says rising or setting
const TOD_HALF_SUN = '<rect x="4" y="5" width="4" height="1"/><rect x="3" y="6" width="6" height="1"/><rect x="2" y="7" width="8" height="2"/>'
  + '<rect x="0" y="8" width="1" height="1"/><rect x="11" y="8" width="1" height="1"/><rect x="0" y="10" width="12" height="1"/>';
const TOD_ITEMS = {
  // Just the top of the sun on the horizon, with rays fanning out above it
  dawn: { label: 'DAWN', icon: '<rect x="0" y="10" width="12" height="1"/><rect x="3" y="9" width="6" height="1"/><rect x="4" y="8" width="4" height="1"/>'
    + '<rect x="5" y="2" width="2" height="4"/><rect x="2" y="4" width="1" height="1"/><rect x="3" y="5" width="1" height="1"/>'
    + '<rect x="9" y="4" width="1" height="1"/><rect x="8" y="5" width="1" height="1"/><rect x="0" y="7" width="2" height="1"/><rect x="10" y="7" width="2" height="1"/>' },
  morning: { label: 'MORNING', icon: TOD_HALF_SUN
    + '<rect x="5" y="0" width="2" height="1"/><rect x="4" y="1" width="4" height="1"/><rect x="3" y="2" width="2" height="1"/><rect x="7" y="2" width="2" height="1"/>' },
  day: { label: 'DAY', icon: '<rect x="4" y="3" width="4" height="1"/><rect x="3" y="4" width="6" height="4"/><rect x="4" y="8" width="4" height="1"/>'
    + '<rect x="5" y="0" width="2" height="2"/><rect x="5" y="10" width="2" height="2"/><rect x="0" y="5" width="2" height="2"/><rect x="10" y="5" width="2" height="2"/>'
    + '<rect x="1" y="1" width="1" height="1"/><rect x="10" y="1" width="1" height="1"/><rect x="1" y="10" width="1" height="1"/><rect x="10" y="10" width="1" height="1"/>' },
  sunset: { label: 'SUNSET', icon: TOD_HALF_SUN
    + '<rect x="3" y="0" width="2" height="1"/><rect x="7" y="0" width="2" height="1"/><rect x="4" y="1" width="4" height="1"/><rect x="5" y="2" width="2" height="1"/>' },
  night: { label: 'NIGHT', icon: '<rect x="3" y="1" width="3" height="1"/><rect x="2" y="2" width="3" height="1"/><rect x="1" y="3" width="3" height="4"/>'
    + '<rect x="1" y="7" width="4" height="1"/><rect x="2" y="8" width="4" height="1"/><rect x="3" y="9" width="5" height="1"/><rect x="5" y="10" width="4" height="1"/>'
    + '<rect x="8" y="2" width="1" height="3"/><rect x="7" y="3" width="3" height="1"/><rect x="10" y="6" width="1" height="1"/>' },
  auto: { label: 'AUTO', icon: '<rect x="4" y="0" width="4" height="1"/><rect x="2" y="1" width="2" height="1"/><rect x="8" y="1" width="2" height="1"/>'
    + '<rect x="1" y="2" width="1" height="2"/><rect x="10" y="2" width="1" height="2"/><rect x="0" y="4" width="1" height="4"/><rect x="11" y="4" width="1" height="4"/>'
    + '<rect x="1" y="8" width="1" height="2"/><rect x="10" y="8" width="1" height="2"/><rect x="2" y="10" width="2" height="1"/><rect x="8" y="10" width="2" height="1"/>'
    + '<rect x="4" y="11" width="4" height="1"/><rect x="5" y="3" width="1" height="4"/><rect x="6" y="6" width="3" height="1"/>' },
};

function initTimeControl({ presets, value, onSelect }) {
  const btn = document.getElementById('todBtn');
  const icon = (id) => TOD_SVG + TOD_ITEMS[id].icon + '</svg>';

  const menu = document.createElement('div');
  menu.className = 'tod';
  menu.id = 'todMenu';
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Time of day');
  const items = presets.concat('auto').map((id) => {
    if (id === 'auto') {
      const sep = document.createElement('div');
      sep.className = 'tod-sep';
      sep.setAttribute('role', 'separator');
      menu.appendChild(sep);
    }
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'tod-item';
    item.dataset.id = id;
    item.setAttribute('role', 'menuitemradio');
    item.innerHTML = icon(id) + '<span>' + TOD_ITEMS[id].label + '</span>';
    item.addEventListener('click', () => pick(id));
    menu.appendChild(item);
    return item;
  });
  document.body.appendChild(menu);

  btn.title = 'Time of day';
  btn.setAttribute('aria-haspopup', 'menu');
  btn.setAttribute('aria-controls', menu.id);
  btn.setAttribute('aria-expanded', 'false');

  let current;
  function set(id) {
    current = id;
    const shown = id || 'auto';
    btn.innerHTML = icon(shown);
    btn.classList.toggle('on', !!id && id !== 'auto');
    btn.setAttribute('aria-label', 'Time of day: ' + (id ? TOD_ITEMS[id].label.toLowerCase() : 'custom'));
    items.forEach((item) => item.setAttribute('aria-checked', String(item.dataset.id === id)));
  }

  // Sit just above the panel, with the menu icons in the same column as
  // the trigger's icon; kept inside the viewport on narrow screens
  function place() {
    const panel = btn.closest('.ap') || btn;
    menu.style.bottom = (window.innerHeight - panel.getBoundingClientRect().top + 6) + 'px';
    menu.style.left = '0px';
    const dx = btn.querySelector('svg').getBoundingClientRect().left
      - items[0].querySelector('svg').getBoundingClientRect().left;
    const maxLeft = window.innerWidth - menu.offsetWidth - 8;
    menu.style.left = Math.max(8, Math.min(dx, maxLeft)) + 'px';
  }
  function open() {
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    place();
    (items.find((item) => item.dataset.id === current) || items[0]).focus();
  }
  function close(refocus) {
    if (menu.hidden) return;
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (refocus) btn.focus();
  }
  function pick(id) {
    close(true);
    if (id === current) return;
    set(id);
    onSelect(id);
  }

  btn.addEventListener('click', () => (menu.hidden ? open() : close(false)));
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); open(); }
  });
  menu.addEventListener('keydown', (e) => {
    const i = items.indexOf(document.activeElement);
    const n = items.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n].focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      items[e.key === 'Home' ? 0 : n - 1].focus();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      close(true);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) close(true);
  });
  // A tap outside closes the menu. On the bare scene that tap is used up
  // here, so it doesn't also hide the whole UI (see the visibility toggle).
  document.addEventListener('click', (e) => {
    if (menu.hidden || e.target.closest('#todBtn, .tod')) return;
    close(false);
    if (!e.target.closest(SCENE_UI_SEL)) e.stopPropagation();
  }, true);
  window.addEventListener('resize', () => { if (!menu.hidden) place(); });

  set(value);
  return { set };
}
