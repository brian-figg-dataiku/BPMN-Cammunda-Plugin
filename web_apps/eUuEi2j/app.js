// Sample Collection Process webapp frontend
// Multi-step flow with backend persistence

let BPMN_STEP_MAP = null;

async function api(route, payload, method) {
  const res = await fetch(getWebAppBackendUrl(route), {
    method: method || 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(payload || {})
  });
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); } catch (e) { data = { raw: txt }; }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) ? (data.error || data.message) : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function loadBpmnStepMap() {
  try {
    const r = await api('bpmn_summary', null, 'GET');
    BPMN_STEP_MAP = r.stepMap || null;
  } catch (e) {
    // Non-blocking
    BPMN_STEP_MAP = null;
  }
}


function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.substring(2), v);
      else node.setAttribute(k, v);
    });
  }
  (children || []).forEach(c => {
    if (c === null || c === undefined) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

function setView(title, contentNode) {
  document.getElementById('page-title').textContent = title || '';
  const root = document.getElementById('app');
  root.innerHTML = '';

  if (BPMN_STEP_MAP) {
    root.appendChild(el('div', { class: 'muted', style: 'margin-bottom:10px' },
      `BPMN step ids (auto-mapped): ${JSON.stringify(BPMN_STEP_MAP)}`
    ));
  }

  root.appendChild(contentNode);
}


function showError(err) {
  const msg = (err && err.message) ? err.message : String(err);
  const box = document.getElementById('global-message');
  box.textContent = msg;
  box.style.display = 'block';
  box.className = 'message error';
}

function showInfo(msg) {
  const box = document.getElementById('global-message');
  box.textContent = msg;
  box.style.display = 'block';
  box.className = 'message info';
}

function clearMessage() {
  const box = document.getElementById('global-message');
  box.textContent = '';
  box.style.display = 'none';
}

function navigate(hash) {
  window.location.hash = hash;
}

function viewHome() {
  clearMessage();
  const card = el('div', { class: 'card' },
    el('h2', null, 'Sample Collection Process'),
    el('p', { class: 'muted' }, 'Click start to begin the sample collection workflow.'),
    el('button', { class: 'primary', onclick: () => navigate('#manufacturing-ended') }, 'Start Process')
  );
  setView('Home', card);
}

function viewManufacturingEnded() {
  clearMessage();
  const yesBtn = el('button', { class: 'primary', onclick: async () => {
    clearMessage();
    try {
      const r = await api('start_session', {});
      navigate(`#sample-details?session_id=${encodeURIComponent(r.session_id)}`);
    } catch (e) { showError(e); }
  }}, 'Yes');

  const noBtn = el('button', { class: 'secondary', onclick: async () => {
    showInfo('Please wait for manufacturing to end before taking the sample. Returning to home...');
    setTimeout(() => navigate('#home'), 1800);
  }}, 'No');

  const card = el('div', { class: 'card' },
    el('h2', null, 'Manufacturing status'),
    el('p', null, 'Has manufacturing ended?'),
    el('div', { class: 'row' }, yesBtn, noBtn)
  );
  setView('Manufacturing Ended?', card);
}

function getParam(paramName) {
  const h = window.location.hash || '';
  const idx = h.indexOf('?');
  if (idx < 0) return null;
  const qs = h.substring(idx + 1);
  const p = new URLSearchParams(qs);
  return p.get(paramName);
}

function requireSessionId() {
  const sessionId = getParam('session_id');
  if (!sessionId) {
    showError('Missing session_id. Returning to home.');
    setTimeout(() => navigate('#home'), 1500);
    return null;
  }
  return sessionId;
}

function viewSampleDetails() {
  clearMessage();
  const sessionId = requireSessionId();
  if (!sessionId) return;

  const select = el('select', { id: 'location', required: 'required' },
    el('option', { value: '' }, '-- Select a location --'),
    el('option', { value: 'Machine A Sample Port 1' }, 'Machine A Sample Port 1'),
    el('option', { value: 'Machine A Sample Port 2' }, 'Machine A Sample Port 2'),
    el('option', { value: 'Machine B Sample Port 1' }, 'Machine B Sample Port 1'),
    el('option', { value: 'Machine B Sample Port 2' }, 'Machine B Sample Port 2')
  );

  const form = el('form', { onsubmit: async (evt) => {
    evt.preventDefault();
    clearMessage();
    try {
      const location = select.value;
      if (!location) throw new Error('Please choose a sample collection location.');
      await api('save_sample_collection_details', { session_id: sessionId, location });
      navigate(`#questionnaire?session_id=${encodeURIComponent(sessionId)}`);
    } catch (e) { showError(e); }
  }},
    el('label', null, 'Sample collection location'),
    select,
    el('div', { class: 'spacer' }),
    el('button', { class: 'primary', type: 'submit' }, 'Submit')
  );

  setView('Sample Collection Details', el('div', { class: 'card' },
    el('p', { class: 'muted' }, `Session: ${sessionId}`),
    form
  ));
}

function yesNoSelect(id) {
  return el('select', { id, required: 'required' },
    el('option', { value: '' }, '-- Select --'),
    el('option', { value: 'Yes' }, 'Yes'),
    el('option', { value: 'No' }, 'No')
  );
}

function viewQuestionnaire() {
  clearMessage();
  const sessionId = requireSessionId();
  if (!sessionId) return;

  const secondsInput = el('input', { id: 'sampling_seconds', type: 'number', min: '0', step: '1', required: 'required', placeholder: 'e.g. 45' });
  const sanitized = yesNoSelect('sanitized_60s');
  const ppe = yesNoSelect('ppe_present');
  const contamination = yesNoSelect('contamination_last_7_days');

  const form = el('form', { onsubmit: async (evt) => {
    evt.preventDefault();
    clearMessage();
    try {
      const payload = {
        session_id: sessionId,
        sampling_seconds: Number(secondsInput.value),
        sanitized_60s: sanitized.value,
        ppe_present: ppe.value,
        contamination_last_7_days: contamination.value
      };
      if (!Number.isFinite(payload.sampling_seconds)) throw new Error('Please enter the sampling duration in seconds.');
      if (!payload.sanitized_60s || !payload.ppe_present || !payload.contamination_last_7_days) throw new Error('Please answer all yes/no questions.');

      await api('save_process_adherence', payload);
      navigate(`#deviation?session_id=${encodeURIComponent(sessionId)}`);
    } catch (e) { showError(e); }
  }},
    el('label', null, 'How many seconds did sampling take?'),
    secondsInput,

    el('label', null, 'Was the sampling equipment sanitized and left to wait for 60 seconds?'),
    sanitized,

    el('label', null, 'Was PPE present?'),
    ppe,

    el('label', null, 'Was contamination detected in last 7 days?'),
    contamination,

    el('div', { class: 'spacer' }),
    el('button', { class: 'primary', type: 'submit' }, 'Submit')
  );

  setView('Process Adherence Questionnaire', el('div', { class: 'card' },
    el('p', { class: 'muted' }, `Session: ${sessionId}`),
    form
  ));
}

function viewDeviation() {
  clearMessage();
  const sessionId = requireSessionId();
  if (!sessionId) return;

  const sel = yesNoSelect('deviation');
  const form = el('form', { onsubmit: (evt) => {
    evt.preventDefault();
    clearMessage();
    const v = sel.value;
    if (!v) { showError('Please select yes/no.'); return; }
    if (v === 'Yes') navigate(`#deviation-confirmed?session_id=${encodeURIComponent(sessionId)}`);
    else navigate(`#sample-returned?session_id=${encodeURIComponent(sessionId)}`);
  }},
    el('label', null, 'Was there a deviation?'),
    sel,
    el('div', { class: 'spacer' }),
    el('button', { class: 'primary', type: 'submit' }, 'Continue')
  );

  setView('Deviation', el('div', { class: 'card' },
    el('p', { class: 'muted' }, `Session: ${sessionId}`),
    form
  ));
}

function viewDeviationConfirmed() {
  clearMessage();
  const sessionId = requireSessionId();
  if (!sessionId) return;

  const sel = yesNoSelect('deviation_confirmed');
  const form = el('form', { onsubmit: async (evt) => {
    evt.preventDefault();
    clearMessage();
    try {
      const v = sel.value;
      if (!v) throw new Error('Please select yes/no.');
      await api('save_deviation', { session_id: sessionId, deviation: 'Yes', deviation_confirmed: v });
      if (v === 'Yes') {
        showInfo('Deviation recorded. Returning to home...');
        setTimeout(() => navigate('#home'), 1400);
      } else {
        // If deviation not confirmed, proceed to sample returned step
        navigate(`#sample-returned?session_id=${encodeURIComponent(sessionId)}`);
      }
    } catch (e) { showError(e); }
  }},
    el('label', null, 'Was the deviation confirmed?'),
    sel,
    el('div', { class: 'spacer' }),
    el('button', { class: 'primary', type: 'submit' }, 'Submit')
  );

  setView('Deviation Confirmed', el('div', { class: 'card' },
    el('p', { class: 'muted' }, `Session: ${sessionId}`),
    form
  ));
}

function viewSampleReturned() {
  setView('Deviation Confirmed', el('div', { class: 'card' },
    el('p', { class: 'muted' }, `Session: ${sessionId}`),
    form
  ));
}

function viewSampleReturned() {
  clearMessage();
  const sessionId = requireSessionId();
  if (!sessionId) return;

  const sel = yesNoSelect('sample_returned');
  const form = el('form', { onsubmit: async (evt) => {
    evt.preventDefault();
    clearMessage();
    try {
      const v = sel.value;
      if (!v) throw new Error('Please select yes/no.');
      await api('save_sample_returned', { session_id: sessionId, sample_returned: v });
      if (v === 'Yes') {
        await api('finalize_to_master_sample_data', { session_id: sessionId });
        showInfo('Saved to master sample data. Returning to home...');
        setTimeout(() => navigate('#home'), 1400);
      } else {
        showInfo('Recorded. Returning to home...');
        setTimeout(() => navigate('#home'), 1400);
      }
    } catch (e) { showError(e); }
  }},
    el('label', null, 'Was the sample returned?'),
    sel,
    el('div', { class: 'spacer' }),
    el('button', { class: 'primary', type: 'submit' }, 'Submit')
  );

  setView('Sample Returned', el('div', { class: 'card' },
    el('p', { class: 'muted' }, `Session: ${sessionId}`),
    form
  ));
}

function route() {
  const hash = (window.location.hash || '#home');
  const path = hash.split('?')[0];
  if (path === '#home' || path === '#') return viewHome();
  if (path === '#manufacturing-ended') return viewManufacturingEnded();
  if (path === '#sample-details') return viewSampleDetails();
  if (path === '#questionnaire') return viewQuestionnaire();
  if (path === '#deviation') return viewDeviation();
  if (path === '#deviation-confirmed') return viewDeviationConfirmed();
  if (path === '#sample-returned') return viewSampleReturned();

  // fallback
  navigate('#home');
}

window.addEventListener('hashchange', route);
window.addEventListener('load', async () => {
  await loadBpmnStepMap();
  route();
});