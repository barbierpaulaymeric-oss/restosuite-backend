# Runbook — Domaine apex `restosuite.fr` (TLS)

> ✅ **RÉSOLU le 2026-07-30.** Le certificat de l'apex `restosuite.fr` a été
> émis (Custom Domain Render déjà déclaré + vérifié ; le certificat était en
> statut « Unknown » puis est passé « Certificate Issued »). Vérifié depuis
> l'extérieur : handshake TLS OK (`CN=restosuite.fr`, émis le 2026-07-30, valide
> jusqu'au 2026-10-28), `https://restosuite.fr/` → **une seule 301** →
> `https://www.restosuite.fr/` → **200**. Ce document est conservé comme
> référence en cas de récidive (le certificat se renouvelle tous les ~90 jours).
>
> Contexte initial : `https://restosuite.fr/` échouait pendant le handshake TLS
> (alerte SSL n° 40), alors que `https://www.restosuite.fr/` fonctionnait. La
> redirection canonique Express (`server/app.js`) ne pouvait rien y faire :
> l'échec avait lieu **avant** que la requête HTTP n'atteigne le serveur.

## 1. Diagnostic constaté (2026-07-30)

| Contrôle | Résultat | Interprétation |
| --- | --- | --- |
| `dig restosuite.fr A` | `216.24.57.1` | L'apex pointe déjà sur l'IP apex de Render — le DNS est **correct** |
| `dig www.restosuite.fr` | CNAME → `restosuite-backend.onrender.com` → edge Cloudflare | Configuration www normale Render |
| `dig restosuite.fr NS` | `dns14.ovh.net` / `ns14.ovh.net` | Le DNS est géré chez **OVH** |
| `dig restosuite.fr CAA` | (vide) | Aucun enregistrement CAA ne bloque l'émission de certificat |
| `curl -I http://restosuite.fr/` (port 80) | `301 → https://restosuite.fr/` servi par Cloudflare (edge Render) | Le trafic apex **arrive bien** chez Render |
| `openssl s_client -servername restosuite.fr` | `sslv3 alert handshake failure` (alerte 40), aucun certificat présenté | L'edge Render **n'a aucun certificat** pour le SNI `restosuite.fr` |
| `openssl s_client -servername www.restosuite.fr` | Certificat `CN=www.restosuite.fr`, émis par Google Trust Services (WE1) | Le certificat www est valide mais ne couvre **pas** l'apex |

**Cause racine :** le domaine `restosuite.fr` (apex, sans `www`) n'est pas
déclaré — ou pas vérifié — comme *custom domain* sur le service Render.
Render ne demande donc jamais de certificat pour ce nom : l'edge accepte la
connexion TCP, reçoit le SNI `restosuite.fr`, ne trouve aucun certificat
correspondant et coupe le handshake.

Ce n'est **pas** un problème DNS (l'A record est déjà bon) ni un problème de
code applicatif. C'est un réglage du dashboard Render.

## 2. Correction (dashboard Render — accès requis)

1. Dashboard Render → service **restosuite** → **Settings → Custom Domains**.
2. Vérifier la liste :
   - `www.restosuite.fr` doit déjà y être avec le statut *Certificate Issued*.
   - Si `restosuite.fr` est absent → **Add Custom Domain** → saisir
     `restosuite.fr`.
   - Si `restosuite.fr` est présent mais en erreur (*Certificate Pending* /
     *Verification Failed*) → cliquer **Verify** / **Retry** ; si l'erreur
     persiste, le supprimer puis le ré-ajouter.
3. Render vérifie alors l'enregistrement DNS. L'A record `restosuite.fr →
   216.24.57.1` étant déjà en place chez OVH, la vérification doit passer sans
   modification DNS. (Si Render affiche une autre IP attendue que
   `216.24.57.1`, mettre à jour la zone OVH en conséquence — voir §3.)
4. Attendre l'émission du certificat (généralement < 15 min, statut
   *Certificate Issued*).
5. S'assurer que `www.restosuite.fr` est marqué comme domaine **primaire** :
   Render redirige alors automatiquement `restosuite.fr` →
   `https://www.restosuite.fr` en **une seule** redirection 301 au niveau de
   l'edge (le middleware Express n'est même pas sollicité).

## 3. Vérifications DNS chez OVH (si la vérification Render échoue)

Zone `restosuite.fr` (manager OVH → Web Cloud → Noms de domaine →
`restosuite.fr` → Zone DNS) :

| Entrée | Type | Valeur attendue |
| --- | --- | --- |
| `restosuite.fr.` (apex) | A | `216.24.57.1` (ou l'IP indiquée par Render à l'ajout du domaine) |
| `restosuite.fr.` (apex) | AAAA | *aucune* (supprimer toute AAAA orpheline — une AAAA pointant ailleurs ferait échouer la vérification pour les clients IPv6) |
| `www.restosuite.fr.` | CNAME | `restosuite-backend.onrender.com.` |
| CAA | — | soit aucune entrée (état actuel, OK), soit inclure `letsencrypt.org` **et** `pki.goog` si une CAA est ajoutée un jour |

Ne pas activer de proxy/CDN tiers devant l'apex : Render gère déjà son edge
Cloudflare et l'émission du certificat échoue si un autre proxy intercepte la
validation.

## 4. Critères d'acceptation (à rejouer après la correction)

```bash
# 1) http apex → une redirection vers https, puis vers www, statut final 200
curl -sIL -o /dev/null -w '%{url_effective} %{http_code}\n' http://restosuite.fr/

# 2) https apex : handshake TLS OK + certificat couvrant restosuite.fr
echo QUIT | openssl s_client -connect restosuite.fr:443 -servername restosuite.fr 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName

# 3) redirection unique apex → www (301, Location exact)
curl -sI https://restosuite.fr/ | grep -Ei '^(HTTP|location)'

# 4) www répond 200
curl -sI https://www.restosuite.fr/ | head -1
```

Attendu :
- (1) aboutit à `https://www.restosuite.fr/ 200` ;
- (2) le SAN contient `restosuite.fr` ;
- (3) `HTTP/2 301` + `location: https://www.restosuite.fr/` (une seule
  redirection HTTPS) ;
- (4) `HTTP/2 200`.

## 5. Accès nécessaires

- **Dashboard Render** (propriétaire du service `restosuite`) — pour §2.
  C'est le seul accès indispensable dans l'état actuel du DNS.
- **Manager OVH** (zone DNS `restosuite.fr`) — uniquement si la vérification
  Render échoue (§3).

Sans ces accès, la correction ne peut pas être effectuée depuis le dépôt :
aucun changement de code ne peut résoudre un handshake TLS refusé à l'edge.
