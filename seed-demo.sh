#!/bin/bash
BASE="http://localhost:3007/api"

# 1. Create accounts
echo "=== Creating accounts ==="
# First account becomes gerant automatically
curl -s -X POST "$BASE/accounts" -H "Content-Type: application/json" \
  -d '{"name":"Chef Laurent","pin":"1234","role":"gerant"}' | jq .id

curl -s -X POST "$BASE/accounts" -H "Content-Type: application/json" \
  -d '{"name":"Marie","pin":"5678","role":"salle"}' | jq .id

# 2. Create suppliers
echo "=== Creating suppliers ==="
S1=$(curl -s -X POST "$BASE/suppliers" -H "Content-Type: application/json" \
  -d '{"name":"Boucherie Dupont","contact":"Jean Dupont","phone":"01 42 33 44 55","quality_rating":5}' | jq .id)
echo "Boucherie Dupont: $S1"

S2=$(curl -s -X POST "$BASE/suppliers" -H "Content-Type: application/json" \
  -d '{"name":"Marée Fraîche","contact":"Sophie Martin","phone":"01 42 33 66 77","quality_rating":4}' | jq .id)
echo "Marée Fraîche: $S2"

S3=$(curl -s -X POST "$BASE/suppliers" -H "Content-Type: application/json" \
  -d '{"name":"Primeur Bio","contact":"Marc Lefèvre","phone":"01 42 33 88 99","quality_rating":4}' | jq .id)
echo "Primeur Bio: $S3"

# 3. Create sub-recipes
echo "=== Creating sub-recipes ==="
FOND=$(curl -s -X POST "$BASE/recipes" -H "Content-Type: application/json" \
  -d '{
    "name":"Fond de veau",
    "category":"base",
    "recipe_type":"sous_recette",
    "portions":10,
    "prep_time_min":30,
    "cooking_time_min":360,
    "notes":"Fond brun classique, base de nombreuses sauces",
    "ingredients":[
      {"name":"os de veau","gross_quantity":2000,"unit":"g","price_per_unit":8.50,"price_unit":"kg"},
      {"name":"carotte","gross_quantity":300,"unit":"g","waste_percent":15,"price_per_unit":2.20,"price_unit":"kg"},
      {"name":"oignon","gross_quantity":200,"unit":"g","waste_percent":10,"price_per_unit":1.80,"price_unit":"kg"},
      {"name":"céleri branche","gross_quantity":150,"unit":"g","waste_percent":20,"price_per_unit":3.50,"price_unit":"kg"},
      {"name":"bouquet garni","gross_quantity":1,"unit":"pièce","price_per_unit":0.80,"price_unit":"pièce"}
    ],
    "steps":[
      {"step_number":1,"instruction":"Concasser les os et les faire colorer au four à 220°C pendant 30 min"},
      {"step_number":2,"instruction":"Tailler la garniture aromatique en mirepoix"},
      {"step_number":3,"instruction":"Déplacer les os dans une marmite, déglacer la plaque"},
      {"step_number":4,"instruction":"Mouiller à hauteur à l eau froide, porter à ébullition"},
      {"step_number":5,"instruction":"Écumer, ajouter la garniture aromatique et le bouquet garni"},
      {"step_number":6,"instruction":"Cuire 6h à frémissement, passer au chinois"}
    ]
  }' | jq .id)
echo "Fond de veau: $FOND"

VINAI=$(curl -s -X POST "$BASE/recipes" -H "Content-Type: application/json" \
  -d '{
    "name":"Vinaigrette maison",
    "category":"base",
    "recipe_type":"sous_recette",
    "portions":20,
    "prep_time_min":5,
    "notes":"Vinaigrette classique moutardée",
    "ingredients":[
      {"name":"huile d olive extra vierge","gross_quantity":500,"unit":"ml","price_per_unit":12.00,"price_unit":"l"},
      {"name":"vinaigre de vin rouge","gross_quantity":150,"unit":"ml","price_per_unit":4.50,"price_unit":"l"},
      {"name":"moutarde de Dijon","gross_quantity":30,"unit":"g","price_per_unit":6.00,"price_unit":"kg"},
      {"name":"sel fin","gross_quantity":5,"unit":"g","price_per_unit":0.80,"price_unit":"kg"},
      {"name":"poivre noir moulu","gross_quantity":2,"unit":"g","price_per_unit":35.00,"price_unit":"kg"}
    ]
  }' | jq .id)
