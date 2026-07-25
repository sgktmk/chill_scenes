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
    const ui = () => document.querySelectorAll('.ap, .back');
    let hidden = false;
    let timer;

    function show() {
      hidden = false;
      clearTimeout(timer);
      ui().forEach(el => el.classList.remove('ui-hidden'));
      if (document.fullscreenElement) {
        timer = setTimeout(hide, 3000);
      }
    }
    function hide() {
      hidden = true;
      clearTimeout(timer);
      ui().forEach(el => el.classList.add('ui-hidden'));
    }

    // Tap anywhere except on UI elements toggles visibility
    document.addEventListener('click', (e) => {
      if (e.target.closest('.ap, .back')) return;
      hidden ? show() : hide();
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
