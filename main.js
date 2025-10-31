const decksKey = 'riglogistics:decks';
const selectedDeckKey = 'riglogistics:selectedDeck';
const defaultDecks = ['Statfjord A deck', 'Statfjord B deck', 'Statfjord C deck'];

const deckSelectionView = document.getElementById('deck-selection');
const workspaceView = document.getElementById('workspace-view');
const deckListEl = document.getElementById('deck-list');
const createDeckBtn = document.getElementById('create-deck');
const backButton = document.getElementById('back-button');
const historySidebar = document.getElementById('history-sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');
const historyList = document.getElementById('history-list');
const workspaceContainer = document.getElementById('workspace-container');
const workspaceContent = document.getElementById('workspace-content');
const createItemBtn = document.getElementById('create-item');
const settingsButton = document.getElementById('settings-button');
const settingsMenu = document.getElementById('settings-menu');
const addDeckAreaBtn = document.getElementById('add-deck-area');
const contextMenu = document.getElementById('context-menu');
const zoomValueEl = document.getElementById('zoom-value');

const inputWidth = document.getElementById('input-width');
const inputHeight = document.getElementById('input-height');
const inputLabel = document.getElementById('input-label');
const inputColor = document.getElementById('input-color');

let decks = loadDecks();
let currentDeck = null;
let history = [];
let activeItem = null;

const workspaceState = {
    scale: 1,
    translateX: -workspaceContent.offsetWidth / 2,
    translateY: -workspaceContent.offsetHeight / 2,
};

function loadDecks() {
    const stored = localStorage.getItem(decksKey);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length) {
                return parsed;
            }
        } catch (err) {
            console.warn('Unable to parse stored decks', err);
        }
    }
    return [...defaultDecks];
}

function saveDecks() {
    localStorage.setItem(decksKey, JSON.stringify(decks));
}

function renderDeckList() {
    deckListEl.innerHTML = '';
    decks.forEach((deck) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = deck;
        button.addEventListener('click', () => selectDeck(deck));
        deckListEl.appendChild(button);
    });
}

function selectDeck(deck) {
    currentDeck = deck;
    localStorage.setItem(selectedDeckKey, deck);
    deckSelectionView.classList.remove('active');
    workspaceView.classList.add('active');
    history = [];
    historyList.innerHTML = '';
    workspaceContent.innerHTML = '';
    applyWorkspaceTransform();
    closeSettingsMenu();
}

function goBackToSelection() {
    currentDeck = null;
    localStorage.removeItem(selectedDeckKey);
    deckSelectionView.classList.add('active');
    workspaceView.classList.remove('active');
}

function applyWorkspaceTransform() {
    workspaceContent.style.transform = `translate(${workspaceState.translateX}px, ${workspaceState.translateY}px) scale(${workspaceState.scale})`;
    zoomValueEl.textContent = `${Math.round(workspaceState.scale * 100)}%`;
}

function addHistoryEntry(label) {
    const time = new Date().toLocaleTimeString();
    const li = document.createElement('li');
    li.textContent = `${label} • ${time}`;
    historyList.prepend(li);
    history.unshift({ label, time });
}

function createItemElement({ width, height, label, color, type = 'item' }) {
    const element = document.createElement('div');
    element.className = type;
    element.dataset.x = '0';
    element.dataset.y = '0';
    element.dataset.rotation = '0';
    element.dataset.width = width.toString();
    element.dataset.height = height.toString();
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    if (type === 'item') {
        element.style.background = color;
    } else {
        element.style.background = '#ffffff';
        element.style.color = '#0f172a';
    }
    element.textContent = label || (type === 'item' ? 'New item' : 'Deck area');

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    element.appendChild(resizeHandle);

    setupItemInteractions(element, resizeHandle);
    if (type === 'deck-area') {
        workspaceContent.insertBefore(element, workspaceContent.firstChild);
    } else {
        workspaceContent.appendChild(element);
    }
    addHistoryEntry(`${type === 'item' ? 'Item' : 'Deck'} created${label ? `: ${label}` : ''}`);
    return element;
}

function setupItemInteractions(element, resizeHandle) {
    let pointerId = null;
    let action = null;
    let start = {};

    element.addEventListener('pointerdown', (event) => {
        if (event.target === resizeHandle) {
            action = 'resize';
        } else {
            action = 'move';
        }
        pointerId = event.pointerId;
        element.setPointerCapture(pointerId);
        start = {
            x: event.clientX,
            y: event.clientY,
            elemX: parseFloat(element.dataset.x),
            elemY: parseFloat(element.dataset.y),
            width: parseFloat(element.dataset.width),
            height: parseFloat(element.dataset.height),
        };
        activeItem = element;
    });

    element.addEventListener('pointermove', (event) => {
        if (pointerId !== event.pointerId) return;
        const deltaX = (event.clientX - start.x) / workspaceState.scale;
        const deltaY = (event.clientY - start.y) / workspaceState.scale;

        if (action === 'move') {
            const newX = start.elemX + deltaX;
            const newY = start.elemY + deltaY;
            element.dataset.x = newX;
            element.dataset.y = newY;
        } else if (action === 'resize') {
            const newWidth = Math.max(40, start.width + deltaX);
            const newHeight = Math.max(40, start.height + deltaY);
            element.dataset.width = newWidth;
            element.dataset.height = newHeight;
            element.style.width = `${newWidth}px`;
            element.style.height = `${newHeight}px`;
        }
        updateElementTransform(element);
    });

    element.addEventListener('pointerup', (event) => {
        if (pointerId !== event.pointerId) return;
        element.releasePointerCapture(pointerId);
        pointerId = null;
        action = null;
    });

    element.addEventListener('pointercancel', () => {
        if (pointerId !== null) {
            element.releasePointerCapture(pointerId);
        }
        pointerId = null;
        action = null;
    });

    element.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        activeItem = element;
        openContextMenu(event.clientX, event.clientY);
    });

    updateElementTransform(element);
}

