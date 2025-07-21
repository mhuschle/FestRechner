let pfandAmount = 0.00;
let total = 0;
let order = {};
let lastAddedItem = null;  // Variable to save last added item
updateTotal('totalSum')    // Write text with initial total=0 

async function loadConfig() {
    const response = await fetch('data/config.json');
    if (!response.ok) {
        throw new Error('Could not import config.');
    }
    const settings = await response.json();
    return settings;
}

loadConfig().then(settings => {
    document.title = settings.appName + " " + settings.version;
    document.getElementById('header').innerHTML = `
    <span style="font-weight: bold; font-size: 25px;">${settings.appName}</span>
    <span style="font-weight: normal; font-size: 18px;"> - ${settings.version}</span>
    `;
    pfandAmount = parseFloat(settings.pfand)
    if (pfandAmount > 0) {
        document.getElementById('pfandButton').innerHTML = `
        Pfand zurück <br>(${pfandAmount.toFixed(2)} €)
        `;
    } else {
        document.getElementById('pfandButton').style.display = 'none'
    }
}).catch(err => {
    console.error(err);
});

async function loadProducts() {
    const response = await fetch('data/products.json');
    if (!response.ok) {
        throw new Error('Could not import config.');
    }
    const products = await response.json();
    return products;
}

function createProductButtons() {
    const drinksGrid = document.getElementById('drinksGrid');
    const foodGrid = document.getElementById('foodGrid');
    const etcGrid = document.getElementById('etcGrid');

    loadProducts()
        .then(products => {

            products.drinks.forEach(drink => {
                const button = document.createElement('button');
                button.innerText = `${drink.name} \n(${drink.price.toFixed(2)} € + ${drink.pfand.toFixed(2)} € Pfand)`;
                button.onclick = () => {
                    if (drink.submenu) {
                        showSubmenu(drink.name, drink.submenu, drink.price, drink.pfand);
                    } else {
                        addItem(drink.name, drink.price, drink.pfand);
                    }
                };
                drinksGrid.appendChild(button);
            });

            products.food.forEach(food => {
                const button = document.createElement('button');
                button.innerText = `${food.name} \n(${food.price.toFixed(2)} €)`;
                button.onclick = () => {
                    if (food.submenu) {
                        showSubmenu(food.name, food.submenu, food.price, food.pfand);
                    } else {
                        addItem(food.name, food.price);
                    }
                };
                foodGrid.appendChild(button);
            });

            products.etc.forEach(etc => {
                const button = document.createElement('button');
                button.innerText = `${etc.name} \n(${etc.price.toFixed(2)} €)`;
                button.onclick = () => {
                    if (etc.submenu) {
                        showSubmenu(etc.name, etc.submenu, etc.price, etc.pfand);
                    } else {
                        addItem(etc.name, etc.price);
                    }
                };
                etcGrid.appendChild(button);
            });
        })
}

function showSubmenu(productName, submenuOptions, basePrice, pfand) {
    closeSubmenu();  // Closes already opened submenus
    const overlay = document.getElementById('overlay');
    const submenuDiv = document.createElement('div');
    submenuDiv.className = 'submenu';

    submenuOptions.forEach(option => {
        const endPrice = basePrice + option.additionalPrice;
        const submenuButton = document.createElement('button');
        // submenuButton.innerText = `${option.name} (${endPrice.toFixed(2)} € + ${pfand.toFixed(2)} € Pfand)`;
        submenuButton.innerText = `${option.name} \n(${endPrice.toFixed(2)} €)`;
        submenuButton.onclick = () => {
            addItem(`${productName} ${option.name}`, endPrice, pfand);
            closeSubmenu();  // Closes submenus after selection
        };
        submenuDiv.appendChild(submenuButton);
    });

    document.body.appendChild(submenuDiv);
    overlay.style.display = 'block';
}

function closeSubmenu() {
    const submenus = document.querySelectorAll('.submenu');
    submenus.forEach(submenu => submenu.remove());
    document.getElementById('overlay').style.display = 'none';
}

function addItem(itemName, itemPrice) {
    total += itemPrice + pfandAmount;

    if (order[itemName]) {
        order[itemName].count += 1;
        order[itemName].total += itemPrice + pfandAmount;
    } else {
        order[itemName] = {
            count: 1,
            total: itemPrice + pfandAmount
        };
    }

    lastAddedItem = { name: itemName, price: itemPrice + pfandAmount };  // Save last added item
    updateTotal('totalSum');
}

function removeLastItem() {
    if (lastAddedItem && order[lastAddedItem.name]) {
        const item = order[lastAddedItem.name];

        total -= lastAddedItem.price;  // Subtract price of the last added item

        if (item.count > 1) {
            item.count -= 1;
            item.total -= lastAddedItem.price;
        } else {
            delete order[lastAddedItem.name];
        }

        lastAddedItem = null;  // Resets variable after deleting last order
        updateTotal('totalSum');
    } else {
        alert('Es gibt keine Bestellung, die gelöscht werden kann.');
    }
}

function returnPfand() {
    total -= pfandAmount;

    if (order['Pfand retour']) {
        order['Pfand retour'].count += 1;
        order['Pfand retour'].total -= pfandAmount;
    } else {
        order['Pfand retour'] = {
            count: 1,
            total: -pfandAmount
        };
    }
    updateTotal('totalSum');
}

function updateTotal(target) {
    document.getElementById(target).innerHTML = `
    <span style="font-size: 22px;">Gesamtbetrag: </span>
    <span class="highlight" style="font-weight: bold; font-size: 25px;"> ${total.toFixed(2)} €</span>
    `;
}

function showSummary() {
    document.getElementById('mainPage').classList.add('hidden');
    document.getElementById('summaryPage').classList.remove('hidden');

    let summaryHTML = '';
    for (const item in order) {
        summaryHTML += `${item} x ${order[item].count}: ${order[item].total.toFixed(2)} €<br>`;
    }
    summaryHTML += `<br>`
    document.getElementById('orderSummary').innerHTML = summaryHTML;
    updateTotal('summaryTotalSum')
}

function clearOrder() {
    total = 0;
    order = {};
    updateTotal('totalSum');
}

function backToOrder() {
    document.getElementById('summaryPage').classList.add('hidden');
    document.getElementById('mainPage').classList.remove('hidden');
    closeSubmenu();  // Closes all submenus
}

function resetOrder() {
    clearOrder();
    backToOrder();
}

function showTab(tabName) {
    document.getElementById('drinksGrid').classList.add('hidden');
    document.getElementById('foodGrid').classList.add('hidden');
    document.getElementById('etcGrid').classList.add('hidden');
    document.getElementById('drinksTab').classList.remove('active');
    document.getElementById('foodTab').classList.remove('active');
    document.getElementById('etcTab').classList.remove('active');

    if (tabName === 'drinks') {
        document.getElementById('drinksGrid').classList.remove('hidden');
        document.getElementById('drinksTab').classList.add('active');
    } else if (tabName === 'food') {
        document.getElementById('foodGrid').classList.remove('hidden');
        document.getElementById('foodTab').classList.add('active');
    } else if (tabName === 'etc') {
        document.getElementById('etcGrid').classList.remove('hidden');
        document.getElementById('etcTab').classList.add('active');
    }
}

// Create buttons dynamically
createProductButtons();
showTab('drinks');  // Set "drinks" tab first
