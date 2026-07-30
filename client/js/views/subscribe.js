// ═══════════════════════════════════════════
// Subscribe — Upgrade to Pro
// ═══════════════════════════════════════════

function renderSubscribe() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="subscribe-page">
      <div class="subscribe-card">
        <h1 class="subscribe-title">Passez en Pro</h1>
        
        <div class="subscribe-features">
          <div class="subscribe-feature">
            <span class="subscribe-check">✅</span>
            <span>Fiches techniques illimitées</span>
          </div>
          <div class="subscribe-feature">
            <span class="subscribe-check">✅</span>
            <span>Saisie vocale IA</span>
          </div>
          <div class="subscribe-feature">
            <span class="subscribe-check">✅</span>
            <span>Module HACCP complet</span>
          </div>
          <div class="subscribe-feature">
            <span class="subscribe-check">✅</span>
            <span>Export PDF</span>
          </div>
          <div class="subscribe-feature">
            <span class="subscribe-check">✅</span>
            <span>Multi-comptes</span>
          </div>
          <div class="subscribe-feature">
            <span class="subscribe-check">✅</span>
            <span>Support prioritaire</span>
          </div>
        </div>

        <div class="subscribe-price">
          <span class="subscribe-amount">39€</span>
          <span class="subscribe-period">HT/mois · Sans engagement</span>
        </div>

        <button class="btn btn-primary subscribe-btn" id="subscribe-now">
          S'abonner maintenant
        </button>
        <p id="subscribe-error" role="alert" style="display:none; color: var(--color-danger, #C4422A); font-size: 0.875rem; margin-top: 12px;"></p>

        <div class="subscribe-reassurance">
          <p>Vos données sont préservées.</p>
          <p>Tout se débloque instantanément.</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('subscribe-now').addEventListener('click', async () => {
    const btn = document.getElementById('subscribe-now');
    const errorEl = document.getElementById('subscribe-error');
    const showError = (msg) => {
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
      showToast(msg, 'error');
      btn.textContent = "S'abonner maintenant";
      btn.disabled = false;
    };
    errorEl.style.display = 'none';
    btn.textContent = 'Redirection...';
    btn.disabled = true;
    if (window.umami) { try { umami.track('checkout_started'); } catch (e) {} }

    try {
      // Le compte est identifié par la session serveur (cookie JWT/Bearer via
      // API.request, qui joint aussi le jeton CSRF) — on n'envoie jamais
      // d'accountId choisi côté navigateur.
      const data = await API.request('/stripe/create-checkout', { method: 'POST', body: {} });
      if (data && data.url) {
        window.location.href = data.url;
      } else if (data && data.status === 'active') {
        errorEl.style.color = 'var(--color-accent, #1F7A4D)';
        errorEl.textContent = 'Votre abonnement Pro est déjà actif — rien à payer.';
        errorEl.style.display = 'block';
        btn.textContent = 'Abonnement déjà actif';
      } else {
        showError('Le paiement est momentanément indisponible. Réessayez dans quelques minutes.');
      }
    } catch (err) {
      const msg = (err && err.message && err.message.includes('Stripe'))
        ? 'Le service de paiement est momentanément indisponible. Réessayez dans quelques minutes ou écrivez à contact@restosuite.fr.'
        : (err && err.message) || 'Erreur de connexion au service de paiement.';
      showError(msg);
    }
  });
}
