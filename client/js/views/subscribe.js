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
          <span class="subscribe-period">/mois · Sans engagement</span>
        </div>

        <button class="btn btn-primary subscribe-btn" id="subscribe-now">
          S'abonner maintenant
        </button>

        <div class="subscribe-reassurance">
          <p>Vos données sont préservées.</p>
          <p>Tout se débloque instantanément.</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('subscribe-now').addEventListener('click', async () => {
    const btn = document.getElementById('subscribe-now');
    btn.textContent = 'Redirection...';
    btn.disabled = true;

    try {
      const account = getAccount();
      const accountId = account ? account.id : null;
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        showToast('Erreur lors de la redirection vers le paiement', 'error');
        btn.textContent = "S'abonner maintenant";
        btn.disabled = false;
      }
    } catch (err) {
      showToast('Erreur de connexion au service de paiement', 'error');
      btn.textContent = "S'abonner maintenant";
      btn.disabled = false;
    }
  });
}