function updateElementTransform(element) {
    const x = parseFloat(element.dataset.x);
    const y = parseFloat(element.dataset.y);
    const rotation = parseFloat(element.dataset.rotation);
    element.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
}

function handleCreateItem() {
    const width = parseInt(inputWidth.value, 10) || 120;
    const height = parseInt(inputHeight.value, 10) || 120;
    const label = inputLabel.value.trim();
    const color = inputColor.value;

    createItemElement({ width, height, label, color, type: 'item' });
    inputLabel.value = '';
}

function toggleSidebar() {
    historySidebar.classList.toggle('hidden');
}

function openSettingsMenu() {
    settingsMenu.classList.add('open');
}

function closeSettingsMenu() {
    settingsMenu.classList.remove('open');
}

function openContextMenu(x, y) {
    contextMenu.style.transform = `translate(${x}px, ${y}px)`;
    contextMenu.classList.add('open');
}

function closeContextMenu() {
    contextMenu.classList.remove('open');
    contextMenu.style.transform = 'translate(-1000px, -1000px)';
}

function handleContextAction(action) {
    if (!activeItem) return;
    if (action === 'delete') {
        activeItem.remove();
        addHistoryEntry('Item deleted');
    } else if (action === 'rotate-left') {
        const current = parseFloat(activeItem.dataset.rotation) || 0;
        activeItem.dataset.rotation = (current - 15).toString();
        updateElementTransform(activeItem);
    } else if (action === 'rotate-right') {
        const current = parseFloat(activeItem.dataset.rotation) || 0;
        activeItem.dataset.rotation = (current + 15).toString();
        updateElementTransform(activeItem);
    }
    closeContextMenu();
}

function handleAddDeckArea() {
    const size = 320;
    createItemElement({
        width: size,
        height: size,
        label: `${currentDeck || 'Deck'} area`,
        color: '#ffffff',
        type: 'deck-area',
    });
    closeSettingsMenu();
}

function initializeDeckSelection() {
    renderDeckList();
    const storedSelection = localStorage.getItem(selectedDeckKey);
    if (storedSelection && decks.includes(storedSelection)) {
        selectDeck(storedSelection);
    }
}

function handleCreateDeck() {
    const name = prompt('Name of the new deck?');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (decks.includes(trimmed)) {
        alert('A deck with that name already exists.');
        return;
    }
    decks.push(trimmed);
    saveDecks();
    renderDeckList();
}

function setupWorkspaceInteractions() {
    let isPanning = false;
    let panStart = { x: 0, y: 0, translateX: 0, translateY: 0 };

    workspaceContainer.addEventListener('pointerdown', (event) => {
        if (event.target !== workspaceContainer && event.target !== workspaceContent) {
            return;
        }
        isPanning = true;
        workspaceContainer.setPointerCapture(event.pointerId);
        panStart = {
            x: event.clientX,
            y: event.clientY,
            translateX: workspaceState.translateX,
            translateY: workspaceState.translateY,
        };
    });

    workspaceContainer.addEventListener('pointermove', (event) => {
        if (!isPanning) return;
        const deltaX = (event.clientX - panStart.x);
        const deltaY = (event.clientY - panStart.y);
        workspaceState.translateX = panStart.translateX + deltaX;
        workspaceState.translateY = panStart.translateY + deltaY;
        applyWorkspaceTransform();
    });

    const stopPan = (event) => {
        if (!isPanning) return;
        workspaceContainer.releasePointerCapture(event.pointerId);
        isPanning = false;
    };

    workspaceContainer.addEventListener('pointerup', stopPan);
    workspaceContainer.addEventListener('pointercancel', stopPan);

    workspaceContainer.addEventListener('wheel', (event) => {
        event.preventDefault();
        const scaleDelta = event.deltaY < 0 ? 1.1 : 0.9;
        const newScale = Math.min(2.5, Math.max(0.4, workspaceState.scale * scaleDelta));

        const rect = workspaceContainer.getBoundingClientRect();
        const cursorX = event.clientX - rect.left;
        const cursorY = event.clientY - rect.top;

        const originX = (cursorX - workspaceState.translateX) / workspaceState.scale;
        const originY = (cursorY - workspaceState.translateY) / workspaceState.scale;

        workspaceState.scale = newScale;
        workspaceState.translateX = cursorX - originX * newScale;
        workspaceState.translateY = cursorY - originY * newScale;

        applyWorkspaceTransform();
    }, { passive: false });
}

function handleGlobalPointerDown() {
    closeSettingsMenu();
    closeContextMenu();
}

settingsButton.addEventListener('click', (event) => {
    event.stopPropagation();
    settingsMenu.classList.toggle('open');
});

settingsMenu.addEventListener('click', (event) => {
    event.stopPropagation();
});

addDeckAreaBtn.addEventListener('click', handleAddDeckArea);

document.addEventListener('click', handleGlobalPointerDown);

deckSelectionView.addEventListener('click', (event) => {
    event.stopPropagation();
});

contextMenu.addEventListener('click', (event) => {
    event.stopPropagation();
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    handleContextAction(button.dataset.action);
});

document.addEventListener('contextmenu', () => {
    closeContextMenu();
});

createItemBtn.addEventListener('click', handleCreateItem);
toggleSidebarBtn.addEventListener('click', toggleSidebar);
createDeckBtn.addEventListener('click', handleCreateDeck);
backButton.addEventListener('click', goBackToSelection);

initializeDeckSelection();
setupWorkspaceInteractions();
applyWorkspaceTransform();
