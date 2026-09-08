import { encode, decode, qrParts, PartCollector, MAX_CODE_LENGTH } from './transfer.js';
import { entryCounts, validateState } from './model.js';
import { PLANS, ageLabel } from './plans.js';
import { $, modal, openModal, error, btn, esc } from './ui.js';
import { icon } from './icons.js';

function entrySummary(state) {
  const counts = entryCounts(state);
  return `${counts.doses} vaccination entries · ${counts.illnesses} illness entries`;
}

// Each dialog has a session token. Late file/camera results cannot change a new dialog.
export function createTransferUI({ getState, isBlocked, save }) {
  let collector,
    cameraStream,
    cameraFrame,
    transferSession = 0,
    inputRevision = 0,
    cameraRevision = 0,
    cameraPending = false;
  function stopCamera() {
    cameraRevision++;
    cameraPending = false;
    cancelAnimationFrame(cameraFrame);
    cameraStream?.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  for (const event of ['close', 'dialogchange'])
    modal.addEventListener(event, () => {
      stopCamera();
      transferSession++;
      inputRevision++;
    });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCamera();
  });
  function transferDialog(tab = 'export') {
    collector = new PartCollector();
    openModal(
      'Your record, wherever you go.',
      `<p class="modal-intro">Move an exact copy between devices, without an account. Your code contains health information. Keep it private.</p>
        <div class="tabs transfer-tabs">
        <button data-action="transfer-tab" data-tab="export" class="${tab === 'export' ? 'active' : ''}" aria-pressed="${tab === 'export'}">Export & back up</button>
        <button data-action="transfer-tab" data-tab="import" class="${tab === 'import' ? 'active' : ''}" aria-pressed="${tab === 'import'}">Import a record</button>
        </div>
        <div id="transfer-content">
        </div>`,
    );
    if (tab === 'export') return showExport();
    else showImport();
  }
  async function showExport() {
    const session = transferSession;
    if (isBlocked()) {
      $('#transfer-content').innerHTML =
        `<p class="notice">The saved record is unreadable. Download the original data for recovery.</p>${btn('raw-backup', 'Download saved data', 'download')}`;
      return;
    }
    const code = encode(getState()),
      parts = await qrParts(code);
    if (session !== transferSession || !modal.open) return;
    const { default: QRCode } = await import('qrcode');
    if (session !== transferSession || !modal.open) return;
    let current = 0;
    $('#transfer-content').innerHTML = `<div class="qr-wrap">
        <canvas id="qr-canvas" role="img" aria-label="Vaccination transfer QR code">
        </canvas>
        <div class="qr-controls">
        <button id="qr-prev" class="icon-btn" aria-label="Previous QR code">←</button>
        <span id="qr-page">
        </span>
        <button id="qr-next" class="icon-btn" aria-label="Next QR code">→</button>
        </div>
        </div>
        <p class="small muted">${parts.length === 1 ? 'Scan with your phone camera to open this site and preview the import.' : 'On the receiving device, open Import and scan or upload every QR code. Parts can be scanned in any order.'}</p>
        <label class="field">Or use your transfer code<textarea id="export-code" readonly spellcheck="false">${code}</textarea>
        </label>
        <div class="transfer-options">${btn('copy-code', 'Copy code', 'sync')}${btn('download-code', 'Save backup', 'download')}<button class="btn" id="save-qr">${icon('qr')}Save QR image</button>
        </div>
        <p class="small muted">${entrySummary(getState())} · ${code.length.toLocaleString()} characters · Full replacement on import</p>`;
    async function draw() {
      $('#qr-page').textContent = `QR ${current + 1} of ${parts.length}`;
      $('#qr-prev').disabled = current === 0;
      $('#qr-next').disabled = current === parts.length - 1;
      const url = new URL(location.href);
      url.hash = '';
      url.search = '';
      url.hash = `transfer=${parts[current]}`;
      try {
        const payload = parts.length === 1 ? url.href : parts[current];
        const modules = QRCode.create(payload, { errorCorrectionLevel: 'M' }).modules.size + 8;
        const scale = Math.max(1, Math.floor(280 / modules));
        // Keep every QR module on whole display pixels; arbitrary CSS scaling can break scans.
        await QRCode.toCanvas($('#qr-canvas'), payload, {
          scale,
          margin: 4,
          errorCorrectionLevel: 'M',
          color: { dark: '#203c31', light: '#ffffff' },
        });
      } catch {
        error('Could not draw this QR code. You can still copy the code or save the backup.');
      }
    }
    $('#qr-prev').onclick = () => {
      current--;
      draw();
    };
    $('#qr-next').onclick = () => {
      current++;
      draw();
    };
    $('#save-qr').onclick = () => {
      const a = document.createElement('a');
      a.download = `diavaxx-qr-${current + 1}-of-${parts.length}.png`;
      a.href = $('#qr-canvas').toDataURL('image/png');
      a.click();
    };
    await draw();
  }
  function showImport() {
    $('#transfer-content').innerHTML =
      `<p class="small muted">Open Export on your other device, then paste its code, load a backup, or scan its QR code here.</p>
        <label class="field">Transfer code or link<textarea id="import-code" placeholder="DV2.… or EV1.…" spellcheck="false">
        </textarea>
        </label>${btn('preview-code', 'Preview import', 'arrow', 'primary')}<div class="transfer-options">
        <label class="btn file-btn">${icon('download')}Load backup<input type="file" id="backup-file" accept=".txt,.json,text/plain,application/json" aria-label="Load backup file">
        </label>
        <label class="btn file-btn">${icon('qr')}Upload QR<input type="file" id="qr-file" accept="image/*" aria-label="Upload QR image">
        </label>${btn('camera', 'Scan QR', 'qr')}</div>
        <div id="scan-area">
        </div>
        <p id="scan-progress" class="small muted" role="status">
        </p>
        <div id="import-preview">
        </div>
        <div class="notice">Import replaces all records and plan settings on this device. You’ll see a preview before anything changes.</div>`;
    $('#backup-file').onchange = async (e) => {
      const session = transferSession;
      const revision = ++inputRevision;
      $('#import-preview').innerHTML = '';
      error('');
      try {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > MAX_CODE_LENGTH) throw new Error('This file is too large.');
        const raw = await file.text();
        if (session !== transferSession || revision !== inputRevision) return;
        if (raw.trim().startsWith('{')) preview(validateState(JSON.parse(raw)));
        else receive(raw);
      } catch (e) {
        if (session === transferSession && revision === inputRevision) error(e.message);
      }
    };
    $('#qr-file').onchange = async (e) => {
      const session = transferSession;
      const revision = ++inputRevision;
      $('#import-preview').innerHTML = '';
      error('');
      try {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 15000000) throw new Error('Please choose an image smaller than 15 MB.');
        const url = URL.createObjectURL(file),
          img = new Image();
        try {
          img.src = url;
          await img.decode();
        } finally {
          URL.revokeObjectURL(url);
        }
        if (session !== transferSession || revision !== inputRevision) return;
        const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const { default: jsQR } = await import('jsqr');
        if (session !== transferSession || revision !== inputRevision) return;
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
          result = jsQR(pixels.data, pixels.width, pixels.height);
        if (!result)
          throw new Error(
            'No readable QR code found. Try a clearer image or use the transfer code.',
          );
        receive(result.data);
      } catch (e) {
        if (session === transferSession && revision === inputRevision) error(e.message);
      }
    };
  }
  function receive(raw) {
    inputRevision++;
    $('#import-preview').innerHTML = '';
    error('');
    try {
      const result = collector.add(raw);
      if (result.code) {
        const incoming = decode(result.code);
        stopCamera();
        preview(incoming);
      } else $('#scan-progress').textContent = result.progress;
    } catch (e) {
      error(e.message);
    }
  }
  function preview(incoming) {
    stopCamera();
    $('#scan-progress').textContent = '';
    $('#import-preview').innerHTML = `<div class="notice">
        <strong>Ready to import</strong>
        <br>${entrySummary(incoming)}.<br>${esc(PLANS.find((plan) => plan.id === incoming.settings.plan).name)} · ${ageLabel(incoming.settings.ageGroup)}.<br>This replaces ${entrySummary(getState())} on this device, plus preferences.</div>
        <div class="transfer-options">${btn('download-code', 'Back up current record', 'download')}<button id="confirm-import" class="btn primary">Replace with this record</button>
        </div>`;
    $('#confirm-import').onclick = () => {
      save(incoming, 'Your complete record has been imported.', { replace: true });
    };
  }
  async function startCamera() {
    if (cameraStream || cameraPending) {
      stopCamera();
      $('#scan-area').innerHTML = '';
      return;
    }
    const session = transferSession;
    const revision = ++cameraRevision;
    cameraPending = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          'Camera access is unavailable. Use HTTPS, upload a QR image, or paste the code.',
        );
      const { default: jsQR } = await import('jsqr');
      if (session !== transferSession || revision !== cameraRevision) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      if (session !== transferSession || revision !== cameraRevision || !modal.open) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      cameraPending = false;
      cameraStream = stream;
      $('#scan-area').innerHTML =
        '<video id="camera" autoplay muted playsinline></video><p class="small muted">Point the camera at the QR code. Tap Scan QR again to stop.</p>';
      const video = $('#camera');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas'),
        ctx = canvas.getContext('2d', { willReadFrequently: true });
      let last = 0,
        lastCode = '';
      function scan(time) {
        if (!cameraStream || session !== transferSession) return;
        if (video.readyState >= 2 && time - last > 250) {
          last = time;
          const scale = Math.min(1, 1000 / video.videoWidth);
          canvas.width = video.videoWidth * scale;
          canvas.height = video.videoHeight * scale;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
            result = jsQR(pixels.data, pixels.width, pixels.height);
          if (result && result.data !== lastCode) {
            lastCode = result.data;
            receive(result.data);
          }
        }
        if (cameraStream) cameraFrame = requestAnimationFrame(scan);
      }
      cameraFrame = requestAnimationFrame(scan);
    } catch (e) {
      if (session === transferSession && revision === cameraRevision) {
        stopCamera();
        error(`${e.message} You can also upload a QR image or paste the code.`);
      }
    }
  }

  document.addEventListener('input', (event) => {
    if (event.target.id === 'import-code') {
      inputRevision++;
      $('#import-preview').innerHTML = '';
      error('');
    }
  });
  return { transferDialog, receive, startCamera };
}
