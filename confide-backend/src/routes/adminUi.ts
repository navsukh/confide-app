import type { FastifyInstance } from "fastify";

// Deliberately a single dependency-free HTML file rather than a separate
// frontend build — this is an internal ops tool, not a product surface.
// Swap for something more capable once the team using it outgrows this.
const ADMIN_HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Confide Admin</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #151220; color: #eee; margin: 0; padding: 24px; }
  h1 { font-size: 20px; }
  h2 { font-size: 15px; color: #a39cb5; margin-top: 32px; }
  input[type=password] { background: #221e33; color: #fff; border: 1px solid #3a3450; border-radius: 6px; padding: 8px; width: 280px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  th, td { text-align: left; padding: 8px; border-bottom: 1px solid #2f2a44; vertical-align: top; }
  th { color: #a39cb5; font-weight: 600; }
  button { background: #7c5cff; color: #fff; border: none; border-radius: 6px; padding: 6px 10px; font-size: 12px; cursor: pointer; margin-right: 4px; }
  button.danger { background: #e5484d; }
  .muted { color: #6b6580; }
  #error { color: #e5484d; margin-top: 8px; }
</style>
</head>
<body>
  <h1>Confide — Admin</h1>
  <input id="token" type="password" placeholder="Admin token" />
  <button onclick="load()">Load</button>
  <div id="error"></div>

  <h2>Open reports</h2>
  <table id="reportsTable"><thead><tr><th>Reason</th><th>Reported user</th><th>Details</th><th>Filed</th><th></th></tr></thead><tbody></tbody></table>

  <h2>Escalated moderation events (self-harm / exploitation flags)</h2>
  <table id="eventsTable"><thead><tr><th>Category</th><th>Sender</th><th>Escalated content</th><th>Flagged</th></tr></thead><tbody></tbody></table>

  <h2>Access audit log <span class="muted">(who decrypted escalated content, and when)</span></h2>
  <table id="auditTable"><thead><tr><th>Actor</th><th>Action</th><th>Resource</th><th>When</th></tr></thead><tbody></tbody></table>

<script>
function token() { return document.getElementById('token').value; }
function authHeaders() { return { Authorization: 'Bearer ' + token() }; }

async function load() {
  document.getElementById('error').textContent = '';
  try {
    await Promise.all([loadReports(), loadEvents(), loadAuditLog()]);
  } catch (e) {
    document.getElementById('error').textContent = 'Failed to load — check the token. (' + e + ')';
  }
}

async function loadReports() {
  const res = await fetch('/admin/reports', { headers: authHeaders() });
  if (!res.ok) throw new Error(res.status);
  const { reports } = await res.json();
  const tbody = document.querySelector('#reportsTable tbody');
  tbody.innerHTML = '';
  for (const r of reports) {
    const tr = document.createElement('tr');
    tr.innerHTML = \`
      <td>\${r.reason}</td>
      <td>\${r.reportedUser.displayHandle} <span class="muted">(\${r.reportedUser.accountStatus})</span></td>
      <td>\${r.details ?? ''}</td>
      <td class="muted">\${new Date(r.createdAt).toLocaleString()}</td>
      <td>
        <button onclick="resolveReport('\${r.id}')">Resolve</button>
        <button class="danger" onclick="suspendUser('\${r.reportedUserId}')">Suspend</button>
        <button class="danger" onclick="banUser('\${r.reportedUserId}')">Ban</button>
      </td>\`;
    tbody.appendChild(tr);
  }
}

async function loadEvents() {
  const res = await fetch('/admin/moderation-events', { headers: authHeaders() });
  if (!res.ok) throw new Error(res.status);
  const { events } = await res.json();
  const tbody = document.querySelector('#eventsTable tbody');
  tbody.innerHTML = '';
  for (const e of events) {
    const tr = document.createElement('tr');
    tr.innerHTML = \`
      <td>\${e.category}</td>
      <td>\${e.message?.senderId ?? ''}</td>
      <td>\${e.escalatedPlaintext ?? '<span class="muted">(none stored)</span>'}</td>
      <td class="muted">\${new Date(e.createdAt).toLocaleString()}</td>\`;
    tbody.appendChild(tr);
  }
}

async function loadAuditLog() {
  const res = await fetch('/admin/audit-log', { headers: authHeaders() });
  if (!res.ok) throw new Error(res.status);
  const { entries } = await res.json();
  const tbody = document.querySelector('#auditTable tbody');
  tbody.innerHTML = '';
  for (const e of entries) {
    const tr = document.createElement('tr');
    tr.innerHTML = \`
      <td>\${e.actor}</td>
      <td>\${e.action}</td>
      <td>\${e.resourceType} <span class="muted">\${e.resourceId}</span></td>
      <td class="muted">\${new Date(e.createdAt).toLocaleString()}</td>\`;
    tbody.appendChild(tr);
  }
}

async function resolveReport(id) {
  await fetch(\`/admin/reports/\${id}/resolve\`, { method: 'POST', headers: authHeaders() });
  load();
}
async function suspendUser(id) {
  await fetch(\`/admin/users/\${id}/suspend\`, { method: 'POST', headers: authHeaders() });
  load();
}
async function banUser(id) {
  await fetch(\`/admin/users/\${id}/ban\`, { method: 'POST', headers: authHeaders() });
  load();
}
</script>
</body>
</html>`;

export async function registerAdminUiRoutes(app: FastifyInstance) {
  app.get("/admin", async (_req, reply) => {
    reply.type("text/html").send(ADMIN_HTML);
  });
}
