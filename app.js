const STORAGE_KEY = 'british-speaking-studio-progress-v2';
const LEGACY_KEY = 'british-studio-progress-v1';
const $ = (id) => document.getElementById(id);
const qs = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const defaultState = {
  done: [],
  difficult: [],
  favourites: [],
  currentIndex: 0,
  settings: { rate: 0.75, showThai: true, showIpa: true },
};

let lessons = [];
let audit = null;
let state = loadState();
let currentFilter = 'all';
let visibleLessonLimit = 48;
let playbackToken = 0;
let managedTimers = new Set();
let ukVoices = [];
let selectedVoice = null;
let shadowRate = 0.75;
let shadowRepeat = 1;
let mediaRecorder = null;
let recordingStream = null;
let recordingChunks = [];
let recordingUrl = '';

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (stored) return { ...structuredClone(defaultState), ...stored, settings: { ...defaultState.settings, ...(stored.settings || {}) } };
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    if (legacy) return { ...structuredClone(defaultState), done: Object.keys(legacy).filter((key) => legacy[key]) };
  } catch (error) {
    console.warn('Progress could not be read:', error);
  }
  return structuredClone(defaultState);
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (error) { showNotice('เบราว์เซอร์ไม่สามารถบันทึกความคืบหน้าได้ โปรดตรวจสอบการตั้งค่าพื้นที่จัดเก็บ'); }
}

const currentLesson = () => lessons[state.currentIndex] || lessons[0];
const has = (collection, id) => state[collection].includes(id);
function toggle(collection, id) {
  state[collection] = has(collection, id) ? state[collection].filter((item) => item !== id) : [...state[collection], id];
  saveState();
  renderAll();
}

function showNotice(message = '') {
  $('globalNotice').textContent = message;
  $('globalNotice').classList.toggle('hidden', !message);
}

