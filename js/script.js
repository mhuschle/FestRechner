let total = 0;
let order = {};
let lastAddedItem = null;  // Variable to save last added item
updateTotal('totalSum');   // Write text with initial total=0 

async function loadConfig() {
    const response = await fetch('data/config.json');
    if (!response.ok) {
        throw new Error('Could not import config.');
    }
    const settings = await response.json();
    return settings;
}

loadConfig().then(settings => {
    document.title = settings.appName + " - " + settings.version;
    document.getElementById('header').innerHTML = `
    <span style="font-weight: bold; font-size: 25px;">${settings.appName}</span>
    <span style="font-weight: normal; font-size: 18px;"> - ${settings.version}</span>
    `;
    createPfandButton(settings.pfand);
});

async function loadProducts() {
    const response = await fetch('data/products.json');
    if (!response.ok) {
        throw new Error('Could not import config.');
    }
    const products = await response.json();
    const normalized = normalizeProducts(products); // <- Hier wird normalisiert
    return normalized;
}

function normalizeProducts(products) {
    const normalized = {};

    for (const category in products) {
        normalized[category] = products[category].map(item => normalizeItem(item));
    }

    return normalized;
}

function normalizeItem(item) {
    const {
        name = '',
        price = 0.00,
        pfand = 0.00,
        submenu
    } = item;

    const normalized = { name, price, pfand };

    if (submenu && Array.isArray(submenu)) {
        normalized.submenu = submenu.map(sub => normalizeItem(sub));
    }

    return normalized;
}

function createProductButtons() {
    loadProducts()
        .then(products => {
            for (const category in products) {
                const grid = document.getElementById(`${category}Grid`);
                if (!grid) {
                    console.warn(`Kein Grid für Kategorie "${category}" gefunden.`);
                    continue;
                }
                products[category].forEach(item => {
                    createSingleProductButton(item, grid);
                });
            }
        })
        .catch(err => console.error('Fehler beim Laden der Produkte:', err));
}

function createSingleProductButton(product, container) {
    const button = document.createElement('button');
    if (product.submenu) {
        button.innerText = `${product.name}\n(Untermenü)`;
    } else if (product.pfand == 0.00) {
        button.innerText = `${product.name}\n(${product.price.toFixed(2)} €)`;
    } else {
        button.innerText = `${product.name}\n(${product.price.toFixed(2)} + ${product.pfand.toFixed(2)} €)`;
    }

    button.onclick = () => {
        if (product.submenu) {
            showSubmenu(product.name, product.submenu);
        } else {
            addItem(product.name, product.price, product.pfand);
        }
    };
    container.appendChild(button);
}

function createPfandButton(pfandList) {
    const pfandButtonItem = document.getElementById('pfandButton');

    if (!Array.isArray(pfandList)) {
        console.warn('Pfandangabe in data/config.json ist fehlerhaft.');
        pfandButtonItem.style.display = 'none';
        return;
    }

    if (pfandList.length === 0) {
        pfandButtonItem.style.display = 'none';
    } else if (pfandList.length === 1) {
        if (parseFloat(pfandList[0].price) > 0) {
            pfandButtonItem.innerHTML = `
            Pfand zurück <br>(${parseFloat(pfandList[0].price).toFixed(2)} €)
            `;
            pfandButtonItem.onclick = () => addItem('Pfand ' + pfandList[0].name, -parseFloat(pfandList[0].price), 0);
        } else {
            pfandButtonItem.style.display = 'none';
        }
    } else if (pfandList.length > 1) {
        pfandButtonItem.innerText = `Pfand zurück\n(Untermenü)`;
        pfandButtonItem.onclick = () => showSubmenu('Pfand', pfandList);
    }
}