echo "Vinaigrette: $VINAI"

# 4. Create main recipes
echo "=== Creating main recipes ==="
SUPREME=$(curl -s -X POST "$BASE/recipes" -H "Content-Type: application/json" \
  -d "{
    \"name\":\"Suprême de volaille, jus au fond de veau\",
    \"category\":\"plat\",
    \"recipe_type\":\"plat\",
    \"portions\":1,
    \"prep_time_min\":15,
    \"cooking_time_min\":25,
    \"selling_price\":18,
    \"notes\":\"Volaille fermière Label Rouge, cuisson basse température\",
    \"ingredients\":[
      {\"name\":\"suprême de volaille\",\"gross_quantity\":220,\"unit\":\"g\",\"waste_percent\":5,\"price_per_unit\":14.50,\"price_unit\":\"kg\"},
      {\"name\":\"beurre doux\",\"gross_quantity\":30,\"unit\":\"g\",\"price_per_unit\":12.00,\"price_unit\":\"kg\"},
      {\"sub_recipe_id\":$FOND,\"gross_quantity\":1,\"unit\":\"portion\",\"notes\":\"1 portion de fond de veau\"}
    ],
    \"steps\":[
      {\"step_number\":1,\"instruction\":\"Assaisonner le suprême, colorer côté peau au beurre moussant\"},
      {\"step_number\":2,\"instruction\":\"Enfourner à 170°C pendant 18 min\"},
      {\"step_number\":3,\"instruction\":\"Déglacer la poêle avec le fond de veau, réduire de moitié\"},
      {\"step_number\":4,\"instruction\":\"Monter le jus au beurre, rectifier l assaisonnement\"}
    ]
  }" | jq .id)
echo "Suprême: $SUPREME"

SAUMON=$(curl -s -X POST "$BASE/recipes" -H "Content-Type: application/json" \
  -d '{
    "name":"Pavé de saumon, beurre blanc",
    "category":"plat",
    "recipe_type":"plat",
    "portions":1,
    "prep_time_min":10,
    "cooking_time_min":12,
    "selling_price":22,
    "notes":"Saumon Label Rouge, cuisson mi-cuit",
    "ingredients":[
      {"name":"pavé de saumon","gross_quantity":180,"unit":"g","waste_percent":3,"price_per_unit":28.00,"price_unit":"kg"},
      {"name":"beurre doux","gross_quantity":60,"unit":"g","price_per_unit":12.00,"price_unit":"kg"},
      {"name":"crème liquide 35%","gross_quantity":30,"unit":"ml","price_per_unit":4.80,"price_unit":"l"},
      {"name":"échalote","gross_quantity":40,"unit":"g","waste_percent":12,"price_per_unit":5.50,"price_unit":"kg"},
      {"name":"vin blanc sec","gross_quantity":50,"unit":"ml","price_per_unit":8.00,"price_unit":"l"}
    ],
    "steps":[
      {"step_number":1,"instruction":"Ciseler finement les échalotes, suer au beurre sans coloration"},
      {"step_number":2,"instruction":"Déglacer au vin blanc, réduire à sec"},
      {"step_number":3,"instruction":"Ajouter la crème, porter à ébullition"},
      {"step_number":4,"instruction":"Monter au beurre froid en fouettant, passer au chinois"},
      {"step_number":5,"instruction":"Cuire le saumon côté peau 4 min, retourner 2 min"}
    ]
  }' | jq .id)
echo "Saumon: $SAUMON"

ENTRECOTE=$(curl -s -X POST "$BASE/recipes" -H "Content-Type: application/json" \
  -d '{
    "name":"Entrecôte grillée, frites maison",
    "category":"plat",
    "recipe_type":"plat",
    "portions":1,
    "prep_time_min":20,
    "cooking_time_min":15,
    "selling_price":24,
    "notes":"Entrecôte de boeuf Charolais, maturation 30 jours",
    "ingredients":[
      {"name":"entrecôte de boeuf","gross_quantity":300,"unit":"g","waste_percent":8,"price_per_unit":32.00,"price_unit":"kg"},
      {"name":"pomme de terre","gross_quantity":250,"unit":"g","waste_percent":15,"price_per_unit":1.80,"price_unit":"kg"},
      {"name":"huile de tournesol","gross_quantity":100,"unit":"ml","price_per_unit":3.20,"price_unit":"l"}
    ],
    "steps":[
      {"step_number":1,"instruction":"Sortir l entrecôte 30 min avant cuisson, assaisonner généreusement"},
      {"step_number":2,"instruction":"Éplucher et tailler les pommes de terre en frites de 8mm"},
      {"step_number":3,"instruction":"Blanchir les frites 5 min à 140°C, égoutter"},
      {"step_number":4,"instruction":"Griller l entrecôte sur grill très chaud, 3 min par face pour saignant"},
      {"step_number":5,"instruction":"Frire les frites à 180°C jusqu à coloration dorée"}
    ]
  }' | jq .id)
echo "Entrecôte: $ENTRECOTE"

SALADE=$(curl -s -X POST "$BASE/recipes" -H "Content-Type: application/json" \
  -d "{
    \"name\":\"Salade César\",
    \"category\":\"entree\",
    \"recipe_type\":\"plat\",
    \"portions\":1,
    \"prep_time_min\":15,
    \"selling_price\":12,
    \"notes\":\"Avec poulet fermier grillé et anchois de Collioure\",
    \"ingredients\":[
      {\"name\":\"laitue romaine\",\"gross_quantity\":120,\"unit\":\"g\",\"waste_percent\":20,\"price_per_unit\":4.50,\"price_unit\":\"kg\"},
      {\"name\":\"blanc de poulet\",\"gross_quantity\":100,\"unit\":\"g\",\"price_per_unit\":12.00,\"price_unit\":\"kg\"},
      {\"name\":\"parmesan reggiano\",\"gross_quantity\":30,\"unit\":\"g\",\"price_per_unit\":22.00,\"price_unit\":\"kg\"},
      {\"name\":\"anchois de Collioure\",\"gross_quantity\":15,\"unit\":\"g\",\"price_per_unit\":45.00,\"price_unit\":\"kg\"},
      {\"sub_recipe_id\":$VINAI,\"gross_quantity\":1,\"unit\":\"portion\",\"notes\":\"1 portion de vinaigrette maison\"}
    ],
    \"steps\":[
      {\"step_number\":1,\"instruction\":\"Griller le blanc de poulet assaisonné, tailler en aiguillettes\"},
      {\"step_number\":2,\"instruction\":\"Laver et essorer la romaine, déchirer en morceaux\"},
      {\"step_number\":3,\"instruction\":\"Réaliser des copeaux de parmesan à la mandoline\"},
      {\"step_number\":4,\"instruction\":\"Dresser la salade, disposer poulet, anchois, parmesan\"},
      {\"step_number\":5,\"instruction\":\"Napper de vinaigrette au dernier moment\"}
    ]
  }" | jq .id)
echo "Salade César: $SALADE"

# 5. Create orders
echo "=== Creating orders ==="
curl -s -X POST "$BASE/orders" -H "Content-Type: application/json" \
  -d "{\"table_number\":3,\"notes\":\"Client habitué\",\"items\":[{\"recipe_id\":$SUPREME,\"quantity\":2},{\"recipe_id\":$SALADE,\"quantity\":1}]}" | jq .id

curl -s -X POST "$BASE/orders" -H "Content-Type: application/json" \
  -d "{\"table_number\":7,\"notes\":\"Anniversaire — dessert offert\",\"items\":[{\"recipe_id\":$SAUMON,\"quantity\":2},{\"recipe_id\":$ENTRECOTE,\"quantity\":1},{\"recipe_id\":$SALADE,\"quantity\":2}]}" | jq .id

curl -s -X POST "$BASE/orders" -H "Content-Type: application/json" \
  -d "{\"table_number\":12,\"items\":[{\"recipe_id\":$ENTRECOTE,\"quantity\":2},{\"recipe_id\":$SAUMON,\"quantity\":1}]}" | jq .id

# 6. HACCP - Create zones
echo "=== Creating HACCP zones ==="
Z1=$(curl -s -X POST "$BASE/haccp/zones" -H "Content-Type: application/json" \
  -d '{"name":"Chambre froide positive","type":"fridge","min_temp":0,"max_temp":4}' | jq .id)

Z2=$(curl -s -X POST "$BASE/haccp/zones" -H "Content-Type: application/json" \
  -d '{"name":"Chambre froide négative","type":"freezer","min_temp":-25,"max_temp":-18}' | jq .id)

Z3=$(curl -s -X POST "$BASE/haccp/zones" -H "Content-Type: application/json" \
  -d '{"name":"Vitrine réfrigérée","type":"fridge","min_temp":0,"max_temp":4}' | jq .id)

# Temperature readings
echo "=== Adding temperature readings ==="
curl -s -X POST "$BASE/haccp/temperatures" -H "Content-Type: application/json" \
  -d "{\"zone_id\":$Z1,\"temperature\":2.4,\"recorded_by\":1,\"notes\":\"Relevé matin\"}" > /dev/null
curl -s -X POST "$BASE/haccp/temperatures" -H "Content-Type: application/json" \
  -d "{\"zone_id\":$Z1,\"temperature\":2.8,\"recorded_by\":1,\"notes\":\"Relevé midi\"}" > /dev/null
curl -s -X POST "$BASE/haccp/temperatures" -H "Content-Type: application/json" \
  -d "{\"zone_id\":$Z1,\"temperature\":3.1,\"recorded_by\":1,\"notes\":\"Relevé soir\"}" > /dev/null
curl -s -X POST "$BASE/haccp/temperatures" -H "Content-Type: application/json" \
  -d "{\"zone_id\":$Z2,\"temperature\":-21.5,\"recorded_by\":1,\"notes\":\"Relevé matin\"}" > /dev/null
curl -s -X POST "$BASE/haccp/temperatures" -H "Content-Type: application/json" \
  -d "{\"zone_id\":$Z2,\"temperature\":-20.8,\"recorded_by\":1,\"notes\":\"Relevé midi\"}" > /dev/null
curl -s -X POST "$BASE/haccp/temperatures" -H "Content-Type: application/json" \
  -d "{\"zone_id\":$Z3,\"temperature\":3.2,\"recorded_by\":1,\"notes\":\"Relevé matin\"}" > /dev/null
curl -s -X POST "$BASE/haccp/temperatures" -H "Content-Type: application/json" \
  -d "{\"zone_id\":$Z3,\"temperature\":3.5,\"recorded_by\":1,\"notes\":\"Relevé midi\"}" > /dev/null

# 7. Cleaning tasks
echo "=== Adding cleaning tasks ==="
C1=$(curl -s -X POST "$BASE/haccp/cleaning" -H "Content-Type: application/json" \
  -d '{"name":"Nettoyage plans de travail","zone":"Cuisine","frequency":"daily","product":"Dégraissant alimentaire","method":"Pulvériser, laisser agir 5 min, rincer à l eau claire"}' | jq .id)
C2=$(curl -s -X POST "$BASE/haccp/cleaning" -H "Content-Type: application/json" \
  -d '{"name":"Désinfection chambres froides","zone":"Stockage","frequency":"weekly","product":"Désinfectant Anios","method":"Vider, nettoyer au détergent, rincer, désinfecter, sécher"}' | jq .id)
C3=$(curl -s -X POST "$BASE/haccp/cleaning" -H "Content-Type: application/json" \
  -d '{"name":"Nettoyage hotte et filtres","zone":"Cuisine","frequency":"weekly","product":"Dégraissant puissant","method":"Tremper les filtres, brosser la hotte, rincer abondamment"}' | jq .id)
C4=$(curl -s -X POST "$BASE/haccp/cleaning" -H "Content-Type: application/json" \
  -d '{"name":"Nettoyage sol cuisine","zone":"Cuisine","frequency":"daily","product":"Détergent sol alimentaire","method":"Balayer, laver au balai espagnol, rincer"}' | jq .id)

# Mark some as done
curl -s -X POST "$BASE/haccp/cleaning/$C1/done" -H "Content-Type: application/json" \
  -d '{"done_by":1,"notes":"RAS"}' > /dev/null
curl -s -X POST "$BASE/haccp/cleaning/$C4/done" -H "Content-Type: application/json" \
  -d '{"done_by":1,"notes":"Fait après le service"}' > /dev/null

echo "=== Seeding complete! ==="
