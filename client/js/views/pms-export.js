// ═══════════════════════════════════════════
// Export PMS — Route #/pms/export
// Plan de Maîtrise Sanitaire complet
// ═══════════════════════════════════════════

let _pmsPeriod = '3m';
let _pmsData = null;

async function renderPMSExport() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    _pmsData = await API.request(`/pms/export?period=${_pmsPeriod}`);
    renderPMSShell();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur lors du chargement du PMS : ${escapeHtml(err.message)}</p></div>`;
  }
}

function renderPMSShell() {
  const app = document.getElementById('app');
  const d = _pmsData;
  const r = d.restaurant || {};

  const periodOptions = [
    { value: '1m', label: 'Dernier mois' },
    { value: '3m', label: '3 derniers mois' },
    { value: '6m', label: '6 derniers mois' },
    { value: '1y', label: '12 derniers mois' },
  ];

  const today = new Date(d.generated_at);
  const dateStr = today.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  app.innerHTML = `
    <div class="pms-export-page">

      <!-- ── Barre d'outils (masquée à l'impression) ── -->
      <div class="pms-toolbar no-print">
        <div class="pms-toolbar__left">
          <h1 style="margin:0;font-size:18px;font-weight:700">
            <i data-lucide="file-text" style="width:20px;height:20px;vertical-align:middle;margin-right:6px;color:var(--color-accent)"></i>
            Export PMS
          </h1>
          <span class="pms-toolbar__subtitle">Plan de Maîtrise Sanitaire complet</span>
        </div>
        <div class="pms-toolbar__right">
          <label class="pms-period-label" for="pms-period-select">Période :</label>
          <select id="pms-period-select" class="pms-period-select">
            ${periodOptions.map(o => `<option value="${o.value}"${o.value === _pmsPeriod ? ' selected' : ''}>${o.label}</option>`).join('')}
          </select>
          <button class="btn btn-secondary no-print" id="btn-pms-print">
            <i data-lucide="printer" style="width:16px;height:16px"></i>
            Imprimer le PMS
          </button>
          <button class="btn btn-primary no-print" id="btn-pms-pdf">
            <i data-lucide="download" style="width:16px;height:16px"></i>
            Exporter en PDF
          </button>
        </div>
      </div>

      <!-- ── Document PMS ── -->
      <div class="pms-document" id="pms-document">

        <!-- ══ Page de garde ══ -->
        <div class="pms-cover print-page-break-after">
          <div class="pms-cover__logo">
            <i data-lucide="shield-check" style="width:64px;height:64px;color:var(--color-accent)"></i>
          </div>
          <div class="pms-cover__title">Plan de Maîtrise Sanitaire</div>
          <div class="pms-cover__subtitle">Document officiel — Contrôle DDPP</div>
          <div class="pms-cover__restaurant">${escapeHtml(r.name || 'Restaurant')}</div>
          <table class="pms-cover__info-table">
            <tr><td>Adresse</td><td>${escapeHtml([r.address, r.postal_code, r.city].filter(Boolean).join(', ') || '—')}</td></tr>
            <tr><td>Téléphone</td><td>${escapeHtml(r.phone || '—')}</td></tr>
            <tr><td>SIRET</td><td>${escapeHtml(r.siret || '—')}</td></tr>
            <tr><td>Responsable</td><td>${escapeHtml(r.gerant_name || '—')}</td></tr>
            <tr><td>Contact responsable</td><td>${escapeHtml(r.gerant_email || '—')}</td></tr>
            ${d.sanitary_settings && d.sanitary_settings.sanitary_approval_number ? `
            <tr><td>N° agrément sanitaire</td><td>${escapeHtml(d.sanitary_settings.sanitary_approval_number)}</td></tr>
            <tr><td>Type d'agrément</td><td>${escapeHtml(d.sanitary_settings.sanitary_approval_type || '—')}</td></tr>
            ` : ''}
            <tr><td>Date de génération</td><td>${dateStr}</td></tr>
            <tr><td>Période des données</td><td>${periodOptions.find(o => o.value === d.period)?.label || d.period}</td></tr>
          </table>
          ${d.pms_audits && d.pms_audits.items && d.pms_audits.items.length > 0 ? `
          <div class="pms-cover__last-audit">
            Dernier audit interne :
            <strong>${escapeHtml(d.pms_audits.items[0].audit_date)}</strong>
            ${d.pms_audits.items[0].overall_score != null ? ` — Score : <strong>${d.pms_audits.items[0].overall_score}/100</strong>` : ''}
          </div>
          ` : ''}
        </div>

        <!-- ══ Table des matières ══ -->
        <div class="pms-toc print-page-break-after no-print">
          <h2 class="pms-section-title">Table des matières</h2>
          <ol class="pms-toc__list">
            <li><a href="#pms-s1">Informations générales & paramètres sanitaires</a></li>
            <li><a href="#pms-s2">Analyse des dangers (HACCP)</a></li>
            <li><a href="#pms-s3">Points Critiques de Contrôle (CCP)</a></li>
            <li><a href="#pms-s4">Arbre de décision</a></li>
            <li><a href="#pms-s5">Plan de nettoyage & désinfection</a></li>
            <li><a href="#pms-s6">Relevés de température</a></li>
            <li><a href="#pms-s7">Traçabilité (amont & aval)</a></li>
            <li><a href="#pms-s8">Formation du personnel</a></li>
            <li><a href="#pms-s9">Lutte contre les nuisibles</a></li>
            <li><a href="#pms-s10">Maintenance des équipements</a></li>
            <li><a href="#pms-s11">Gestion des déchets</a></li>
            <li><a href="#pms-s12">Gestion des allergènes (INCO)</a></li>
            <li><a href="#pms-s13">Procédures de retrait & rappel</a></li>
            <li><a href="#pms-s14">Actions correctives</a></li>
            <li><a href="#pms-s15">Fournisseurs</a></li>
            <li><a href="#pms-s16">Gestion de l'eau</a></li>
            <li><a href="#pms-s17">Audits PMS</a></li>
          </ol>
        </div>

        <!-- ══ Section 1 — Informations générales ══ -->
        ${renderPMSSection1(d)}

        <!-- ══ Section 2 — Analyse des dangers ══ -->
        ${renderPMSSection2(d)}

        <!-- ══ Section 3 — CCP ══ -->
        ${renderPMSSection3(d)}

        <!-- ══ Section 4 — Arbre de décision ══ -->
        ${renderPMSSection4(d)}

        <!-- ══ Section 5 — Nettoyage ══ -->
        ${renderPMSSection5(d)}

        <!-- ══ Section 6 — Températures ══ -->
        ${renderPMSSection6(d)}

        <!-- ══ Section 7 — Traçabilité ══ -->
        ${renderPMSSection7(d)}

        <!-- ══ Section 8 — Formation ══ -->
        ${renderPMSSection8(d)}

        <!-- ══ Section 9 — Nuisibles ══ -->
        ${renderPMSSection9(d)}

        <!-- ══ Section 10 — Maintenance ══ -->
        ${renderPMSSection10(d)}

        <!-- ══ Section 11 — Déchets ══ -->
        ${renderPMSSection11(d)}

        <!-- ══ Section 12 — Allergènes ══ -->
        ${renderPMSSection12(d)}

        <!-- ══ Section 13 — Retrait/Rappel ══ -->
        ${renderPMSSection13(d)}

        <!-- ══ Section 14 — Actions correctives ══ -->
        ${renderPMSSection14(d)}

        <!-- ══ Section 15 — Fournisseurs ══ -->
        ${renderPMSSection15(d)}

        <!-- ══ Section 16 — Eau ══ -->
        ${renderPMSSection16(d)}

        <!-- ══ Section 17 — Audits PMS ══ -->
        ${renderPMSSection17(d)}

        <!-- ── Pied de document ── -->
        <div class="pms-footer-doc">
          <p>Document généré le ${dateStr} via RestoSuite — Plan de Maîtrise Sanitaire de ${escapeHtml(r.name || 'l\'établissement')}</p>
          <p>Ce document est confidentiel et destiné exclusivement aux autorités sanitaires compétentes.</p>
        </div>

      </div><!-- /.pms-document -->
    </div><!-- /.pms-export-page -->

    <style>
      ${PMS_PRINT_CSS}
    </style>
  `;

  if (window.lucide) lucide.createIcons();

  document.getElementById('pms-period-select').addEventListener('change', async (e) => {
    _pmsPeriod = e.target.value;
    _pmsData = null;
    await renderPMSExport();
  });

  document.getElementById('btn-pms-print').addEventListener('click', () => window.print());
  document.getElementById('btn-pms-pdf').addEventListener('click', () => window.print());
}

// ─────────────────────────────────────────────────────────────────────────────
// Section renderers
// ─────────────────────────────────────────────────────────────────────────────

function renderPMSSection1(d) {
  const r = d.restaurant || {};
  const s = d.sanitary_settings || {};
  return `
    <div class="pms-section print-page-break-before" id="pms-s1">
      <div class="pms-section__header">
        <span class="pms-section__num">1</span>
        <h2 class="pms-section__title">Informations générales & paramètres sanitaires</h2>
      </div>
      <div class="pms-section__body">
        <div class="pms-info-grid">
          <div class="pms-info-card">
            <h3>Établissement</h3>
            <table class="pms-table pms-table--compact">
              <tr><th>Nom</th><td>${escapeHtml(r.name || '—')}</td></tr>
              <tr><th>Type</th><td>${escapeHtml(r.type || '—')}</td></tr>
              <tr><th>Adresse</th><td>${escapeHtml(r.address || '—')}</td></tr>
              <tr><th>Ville</th><td>${escapeHtml([r.postal_code, r.city].filter(Boolean).join(' ') || '—')}</td></tr>
              <tr><th>Téléphone</th><td>${escapeHtml(r.phone || '—')}</td></tr>
              <tr><th>SIRET</th><td>${escapeHtml(r.siret || '—')}</td></tr>
              <tr><th>Couverts</th><td>${r.covers || '—'}</td></tr>
            </table>
          </div>
          <div class="pms-info-card">
            <h3>Responsable & sanitaire</h3>
            <table class="pms-table pms-table--compact">
              <tr><th>Gérant</th><td>${escapeHtml(r.gerant_name || '—')}</td></tr>
              <tr><th>Email gérant</th><td>${escapeHtml(r.gerant_email || '—')}</td></tr>
              ${s.sanitary_approval_number ? `<tr><th>N° agrément</th><td>${escapeHtml(s.sanitary_approval_number)}</td></tr>` : ''}
              ${s.sanitary_approval_date ? `<tr><th>Date agrément</th><td>${escapeHtml(s.sanitary_approval_date)}</td></tr>` : ''}
              ${s.sanitary_approval_type ? `<tr><th>Type agrément</th><td>${escapeHtml(s.sanitary_approval_type)}</td></tr>` : ''}
              ${s.activity_type ? `<tr><th>Activité</th><td>${escapeHtml(s.activity_type)}</td></tr>` : ''}
              ${s.dd_pp_office ? `<tr><th>DDPP</th><td>${escapeHtml(s.dd_pp_office)}</td></tr>` : ''}
            </table>
          </div>
        </div>
        ${s.notes ? `<div class="pms-notes"><strong>Notes :</strong> ${escapeHtml(s.notes)}</div>` : ''}
      </div>
    </div>
  `;
}

function renderPMSSection2(d) {
  const { items, total, ccp_count, high_risk, by_type } = d.hazard_analysis;
  const byStep = {};
  for (const h of items) {
    if (!byStep[h.step_name]) byStep[h.step_name] = [];
    byStep[h.step_name].push(h);
  }
  const hazardTypeName = { B: 'Biologique', C: 'Chimique', P: 'Physique' };
  return `
    <div class="pms-section print-page-break-before" id="pms-s2">
      <div class="pms-section__header">
        <span class="pms-section__num">2</span>
        <h2 class="pms-section__title">Analyse des dangers (HACCP)</h2>
      </div>
      <div class="pms-section__body">
        <div class="pms-kpis">
          <div class="pms-kpi"><span class="pms-kpi__val">${total}</span><span class="pms-kpi__lbl">Dangers identifiés</span></div>
          <div class="pms-kpi pms-kpi--danger"><span class="pms-kpi__val">${ccp_count}</span><span class="pms-kpi__lbl">CCP</span></div>
          <div class="pms-kpi pms-kpi--warning"><span class="pms-kpi__val">${high_risk}</span><span class="pms-kpi__lbl">Risque élevé</span></div>
          <div class="pms-kpi pms-kpi--info"><span class="pms-kpi__val">${by_type.B}</span><span class="pms-kpi__lbl">Biologiques</span></div>
          <div class="pms-kpi"><span class="pms-kpi__val">${by_type.C}</span><span class="pms-kpi__lbl">Chimiques</span></div>
          <div class="pms-kpi"><span class="pms-kpi__val">${by_type.P}</span><span class="pms-kpi__lbl">Physiques</span></div>
        </div>
        ${total === 0 ? '<p class="pms-empty">Aucune analyse des dangers enregistrée.</p>' : ''}
        ${Object.entries(byStep).map(([step, hazards]) => `
          <h3 class="pms-subsection-title">Étape : ${escapeHtml(step)}</h3>
          <table class="pms-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Danger identifié</th>
                <th style="text-align:center">Gravité</th>
                <th style="text-align:center">Probabilité</th>
                <th style="text-align:center">Score</th>
                <th style="text-align:center">CCP ?</th>
                <th>Mesures préventives</th>
              </tr>
            </thead>
            <tbody>
              ${hazards.map(h => {
                const score = h.severity * h.probability;
                const scoreBadge = score > 15
                  ? `<span class="pms-badge pms-badge--danger">${score}</span>`
                  : score >= 6
                    ? `<span class="pms-badge pms-badge--warning">${score}</span>`
                    : `<span class="pms-badge pms-badge--ok">${score}</span>`;
                const typeBadge = `<span class="pms-badge pms-badge--type-${h.hazard_type.toLowerCase()}">${hazardTypeName[h.hazard_type] || h.hazard_type}</span>`;
                return `<tr>
                  <td>${typeBadge}</td>
                  <td>${escapeHtml(h.hazard_description)}</td>
                  <td style="text-align:center">${h.severity}/5</td>
                  <td style="text-align:center">${h.probability}/5</td>
                  <td style="text-align:center">${scoreBadge}</td>
                  <td style="text-align:center">${h.is_ccp ? '<span class="pms-badge pms-badge--ccp">CCP</span>' : '—'}</td>
                  <td class="pms-td--wrap">${escapeHtml(h.preventive_measures || '—')}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        `).join('')}
      </div>
    </div>
  `;
}

function renderPMSSection3(d) {
  const { items, total } = d.ccps;
  return `
    <div class="pms-section print-page-break-before" id="pms-s3">
      <div class="pms-section__header">
        <span class="pms-section__num">3</span>
        <h2 class="pms-section__title">Points Critiques de Contrôle (CCP)</h2>
      </div>
      <div class="pms-section__body">
        <div class="pms-kpis">
          <div class="pms-kpi pms-kpi--danger"><span class="pms-kpi__val">${total}</span><span class="pms-kpi__lbl">CCP définis</span></div>
        </div>
        ${total === 0 ? '<p class="pms-empty">Aucun CCP enregistré.</p>' : `
        <table class="pms-table">
          <thead>
            <tr>
              <th>N° CCP</th>
              <th>Étape</th>
              <th>Danger</th>
              <th>Limites critiques</th>
              <th>Surveillance</th>
              <th>Fréquence</th>
              <th>Actions correctives</th>
              <th>Vérification</th>
              <th>Responsable</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(c => `<tr>
              <td><strong>${escapeHtml(c.ccp_number)}</strong></td>
              <td>${escapeHtml(c.step_name)}</td>
              <td class="pms-td--wrap">${escapeHtml(c.hazard_description)}</td>
              <td class="pms-td--wrap">${escapeHtml(c.critical_limits || '—')}</td>
              <td class="pms-td--wrap">${escapeHtml(c.monitoring_procedure || '—')}</td>
              <td>${escapeHtml(c.monitoring_frequency || '—')}</td>
              <td class="pms-td--wrap">${escapeHtml(c.corrective_actions || '—')}</td>
              <td class="pms-td--wrap">${escapeHtml(c.verification_procedure || '—')}</td>
              <td>${escapeHtml(c.responsible_person || '—')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        `}
      </div>
    </div>
  `;
}

function renderPMSSection4(d) {
  const { items, total } = d.decision_tree;
  const yesNo = v => v === 1 ? '<span class="pms-badge pms-badge--ok">Oui</span>' : v === 0 ? '<span class="pms-badge pms-badge--neutral">Non</span>' : '—';
  const resultBadge = r => {
    if (!r) return '—';
    const map = { CCP: 'pms-badge--ccp', PRPO: 'pms-badge--warning', PRP: 'pms-badge--ok' };
    return `<span class="pms-badge ${map[r] || 'pms-badge--neutral'}">${r}</span>`;
  };
  return `
    <div class="pms-section print-page-break-before" id="pms-s4">
      <div class="pms-section__header">
        <span class="pms-section__num">4</span>
        <h2 class="pms-section__title">Arbre de décision HACCP</h2>
      </div>
      <div class="pms-section__body">
        ${total === 0 ? '<p class="pms-empty">Aucun résultat d\'arbre de décision enregistré.</p>' : `
        <table class="pms-table">
          <thead>
            <tr>
              <th>Étape</th>
              <th>Danger</th>
              <th style="text-align:center">Q1 — Mesure préventive ?</th>
              <th style="text-align:center">Q2 — Étape élimine ?</th>
              <th style="text-align:center">Q3 — Contamination possible ?</th>
              <th style="text-align:center">Q4 — Étape suivante élimine ?</th>
              <th style="text-align:center">Résultat</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(row => `<tr>
              <td>${escapeHtml(row.step_name)}</td>
              <td class="pms-td--wrap">${escapeHtml(row.hazard_description)}</td>
              <td style="text-align:center">${yesNo(row.q1_preventive_measure)}</td>
              <td style="text-align:center">${yesNo(row.q2_step_designed_eliminate)}</td>
              <td style="text-align:center">${yesNo(row.q3_contamination_possible)}</td>
              <td style="text-align:center">${yesNo(row.q4_subsequent_step_eliminate)}</td>
              <td style="text-align:center">${resultBadge(row.result)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        `}
      </div>
    </div>
  `;
}

function renderPMSSection5(d) {
  const { tasks, stats, recent_logs } = d.cleaning;
  const freqLabel = { daily: 'Quotidien', weekly: 'Hebdomadaire', monthly: 'Mensuel' };
  const byZone = {};
  for (const t of tasks) {
    if (!byZone[t.zone]) byZone[t.zone] = [];
    byZone[t.zone].push(t);
  }
  return `
    <div class="pms-section print-page-break-before" id="pms-s5">
      <div class="pms-section__header">
        <span class="pms-section__num">5</span>
        <h2 class="pms-section__title">Plan de nettoyage & désinfection</h2>
      </div>
      <div class="pms-section__body">
        <div class="pms-kpis">
          <div class="pms-kpi"><span class="pms-kpi__val">${stats.total}</span><span class="pms-kpi__lbl">Tâches totales</span></div>
          <div class="pms-kpi pms-kpi--info"><span class="pms-kpi__val">${stats.daily}</span><span class="pms-kpi__lbl">Quotidiennes</span></div>
          <div class="pms-kpi"><span class="pms-kpi__val">${stats.weekly}</span><span class="pms-kpi__lbl">Hebdomadaires</span></div>
          <div class="pms-kpi"><span class="pms-kpi__val">${stats.monthly}</span><span class="pms-kpi__lbl">Mensuelles</span></div>
          <div class="pms-kpi pms-kpi--info"><span class="pms-kpi__val">${recent_logs.length}</span><span class="pms-kpi__lbl">Réalisations (période)</span></div>
        </div>
        ${tasks.length === 0 ? '<p class="pms-empty">Aucune tâche de nettoyage enregistrée.</p>' : ''}
        ${Object.entries(byZone).map(([zone, zoneTasks]) => `
          <h3 class="pms-subsection-title">Zone : ${escapeHtml(zone)}</h3>
          <table class="pms-table">
            <thead><tr><th>Tâche</th><th>Fréquence</th><th>Produit</th><th>Méthode / Protocole</th></tr></thead>
            <tbody>
              ${zoneTasks.map(t => `<tr>
                <td>${escapeHtml(t.name)}</td>
                <td>${freqLabel[t.frequency] || escapeHtml(t.frequency)}</td>
                <td>${escapeHtml(t.product || '—')}</td>
                <td class="pms-td--wrap">${escapeHtml(t.method || '—')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        `).join('')}
        ${recent_logs.length > 0 ? `
          <h3 class="pms-subsection-title">Registre des réalisations (extrait — ${recent_logs.length} entrées)</h3>
          <table class="pms-table">
            <thead><tr><th>Date</th><th>Tâche</th><th>Zone</th><th>Réalisé par</th><th>Notes</th></tr></thead>
            <tbody>
              ${recent_logs.slice(0, 30).map(l => `<tr>
                <td style="white-space:nowrap">${fmtDateTime(l.completed_at)}</td>
                <td>${escapeHtml(l.task_name)}</td>
                <td>${escapeHtml(l.zone)}</td>
                <td>${escapeHtml(l.done_by || '—')}</td>
                <td>${escapeHtml(l.notes || '')}</td>
              </tr>`).join('')}
              ${recent_logs.length > 30 ? `<tr><td colspan="5" style="text-align:center;font-style:italic;color:var(--text-secondary)">... et ${recent_logs.length - 30} entrée(s) supplémentaire(s) non affichées</td></tr>` : ''}
            </tbody>
          </table>
        ` : ''}
      </div>
    </div>
  `;
}

function renderPMSSection6(d) {
  const { zones, logs, alert_count, cooling_logs, reheating_logs } = d.temperatures;
  return `
    <div class="pms-section print-page-break-before" id="pms-s6">
      <div class="pms-section__header">
        <span class="pms-section__num">6</span>
        <h2 class="pms-section__title">Relevés de température</h2>
      </div>
      <div class="pms-section__body">
        <div class="pms-kpis">
          <div class="pms-kpi"><span class="pms-kpi__val">${zones.length}</span><span class="pms-kpi__lbl">Zones surveillées</span></div>
          <div class="pms-kpi pms-kpi--info"><span class="pms-kpi__val">${logs.length}</span><span class="pms-kpi__lbl">Relevés (période)</span></div>
          <div class="pms-kpi ${alert_count > 0 ? 'pms-kpi--danger' : 'pms-kpi--ok'}"><span class="pms-kpi__val">${alert_count}</span><span class="pms-kpi__lbl">Alertes</span></div>
          <div class="pms-kpi"><span class="pms-kpi__val">${cooling_logs.length}</span><span class="pms-kpi__lbl">Refroidissements</span></div>
          <div class="pms-kpi"><span class="pms-kpi__val">${reheating_logs.length}</span><span class="pms-kpi__lbl">Remises en T°</span></div>
        </div>

        <h3 class="pms-subsection-title">Zones de surveillance</h3>
        <table class="pms-table">
          <thead><tr><th>Zone</th><th>Type</th><th>Plage autorisée</th></tr></thead>
          <tbody>
            ${zones.map(z => `<tr>
              <td>${escapeHtml(z.name)}</td>
              <td>${escapeHtml(z.type)}</td>
              <td>${z.min_temp}°C → ${z.max_temp}°C</td>
            </tr>`).join('')}
          </tbody>
        </table>

        ${alert_count > 0 ? `
          <h3 class="pms-subsection-title pms-subsection-title--danger">⚠ Alertes de température (période)</h3>
          <table class="pms-table">
            <thead><tr><th>Date/Heure</th><th>Zone</th><th>Température mesurée</th><th>Plage autorisée</th><th>Notes</th></tr></thead>
            <tbody>
              ${logs.filter(l => l.is_alert).map(l => `<tr class="pms-row--danger">
                <td style="white-space:nowrap">${fmtDateTime(l.recorded_at)}</td>
                <td>${escapeHtml(l.zone_name)}</td>
                <td><strong>${l.temperature}°C</strong></td>
                <td>${l.min_temp}°C → ${l.max_temp}°C</td>
                <td>${escapeHtml(l.notes || '')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        ` : ''}

        ${logs.length > 0 ? `
          <h3 class="pms-subsection-title">Extrait des relevés (${Math.min(logs.length, 30)} sur ${logs.length})</h3>
          <table class="pms-table">
            <thead><tr><th>Date/Heure</th><th>Zone</th><th>Température</th><th>Statut</th><th>Par</th></tr></thead>
            <tbody>
              ${logs.slice(0, 30).map(l => `<tr class="${l.is_alert ? 'pms-row--danger' : ''}">
                <td style="white-space:nowrap">${fmtDateTime(l.recorded_at)}</td>
                <td>${escapeHtml(l.zone_name)}</td>
                <td>${l.temperature}°C</td>
                <td>${l.is_alert ? '<span class="pms-badge pms-badge--danger">Alerte</span>' : '<span class="pms-badge pms-badge--ok">Conforme</span>'}</td>
                <td>${escapeHtml(l.recorded_by_name || '—')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        ` : '<p class="pms-empty">Aucun relevé sur la période.</p>'}

        ${cooling_logs.length > 0 ? `
          <h3 class="pms-subsection-title">Refroidissements rapides (${cooling_logs.length})</h3>
          <table class="pms-table">
            <thead><tr><th>Produit</th><th>Début</th><th>T° initiale</th><th>T° à 63°C à</th><th>T° à 10°C à</th><th>Conforme</th></tr></thead>
            <tbody>
              ${cooling_logs.slice(0, 20).map(c => `<tr class="${c.is_compliant === 0 ? 'pms-row--danger' : ''}">
                <td>${escapeHtml(c.product_name)}</td>
                <td style="white-space:nowrap">${fmtDateTime(c.start_time)}</td>
                <td>${c.temp_start}°C</td>
                <td>${c.time_at_63c ? fmtDateTime(c.time_at_63c) : '—'}</td>
                <td>${c.time_at_10c ? fmtDateTime(c.time_at_10c) : '—'}</td>
                <td>${c.is_compliant === 1 ? '<span class="pms-badge pms-badge--ok">Oui</span>' : c.is_compliant === 0 ? '<span class="pms-badge pms-badge--danger">Non</span>' : '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        ` : ''}

        ${reheating_logs.length > 0 ? `
          <h3 class="pms-subsection-title">Remises en température (${reheating_logs.length})</h3>
          <table class="pms-table">
            <thead><tr><th>Produit</th><th>Début</th><th>T° initiale</th><th>T° à 63°C à</th><th>Conforme</th></tr></thead>
            <tbody>
              ${reheating_logs.slice(0, 20).map(r => `<tr class="${r.is_compliant === 0 ? 'pms-row--danger' : ''}">
                <td>${escapeHtml(r.product_name)}</td>
                <td style="white-space:nowrap">${fmtDateTime(r.start_time)}</td>
                <td>${r.temp_start}°C</td>
                <td>${r.time_at_63c ? fmtDateTime(r.time_at_63c) : '—'}</td>
                <td>${r.is_compliant === 1 ? '<span class="pms-badge pms-badge--ok">Oui</span>' : r.is_compliant === 0 ? '<span class="pms-badge pms-badge--danger">Non</span>' : '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        ` : ''}
      </div>
    </div>
  `;
}

function renderPMSSection7(d) {
  const { reception, downstream } = d.traceability;
  return `
    <div class="pms-section print-page-break-before" id="pms-s7">
      <div class="pms-section__header">
        <span class="pms-section__num">7</span>
        <h2 class="pms-section__title">Traçabilité (amont & aval)</h2>
      </div>
      <div class="pms-section__body">
        <div class="pms-kpis">
          <div class="pms-kpi pms-kpi--info"><span class="pms-kpi__val">${reception.length}</span><span class="pms-kpi__lbl">Réceptions</span></div>
          <div class="pms-kpi pms-kpi--info"><span class="pms-kpi__val">${downstream.length}</span><span class="pms-kpi__lbl">Dispatches aval</span></div>
        </div>

        <h3 class="pms-subsection-title">Traçabilité amont — Réceptions marchandises (${reception.length})</h3>
        ${reception.length === 0 ? '<p class="pms-empty">Aucune réception sur la période.</p>' : `
        <table class="pms-table">
          <thead><tr><th>Date</th><th>Produit</th><th>Fournisseur</th><th>N° lot</th><th>DLC</th><th>T° réception</th><th>Qté</th></tr></thead>
          <tbody>
            ${reception.slice(0, 40).map(r => `<tr>
              <td style="white-space:nowrap">${fmtDate(r.received_at)}</td>
              <td>${escapeHtml(r.product_name)}</td>
              <td>${escapeHtml(r.supplier || '—')}</td>
              <td>${escapeHtml(r.batch_number || '—')}</td>
              <td>${r.dlc ? `<span class="${isDLCAlert(r.dlc) ? 'pms-text--danger' : ''}">${r.dlc}</span>` : '—'}</td>
              <td>${r.temperature_at_reception != null ? `${r.temperature_at_reception}°C` : '—'}</td>
              <td>${r.quantity != null ? `${r.quantity} ${r.unit}` : '—'}</td>
            </tr>`).join('')}
            ${reception.length > 40 ? `<tr><td colspan="7" style="text-align:center;font-style:italic">... ${reception.length - 40} entrées supplémentaires</td></tr>` : ''}
          </tbody>
        </table>
        `}

        <h3 class="pms-subsection-title">Traçabilité aval — Distribution & expéditions (${downstream.length})</h3>
        ${downstream.length === 0 ? '<p class="pms-empty">Aucun dispatch sur la période.</p>' : `
        <table class="pms-table">
          <thead><tr><th>Date</th><th>Produit</th><th>N° lot</th><th>Destination</th><th>Type</th><th>Qté</th><th>T° dispatch</th><th>Responsable</th></tr></thead>
          <tbody>
            ${downstream.slice(0, 40).map(r => `<tr>
              <td style="white-space:nowrap">${escapeHtml(r.dispatch_date)}</td>
              <td>${escapeHtml(r.product_name)}</td>
              <td>${escapeHtml(r.batch_number || '—')}</td>
              <td>${escapeHtml(r.destination_name || '—')}</td>
              <td>${escapeHtml(r.destination_type || '—')}</td>
              <td>${r.quantity != null ? `${r.quantity} ${r.unit}` : '—'}</td>
              <td>${r.temperature_at_dispatch != null ? `${r.temperature_at_dispatch}°C` : '—'}</td>
              <td>${escapeHtml(r.responsible_person || '—')}</td>
            </tr>`).join('')}
            ${downstream.length > 40 ? `<tr><td colspan="8" style="text-align:center;font-style:italic">... ${downstream.length - 40} entrées supplémentaires</td></tr>` : ''}
          </tbody>
        </table>
        `}
      </div>
    </div>
  `;
}

function renderPMSSection8(d) {
  const { records, stats } = d.training;
  const statusBadge = s => {
    const map = { 'réalisé': 'ok', 'planifié': 'info', 'expiré': 'danger' };
    return `<span class="pms-badge pms-badge--${map[s] || 'neutral'}">${s}</span>`;
  };
  return `
    <div class="pms-section print-page-break-before" id="pms-s8">
      <div class="pms-section__header">
        <span class="pms-section__num">8</span>
        <h2 class="pms-section__title">Formation du personnel</h2>
      </div>
      <div class="pms-section__body">
        <div class="pms-kpis">
          <div class="pms-kpi"><span class="pms-kpi__val">${stats.total}</span><span class="pms-kpi__lbl">Formations totales</span></div>
          <div class="pms-kpi pms-kpi--ok"><span class="pms-kpi__val">${stats.realise}</span><span class="pms-kpi__lbl">Réalisées</span></div>
          <div class="pms-kpi pms-kpi--info"><span class="pms-kpi__val">${stats.planifie}</span><span class="pms-kpi__lbl">Planifiées</span></div>
          <div class="pms-kpi ${stats.expire > 0 ? 'pms-kpi--danger' : 'pms-kpi'}"><span class="pms-kpi__val">${stats.expire}</span><span class="pms-kpi__lbl">Expirées</span></div>
        </div>
        ${records.length === 0 ? '<p class="pms-empty">Aucune formation enregistrée.</p>' : `
        <table class="pms-table">
          <thead><tr><th>Employé</th><th>Formation</th><th>Formateur</th><th>Date</th><th>Durée</th><th>Renouvellement</th><th>Référence</th><th>Statut</th></tr></thead>
          <tbody>
            ${records.map(r => `<tr class="${r.status === 'expiré' ? 'pms-row--danger' : ''}">
              <td>${escapeHtml(r.employee_name)}</td>
              <td>${escapeHtml(r.training_topic)}</td>
              <td>${escapeHtml(r.trainer || '—')}</td>
              <td style="white-space:nowrap">${r.training_date}</td>
              <td>${r.duration_hours ? `${r.duration_hours}h` : '—'}</td>
              <td style="white-space:nowrap">${r.next_renewal_date || '—'}</td>
              <td>${escapeHtml(r.certificate_ref || '—')}</td>
              <td>${statusBadge(r.status)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        `}
      </div>
    </div>
  `;
}

function renderPMSSection9(d) {
  const { visits, last_visit, compliant_count } = d.pest_control;
  const statusBadge = s => {
    const map = { 'conforme': 'ok', 'action-requise': 'danger', 'non-conforme': 'danger' };
    return `<span class="pms-badge pms-badge--${map[s] || 'neutral'}">${escapeHtml(s)}</span>`;
  };
  return `
    <div class="pms-section print-page-break-before" id="pms-s9">
      <div class="pms-section__header">
        <span class="pms-section__num">9</span>
        <h2 class="pms-section__title">Lutte contre les nuisibles</h2>
      </div>
      <div class="pms-section__body">
        <div class="pms-kpis">
          <div class="pms-kpi"><span class="pms-kpi__val">${visits.length}</span><span class="pms-kpi__lbl">Visites totales</span></div>
          <div class="pms-kpi pms-kpi--ok"><span class="pms-kpi__val">${compliant_count}</span><span class="pms-kpi__lbl">Conformes</span></div>
          <div class="pms-kpi ${visits.length - compliant_count > 0 ? 'pms-kpi--warning' : 'pms-kpi'}"><span class="pms-kpi__val">${visits.length - compliant_count}</span><span class="pms-kpi__lbl">Actions requises</span></div>
          ${last_visit ? `<div class="pms-kpi pms-kpi--info"><span class="pms-kpi__val">${escapeHtml(last_visit.visit_date)}</span><span class="pms-kpi__lbl">Dernière visite</span></div>` : ''}
        </div>
        ${visits.length === 0 ? '<p class="pms-empty">Aucune visite enregistrée.</p>' : `
        <table class="pms-table">
          <thead><tr><th>Date visite</th><th>Prestataire</th><th>N° contrat</th><th>Constatations</th><th>Actions prises</th><th>Postes appâts</th><th>Prochaine visite</th><th>Statut</th><th>Rapport</th></tr></thead>
          <tbody>
            ${visits.map(v => `<tr class="${v.status === 'action-requise' ? 'pms-row--warning' : v.status === 'non-conforme' ? 'pms-row--danger' : ''}">
              <td style="white-space:nowrap">${v.visit_date}</td>
              <td>${escapeHtml(v.provider_name || '—')}</td>
              <td>${escapeHtml(v.contract_ref || '—')}</td>
              <td class="pms-td--wrap">${escapeHtml(v.findings || '—')}</td>
              <td class="pms-td--wrap">${escapeHtml(v.actions_taken || '—')}</td>
              <td style="text-align:center">${v.bait_stations_count}</td>
              <td style="white-space:nowrap">${v.next_visit_date || '—'}</td>
              <td>${statusBadge(v.status)}</td>
              <td>${escapeHtml(v.report_ref || '—')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        `}
      </div>
    </div>
  `;
}

function renderPMSSection10(d) {
  const { items, stats } = d.maintenance;
  const statusBadge = s => {
    const map = { 'à_jour': 'ok', 'planifié': 'info', 'en_retard': 'danger', 'en_panne': 'danger' };
    return `<span class="pms-badge pms-badge--${map[s] || 'neutral'}">${escapeHtml(s)}</span>`;
  };
  return `
    <div class="pms-section print-page-break-before" id="pms-s10">
      <div class="pms-section__header">
        <span class="pms-section__num">10</span>
        <h2 class="pms-section__title">Maintenance des équipements</h2>
      </div>
      <div class="pms-section__body">
        <div class="pms-kpis">
          <div class="pms-kpi"><span class="pms-kpi__val">${stats.total}</span><span class="pms-kpi__lbl">Équipements</span></div>
          <div class="pms-kpi pms-kpi--ok"><span class="pms-kpi__val">${stats.a_jour}</span><span class="pms-kpi__lbl">À jour</span></div>
          <div class="pms-kpi pms-kpi--info"><span class="pms-kpi__val">${stats.planifie}</span><span class="pms-kpi__lbl">Planifiés</span></div>
          <div class="pms-kpi ${stats.en_retard > 0 ? 'pms-kpi--danger' : 'pms-kpi'}"><span class="pms-kpi__val">${stats.en_retard}</span><span class="pms-kpi__lbl">En retard</span></div>
        </div>
        ${items.length === 0 ? '<p class="pms-empty">Aucun équipement enregistré.</p>' : `
        <table class="pms-table">
          <thead><tr><th>Équipement</th><th>Type</th><th>Localisation</th><th>Dernière maintenance</th><th>Prochaine maintenance</th><th>Type maintenance</th><th>Prestataire</th><th>Statut</th></tr></thead>
          <tbody>
            ${items.map(m => `<tr class="${m.status === 'en_retard' ? 'pms-row--danger' : m.status === 'en_panne' ? 'pms-row--danger' : ''}">
              <td>${escapeHtml(m.equipment_name)}</td>
              <td>${escapeHtml(m.equipment_type)}</td>
              <td>${escapeHtml(m.location || '—')}</td>
              <td style="white-space:nowrap">${m.last_maintenance_date || '—'}</td>
              <td style="white-space:nowrap">${m.next_maintenance_date || '—'}</td>
              <td>${escapeHtml(m.maintenance_type || '—')}</td>
              <td>${escapeHtml(m.provider || '—')}</td>
              <td>${statusBadge(m.status)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        `}
      </div>
    </div>
  `;
}

function renderPMSSection11(d) {
  const { items } = d.waste;
  return `
    <div class="pms-section print-page-break-before" id="pms-s11">
      <div class="pms-section__header">
        <span class="pms-section__num">11</span>
        <h2 class="pms-section__title">Gestion des déchets</h2>
      </div>
      <div class="pms-section__body">
        ${items.length === 0 ? '<p class="pms-empty">Aucune filière déchets enregistrée.</p>' : `
        <table class="pms-table">
          <thead><tr><th>Type de déchet</th><th>Prestataire</th><th>Fréquence de collecte</th><th>Dernière collecte</th><th>Prochaine collecte</th><th>N° contrat</th><th>Notes</th></tr></thead>
          <tbody>
            ${items.map(w => `<tr>
              <td>${escapeHtml(w.waste_type)}</td>
              <td>${escapeHtml(w.collection_provider || '—')}</td>
              <td>${escapeHtml(w.collection_frequency || '—')}</td>
              <td style="white-space:nowrap">${w.last_collection_date || '—'}</td>
              <td style="white-space:nowrap">${w.next_collection_date || '—'}</td>
              <td>${escapeHtml(w.contract_ref || '—')}</td>
              <td class="pms-td--wrap">${escapeHtml(w.notes || '')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        `}
      </div>
    </div>
  `;
}

function renderPMSSection12(d) {
  const { items } = d.allergens;
  const riskBadge = r => {
    const map = { 'élevé': 'danger', 'moyen': 'warning', 'faible': 'ok' };
    return `<span class="pms-badge pms-badge--${map[r] || 'neutral'}">${escapeHtml(r)}</span>`;
  };
  return `
    <div class="pms-section print-page-break-before" id="pms-s12">
      <div class="pms-section__header">
        <span class="pms-section__num">12</span>
        <h2 class="pms-section__title">Gestion des allergènes — Règlement INCO (UE 1169/2011)</h2>
      </div>
      <div class="pms-section__body">
        <div class="pms-kpis">
          <div class="pms-kpi"><span class="pms-kpi__val">${items.length}</span><span class="pms-kpi__lbl">Allergènes recensés</span></div>
          <div class="pms-kpi pms-kpi--danger"><span class="pms-kpi__val">${items.filter(a => a.risk_level === 'élevé').length}</span><span class="pms-kpi__lbl">Risque élevé</span></div>
          <div class="pms-kpi pms-kpi--info"><span class="pms-kpi__val">${items.filter(a => a.presence_in_menu).length}</span><span class="pms-kpi__lbl">Présents au menu</span></div>
        </div>
        ${items.length === 0 ? '<p class="pms-empty">Aucun plan allergènes enregistré.</p>' : `
        <table class="pms-table">
          <thead>
            <tr>
              <th>Allergène</th>
              <th style="text-align:center">Présent au menu</th>
              <th style="text-align:center">Risque</th>
              <th>Risque contamination croisée</th>
              <th>Mesures préventives</th>
              <th>Procédure nettoyage</th>
              <th>Affichage</th>
              <th>Dernière révision</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(a => `<tr>
              <td><strong>${escapeHtml(a.allergen_name)}</strong></td>
              <td style="text-align:center">${a.presence_in_menu ? '<span class="pms-badge pms-badge--warning">Oui</span>' : '<span class="pms-badge pms-badge--neutral">Non</span>'}</td>
              <td style="text-align:center">${riskBadge(a.risk_level)}</td>
              <td class="pms-td--wrap">${escapeHtml(a.cross_contamination_risk || '—')}</td>
              <td class="pms-td--wrap">${escapeHtml(a.preventive_measures || '—')}</td>
              <td class="pms-td--wrap">${escapeHtml(a.cleaning_procedure || '—')}</td>
              <td class="pms-td--wrap">${escapeHtml(a.display_method || '—')}</td>
              <td style="white-space:nowrap">${a.last_review_date || '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        `}
      </div>
    </div>
  `;
}

function renderPMSSection13(d) {
  const { items, stats } = d.recall;
  const severityBadge = s => {
    const map = { 'critique': 'danger', 'majeur': 'warning', 'mineur': 'ok' };
    return `<span class="pms-badge pms-badge--${map[s] || 'neutral'}">${escapeHtml(s)}</span>`;
  };
  const statusBadge = s => {
    const map = { 'cloturé': 'ok', 'cloture': 'ok', 'en_cours': 'warning', 'alerte': 'danger' };
    return `<span class="pms-badge pms-badge--${map[s] || 'neutral'}">${escapeHtml(s)}</span>`;
  };
  return `
    <div class="pms-section print-page-break-before" id="pms-s13">
      <div class="pms-section__header">
        <span class="pms-section__num">13</span>
        <h2 class="pms-section__title">Procédures de retrait & rappel produits</h2>
      </div>
      <div class="pms-section__body">
        <div class="pms-kpis">
          <div class="pms-kpi"><span class="pms-kpi__val">${stats.total}</span><span class="pms-kpi__lbl">Procédures totales</span></div>
          <div class="pms-kpi ${stats.actifs > 0 ? 'pms-kpi--warning' : 'pms-kpi'}"><span class="pms-kpi__val">${stats.actifs}</span><span class="pms-kpi__lbl">Actives</span></div>
          <div class="pms-kpi pms-kpi--ok"><span class="pms-kpi__val">${stats.cloture}</span><span class="pms-kpi__lbl">Clôturées</span></div>
        </div>
        ${items.length === 0 ? '<p class="pms-empty">Aucune procédure de retrait/rappel enregistrée.</p>' : `
        <table class="pms-table">
          <thead>
            <tr>
              <th>Date alerte</th>
              <th>Produit</th>
              <th>N° lot</th>
              <th>Raison</th>
              <th>Source alerte</th>
              <th style="text-align:center">Sévérité</th>
              <th>Qté affectée</th>
              <th>Actions prises</th>
              <th>Notification envoyée</th>
              <th>Date clôture</th>
              <th style="text-align:center">Statut</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(r => `<tr class="${r.severity === 'critique' && (r.status === 'en_cours' || r.status === 'alerte') ? 'pms-row--danger' : ''}">
              <td style="white-space:nowrap">${fmtDate(r.alert_date)}</td>
              <td><strong>${escapeHtml(r.product_name)}</strong></td>
              <td>${escapeHtml(r.lot_number || '—')}</td>
              <td>${escapeHtml(r.reason)}</td>
              <td>${escapeHtml(r.alert_source)}</td>
              <td style="text-align:center">${severityBadge(r.severity)}</td>
              <td>${r.quantity_affected != null ? `${r.quantity_affected} ${r.quantity_unit}` : '—'}</td>
              <td class="pms-td--wrap">${escapeHtml(r.actions_taken || '—')}</td>
              <td style="text-align:center">${r.notification_sent ? '<span class="pms-badge pms-badge--ok">Oui</span>' : '<span class="pms-badge pms-badge--danger">Non</span>'}</td>
              <td style="white-space:nowrap">${r.closure_date ? fmtDate(r.closure_date) : '—'}</td>
              <td style="text-align:center">${statusBadge(r.status)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        `}
      </div>
    </div>
  `;
}

function renderPMSSection14(d) {
  const { log, templates } = d.corrective_actions;
  const catLabels = { temperature: 'Température', cleaning: 'Nettoyage', reception: 'Réception', storage: 'Stockage', preparation: 'Préparation', service: 'Service' };
  const statusBadge = s => {
    const map = { 'en_cours': 'warning', 'terminé': 'ok', 'escaladé': 'danger' };
    return `<span class="pms-badge pms-badge--${map[s] || 'neutral'}">${escapeHtml(s)}</span>`;
  };
  return `
    <div class="pms-section print-page-break-before" id="pms-s14">
      <div class="pms-section__header">
        <span class="pms-section__num">14</span>
        <h2 class="pms-section__title">Actions correctives</h2>
      </div>
      <div class="pms-section__body">
        <div class="pms-kpis">
          <div class="pms-kpi"><span class="pms-kpi__val">${templates.length}</span><span class="pms-kpi__lbl">Modèles actifs</span></div>
          <div class="pms-kpi pms-kpi--info"><span class="pms-kpi__val">${log.length}</span><span class="pms-kpi__lbl">Actions (période)</span></div>
          <div class="pms-kpi ${log.filter(a => a.status === 'en_cours').length > 0 ? 'pms-kpi--warning' : 'pms-kpi'}"><span class="pms-kpi__val">${log.filter(a => a.status === 'en_cours').length}</span><span class="pms-kpi__lbl">En cours</span></div>
          <div class="pms-kpi pms-kpi--ok"><span class="pms-kpi__val">${log.filter(a => a.status === 'terminé').length}</span><span class="pms-kpi__lbl">Terminées</span></div>
        </div>

        <h3 class="pms-subsection-title">Modèles d'actions correctives (${templates.length})</h3>
        <table class="pms-table">
          <thead><tr><th>Catégorie</th><th>Déclencheur</th><th>Action à mener</th><th>Responsable</th><th>Délai</th><th>Documentation requise</th></tr></thead>
          <tbody>
            ${templates.map(t => `<tr>
              <td>${catLabels[t.category] || escapeHtml(t.category)}</td>
              <td class="pms-td--wrap">${escapeHtml(t.trigger_condition || '—')}</td>
              <td class="pms-td--wrap">${escapeHtml(t.action_description || '—')}</td>
              <td>${escapeHtml(t.responsible_role || '—')}</td>
              <td>${t.deadline_hours != null ? `${t.deadline_hours}h` : '—'}</td>
              <td class="pms-td--wrap">${escapeHtml(t.documentation_required || '—')}</td>
            </tr>`).join('')}
          </tbody>
        </table>

        ${log.length > 0 ? `
          <h3 class="pms-subsection-title">Registre des actions correctives (${log.length} sur la période)</h3>
          <table class="pms-table">
            <thead><tr><th>Date</th><th>Catégorie</th><th>Déclencheur</th><th>Action prise</th><th>Responsable</th><th>Statut</th></tr></thead>
            <tbody>
              ${log.slice(0, 30).map(a => `<tr class="${a.status === 'escaladé' ? 'pms-row--danger' : ''}">
                <td style="white-space:nowrap">${fmtDate(a.created_at)}</td>
                <td>${catLabels[a.category] || escapeHtml(a.category || '—')}</td>
                <td class="pms-td--wrap">${escapeHtml(a.trigger_description || '—')}</td>
                <td class="pms-td--wrap">${escapeHtml(a.action_taken || '—')}</td>
                <td>${escapeHtml(a.responsible_person || '—')}</td>
                <td>${statusBadge(a.status)}</td>
              </tr>`).join('')}
              ${log.length > 30 ? `<tr><td colspan="6" style="text-align:center;font-style:italic">... ${log.length - 30} actions supplémentaires</td></tr>` : ''}
            </tbody>
          </table>
        ` : '<p class="pms-empty">Aucune action corrective enregistrée sur la période.</p>'}
      </div>
    </div>
  `;
}

function renderPMSSection15(d) {
  const { items, total } = d.suppliers;
  return `
    <div class="pms-section print-page-break-before" id="pms-s15">
      <div class="pms-section__header">
        <span class="pms-section__num">15</span>
        <h2 class="pms-section__title">Fournisseurs agréés</h2>
      </div>
      <div class="pms-section__body">
        <div class="pms-kpis">
          <div class="pms-kpi pms-kpi--info"><span class="pms-kpi__val">${total}</span><span class="pms-kpi__lbl">Fournisseurs</span></div>
        </div>
        ${total === 0 ? '<p class="pms-empty">Aucun fournisseur enregistré.</p>' : `
        <table class="pms-table">
          <thead><tr><th>Nom fournisseur</th><th>Contact</th><th>Téléphone</th><th>Email</th><th>Note qualité</th><th>Commentaire qualité</th></tr></thead>
          <tbody>
            ${items.map(s => `<tr>
              <td><strong>${escapeHtml(s.name)}</strong></td>
              <td>${escapeHtml(s.contact || s.contact_name || '—')}</td>
              <td>${escapeHtml(s.phone || '—')}</td>
              <td>${escapeHtml(s.email || '—')}</td>
              <td style="text-align:center">${s.quality_rating ? `${s.quality_rating}/5` : '—'}</td>
              <td class="pms-td--wrap">${escapeHtml(s.quality_notes || '')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        `}
      </div>
    </div>
  `;
}

function renderPMSSection16(d) {
  const { items } = d.water_management;
  const conformBadge = c => c ? '<span class="pms-badge pms-badge--ok">Conforme</span>' : '<span class="pms-badge pms-badge--danger">Non conforme</span>';
  return `
    <div class="pms-section print-page-break-before" id="pms-s16">
      <div class="pms-section__header">
        <span class="pms-section__num">16</span>
        <h2 class="pms-section__title">Gestion de l'eau</h2>
      </div>
      <div class="pms-section__body">
        ${items.length === 0 ? '<p class="pms-empty">Aucune analyse d\'eau enregistrée.</p>' : `
        <table class="pms-table">
          <thead><tr><th>Date</th><th>Type analyse</th><th>Prestataire</th><th>Source</th><th>Résultats</th><th>Conformité</th><th>Prochaine analyse</th></tr></thead>
          <tbody>
            ${items.map(w => `<tr class="${!w.conformity ? 'pms-row--danger' : ''}">
              <td style="white-space:nowrap">${w.analysis_date}</td>
              <td>${escapeHtml(w.analysis_type)}</td>
              <td>${escapeHtml(w.provider || '—')}</td>
              <td>${escapeHtml(w.water_source || '—')}</td>
              <td class="pms-td--wrap">${escapeHtml(w.results || '—')}</td>
              <td>${conformBadge(w.conformity)}</td>
              <td style="white-space:nowrap">${w.next_analysis_date || '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        `}
      </div>
    </div>
  `;
}

function renderPMSSection17(d) {
  const { items } = d.pms_audits;
  const statusBadge = s => {
    const map = { 'réalisé': 'ok', 'planifié': 'info', 'actions_en_cours': 'warning', 'clôturé': 'ok' };
    return `<span class="pms-badge pms-badge--${map[s] || 'neutral'}">${escapeHtml(s)}</span>`;
  };
  return `
    <div class="pms-section print-page-break-before" id="pms-s17">
      <div class="pms-section__header">
        <span class="pms-section__num">17</span>
        <h2 class="pms-section__title">Audits PMS</h2>
      </div>
      <div class="pms-section__body">
        ${items.length === 0 ? '<p class="pms-empty">Aucun audit PMS enregistré.</p>' : `
        ${items.map(a => {
          let findings = [];
          try { findings = JSON.parse(a.findings || '[]'); } catch {}
          return `
            <div class="pms-audit-card">
              <div class="pms-audit-card__header">
                <span class="pms-audit-card__date">${a.audit_date}</span>
                <span class="pms-audit-card__auditor">${escapeHtml(a.auditor_name)}</span>
                <span class="pms-audit-card__type">${escapeHtml(a.audit_type)} — ${escapeHtml(a.scope)}</span>
                ${a.overall_score != null ? `<span class="pms-audit-card__score">Score : <strong>${a.overall_score}/100</strong></span>` : ''}
                ${statusBadge(a.status)}
              </div>
              ${a.notes ? `<p class="pms-audit-card__notes">${escapeHtml(a.notes)}</p>` : ''}
              ${findings.length > 0 ? `
                <table class="pms-table pms-table--compact">
                  <thead><tr><th>Section</th><th>Constatation</th><th>Sévérité</th><th>Action requise</th></tr></thead>
                  <tbody>
                    ${findings.map(f => `<tr>
                      <td><strong>${escapeHtml(f.section)}</strong></td>
                      <td class="pms-td--wrap">${escapeHtml(f.finding)}</td>
                      <td><span class="pms-badge pms-badge--${f.severity === 'conforme' ? 'ok' : f.severity === 'majeure' ? 'danger' : f.severity === 'mineure' ? 'warning' : 'neutral'}">${escapeHtml(f.severity)}</span></td>
                      <td class="pms-td--wrap">${escapeHtml(f.action_required || '—')}</td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              ` : ''}
            </div>
          `;
        }).join('')}
        `}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('fr-FR'); } catch { return iso; }
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function isDLCAlert(dlc) {
  if (!dlc) return false;
  return new Date(dlc) < new Date();
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS @media print
// ─────────────────────────────────────────────────────────────────────────────

const PMS_PRINT_CSS = `
  /* ── Styles d'impression PMS ── */

  /* Page setup */
  @page {
    size: A4;
    margin: 15mm 15mm 20mm 15mm;
  }

  @media print {
    /* Masquer tout sauf le document PMS */
    body > *:not(#app) { display: none !important; }
    #app > *:not(.pms-export-page) { display: none !important; }
    .pms-toolbar { display: none !important; }
    .pms-toc.no-print { display: none !important; }
    nav, #nav, .nav, header, .header, .trial-banner, .install-banner { display: none !important; }

    /* Reset couleurs pour impression propre */
    body { background: white !important; color: black !important; }
    .pms-export-page { padding: 0 !important; }
    .pms-document { background: white !important; box-shadow: none !important; padding: 0 !important; }

    /* Sauts de page */
    .print-page-break-before { page-break-before: always; }
    .print-page-break-after  { page-break-after: always; }

    /* Ne pas couper les tableaux */
    table { page-break-inside: auto; }
    tr    { page-break-inside: avoid; page-break-after: auto; }
    thead { display: table-header-group; }

    /* Sections */
    .pms-section { page-break-inside: avoid; page-break-before: always; }
    .pms-audit-card { page-break-inside: avoid; }

    /* Couleurs de tableaux OK pour impression */
    .pms-table th { background: #f0f0f0 !important; color: black !important; }
    .pms-row--danger td { background: #fef0f0 !important; }
    .pms-row--warning td { background: #fffbeb !important; }

    /* Badges */
    .pms-badge { border: 1px solid #ccc !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .pms-badge--ok     { background: #d4edda !important; color: #155724 !important; border-color: #c3e6cb !important; }
    .pms-badge--danger { background: #f8d7da !important; color: #721c24 !important; border-color: #f5c6cb !important; }
    .pms-badge--warning{ background: #fff3cd !important; color: #856404 !important; border-color: #ffeeba !important; }
    .pms-badge--info   { background: #d1ecf1 !important; color: #0c5460 !important; border-color: #bee5eb !important; }
    .pms-badge--ccp    { background: #f8d7da !important; color: #721c24 !important; border-color: #f5c6cb !important; font-weight: 700 !important; }
    .pms-badge--type-b { background: #cfe2ff !important; color: #084298 !important; }
    .pms-badge--type-c { background: #ffe5d0 !important; color: #8b2500 !important; }
    .pms-badge--type-p { background: #e9d8fd !important; color: #44337a !important; }
    .pms-kpi { background: #f8f9fa !important; border: 1px solid #dee2e6 !important; }

    /* En-tête et pied de page sur chaque page */
    .pms-section { position: relative; }

    /* Page de garde */
    .pms-cover { text-align: center; padding-top: 60mm; }
    .pms-cover__logo svg { width: 64px; height: 64px; }
  }

  /* ── Styles écran (non-print) ── */
  .pms-export-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--space-4);
  }

  .pms-toolbar {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-4);
    box-shadow: 0 2px 8px rgba(0,0,0,.08);
  }
  .pms-toolbar__left { display: flex; align-items: center; gap: var(--space-2); }
  .pms-toolbar__subtitle { font-size: 13px; color: var(--text-secondary); }
  .pms-toolbar__right { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
  .pms-period-label { font-size: 13px; color: var(--text-secondary); }
  .pms-period-select {
    padding: 6px 10px;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    background: var(--bg-input, var(--bg-card));
    color: var(--text-primary);
    font-size: 13px;
  }

  .pms-document {
    background: var(--bg-card);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    padding: var(--space-5);
  }

  /* Page de garde */
  .pms-cover {
    text-align: center;
    padding: 48px 32px;
    border-bottom: 2px solid var(--border-light);
    margin-bottom: var(--space-5);
  }
  .pms-cover__logo { margin-bottom: var(--space-4); }
  .pms-cover__title {
    font-size: 32px;
    font-weight: 800;
    color: var(--text-primary);
    margin-bottom: 8px;
  }
  .pms-cover__subtitle {
    font-size: 15px;
    color: var(--text-secondary);
    margin-bottom: var(--space-4);
  }
  .pms-cover__restaurant {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-accent);
    margin-bottom: var(--space-5);
  }
  .pms-cover__info-table {
    margin: 0 auto;
    border-collapse: collapse;
    max-width: 560px;
    width: 100%;
  }
  .pms-cover__info-table td, .pms-cover__info-table th {
    padding: 8px 16px;
    border-bottom: 1px solid var(--border-light);
    text-align: left;
    font-size: 14px;
  }
  .pms-cover__info-table td:first-child {
    color: var(--text-secondary);
    width: 200px;
    font-weight: 600;
  }
  .pms-cover__last-audit {
    margin-top: var(--space-4);
    font-size: 13px;
    color: var(--text-secondary);
  }

  /* Table des matières */
  .pms-toc { padding: var(--space-4) 0; border-bottom: 2px solid var(--border-light); margin-bottom: var(--space-5); }
  .pms-toc__list { columns: 2; column-gap: 32px; padding-left: 20px; }
  .pms-toc__list li { padding: 4px 0; font-size: 14px; break-inside: avoid; }
  .pms-toc__list a { color: var(--color-accent); text-decoration: none; }
  .pms-toc__list a:hover { text-decoration: underline; }

  /* Sections */
  .pms-section {
    margin-bottom: var(--space-6);
    padding-top: var(--space-4);
    border-top: 2px solid var(--border-light);
  }
  .pms-section__header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .pms-section__num {
    width: 36px;
    height: 36px;
    min-width: 36px;
    background: var(--color-accent);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16px;
  }
  .pms-section__title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }
  .pms-section__body { padding-left: 0; }

  .pms-subsection-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
    margin: var(--space-4) 0 var(--space-2) 0;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border-light);
  }
  .pms-subsection-title--danger { color: var(--color-danger, #e53e3e); }

  /* KPIs */
  .pms-kpis {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-bottom: var(--space-3);
  }
  .pms-kpi {
    background: var(--bg-secondary, #f8f9fa);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    padding: 10px 16px;
    min-width: 100px;
    text-align: center;
  }
  .pms-kpi--ok { background: #f0fdf4; border-color: #bbf7d0; }
  .pms-kpi--danger { background: #fff1f2; border-color: #fecdd3; }
  .pms-kpi--warning { background: #fffbeb; border-color: #fde68a; }
  .pms-kpi--info { background: #eff6ff; border-color: #bfdbfe; }
  .pms-kpi__val { display: block; font-size: 22px; font-weight: 800; color: var(--text-primary); }
  .pms-kpi__lbl { display: block; font-size: 11px; color: var(--text-secondary); margin-top: 2px; }

  /* Tableaux */
  .pms-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    margin-bottom: var(--space-3);
  }
  .pms-table th {
    background: var(--bg-secondary, #f3f4f6);
    color: var(--text-secondary);
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .04em;
    padding: 8px 12px;
    border-bottom: 2px solid var(--border-light);
    text-align: left;
    white-space: nowrap;
  }
  .pms-table td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-light);
    vertical-align: top;
  }
  .pms-table tbody tr:hover { background: var(--bg-hover, rgba(0,0,0,.02)); }
  .pms-table--compact td, .pms-table--compact th { padding: 6px 10px; }
  .pms-td--wrap { max-width: 280px; word-wrap: break-word; white-space: normal; line-height: 1.4; }
  .pms-row--danger td { background: rgba(229,62,62,.06); }
  .pms-row--warning td { background: rgba(214,158,46,.06); }

  /* Badges */
  .pms-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }
  .pms-badge--ok      { background: var(--color-success-bg, #d4edda); color: var(--color-success-text, #155724); }
  .pms-badge--danger  { background: var(--color-danger-bg, #f8d7da); color: var(--color-danger-text, #721c24); }
  .pms-badge--warning { background: var(--color-warning-bg, #fff3cd); color: var(--color-warning-text, #856404); }
  .pms-badge--info    { background: var(--color-info-bg, #d1ecf1); color: var(--color-info-text, #0c5460); }
  .pms-badge--neutral { background: var(--bg-secondary, #e9ecef); color: var(--text-secondary); }
  .pms-badge--ccp     { background: #f8d7da; color: #721c24; font-weight: 700; }
  .pms-badge--type-b  { background: #cfe2ff; color: #084298; }
  .pms-badge--type-c  { background: #ffe5d0; color: #8b2500; }
  .pms-badge--type-p  { background: #e9d8fd; color: #44337a; }

  /* Audit cards */
  .pms-audit-card {
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .pms-audit-card__header {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: var(--space-2);
    font-size: 13px;
  }
  .pms-audit-card__date { font-weight: 700; }
  .pms-audit-card__score { font-size: 14px; }
  .pms-audit-card__notes {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: var(--space-2);
  }

  /* Info grid */
  .pms-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .pms-info-card {
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    padding: var(--space-3);
  }
  .pms-info-card h3 {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .04em;
    color: var(--text-secondary);
    margin: 0 0 var(--space-2) 0;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border-light);
  }

  /* Empty state */
  .pms-empty {
    font-size: 13px;
    color: var(--text-secondary);
    font-style: italic;
    padding: var(--space-2) 0;
  }

  /* Notes */
  .pms-notes {
    font-size: 13px;
    color: var(--text-secondary);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-secondary, #f8f9fa);
    border-left: 3px solid var(--color-accent);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    margin-top: var(--space-2);
  }

  /* Text helpers */
  .pms-text--danger { color: var(--color-danger, #e53e3e); font-weight: 600; }

  /* Footer document */
  .pms-footer-doc {
    margin-top: var(--space-6);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border-light);
    font-size: 12px;
    color: var(--text-secondary);
    text-align: center;
  }
`;
