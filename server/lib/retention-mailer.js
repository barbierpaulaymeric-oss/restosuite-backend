'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// Relances anti-churn (J+1 / J+3 / J+7)
// ═══════════════════════════════════════════════════════════════════════════
// Complément de l'email de bienvenue (routes/auth.js → sendWelcomeEmail) : on
// relance les restaurateurs qui se sont inscrits mais n'ont pas encore créé
// leur première fiche technique (= non activés, first_recipe_at IS NULL). Un
// compte qui a déjà créé une fiche est activé : on ne le relance jamais.
//
// Fonctionnement : un tick (horaire) parcourt les comptes gérants non activés,
// calcule l'ancienneté du compte (created_at) et envoie la relance « due » la
// plus précoce non encore envoyée — une seule par compte et par tick, ce qui
// préserve la progression J+1 → J+3 → J+7. Chaque envoi est journalisé dans
// retention_emails_sent (index unique account_id+email_type) pour ne jamais
// doubler une relance, même après un redémarrage ou un rattrapage.
//
// Best-effort / env-gated : sans SMTP OVH configuré (MERCURIALE_EMAIL /
// MERCURIALE_PASSWORD absents — dev/test), le job ne fait rien.
//
// Cf. marketing/retention-study.md.

const { all, run } = require('../db');
const { escapeHtml } = require('./email-signature');

const APP_URL = 'https://www.restosuite.fr/app';
const TRIAL_DAYS = 60;

// Bouton CTA orange RestoSuite (même style que l'email de bienvenue).
function ctaButton(label) {
  return `<p style="margin:24px 0">
  <a href="${APP_URL}" style="display:inline-block;background:#C45A18;color:#fff;text-decoration:none;
     font-weight:600;padding:12px 24px;border-radius:8px">${escapeHtml(label)}</a>
</p>`;
}

