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
 * URL param ?ui=0 hides the back button and audio panel — used for
 * clean captures (thumbnails via tools/thumbs.sh, screenshots).
 */
if (new URLSearchParams(location.search).get('ui') === '0') {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.back, .ap').forEach((el) => { el.style.display = 'none'; });
  });
}

// Fullscreen button
(function () {
  // Inline style ensures these SVGs stay 14×14 even when scene CSS has a global svg{width:100%;height:100%} rule
  const SVG_OPEN = '<svg style="display:block;width:14px;height:14px;min-width:14px;flex-shrink:0" viewBox="0 0 12 12" fill="none" stroke="rgba(255,180,80,.7)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">';
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

// Auto-hide UI after 3 s of inactivity in fullscreen; any touch/move restores it
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const ui = () => document.querySelectorAll('.ap, .back');
    let timer;

    function show() {
      clearTimeout(timer);
      ui().forEach(el => el.classList.remove('ui-hidden'));
    }
    function scheduleHide() {
      clearTimeout(timer);
      timer = setTimeout(() => ui().forEach(el => el.classList.add('ui-hidden')), 3000);
    }
    function onActivity() {
      if (!document.fullscreenElement) return;
      show();
      scheduleHide();
    }

    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        show();
        scheduleHide();
      } else {
        clearTimeout(timer);
        show();
      }
    });

    ['mousemove', 'touchstart', 'touchend'].forEach(ev =>
      document.addEventListener(ev, onActivity, { passive: true })
    );
  });
}());

function initSceneAudio({ onStart, onStop, onVolumeChange }) {
  const btn = document.getElementById('aBtn');
  const slider = document.getElementById('vSl');
  const label = document.getElementById('vLb');
  let isPlaying = false;

  btn.addEventListener('click', () => {
    if (isPlaying) {
      isPlaying = false;
      btn.classList.remove('on');
      btn.querySelector('span').firstChild.textContent = '\u{1F507}';
      onStop();
    } else {
      isPlaying = true;
      btn.classList.add('on');
      btn.querySelector('span').firstChild.textContent = '\u{1F50A}';
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