function navigate(view, { replace = false } = {}) {
  const target = $(`view-${view}`) ? view : 'dashboard';
  stopPlayback();
  $$('.view').forEach((element) => element.classList.toggle('active', element.id === `view-${target}`));
  $$('.nav-item').forEach((element) => element.classList.toggle('active', element.dataset.view === target));
  const section = $(`view-${target}`);
  $('pageTitle').textContent = section.dataset.title;
  $('pageEyebrow').textContent = section.dataset.eyebrow;
  closeSidebar();
  if (target === 'lessons') renderLessonGrid();
  if (target === 'practice') renderPractice();
  if (target === 'shadowing') renderShadowing();
  if (target === 'progress') renderProgress();
  const nextHash = `#${target}`;
  if (location.hash !== nextHash) history[replace ? 'replaceState' : 'pushState'](null, '', nextHash);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openLesson(index, view = 'practice') {
  if (!lessons[index]) return;
  stopPlayback();
  state.currentIndex = index;
  saveState();
  renderAll();
  navigate(view);
}

function renderDashboard() {
  const total = lessons.length;
  const done = state.done.filter((id) => lessons.some((lesson) => lesson.id === id)).length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  $('dashboardTotal').textContent = total.toLocaleString('th-TH');
  $('dashboardDone').textContent = done.toLocaleString('th-TH');
  $('dashboardPercent').textContent = `${percent}%`;
  $('dashboardFavourites').textContent = state.favourites.length.toLocaleString('th-TH');
  $('dashboardRemaining').textContent = done ? `เหลืออีก ${Math.max(0, total - done)} บทเรียน` : 'เริ่มบทเรียนแรก';
  $('sidebarPercent').textContent = `${percent}%`;
  $('sidebarProgressBar').style.width = `${percent}%`;
  $('sidebarProgressText').textContent = `${done} จาก ${total} บทเรียน`;
  const lesson = currentLesson();
  if (!lesson) return;
  $('currentLessonCard').innerHTML = `<div class="current-lesson"><span class="lesson-no">${lesson.number}</span><div><strong>${escapeHtml(lesson.word || 'Needs Review')}</strong><small>${escapeHtml(lesson.sentence || 'ข้อมูลประโยคต้องตรวจทาน')}</small></div><button aria-label="ฝึกบทเรียนนี้" data-open-current>→</button></div>`;
  qs('[data-open-current]', $('currentLessonCard')).onclick = () => navigate('practice');
}

function filteredLessons(query = $('lessonSearch')?.value || '') {
  const normalised = query.trim().toLocaleLowerCase('th-TH');
  return lessons.map((lesson, index) => ({ lesson, index })).filter(({ lesson }) => {
    if (currentFilter === 'done' && !has('done', lesson.id)) return false;
    if (currentFilter === 'todo' && has('done', lesson.id)) return false;
    if (currentFilter === 'favourite' && !has('favourites', lesson.id)) return false;
    if (currentFilter === 'difficult' && !has('difficult', lesson.id)) return false;
    if (currentFilter === 'review' && !lesson.flags.length) return false;
    const haystack = `${lesson.number} ${lesson.word} ${lesson.meaning} ${lesson.sentence} ${lesson.thai}`.toLocaleLowerCase('th-TH');
    return haystack.includes(normalised);
  });
}

function renderLessonGrid() {
  const results = filteredLessons();
  const visible = results.slice(0, visibleLessonLimit);
  $('lessonResultCount').textContent = `แสดง ${visible.length.toLocaleString('th-TH')} จาก ${results.length.toLocaleString('th-TH')} รายการ`;
  $('lessonGrid').replaceChildren(...visible.map(({ lesson, index }) => lessonCard(lesson, index)));
  $('loadMoreButton').classList.toggle('hidden', results.length <= visibleLessonLimit);
}

function lessonCard(lesson, index) {
  const button = document.createElement('button');
  button.className = `lesson-card${has('done', lesson.id) ? ' done' : ''}`;
  button.innerHTML = `<span class="number">${has('done', lesson.id) ? '✓' : lesson.number}</span><div><h3>${escapeHtml(lesson.word || 'ต้องตรวจทาน')}</h3><p>${escapeHtml(lesson.sentence || 'ไม่พบประโยค')}</p><small>PDF PAGE ${lesson.page}${lesson.flags.length ? ' · NEEDS REVIEW' : ''}</small></div><span class="card-flags">${has('favourites', lesson.id) ? '♥' : lesson.flags.length ? '●' : '→'}</span>`;
  button.onclick = () => openLesson(index);
  return button;
}

function renderRail() {
  const query = $('railSearch').value.trim().toLocaleLowerCase('th-TH');
  const items = lessons.map((lesson, index) => ({ lesson, index })).filter(({ lesson }) => `${lesson.number} ${lesson.word}`.toLocaleLowerCase('th-TH').includes(query));
  $('railList').replaceChildren(...items.map(({ lesson, index }) => {
    const button = document.createElement('button');
    button.className = `rail-item${index === state.currentIndex ? ' active' : ''}`;
    button.innerHTML = `<span>${lesson.number}</span><div><strong>${escapeHtml(lesson.word || 'Needs Review')}</strong><small>${has('done', lesson.id) ? '✓ ฝึกแล้ว' : `หน้า ${lesson.page}`}</small></div>`;
    button.onclick = () => openLesson(index, 'practice');
    return button;
  }));
  requestAnimationFrame(() => qs('.rail-item.active', $('railList'))?.scrollIntoView({ block: 'nearest' }));
}

function renderPractice() {
  const lesson = currentLesson();
  if (!lesson) return;
  $('practiceNumber').textContent = `LESSON ${lesson.number}`;
  $('practicePage').textContent = `PDF PAGE ${lesson.page}`;
  $('practiceWord').textContent = lesson.word || 'ต้องตรวจทาน';
  $('practiceMeaning').textContent = lesson.meaning || 'ไม่มีข้อมูลคำแปลที่ตรวจสอบได้';
  $('practiceWordIpa').textContent = lesson.wordIpa ? `/${lesson.wordIpa.replace(/^\/+|\/+$/g, '')}/` : 'ไม่มีข้อมูล IPA';
  $('practiceSentence').textContent = lesson.sentence || 'ไม่พบประโยคที่ตรวจสอบได้';
  $('practiceThai').textContent = lesson.thai || 'คำแปลภาษาไทยต้องตรวจทาน';
  $('practiceSentenceIpa').textContent = lesson.ipa || 'IPA ประโยคต้องตรวจทาน';
  $('practiceReview').classList.toggle('hidden', !lesson.flags.length);
  $('reviewPanel').classList.toggle('hidden', !lesson.flags.length);
  $('reviewPanel').textContent = lesson.flags.length ? `Needs Review: ${lesson.flags.join(', ')} — โปรดตรวจเทียบกับ PDF ต้นฉบับก่อนแก้ไขข้อมูล` : '';
  $('practiceThai').classList.toggle('hidden', !state.settings.showThai);
  $('practiceSentenceIpa').classList.toggle('hidden', !state.settings.showIpa);
  $('practiceWordIpa').classList.toggle('hidden', !state.settings.showIpa);
  $('practiceSpeed').value = String(state.settings.rate);
  $('showThai').checked = state.settings.showThai;
  $('showIpa').checked = state.settings.showIpa;
  setToggleButton('toggleDone', 'done', lesson.id, '✓ ฝึกแล้ว', '✓ ทำเครื่องหมายว่าฝึกแล้ว');
  setToggleButton('toggleDifficult', 'difficult', lesson.id, '◆ อ่านยาก', '◇ อ่านยาก');
  setToggleButton('toggleFavourite', 'favourites', lesson.id, '♥ รายการโปรด', '♡ รายการโปรด');
  $('previousLesson').disabled = state.currentIndex === 0;
  $('nextLesson').disabled = state.currentIndex === lessons.length - 1;
  $('lessonPosition').textContent = `${state.currentIndex + 1} / ${lessons.length}`;
  renderRail();
}

function setToggleButton(buttonId, collection, id, activeText, inactiveText) {
  const button = $(buttonId);
  const active = has(collection, id);
  button.classList.toggle('active', active);
  button.textContent = active ? activeText : inactiveText;
}

function renderShadowing() {
  const lesson = currentLesson();
  if (!lesson) return;
  $('shadowLessonLabel').textContent = `LESSON ${lesson.number} · ${lesson.word || 'Needs Review'}`;
  $('shadowSentence').textContent = lesson.sentence || 'ไม่พบประโยคที่ตรวจสอบได้';
  $('shadowThai').textContent = lesson.thai || 'คำแปลภาษาไทยต้องตรวจทาน';
  $('shadowIpa').textContent = lesson.ipa || 'IPA ประโยคต้องตรวจทาน';
  $('shadowFavourite').textContent = has('favourites', lesson.id) ? '♥' : '♡';
  $('roundProgress').textContent = `0 / ${shadowRepeat}`;
  $('roundProgressBar').style.width = '0%';
  setShadowStatus('พร้อมเริ่มฝึก');
}

function renderProgress() {
  const percent = lessons.length ? Math.round((state.done.length / lessons.length) * 100) : 0;
  $('progressRingText').textContent = `${percent}%`;
  $('progressRing').style.setProperty('--progress', `${percent * 3.6}deg`);
  $('progressHeadline').textContent = percent ? `คุณฝึกแล้ว ${state.done.length} บทเรียน` : 'เริ่มต้นการเดินทางของคุณ';
  $('progressCopy').textContent = percent ? `อีก ${Math.max(0, lessons.length - state.done.length)} บทเรียนจะครบทั้งชุด ฝึกต่ออย่างสม่ำเสมอ` : 'เลือกบทเรียนแรก แล้วฝึกฟังและพูดตามในแบบของคุณ';
  renderMiniList('favouriteList', 'favourites', 'ยังไม่มีรายการโปรด');
  renderMiniList('difficultList', 'difficult', 'ยังไม่มีคำศัพท์ที่ทำเครื่องหมายว่าอ่านยาก');
  $('favouriteCount').textContent = state.favourites.length;
  $('difficultCount').textContent = state.difficult.length;
}

function renderMiniList(elementId, collection, emptyText) {
  const selected = state[collection].map((id) => ({ lesson: lessons.find((lesson) => lesson.id === id), index: lessons.findIndex((lesson) => lesson.id === id) })).filter(({ lesson }) => lesson).slice(0, 8);
  if (!selected.length) { $(elementId).innerHTML = `<p class="mini-empty">${emptyText}</p>`; return; }
  $(elementId).replaceChildren(...selected.map(({ lesson, index }) => {
    const button = document.createElement('button');
    button.className = 'mini-item';
    button.innerHTML = `<span>${lesson.number}</span><div><strong>${escapeHtml(lesson.word || 'Needs Review')}</strong><small>${escapeHtml(lesson.sentence || 'ข้อมูลต้องตรวจทาน')}</small></div><b>→</b>`;
    button.onclick = () => openLesson(index);
    return button;
  }));
}

function renderAll() {
  renderDashboard();
  renderPractice();
  renderProgress();
  if ($('view-lessons').classList.contains('active')) renderLessonGrid();
  if ($('view-shadowing').classList.contains('active')) renderShadowing();
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function refreshVoices() {
  if (!('speechSynthesis' in window)) {
    selectedVoice = null;
    setVoiceState('เบราว์เซอร์ไม่รองรับระบบเสียง', true);
    return;
  }
  const voices = speechSynthesis.getVoices();
  ukVoices = voices.filter((voice) => /^en[-_]GB$/i.test(voice.lang));
  selectedVoice = ukVoices.find((voice) => /natural|sonia|libby|ryan|george/i.test(voice.name)) || ukVoices[0] || null;
  if (selectedVoice) {
    setVoiceState(`${selectedVoice.name} · en-GB`, false);
    showNotice('');
  } else if (voices.length) {
    setVoiceState('ไม่พบเสียง British English', true);
    showNotice('ไม่พบเสียง en-GB บนอุปกรณ์นี้ ระบบจะไม่เปลี่ยนไปใช้ American English โดยอัตโนมัติ โปรดติดตั้งเสียง English (United Kingdom) ในการตั้งค่าระบบ แล้วเปิดหน้านี้ใหม่');
  } else {
    setVoiceState('กำลังตรวจสอบเสียง UK…', false);
  }
}

function setVoiceState(text, isError) {
  $('voiceChip').querySelector('span').textContent = text;
  $('voiceChip').classList.toggle('error', isError);
  ['speakWord', 'speakSentence', 'repeatSentence', 'startShadowing', 'playOriginal'].forEach((id) => { $(id).disabled = isError; });
}

function clearManagedTimers() {
  managedTimers.forEach((timer) => { clearTimeout(timer); clearInterval(timer); });
  managedTimers.clear();
}

function stopPlayback(updateStatus = true) {
  playbackToken += 1;
  clearManagedTimers();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  $('countdown')?.classList.add('hidden');
  if (updateStatus && $('shadowStatus')) setShadowStatus('หยุดการเล่นเสียงแล้ว');
}

function speechText(text) {
  return String(text || '').replace(/[←⇌∞≠⑫⑯⑱⑲ー]/g, ' ').replace(/\s+/g, ' ').trim();
}

function speakOnce(text, rate, token = playbackToken) {
  return new Promise((resolve) => {
    if (!selectedVoice || token !== playbackToken || !text) { resolve(false); return; }
    const utterance = new SpeechSynthesisUtterance(speechText(text));
    utterance.lang = 'en-GB';
    utterance.voice = selectedVoice;
    utterance.rate = Number(rate);
    utterance.pitch = 1;
    utterance.onend = () => resolve(token === playbackToken);
    utterance.onerror = (event) => {
      if (event.error !== 'canceled' && event.error !== 'interrupted') showNotice(`เล่นเสียงไม่สำเร็จ: ${event.error}`);
      resolve(false);
    };
    speechSynthesis.speak(utterance);
  });
}

async function playText(text, { rate = state.settings.rate, repeat = 1 } = {}) {
  stopPlayback(false);
  if (!selectedVoice) { refreshVoices(); return; }
  const token = playbackToken;
  for (let round = 1; round <= repeat; round += 1) {
    if (token !== playbackToken) return;
    const completed = await speakOnce(text, rate, token);
    if (!completed) return;
    if (round < repeat) await delay(900, token);
  }
}

function delay(milliseconds, token) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { managedTimers.delete(timer); resolve(token === playbackToken); }, milliseconds);
    managedTimers.add(timer);
  });
}