// Chaque étape : seuil d'ancienneté (jours), sujet, et un build(firstName, ctx)
// qui renvoie { text, html }. La signature brandée est ajoutée automatiquement
// par sendPlainEmail → applySignature.
const STAGES = [
  {
    type: 'j1',
    minDays: 1,
    subject: 'Votre première fiche technique vous attend',
    build(firstName) {
      const text =
`Bonjour ${firstName},

Vous avez créé votre compte RestoSuite hier — bravo, c'est le premier pas !

Pour vraiment sentir ce que l'outil peut faire pour vous, le plus simple est de
créer votre première fiche technique. Deux façons d'y arriver en quelques minutes :

  • Dictez votre recette à Alto, votre assistant : il la met en forme, calcule
    le coût matière et le food cost à votre place.
  • Ou importez vos fiches existantes (Excel / CSV) en quelques clics.

Accédez à votre espace : ${APP_URL}

Une question, un blocage ? Répondez simplement à cet email, on vous lit.

À très vite,
L'équipe RestoSuite`;

      const html =
`<p>Bonjour <strong>${escapeHtml(firstName)}</strong>,</p>
<p>Vous avez créé votre compte RestoSuite hier — bravo, c'est le premier pas&nbsp;!</p>
<p>Pour vraiment sentir ce que l'outil peut faire pour vous, le plus simple est de
créer votre <strong>première fiche technique</strong>. Deux façons d'y arriver en quelques minutes&nbsp;:</p>
<ul style="padding-left:20px;line-height:1.6">
  <li><strong>Dictez votre recette à Alto</strong>, votre assistant&nbsp;: il la met en forme
      et calcule le coût matière et le food cost à votre place.</li>
  <li>Ou <strong>importez vos fiches existantes</strong> (Excel / CSV) en quelques clics.</li>
</ul>
${ctaButton('Créer ma première fiche')}
<p style="color:#6b7280;font-size:13px">Une question, un blocage&nbsp;? Répondez simplement à cet email, on vous lit.</p>
<p>À très vite,<br>L'équipe RestoSuite</p>`;

      return { text, html };
    },
  },
  {
    type: 'j3',
    minDays: 3,
    subject: 'Vous n\'avez pas encore essayé ?',
    build(firstName) {
      const text =
`Bonjour ${firstName},

On a remarqué que vous n'aviez pas encore créé votre première fiche — pas de
souci, le quotidien d'un restaurateur ne laisse pas toujours le temps.

Un exemple concret pour vous donner une idée : en 2 minutes, vous pouvez
calculer le food cost de votre plat signature. Vous saisissez (ou dictez) les
ingrédients, RestoSuite fait le reste : coût matière, marge, prix de vente
conseillé. De quoi savoir précisément ce que chaque assiette vous rapporte.

C'est souvent le moment « ah, c'est donc ça » — et tout devient plus simple ensuite.

Accédez à votre espace : ${APP_URL}

À très vite,
L'équipe RestoSuite`;

      const html =
`<p>Bonjour <strong>${escapeHtml(firstName)}</strong>,</p>
<p>On a remarqué que vous n'aviez pas encore créé votre première fiche — pas de souci,
le quotidien d'un restaurateur ne laisse pas toujours le temps.</p>
<p>Un exemple concret&nbsp;: <strong>en 2&nbsp;minutes, vous pouvez calculer le food cost de
votre plat signature</strong>. Vous saisissez (ou dictez) les ingrédients, RestoSuite fait
le reste&nbsp;: coût matière, marge, prix de vente conseillé. De quoi savoir précisément
ce que chaque assiette vous rapporte.</p>
<p>C'est souvent le moment «&nbsp;ah, c'est donc ça&nbsp;» — et tout devient plus simple ensuite.</p>
${ctaButton('Calculer un food cost')}
<p>À très vite,<br>L'équipe RestoSuite</p>`;

      return { text, html };
    },
  },
  {
    type: 'j7',
    minDays: 7,
    subject: 'Votre essai gratuit continue',
    build(firstName, ctx) {
      const remaining = ctx.remainingDays;
      const text =
`Bonjour ${firstName},

Petit point sur votre essai gratuit RestoSuite : il vous reste ${remaining} jours
pour explorer l'outil, sans limite et sans engagement.

Si vous ne deviez retenir que trois choses utiles dès cette semaine :

  1. Fiches techniques & food cost — connaissez le coût et la marge de chaque
     plat, et fixez vos prix sereinement.
  2. HACCP simplifié — relevés de température et traçabilité en un geste, vos
     documents prêts en cas de contrôle.
  3. Commandes fournisseurs — générez et envoyez vos bons de commande en un clic.

Il n'est jamais trop tard pour commencer : ${APP_URL}

À très vite,
L'équipe RestoSuite`;

      const html =
`<p>Bonjour <strong>${escapeHtml(firstName)}</strong>,</p>
<p>Petit point sur votre essai gratuit RestoSuite&nbsp;: il vous reste
<strong>${remaining}&nbsp;jours</strong> pour explorer l'outil, sans limite et sans engagement.</p>
<p>Si vous ne deviez retenir que trois choses utiles dès cette semaine&nbsp;:</p>
<ol style="padding-left:20px;line-height:1.6">
  <li><strong>Fiches techniques &amp; food cost</strong> — connaissez le coût et la marge de
      chaque plat, et fixez vos prix sereinement.</li>
  <li><strong>HACCP simplifié</strong> — relevés de température et traçabilité en un geste,
      vos documents prêts en cas de contrôle.</li>
  <li><strong>Commandes fournisseurs</strong> — générez et envoyez vos bons de commande en un clic.</li>
</ol>
${ctaButton('Reprendre mon essai')}
<p>À très vite,<br>L'équipe RestoSuite</p>`;

      return { text, html };
    },
  },
];

