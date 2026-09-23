const form = document.getElementById('task-form');
const list = document.getElementById('task-list');
const empty = document.getElementById('empty');
const summary = document.getElementById('summary');

let tasks = [];
let filter = 'all';

async function api(path, options = {}) {
  const res = await fetch(`/api/tasks${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok && res.status !== 204) {
    const { error } = await res.json().catch(() => ({}));
    throw new Error(error || res.statusText);
  }
  return res.status === 204 ? null : res.json();
}

async function load() {
  tasks = await api('');
  render();
}

function render() {
  const done = tasks.filter((t) => t.status === 'done').length;
  summary.textContent = `${tasks.length} task${tasks.length === 1 ? '' : 's'} · ${done} done`;

  const visible = tasks.filter((t) => filter === 'all' || t.status === filter);
  empty.hidden = visible.length > 0;
  list.replaceChildren(...visible.map(renderTask));
}

function renderTask(task) {
  const li = document.createElement('li');
  li.className = `task ${task.priority} ${task.status}`;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = task.status === 'done';
  checkbox.onchange = () => update(task.id, { status: checkbox.checked ? 'done' : 'todo' });

  const body = document.createElement('div');
  body.className = 'body';
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = task.title;
  body.append(title);
  if (task.description) {
    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = task.description;
    body.append(desc);
  }
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.append(`${task.priority} priority`);
  if (task.dueDate) {
    const due = document.createElement('span');
    const today = new Date().toISOString().slice(0, 10);
    if (task.dueDate < today && task.status !== 'done') due.className = 'overdue';
    due.textContent = ` · due ${task.dueDate}`;
    meta.append(due);
  }
  body.append(meta);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const status = document.createElement('select');
  for (const [value, label] of [['todo', 'To do'], ['in-progress', 'In progress'], ['done', 'Done']]) {
    status.add(new Option(label, value, false, value === task.status));
  }
  status.onchange = () => update(task.id, { status: status.value });
  const del = document.createElement('button');
  del.textContent = 'Delete';
  del.onclick = () => remove(task.id);
  actions.append(status, del);

  li.append(checkbox, body, actions);
  return li;
}

async function update(id, changes) {
  const updated = await api(`/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
  tasks = tasks.map((t) => (t.id === id ? updated : t));
  render();
}

async function remove(id) {
  if (!confirm('Delete this task?')) return;
  await api(`/${id}`, { method: 'DELETE' });
  tasks = tasks.filter((t) => t.id !== id);
  render();
}

form.onsubmit = async (e) => {
  e.preventDefault();
  const task = await api('', {
    method: 'POST',
    body: JSON.stringify({
      title: form.elements.title.value,
      description: form.elements.description.value,
      priority: form.elements.priority.value,
      dueDate: form.elements.dueDate.value || null,
    }),
  });
  tasks.push(task);
  form.reset();
  form.elements.priority.value = 'medium';
  render();
};

document.querySelectorAll('.filters button').forEach((btn) => {
  btn.onclick = () => {
    document.querySelector('.filters .active').classList.remove('active');
    btn.classList.add('active');
    filter = btn.dataset.filter;
    render();
  };
});

load().catch((err) => alert(err.message));
