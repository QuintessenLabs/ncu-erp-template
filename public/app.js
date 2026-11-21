// Front end: plain JavaScript, no build step, no framework.
// Server data is always inserted with textContent (never innerHTML) to avoid script injection.

// Attendance below this percentage is highlighted. Change to your institution's rule.
const MIN_ATTENDANCE = 75;

const $ = (selector) => document.querySelector(selector);
const panel = $('#panel');
const loginView = $('#login-view');
const appView = $('#app-view');
const account = $('#account');
const loading = $('#loading');

let currentTab = 'attendance';

// ---- tiny DOM helper ----
function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function table(headers, bodyRows, emptyText = 'No records.') {
  const rows = bodyRows.length
    ? bodyRows
    : [h('tr', {}, h('td', { colspan: headers.length, class: 'muted' }, emptyText))];
  return h('div', { class: 'table-wrap' },
    h('table', {},
      h('thead', {}, h('tr', {}, headers.map((text) => h('th', { scope: 'col' }, text)))),
      h('tbody', {}, rows)));
}

const show = (value) => (value === null || value === undefined || value === '' ? '–' : value);

// ---- API helper ----
async function api(path, options = {}) {
  const init = { method: options.method ?? 'GET', headers: { Accept: 'application/json' }, credentials: 'same-origin' };
  if (options.body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---- views ----
function showLogin(message = '') {
  appView.hidden = true;
  account.hidden = true;
  loginView.hidden = false;
  const errorBox = $('#login-error');
  errorBox.hidden = !message;
  errorBox.textContent = message;
}

function showApp(user) {
  loginView.hidden = true;
  appView.hidden = false;
  account.hidden = false;
  $('#user-name').textContent = user?.name || 'Signed in';
  selectTab(currentTab);
}

function selectTab(tab) {
  currentTab = tab;
  for (const button of document.querySelectorAll('[role="tab"]')) {
    button.setAttribute('aria-selected', String(button.dataset.tab === tab));
  }
  renderTab(tab);
}

async function renderTab(tab) {
  panel.replaceChildren();
  loading.hidden = false;
  try {
    const node = await views[tab]();
    panel.replaceChildren(node);
  } catch (err) {
    if (err.status === 401) return showLogin('Your session ended. Please log in again.');
    panel.replaceChildren(h('p', { class: 'error' }, err.message));
  } finally {
    loading.hidden = true;
  }
}

const badge = (percent) => {
  if (percent === null || percent === undefined) return h('span', { class: 'badge' }, '–');
  const low = percent < MIN_ATTENDANCE;
  return h('span', { class: low ? 'badge low' : 'badge ok' }, `${percent.toFixed(2)}%`);
};

const views = {
  async attendance() {
    const { courses } = await api('/api/attendance');
    const rows = courses.map((c) => h('tr', {
      class: 'clickable',
      tabindex: '0',
      onclick: () => showCourseDetail(c),
      onkeydown: (event) => { if (event.key === 'Enter') showCourseDetail(c); },
    },
      h('td', {}, show(c.courseName)),
      h('td', {}, show(c.courseCode)),
      h('td', {}, `${show(c.present)} / ${show(c.totalLectures)}`),
      h('td', {}, badge(c.percentage))));
    return h('div', {},
      h('h2', {}, 'Attendance'),
      h('p', { class: 'muted' }, `Highlighted in red when below ${MIN_ATTENDANCE}%. Select a course for lecture-by-lecture details.`),
      table(['Course', 'Code', 'Present / total', 'Attendance'], rows, 'No attendance records yet.'),
      h('div', { id: 'detail' }));
  },

  async schedule() {
    const lectures = await api('/api/schedule');
    const rows = lectures.map((l) => h('tr', {},
      h('td', {}, show(l.date)), h('td', {}, show(l.timing)), h('td', {}, show(l.courseName)),
      h('td', {}, show(l.faculty)), h('td', {}, show(l.room))));
    return h('div', {}, h('h2', {}, 'Timetable'),
      table(['Date', 'Time', 'Course', 'Faculty', 'Room'], rows, 'No lectures listed.'));
  },

  async marks() {
    const marks = await api('/api/marks');
    const rows = marks.map((m) => h('tr', {},
      h('td', {}, show(m.courseName)), h('td', {}, show(m.component)),
      h('td', {}, `${show(m.obtained)} / ${show(m.max)}`)));
    return h('div', {}, h('h2', {}, 'Internal marks'),
      table(['Course', 'Component', 'Marks'], rows, 'No marks published yet.'));
  },

  async datesheet() {
    const sheet = await api('/api/datesheet');
    const rows = sheet.map((e) => h('tr', {},
      h('td', {}, show(e.courseName)), h('td', {}, show(e.date)),
      h('td', {}, show(e.startTime)), h('td', {}, show(e.room)), h('td', {}, show(e.seat))));
    return h('div', {}, h('h2', {}, 'Exam date sheet'),
      table(['Course', 'Date', 'Start', 'Room', 'Seat'], rows, 'No exams listed.'));
  },

  async courses() {
    const courses = await api('/api/courses');
    const rows = courses.map((c) => h('tr', {},
      h('td', {}, show(c.courseDetails)), h('td', {}, show(c.type)),
      h('td', {}, show(c.credits)), h('td', {}, show(c.mode))));
    return h('div', {}, h('h2', {}, 'Current courses'),
      table(['Course', 'Type', 'Credits', 'Mode'], rows, 'No courses registered.'));
  },

  async profile() {
    const p = await api('/api/profile');
    const items = [
      ['Name', p.name], ['Roll number', p.rollNo], ['Programme', p.programme],
      ['Degree level', p.degreeLevel], ['Semester', p.semester], ['Section', p.section],
    ];
    return h('div', {}, h('h2', {}, 'Profile'),
      h('dl', { class: 'facts' }, items.flatMap(([label, value]) => [h('dt', {}, label), h('dd', {}, show(value))])));
  },
};

async function showCourseDetail(course) {
  const box = $('#detail');
  if (!box) return;
  box.replaceChildren(h('p', { class: 'muted' }, `Loading ${course.courseName ?? course.courseCode}...`));
  try {
    const lectures = await api(`/api/attendance/${encodeURIComponent(course.courseCode)}`);
    const rows = lectures.map((l) => h('tr', {},
      h('td', {}, show(l.date)), h('td', {}, show(l.timing)), h('td', {}, show(l.faculty)),
      h('td', {}, show(l.status))));
    box.replaceChildren(h('h3', {}, course.courseName ?? course.courseCode),
      table(['Date', 'Time', 'Faculty', 'Status'], rows, 'No lectures recorded.'));
  } catch (err) {
    if (err.status === 401) return showLogin('Your session ended. Please log in again.');
    box.replaceChildren(h('p', { class: 'error' }, err.message));
  }
}

// ---- events ----
document.querySelectorAll('[role="tab"]').forEach((button) => {
  button.addEventListener('click', () => selectTab(button.dataset.tab));
});

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const username = form.username.value;
  const password = form.password.value;
  form.password.value = ''; // clear the field as early as possible
  const button = $('#login-btn');
  button.disabled = true;
  try {
    const { user } = await api('/api/login', { method: 'POST', body: { username, password } });
    showLogin();
    showApp(user);
  } catch (err) {
    showLogin(err.message);
  } finally {
    button.disabled = false;
  }
});

$('#logout-btn').addEventListener('click', async () => {
  try {
    await api('/api/logout', { method: 'POST', body: {} });
  } finally {
    showLogin('You have been logged out.');
  }
});

// On page load, reuse the server session if one exists.
(async () => {
  try {
    const { user } = await api('/api/session');
    showApp(user);
  } catch {
    showLogin();
  }
})();
