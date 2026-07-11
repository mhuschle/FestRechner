let total = 0;
let order = {};
let lastAddedItem = null;
let activeCategory = null;
let categories = [];
let touchStartX = 0;
let touchEndX = 0;

updateTotal('totalSum');

async function loadConfig() {
    const response = await fetch('data/config.json');
    if (!response.ok) {
        throw new Error('Could not import config.');
    }
    const settings = await response.json();
    return settings;
}

loadConfig().then(settings => {
    document.getElementById('header').innerHTML = `
    <span style="font-weight: bold; font-size: 3.5svh;">FestRechner</span>
    <span style="font-weight: normal;"> - ${settings.version}</span>
    `;
    createPfandButton(settings.pfand);
});

async function loadProducts() {
    const response = await fetch('data/products.json');
    if (!response.ok) {
        throw new Error('Could not import products.');
    }
    const products = await response.json();
    return normalizeProducts(products);
}

function normalizeProducts(products) {
    const normalized = {};

    for (const category in products) {
        const value = products[category];

        if (Array.isArray(value)) {
            console.warn(`Kategorie "${category}" hat kein Label. Bitte füge in products.json ein Label hinzu.`);
            continue;
        }

        if (!value || typeof value !== 'object' || !Array.isArray(value.items)) {
            console.warn(`Kategorie "${category}" hat ein unbekanntes Format.`);
            continue;
        }

        if (typeof value.label !== 'string' || value.label.trim() === '') {
            console.warn(`Kategorie "${category}" hat kein gültiges Label. Bitte prüfe products.json.`);
            continue;
        }

        normalized[category] = {
            label: value.label,
            items: value.items.map(item => normalizeItem(item))
        };
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
            categories = Object.keys(products);
            const tabContainer = document.getElementById('tabContainer');
            const gridContainer = document.getElementById('productGridContainer');

            if (!tabContainer || !gridContainer) {
                console.warn('Tab-Container oder Grid-Container fehlt.');
                return;
            }

            tabContainer.innerHTML = '';
            gridContainer.innerHTML = '';

            categories.forEach(category => {
                const categoryData = products[category];
                const tabButton = document.createElement('button');
                tabButton.id = `${category}Tab`;

                if (!categoryData.label) {
                    console.warn(`Kategorie "${category}" hat kein Label. Bitte füge in products.json ein Label hinzu.`);
                }
                tabButton.innerText = categoryData.label;
                tabButton.onclick = () => showTab(category);
                tabContainer.appendChild(tabButton);

                const grid = document.createElement('div');
                grid.id = `${category}Grid`;
                grid.className = 'grid hidden';
                gridContainer.appendChild(grid);

                categoryData.items.forEach(item => {
                    createSingleProductButton(item, grid);
                });
            });

            if (categories.length > 0) {
                showTab(categories[0]);
                initSwipeNavigation();
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
            Pfand zurück (${parseFloat(pfandList[0].price).toFixed(2)} €)
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
    closeSubmenu();
    const overlay = document.getElementById('overlay');

    const submenuDiv = document.createElement('div');
    submenuDiv.className = 'submenu';

    const submenuTitle = document.createElement('submenu-title');
    submenuTitle.className = 'submenu-title';

    if (name === 'Pfand') {
        submenuTitle.innerText = `Pfand`;
        submenuDiv.appendChild(submenuTitle);
        submenuOptions.forEach(option => {
            const submenuButton = document.createElement('button');
            submenuButton.innerText = `${option.name} (${option.price.toFixed(2)}€)`;
            submenuButton.onclick = () => {
                addItem(name + ' ' + option.name, -parseFloat(option.price), 0);
            };
            submenuDiv.appendChild(submenuButton);
        });
    } else {
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

    lastAddedItem = { name: itemName, price: itemPrice + itemPfand };
    updateTotal('totalSum');
}

function removeLastItem() {
    if (lastAddedItem && order[lastAddedItem.name]) {
        const item = order[lastAddedItem.name];

        total -= lastAddedItem.price;

        if (item.count > 1) {
            item.count -= 1;
            item.total -= lastAddedItem.price;
        } else {
            delete order[lastAddedItem.name];
        }

        lastAddedItem = null;
        updateTotal('totalSum');
    } else {
        alert('Es gibt keine Bestellung, die gelöscht werden kann.');
    }
}

function updateTotal(target) {
    document.getElementById(target).innerHTML = `
    <span>Betrag : </span>
    <span class="highlight" style="font-weight: bold;"> ${total.toFixed(2)} €</span>
    `;
}

function showSummary() {
    document.getElementById('mainPage').classList.add('hidden');
    document.getElementById('summaryPage').classList.remove('hidden');
    document.getElementById('mainButtons').classList.add('hidden');
    document.getElementById('summaryButtons').classList.remove('hidden');

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
    document.getElementById('summaryButtons').classList.add('hidden');
    document.getElementById('mainPage').classList.remove('hidden');
    document.getElementById('mainButtons').classList.remove('hidden');
    document.getElementById('mainPage').scrollIntoView({ behavior: 'smooth' });
    closeSubmenu();
}

function resetOrder() {
    clearOrder();
    backToOrder();
}

function showTab(tabName) {
    const targetTab = categories.includes(tabName) ? tabName : categories[0];

    document.querySelectorAll('.grid').forEach(grid => {
        grid.classList.add('hidden');
    });
    document.querySelectorAll('.tabContainer button').forEach(tab => {
        tab.classList.remove('active');
    });

    const activeGrid = document.getElementById(`${targetTab}Grid`);
    const activeTab = document.getElementById(`${targetTab}Tab`);

    if (activeGrid) activeGrid.classList.remove('hidden');
    if (activeTab) activeTab.classList.add('active');

    activeCategory = targetTab;
    document.getElementById('mainPage').scrollIntoView({ behavior: 'smooth' });
}

function initSwipeNavigation() {
    const swipeTarget = document.getElementById('mainPage');
    if (!swipeTarget) {
        return;
    }

    swipeTarget.addEventListener('touchstart', handleTouchStart, { passive: true });
    swipeTarget.addEventListener('touchend', handleTouchEnd, { passive: true });
}

function handleTouchStart(event) {
    if (event.touches.length !== 1) {
        return;
    }

    touchStartX = event.touches[0].clientX;
    touchEndX = touchStartX;
}

function handleTouchEnd(event) {
    if (event.changedTouches.length !== 1) {
        return;
    }

    touchEndX = event.changedTouches[0].clientX;
    handleSwipeGesture();
}

function handleSwipeGesture() {
    const swipeThreshold = 60;
    const deltaX = touchEndX - touchStartX;

    if (Math.abs(deltaX) < swipeThreshold || !activeCategory) {
        return;
    }

    const currentIndex = categories.indexOf(activeCategory);
    if (currentIndex === -1) {
        return;
    }

    if (deltaX < 0 && currentIndex < categories.length - 1) {
        showTab(categories[currentIndex + 1]);
    } else if (deltaX > 0 && currentIndex > 0) {
        showTab(categories[currentIndex - 1]);
    }
}

createProductButtons();