// Parcourt les comptes éligibles et envoie au plus une relance par compte.
// Renvoie un récapitulatif { sent, candidates } (utile pour les logs/tests/cron).
async function runRetentionCycle() {
  if (!process.env.MERCURIALE_EMAIL || !process.env.MERCURIALE_PASSWORD) {
    return { sent: 0, candidates: 0, reason: 'smtp-disabled' };
  }

  const { sendPlainEmail } = require('./mercuriale-mail/smtp-client');

  // Comptes gérants non activés, avec un email réel (hors démo/test). On calcule
  // l'ancienneté en jours directement en SQL (julianday). Le seuil minimum est
  // celui de la première étape : inutile de remonter des comptes trop récents.
  const minDays = STAGES[0].minDays;
  const candidates = all(
    `SELECT a.id, a.email, a.first_name,
            (julianday('now') - julianday(a.created_at)) AS age_days
     FROM accounts a
     WHERE a.is_owner = 1
       AND a.first_recipe_at IS NULL
       AND a.email IS NOT NULL AND TRIM(a.email) <> ''
       AND LOWER(a.email) NOT LIKE '%@test.%'
       AND LOWER(a.email) NOT LIKE 'demo@%'
       AND (julianday('now') - julianday(a.created_at)) >= ?`,
    [minDays]
  );

  let sent = 0;
  for (const acc of candidates) {
    const sentTypes = new Set(
      all('SELECT email_type FROM retention_emails_sent WHERE account_id = ?', [acc.id])
        .map(r => r.email_type)
    );

    // Étape « due » la plus précoce non encore envoyée → conserve la narration
    // J+1 → J+3 → J+7 (une seule relance par tick, même en cas de rattrapage).
    const stage = STAGES.find(s => acc.age_days >= s.minDays && !sentTypes.has(s.type));
    if (!stage) continue;

    const firstName = (acc.first_name || '').trim() || 'Chef';
    const remainingDays = Math.max(0, TRIAL_DAYS - Math.floor(acc.age_days));
    const { text, html } = stage.build(firstName, { remainingDays });

    try {
      await sendPlainEmail({ to: acc.email, subject: stage.subject, text, html });
      // Journalise APRÈS l'envoi réussi. INSERT OR IGNORE : pas de doublon si
      // deux ticks se chevauchaient (l'index unique tranche).
      run(
        'INSERT OR IGNORE INTO retention_emails_sent (account_id, email_type) VALUES (?, ?)',
        [acc.id, stage.type]
      );
      sent++;
    } catch (e) {
      console.warn(`📧 Relance ${stage.type} → ${acc.email} échouée:`, e.message);
    }
  }

  return { sent, candidates: candidates.length };
}

// ─── Scheduler (setInterval) ───
// Démarré depuis server/index.js après app.listen — jamais en test (les tests
// chargent app.js, pas index.js). Env-gated comme le poller mercuriale.
let _timer = null;

function startRetentionMailer({ intervalMs } = {}) {
  if (_timer) return _timer;
  if (!process.env.MERCURIALE_EMAIL || !process.env.MERCURIALE_PASSWORD) {
    console.log('📧 Relances rétention: désactivées (SMTP non configuré)');
    return null;
  }
  const ms = Number(intervalMs)
    || Number(process.env.RETENTION_MAILER_INTERVAL_MS)
    || 60 * 60 * 1000; // toutes les heures
  console.log(`📧 Relances rétention: activées, intervalle ${ms}ms`);

  const tick = async () => {
    try {
      const r = await runRetentionCycle();
      if (r.sent > 0) {
        console.log(`📧 Relances rétention: ${r.sent} email(s) envoyé(s) sur ${r.candidates} compte(s) éligible(s)`);
      }
    } catch (e) {
      console.warn('📧 Relances rétention: erreur de cycle —', e.message);
    }
  };

  _timer = setInterval(tick, ms);
  if (typeof _timer.unref === 'function') _timer.unref();
  // Un premier cycle au démarrage pour ne pas attendre l'intervalle complet.
  tick().catch(() => {});
  return _timer;
}

function stopRetentionMailer() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

module.exports = { runRetentionCycle, startRetentionMailer, stopRetentionMailer, STAGES };
