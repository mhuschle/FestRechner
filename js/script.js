let order = {};
let activeCategory = null;
let categories = [];
let touchStartX = 0;
let touchEndX = 0;

updateTotal();

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
    <span style="font-weight: bold; font-size: 1.5em;">FestRechner</span>
    <span style="font-weight: normal;"> - ${settings.version}</span>
    `;
    createQuickAccessButton(settings.quickAccess);
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

    const hasSubmenu = Array.isArray(item.submenu);
    const hasPrice = Object.prototype.hasOwnProperty.call(item, 'price');
    const hasPfand = Object.prototype.hasOwnProperty.call(item, 'pfand');

    const normalized = { name, price, pfand };

    if (hasSubmenu && (hasPrice || hasPfand)) {
        console.error(`Ungültiger Eintrag: "${item.name}" darf nicht gleichzeitig submenu und price/pfand haben.`);
        return null;
    }

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
        button.classList.add('active');
        setTimeout(() => {
            button.classList.remove('active');
        }, 25);
        if (product.submenu) {
            showSubmenu(product.name, product.submenu);
        } else {
            addItem(product.name, product.price, product.pfand);
        }
    };
    container.appendChild(button);
}

function createQuickAccessButton(quickAccessList) {
    const quickAccessItem = document.getElementById('quickAccessButton');

    if (!Array.isArray(quickAccessList)) {
        console.warn('Schnellzugriffangabe in data/config.json ist fehlerhaft.');
        quickAccessItem.style.display = 'none';
        return;
    }

    if (quickAccessList.length === 0) {
        quickAccessItem.style.display = 'none';

    } else if (quickAccessList.length > 1) {
        quickAccessItem.onclick = () => showSubmenu('Schnellzugriff', quickAccessList);
    }
}

function showSubmenu(name, submenuOptions) {
    closeSubmenu();
    const overlay = document.getElementById('overlay');

    const submenuDiv = document.createElement('div');
    submenuDiv.className = 'submenu';

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
            submenuButton.classList.add('active');
            setTimeout(() => {
                submenuButton.classList.remove('active');
            }, 25);
            addItem(name + ' ' + option.name, option.price, option.pfand);
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

function addItem(itemName, itemPrice, itemPfand) {
    const lineTotal = itemPrice + itemPfand;

    if (order[itemName]) {
        order[itemName].count += 1;
    } else {
        order[itemName] = {
            count: 1,
            unitPrice: lineTotal
        };
    }
    updateTotal();
}

function removeItem(itemName) {
    if (!order[itemName]) {
        return;
    }

    const item = order[itemName];
    if (item.count > 1) {
        item.count -= 1;
    } else {
        delete order[itemName];
    }
    renderSummary();
}

function calculateTotal() {
    let total = 0;
    for (const itemName in order) {
        const item = order[itemName];
        total += item.unitPrice * item.count;
    }
    return total.toFixed(2);
}

function updateTotal() {
    const target = ['totalSum', 'summaryTotalSum'];

    target.forEach(target => {
        targetElement = document.getElementById(target);
        targetElement.innerHTML = `
        <span>Summe: </span>
        <span style="font-weight: bold;"> ${calculateTotal()} €</span>
        `;
    });
}

function renderSummary() {
    const summaryContainer = document.getElementById('orderSummary');
    if (!summaryContainer) {
        return;
    }

    summaryContainer.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'summary-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Artikel</th>
            <th>Anz.</th>
            <th>Summe</th>
            <th></th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    const entries = Object.entries(order);
    if (entries.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 4;
        emptyCell.className = 'summary-empty';
        emptyCell.textContent = 'Noch keine Artikel in der Bestellung.';
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
    } else {
        entries.forEach(([itemName, item]) => {
            const row = document.createElement('tr');
            row.className = 'summary-row';

            const nameCell = document.createElement('td');
            nameCell.className = 'summary-name';
            nameCell.textContent = itemName;
            row.appendChild(nameCell);

            const countCell = document.createElement('td');
            countCell.className = 'summary-count';
            countCell.textContent = `x ${item.count}`;
            row.appendChild(countCell);

            const totalCell = document.createElement('td');
            totalCell.className = 'summary-total';
            totalCell.textContent = `${(item.unitPrice * item.count).toFixed(2)} €`;
            row.appendChild(totalCell);

            const actionCell = document.createElement('td');
            actionCell.className = 'summary-actions';
            const removeButton = document.createElement('button');
            removeButton.className = 'summary-remove-button';
            removeButton.type = 'button';
            removeButton.textContent = '−';
            removeButton.addEventListener('click', () => removeItem(itemName));
            removeButton.classList.add('active');
            setTimeout(() => {
                removeButton.classList.remove('active');
            }, 25);
            actionCell.appendChild(removeButton);
            row.appendChild(actionCell);

            tbody.appendChild(row);
        });
    }

    table.appendChild(tbody);
    summaryContainer.appendChild(table);
    updateTotal();
}

function showPage(pageName) {
    ['main', 'summary', 'help'].forEach(key => {
        const page = document.getElementById(`${key}Page`);
        if (!page) {
            return;
        }
        const shouldShow = key === pageName;
        page.classList.toggle('is-active', shouldShow);
        page.classList.toggle('hidden', !shouldShow);
    });

    ['main', 'summary', 'help'].forEach(key => {
        const footerGroup = document.getElementById(`${key}Buttons`);
        if (!footerGroup) {
            return;
        }
        footerGroup.classList.toggle('hidden', key !== pageName);
    });

    if (pageName === 'summary') {
        renderSummary();
    }
    closeSubmenu();
}

function showSummary() {
    showPage('summary');
}

function clearOrder() {
    order = {};
    updateTotal();
}

function backToOrder() {
    showPage('main');
    const mainPage = document.getElementById('mainPage');
    if (mainPage) {
        mainPage.scrollIntoView({ behavior: 'smooth' });
    }
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
    document.querySelectorAll('.tab-container button').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.grid button.active').forEach(button => {
        button.classList.remove('active');
    });

    const activeGrid = document.getElementById(`${targetTab}Grid`);
    const activeTab = document.getElementById(`${targetTab}Tab`);

    if (activeGrid) activeGrid.classList.remove('hidden');
    if (activeTab) {
        activeTab.classList.add('active');
        const tabContainer = document.getElementById('tabContainer');
        if (tabContainer) {
            activeTab.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    }

    activeCategory = targetTab;
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

showPage('main');
createProductButtons();