function setShadowStatus(text) { $('shadowStatus').querySelector('span').textContent = text; }

async function runCountdown(seconds, token) {
  const countdown = $('countdown');
  countdown.classList.remove('hidden');
  for (let remaining = seconds; remaining >= 1; remaining -= 1) {
    if (token !== playbackToken) return false;
    countdown.querySelector('strong').textContent = remaining;
    countdown.querySelector('span').textContent = 'ถึงเวลาพูดตาม';
    const active = await delay(1000, token);
    if (!active) return false;
  }
  countdown.classList.add('hidden');
  return token === playbackToken;
}

async function startShadowing() {
  stopPlayback(false);
  if (!selectedVoice) { refreshVoices(); return; }
  const token = playbackToken;
  const lesson = currentLesson();
  const pause = Number($('pauseDuration').value);
  for (let round = 1; round <= shadowRepeat; round += 1) {
    if (token !== playbackToken) return;
    $('roundProgress').textContent = `${round} / ${shadowRepeat}`;
    $('roundProgressBar').style.width = `${((round - 1) / shadowRepeat) * 100}%`;
    setShadowStatus(`กำลังฟังรอบที่ ${round} จาก ${shadowRepeat}`);
    const spoken = await speakOnce(lesson.sentence, shadowRate, token);
    if (!spoken) return;
    setShadowStatus(`พูดตามได้เลย · รอบ ${round} จาก ${shadowRepeat}`);
    const continued = await runCountdown(pause, token);
    if (!continued) return;
    $('roundProgressBar').style.width = `${(round / shadowRepeat) * 100}%`;
  }
  setShadowStatus(`ฝึกครบ ${shadowRepeat} รอบแล้ว`);
}

