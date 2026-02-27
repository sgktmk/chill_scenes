/**
 * Shared Scene UI — Audio Control & Screenshot
 *
 * initSceneAudio({ onStart, onStop, onVolumeChange })
 *   Callback-based API for scene audio toggle and volume control.
 *
 * initSceneScreenshot(svgEl, filename)
 *   Captures the current SVG state and downloads it as a PNG.
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

function initSceneScreenshot(svgEl, filename) {
  const btn = document.getElementById('ssBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const vb = svgEl.viewBox.baseVal;
      const canvas = document.createElement('canvas');
      canvas.width = vb.width * 2;
      canvas.height = vb.height * 2;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.download = filename || 'scene.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = url;
  });
}
