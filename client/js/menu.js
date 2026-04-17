var params = new URLSearchParams(window.location.search);
var tableNumber = params.get('table') || '?';
document.getElementById('table-badge').textContent = 'Table ' + tableNumber;

var cart = {};
var menuData = {};

function escapeHtml(str) {
  var d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  updateCart();
}

function removeFromCart(id) {
  if (cart[id] > 1) cart[id]--;
  else delete cart[id];
  updateCart();
}

function updateCart() {
  var cartEl = document.getElementById('cart');
  var itemsEl = document.getElementById('cart-items');
  var countEl = document.getElementById('cart-count');
  var totalEl = document.getElementById('cart-total');

  var entries = Object.entries(cart);
  if (entries.length === 0) { cartEl.classList.remove('visible'); return; }
  cartEl.classList.add('visible');

  var total = 0, count = 0;
  itemsEl.innerHTML = '';

  entries.forEach(function(entry) {
    var id = entry[0], qty = entry[1];
    var item = menuData[id];
    if (!item) return;
    total += item.price * qty;
    count += qty;

    var div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML =
      '<span>' + escapeHtml(item.name) + '</span>' +
      '<div class="qty-controls">' +
        '<button class="qty-btn" onclick="removeFromCart(' + id + ')">−</button>' +
        '<span>' + qty + '</span>' +
        '<button class="qty-btn" onclick="addToCart(' + id + ')">+</button>' +
        '<span style="width:60px;text-align:right">' + (item.price * qty).toFixed(2) + ' €</span>' +
      '</div>';
    itemsEl.appendChild(div);
  });

  countEl.textContent = count + ' article' + (count > 1 ? 's' : '');
  totalEl.textContent = total.toFixed(2) + ' €';
}

async function submitOrder() {
  var items = Object.entries(cart).map(function(entry) {
    return { recipe_id: Number(entry[0]), quantity: entry[1] };
  });
  if (items.length === 0) return;

  try {
    var res = await fetch('/api/menu/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_number: Number(tableNumber), items: items })
    });
    if (res.ok) {
      document.getElementById('success').classList.add('visible');
      cart = {};
      updateCart();
      setTimeout(function() {
        document.getElementById('success').classList.remove('visible');
      }, 5000);
    } else {
      var err = await res.json();
      alert('Erreur: ' + (err.error || 'Commande échouée'));
    }
  } catch (e) {
    alert('Erreur lors de l\'envoi de la commande.');
  }
}

async function loadMenu() {
  try {
    var res = await fetch('/api/menu');
    var data = await res.json();

    var categories = data.menu || data.categories || {};
    if (data.restaurant_name) {
      document.getElementById('restaurant-name').textContent = data.restaurant_name;
    }

    menuData = {};
    var container = document.getElementById('menu-container');

    if (Object.keys(categories).length === 0) {
      container.innerHTML = '<div class="empty"><p>Aucun plat disponible pour le moment.</p></div>';
      return;
    }

    container.innerHTML = '';

    for (var cat of Object.keys(categories)) {
      var items = categories[cat];
      var section = document.createElement('div');
      section.className = 'category';
      section.innerHTML = '<h2>' + escapeHtml(cat) + '</h2>';
      items.forEach(function(item) {
        var id = item.id;
        var price = item.price || item.selling_price || 0;
        var name = item.name || '';
        var desc = item.description || '';
        menuData[id] = { id, name, price, description: desc };

        var div = document.createElement('div');
        div.className = 'menu-item';
        div.innerHTML =
          '<div class="info">' +
            '<div class="name">' + escapeHtml(name) + '</div>' +
            (desc ? '<div class="desc">' + escapeHtml(desc) + '</div>' : '') +
          '</div>' +
          '<div class="price">' + price.toFixed(2) + ' €</div>' +
          '<button class="add-btn" onclick="addToCart(' + id + ')">+</button>';
        section.appendChild(div);
      });
      container.appendChild(section);
    }
  } catch (e) {
    document.getElementById('menu-container').innerHTML =
      '<div class="empty"><p>Erreur de chargement du menu.</p></div>';
  }
}

loadMenu();
