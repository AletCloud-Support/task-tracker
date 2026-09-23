const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'tasks.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function loadTasks() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2));
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['todo', 'in-progress', 'done'];

async function handleApi(req, res, url) {
  const tasks = loadTasks();
  const match = url.pathname.match(/^\/api\/tasks\/([\w-]+)$/);

  if (url.pathname === '/api/tasks' && req.method === 'GET') {
    return send(res, 200, tasks);
  }

  if (url.pathname === '/api/tasks' && req.method === 'POST') {
    const body = await readBody(req);
    const title = String(body.title || '').trim();
    if (!title) return send(res, 400, { error: 'Title is required' });
    const task = {
      id: crypto.randomUUID(),
      title,
      description: String(body.description || '').trim(),
      priority: PRIORITIES.includes(body.priority) ? body.priority : 'medium',
      status: 'todo',
      dueDate: body.dueDate || null,
      createdAt: new Date().toISOString(),
    };
    tasks.push(task);
    saveTasks(tasks);
    return send(res, 201, task);
  }

  if (match) {
    const idx = tasks.findIndex((t) => t.id === match[1]);
    if (idx === -1) return send(res, 404, { error: 'Task not found' });

    if (req.method === 'PATCH') {
      const body = await readBody(req);
      const task = tasks[idx];
      if (body.title !== undefined) {
        const title = String(body.title).trim();
        if (!title) return send(res, 400, { error: 'Title cannot be empty' });
        task.title = title;
      }
      if (body.description !== undefined) task.description = String(body.description).trim();
      if (PRIORITIES.includes(body.priority)) task.priority = body.priority;
      if (STATUSES.includes(body.status)) task.status = body.status;
      if (body.dueDate !== undefined) task.dueDate = body.dueDate || null;
      saveTasks(tasks);
      return send(res, 200, task);
    }

    if (req.method === 'DELETE') {
      tasks.splice(idx, 1);
      saveTasks(tasks);
      return send(res, 204);
    }
  }

  send(res, 404, { error: 'Not found' });
}

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

function serveStatic(res, pathname) {
  const file = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'Forbidden' });
  fs.readFile(file, (err, content) => {
    if (err) return send(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(content);
  });
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
      else serveStatic(res, url.pathname);
    } catch (err) {
      send(res, 400, { error: err.message });
    }
  })
  .listen(PORT, () => console.log(`Task tracker running at http://localhost:${PORT}`));