function showSubmenu(name, submenuOptions) {
    closeSubmenu();  // Closes already opened submenus
    const overlay = document.getElementById('overlay');
    const submenuDiv = document.createElement('div');
    submenuDiv.className = 'submenu';

    if (name === 'Pfand') {
        const submenuTitle = document.createElement('submenu-title');
        submenuTitle.className = 'submenu-title';
        submenuTitle.innerText = `Pfand`;
        submenuDiv.appendChild(submenuTitle);

        submenuOptions.forEach(option => {
            const submenuButton = document.createElement('button');
            submenuButton.innerText = `${option.name}\n(${option.price.toFixed(2)}€)`;
            submenuButton.onclick = () => {
                addItem(name + ' ' + option.name, -parseFloat(option.price), 0);
                // closeSubmenu();  // Closes submenus after selection
            };
            submenuDiv.appendChild(submenuButton);
        });
    } else {
        const submenuTitle = document.createElement('submenu-title');
        submenuTitle.className = 'submenu-title';
        submenuTitle.innerText = `${name}`;
        submenuDiv.appendChild(submenuTitle);

        submenuOptions.forEach(option => {
            const submenuButton = document.createElement('button');
            if (option.pfand == 0.00) {
                submenuButton.innerText = `${option.name}\n(${option.price.toFixed(2)} €)`;
            } else {
                submenuButton.innerText = `${option.name}\n(${option.price.toFixed(2)} + ${option.pfand.toFixed(2)} €)`;
            }
            submenuButton.onclick = () => {
                addItem(name + ' ' + option.name, option.price, option.pfand);
                // closeSubmenu();  // Closes submenus after selection
            };
            submenuDiv.appendChild(submenuButton);
        });
    }
    document.body.appendChild(submenuDiv);
    overlay.style.display = 'block';
}

function closeSubmenu() {
    const submenus = document.querySelectorAll('.submenu');
    submenus.forEach(submenu => submenu.remove());
    document.getElementById('overlay').style.display = 'none';
}

function addItem(itemName, itemPrice, itemPfand) {
    total += itemPrice + itemPfand;

    if (order[itemName]) {
        order[itemName].count += 1;
        order[itemName].total += itemPrice + itemPfand;
    } else {
        order[itemName] = {
            count: 1,
            total: itemPrice + itemPfand
        };
    }

    lastAddedItem = { name: itemName, price: itemPrice + itemPfand };  // Save last added item
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

function updateTotal(target) {
    document.getElementById(target).innerHTML = `
    <span>Gesamtbetrag : </span>
    <span class="highlight" style="font-weight: bold; font-size: 26px;"> ${total.toFixed(2)} €</span>
    `;
}

function showSummary() {
    document.getElementById('mainPage').classList.add('hidden');
    document.getElementById('summaryPage').classList.remove('hidden');

    let summaryHTML = '';
    for (const item in order) {
        summaryHTML += `${item} x ${order[item].count}: ${order[item].total.toFixed(2)} €<br>`;
    }
    summaryHTML += `<br>`;
    document.getElementById('orderSummary').innerHTML = summaryHTML;
    updateTotal('summaryTotalSum');
}

function clearOrder() {
    total = 0;
    order = {};
    updateTotal('totalSum');
}

function backToOrder() {
    document.getElementById('summaryPage').classList.add('hidden');
    document.getElementById('mainPage').classList.remove('hidden');
    document.getElementById('mainPage').scrollIntoView({ behavior: 'smooth' });
    closeSubmenu();  // Closes all submenus
}

function resetOrder() {
    clearOrder();
    backToOrder();
}

function showTab(tabName) {
    document.querySelectorAll('.grid').forEach(grid => {
        grid.classList.add('hidden');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    const activeGrid = document.getElementById(`${tabName}Grid`);
    const activeTab = document.getElementById(`${tabName}Tab`);

    if (activeGrid) activeGrid.classList.remove('hidden');
    if (activeTab) activeTab.classList.add('active');

    document.getElementById('mainPage').scrollIntoView({ behavior: 'smooth' });
}


// Create buttons dynamically
createProductButtons();
showTab('drinks');  // Set "drinks" tab first