async function toggleRecording() {
  if (mediaRecorder?.state === 'recording') { mediaRecorder.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    $('recordingStatus').textContent = 'การอัดเสียงต้องใช้ HTTPS หรือ localhost และเบราว์เซอร์ที่รองรับ MediaRecorder';
    return;
  }
  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingChunks = [];
    mediaRecorder = new MediaRecorder(recordingStream);
    mediaRecorder.ondataavailable = (event) => { if (event.data.size) recordingChunks.push(event.data); };
    mediaRecorder.onstop = finishRecording;
    mediaRecorder.start();
    $('recordButton').classList.add('recording');
    $('recordButton').querySelector('span').textContent = 'Stop';
    $('recordingStatus').textContent = 'กำลังอัดเสียง… กด Stop เมื่อพูดจบ';
  } catch (error) {
    $('recordingStatus').textContent = error.name === 'NotAllowedError' ? 'ไม่ได้รับอนุญาตใช้ไมโครโฟน โปรดอนุญาตจากไอคอนข้างแถบที่อยู่แล้วลองใหม่' : `ไมโครโฟนใช้งานไม่ได้: ${error.message}`;
  }
}

function finishRecording() {
  recordingStream?.getTracks().forEach((track) => track.stop());
  if (recordingUrl) URL.revokeObjectURL(recordingUrl);
  const mimeType = mediaRecorder.mimeType || 'audio/webm';
  recordingUrl = URL.createObjectURL(new Blob(recordingChunks, { type: mimeType }));
  $('recordingPlayer').src = recordingUrl;
  $('recordingPlayer').classList.remove('hidden');
  $('recordButton').classList.remove('recording');
  $('recordButton').querySelector('span').textContent = 'Record again';
  $('recordingStatus').textContent = 'อัดเสียงเสร็จแล้ว กด Playback เพื่อฟังและเปรียบเทียบกับเสียงต้นฉบับ';
}

