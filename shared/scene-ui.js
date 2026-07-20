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
