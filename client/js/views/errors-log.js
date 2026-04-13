class ErrorsLogView {
  async render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="view-header">
        <h1>Journal d'erreurs</h1>
        <p class="text-secondary">50 dernières erreurs — serveur & client</p>
      </div>
      <div id="errors-log-content">
        <div class="loading-spinner"></div>
      </div>
    `;

    try {
      const token = localStorage.getItem('restosuite_token');
      const res = await fetch('/api/errors/recent', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('Accès refusé');
      const { errors } = await res.json();
      this._renderList(errors);
    } catch (e) {
      document.getElementById('errors-log-content').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="alert-triangle"></i></div>
          <p>Impossible de charger les erreurs : ${escapeHtml(e.message)}</p>
        </div>
      `;
    }
  }

  _renderList(errors) {
    const container = document.getElementById('errors-log-content');

    if (!errors.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="check-circle"></i></div>
          <p>Aucune erreur enregistrée.</p>
        </div>
      `;
      return;
    }

    const rows = errors.map(e => {
      const badge = e.origin === 'server'
        ? '<span class="badge badge--error">Serveur</span>'
        : '<span class="badge badge--warning">Client</span>';
      const date = new Date(e.ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
      const context = e.route
        ? `<span class="text-secondary text-sm">${escapeHtml(e.route)}</span>`
        : e.source
        ? `<span class="text-secondary text-sm">${escapeHtml(e.source)}${e.lineno ? ':' + e.lineno : ''}</span>`
        : '';

      const stackHtml = e.stack
        ? `<pre class="error-stack">${escapeHtml(e.stack)}</pre>`
        : '';

      return `
        <div class="error-entry" onclick="this.classList.toggle('error-entry--open')">
          <div class="error-entry__header">
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
              ${badge}
              <span class="text-sm">${escapeHtml(e.message)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0">
              ${context}
              <span class="text-secondary text-sm">${date}</span>
              <i data-lucide="chevron-down" style="width:14px;height:14px;opacity:.5"></i>
            </div>
          </div>
          ${stackHtml ? `<div class="error-entry__body">${stackHtml}</div>` : ''}
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
        <span class="text-secondary text-sm">${errors.length} erreur(s)</span>
        <button class="btn btn-secondary btn-sm" onclick="new ErrorsLogView().render()">
          <i data-lucide="refresh-cw" style="width:14px;height:14px"></i> Actualiser
        </button>
      </div>
      <div class="errors-list">${rows}</div>
      <style>
        .error-entry {
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          margin-bottom: .5rem;
          overflow: hidden;
          cursor: pointer;
        }
        .error-entry__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: .5rem;
          padding: .75rem 1rem;
          flex-wrap: wrap;
        }
        .error-entry__body {
          display: none;
          border-top: 1px solid var(--color-border);
          padding: .75rem 1rem;
          background: var(--color-bg-subtle, #0d0d0d);
        }
        .error-entry--open .error-entry__body {
          display: block;
        }
        .error-stack {
          font-size: .75rem;
          white-space: pre-wrap;
          word-break: break-all;
          margin: 0;
          color: var(--color-text-secondary);
        }
      </style>
    `;

    if (window.lucide) lucide.createIcons();
  }
}