function exportProgress() {
  const payload = { exportedAt: new Date().toISOString(), version: 2, progress: state };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'british-speaking-studio-progress.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openSidebar() { $('appSidebar').classList.add('open'); $('sidebarBackdrop').classList.remove('hidden'); }
function closeSidebar() { $('appSidebar').classList.remove('open'); $('sidebarBackdrop').classList.add('hidden'); }

function bindEvents() {
  $$('.nav-item').forEach((button) => button.onclick = () => navigate(button.dataset.view));
  $$('[data-go]').forEach((button) => button.onclick = () => navigate(button.dataset.go));
  $('continueButton').onclick = () => navigate('practice');
  $('menuButton').onclick = openSidebar;
  $('sidebarBackdrop').onclick = closeSidebar;
  $('lessonSearch').oninput = () => { visibleLessonLimit = 48; renderLessonGrid(); };
  $('filterTabs').onclick = (event) => {
    const button = event.target.closest('button[data-filter]'); if (!button) return;
    currentFilter = button.dataset.filter; visibleLessonLimit = 48;
    $$('#filterTabs button').forEach((item) => item.classList.toggle('active', item === button));
    renderLessonGrid();
  };
  $('loadMoreButton').onclick = () => { visibleLessonLimit += 48; renderLessonGrid(); };
  $('railSearch').oninput = renderRail;
  $('previousLesson').onclick = () => openLesson(state.currentIndex - 1, 'practice');
  $('nextLesson').onclick = () => openLesson(state.currentIndex + 1, 'practice');
  $('speakWord').onclick = () => playText(currentLesson().word);
  $('speakSentence').onclick = () => playText(currentLesson().sentence);
  $('repeatSentence').onclick = () => playText(currentLesson().sentence, { repeat: 3 });
  $('stopAudio').onclick = () => stopPlayback();
  $('practiceSpeed').onchange = (event) => { state.settings.rate = Number(event.target.value); saveState(); };
  $('showThai').onchange = (event) => { state.settings.showThai = event.target.checked; saveState(); renderPractice(); };
  $('showIpa').onchange = (event) => { state.settings.showIpa = event.target.checked; saveState(); renderPractice(); };
  $('toggleDone').onclick = () => toggle('done', currentLesson().id);
  $('toggleDifficult').onclick = () => toggle('difficult', currentLesson().id);
  $('toggleFavourite').onclick = () => toggle('favourites', currentLesson().id);
  $('shadowFavourite').onclick = () => toggle('favourites', currentLesson().id);
  $('startShadowing').onclick = startShadowing;
  $('stopShadowing').onclick = () => stopPlayback();
  $('restartShadowing').onclick = startShadowing;
  $('shadowSpeed').onclick = (event) => {
    const button = event.target.closest('button[data-value]'); if (!button) return;
    shadowRate = Number(button.dataset.value); $$('#shadowSpeed button').forEach((item) => item.classList.toggle('active', item === button)); stopPlayback(false);
  };
  $('repeatCount').onclick = (event) => {
    const button = event.target.closest('button[data-value]'); if (!button) return;
    shadowRepeat = Number(button.dataset.value); $$('#repeatCount button').forEach((item) => item.classList.toggle('active', item === button)); renderShadowing();
  };
  $('pauseDuration').onchange = () => stopPlayback(false);
  $('recordButton').onclick = toggleRecording;
  $('playOriginal').onclick = () => playText(currentLesson().sentence, { rate: shadowRate });
  $('exportProgress').onclick = exportProgress;
  window.addEventListener('hashchange', () => navigate(location.hash.slice(1), { replace: true }));
  window.addEventListener('beforeunload', () => { stopPlayback(false); recordingStream?.getTracks().forEach((track) => track.stop()); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlayback(false); });
}

async function initialise() {
  try {
    const [lessonResponse, auditResponse] = await Promise.all([fetch('/data/lessons.json'), fetch('/data/audit.json')]);
    if (!lessonResponse.ok) throw new Error(`Lessons request failed (${lessonResponse.status})`);
    lessons = await lessonResponse.json();
    if (auditResponse.ok) audit = await auditResponse.json();
    state.currentIndex = Math.min(Math.max(0, Number(state.currentIndex) || 0), lessons.length - 1);
    state.done = state.done.filter((id) => lessons.some((lesson) => lesson.id === id));
    state.difficult = state.difficult.filter((id) => lessons.some((lesson) => lesson.id === id));
    state.favourites = state.favourites.filter((id) => lessons.some((lesson) => lesson.id === id));
    bindEvents();
    renderAll();
    if ('speechSynthesis' in window) {
      refreshVoices();
      speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
      setTimeout(refreshVoices, 800);
    } else refreshVoices();
    navigate(location.hash.slice(1) || 'dashboard', { replace: true });
    console.info(`British Speaking Studio ready: ${lessons.length} lessons, ${audit?.needsReviewCount ?? 'unknown'} need review.`);
  } catch (error) {
    console.error(error);
    showNotice('โหลดข้อมูลบทเรียนไม่สำเร็จ โปรดลองรีเฟรชหน้าเว็บ หรือแจ้งผู้ดูแลระบบ');
    $('currentLessonCard').innerHTML = '<p class="mini-empty">ไม่สามารถโหลดข้อมูลบทเรียนได้</p>';
  }
}

initialise();
