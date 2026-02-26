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
 */
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
