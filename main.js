const decksKey = 'riglogistics:decks';
const selectedDeckKey = 'riglogistics:selectedDeck';
const defaultDecks = ['Statfjord A deck', 'Statfjord B deck', 'Statfjord C deck'];
const PIXELS_PER_METER = 60;
const BASE_SCALE = 0.4;
const MIN_SCALE = BASE_SCALE * 0.25;
const MIN_ITEM_SIZE_METERS = 0.5;
const DEFAULT_ITEM_WIDTH_METERS = 5;
const DEFAULT_ITEM_HEIGHT_METERS = 3;
const DEFAULT_DECK_AREA_SIZE_METERS = Number((320 / PIXELS_PER_METER).toFixed(2));

const deckSelectionView = document.getElementById('deck-selection');
const workspaceView = document.getElementById('workspace-view');
const deckListEl = document.getElementById('deck-list');
const createDeckBtn = document.getElementById('create-deck');
const backButton = document.getElementById('back-button');
const historySidebar = document.getElementById('history-sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');
const historyList = document.getElementById('history-list');
const historySearchInput = document.getElementById('history-search');
const sortAlphaBtn = document.getElementById('sort-alpha');
const sortDateBtn = document.getElementById('sort-date');
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

inputWidth.value = DEFAULT_ITEM_WIDTH_METERS.toString();
inputHeight.value = DEFAULT_ITEM_HEIGHT_METERS.toString();
inputWidth.min = inputHeight.min = MIN_ITEM_SIZE_METERS.toString();
inputWidth.step = inputHeight.step = '0.1';

let decks = loadDecks();
let currentDeck = null;
let history = [];
let activeItem = null;
const itemMetadata = new Map();
const itemHistories = new Map();
let itemIdCounter = 0;
let historySortMode = 'alpha';
let historySearchQuery = '';

function metersToPixels(value) {
    return value * PIXELS_PER_METER;
}

function clampToMinSize(value) {
    return Math.max(MIN_ITEM_SIZE_METERS, value);
}

const workspaceState = {
    scale: BASE_SCALE,
    translateX: -workspaceContent.offsetWidth / 2,
    translateY: -workspaceContent.offsetHeight / 2,
};

function generateItemId() {
    itemIdCounter += 1;
    return `item-${Date.now()}-${itemIdCounter}`;
}

function formatTimestamp(value) {
    if (!value) {
        return '—';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '—';
    }
    return date.toLocaleString();
}

function getItemLabel(element) {
    if (!element) return 'Unnamed item';
    const label = (element.textContent || '').trim();
    return label || 'Unnamed item';
}

function getElementRect(element) {
    const x = parseFloat(element.dataset.x) || 0;
    const y = parseFloat(element.dataset.y) || 0;
    const widthMeters = parseFloat(element.dataset.width) || 0;
    const heightMeters = parseFloat(element.dataset.height) || 0;
    const width = metersToPixels(widthMeters);
    const height = metersToPixels(heightMeters);
    return {
        x,
        y,
        width,
        height,
        centerX: x + width / 2,
        centerY: y + height / 2,
    };
}

function determineDeckForItem(element) {
    if (!element || element.dataset.type !== 'item') {
        return null;
    }
    const deckAreas = workspaceContent.querySelectorAll('.deck-area');
    if (!deckAreas.length) {
        return null;
    }
    const { centerX, centerY } = getElementRect(element);
    for (const deckElement of deckAreas) {
        const rect = getElementRect(deckElement);
        const withinX = centerX >= rect.x && centerX <= rect.x + rect.width;
        const withinY = centerY >= rect.y && centerY <= rect.y + rect.height;
        if (withinX && withinY) {
            return deckElement.dataset.label || getItemLabel(deckElement);
        }
    }
    return null;
}

function recordItemHistory(element, message, timestamp = new Date()) {
    if (!element || element.dataset.type !== 'item' || !message) {
        return;
    }
    const itemId = element.dataset.itemId;
    if (!itemId) {
        return;
    }
    if (!itemHistories.has(itemId)) {
        itemHistories.set(itemId, []);
    }
    const events = itemHistories.get(itemId);
    events.unshift({ message, timestamp });
    itemHistories.set(itemId, events.slice(0, 50));
}

function registerItem(element, initialMessage) {
    if (!element || element.dataset.type !== 'item') {
        return;
    }
    if (!element.dataset.itemId) {
        element.dataset.itemId = generateItemId();
    }
    const itemId = element.dataset.itemId;
    const timestamp = new Date();
    const metadata = {
        id: itemId,
        element,
        label: getItemLabel(element),
        deck: determineDeckForItem(element),
        lastModified: timestamp,
        comment: (element.dataset.comment || '').trim(),
    };
    itemMetadata.set(itemId, metadata);
    if (!itemHistories.has(itemId)) {
        itemHistories.set(itemId, []);
    }
    if (initialMessage) {
        recordItemHistory(element, initialMessage, timestamp);
    }
    refreshItemList();
}

function updateItemRecord(element, message, { updateComment = true, updateDeck = true } = {}) {
    if (!element || element.dataset.type !== 'item') {
        return;
    }
    if (!element.dataset.itemId) {
        registerItem(element);
    }
    const itemId = element.dataset.itemId;
    if (!itemId) {
        return;
    }
    const metadata = itemMetadata.get(itemId) || {
        id: itemId,
        element,
        label: '',
        deck: null,
        lastModified: new Date(),
        comment: '',
    };
    metadata.label = getItemLabel(element);
    if (updateDeck) {
        metadata.deck = determineDeckForItem(element);
    }
    if (updateComment) {
        metadata.comment = (element.dataset.comment || '').trim();
    }
    const timestamp = new Date();
    metadata.lastModified = timestamp;
    itemMetadata.set(itemId, metadata);
    if (message) {
        recordItemHistory(element, message, timestamp);
    }
    refreshItemList();
}

function removeItemRecord(element) {
    if (!element || element.dataset.type !== 'item') {
        return;
    }
    const itemId = element.dataset.itemId;
    if (!itemId) {
        return;
    }
    itemMetadata.delete(itemId);
    itemHistories.delete(itemId);
    refreshItemList();
}

function updateSortButtons() {
    if (!sortAlphaBtn || !sortDateBtn) {
        return;
    }
    sortAlphaBtn.classList.toggle('active', historySortMode !== 'date');
    sortDateBtn.classList.toggle('active', historySortMode === 'date');
}

function refreshItemList() {
    if (!historyList) return;
    updateSortButtons();
    historyList.innerHTML = '';
    let items = Array.from(itemMetadata.values());

    const normalizedQuery = historySearchQuery.trim().toLowerCase();
    if (normalizedQuery) {
        items = items.filter((item) => {
            const label = (item.label || '').toLowerCase();
            const comment = (item.comment || '').toLowerCase();
            const deck = (item.deck || '').toLowerCase();
            return label.includes(normalizedQuery) || comment.includes(normalizedQuery) || deck.includes(normalizedQuery);
        });
    }

    if (!items.length) {
        const empty = document.createElement('li');
        empty.className = 'list-empty';
        empty.textContent = normalizedQuery ? 'No items match your search.' : 'No items yet.';
        historyList.appendChild(empty);
        return;
    }

    if (historySortMode === 'date') {
        items.sort((a, b) => {
            const timeA = new Date(a.lastModified).getTime();
            const timeB = new Date(b.lastModified).getTime();
            return timeB - timeA;
        });
    } else {
        items.sort((a, b) => (a.label || '').localeCompare(b.label || '', undefined, { sensitivity: 'base' }));
    }

    items.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'item-summary';
        li.dataset.itemId = item.id;

        const currentDeck = determineDeckForItem(item.element) || item.deck || null;
        if (currentDeck !== item.deck) {
            item.deck = currentDeck;
        }

        const header = document.createElement('div');
        header.className = 'item-summary-header';

        const labelEl = document.createElement('span');
        labelEl.className = 'item-summary-label';
        labelEl.textContent = item.label;

        const historyButton = document.createElement('button');
        historyButton.type = 'button';
        historyButton.className = 'ghost item-history-button';
        historyButton.textContent = 'History';

        header.appendChild(labelEl);
        header.appendChild(historyButton);

        const deckEl = document.createElement('div');
        deckEl.className = 'item-summary-detail';
        deckEl.textContent = `Deck: ${currentDeck || 'Unassigned'}`;

        const modifiedEl = document.createElement('div');
        modifiedEl.className = 'item-summary-detail';
        modifiedEl.textContent = `Last modified: ${formatTimestamp(item.lastModified)}`;

        const commentEl = document.createElement('div');
        commentEl.className = 'item-summary-comment';
        commentEl.textContent = item.comment ? `Comment: ${item.comment}` : 'No comment';

        li.append(header, deckEl, modifiedEl, commentEl);
        historyList.appendChild(li);
    });
}

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
    workspaceContent.innerHTML = '';
    itemMetadata.clear();
    itemHistories.clear();
    refreshItemList();
    workspaceState.scale = BASE_SCALE;
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
    const normalizedScale = (workspaceState.scale / BASE_SCALE) * 100;
    zoomValueEl.textContent = `${Math.round(normalizedScale)}%`;
}

function addHistoryEntry(label) {
    history.unshift({ label, timestamp: new Date() });
}

function createItemElement({ width, height, label, color, type = 'item' }) {
    const element = document.createElement('div');
    element.className = type;
    element.dataset.type = type;
    element.dataset.x = '0';
    element.dataset.y = '0';
    element.dataset.rotation = '0';
    element.dataset.width = width.toString();
    element.dataset.height = height.toString();
    element.dataset.locked = 'false';
    element.dataset.comment = '';
    element.style.width = `${metersToPixels(width)}px`;
    element.style.height = `${metersToPixels(height)}px`;
    if (type === 'item') {
        element.style.background = color;
        element.textContent = label || 'New item';
    } else {
        element.style.background = '#ffffff';
        element.style.color = '#0f172a';
        const deckLabel = label || 'Deck area';
        element.dataset.nameHidden = 'false';
        element.dataset.label = deckLabel;
        const nameEl = document.createElement('div');
        nameEl.className = 'deck-name';
        nameEl.textContent = deckLabel;
        element.appendChild(nameEl);
        setDeckLockState(element, false);
        element.classList.remove('name-hidden');
    }

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    element.appendChild(resizeHandle);

    setupItemInteractions(element, resizeHandle);
    const creationMessage = `${type === 'item' ? 'Item' : 'Deck'} created${label ? `: ${label}` : ''}`;
    if (type === 'deck-area') {
        workspaceContent.insertBefore(element, workspaceContent.firstChild);
    } else {
        workspaceContent.appendChild(element);
    }
    addHistoryEntry(creationMessage);
    if (type === 'item') {
        registerItem(element, creationMessage);
    }
    return element;
}

function setupItemInteractions(element, resizeHandle) {
    let pointerId = null;
    let action = null;
    let start = {};

    element.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) {
            return;
        }

        const isDeckArea = element.dataset.type === 'deck-area';
        const isLockedDeck = isDeckArea && element.dataset.locked === 'true';
        const isLockedItem = !isDeckArea && element.dataset.locked === 'true';

        if (isLockedDeck || isLockedItem) {
            return;
        }

        if (!isDeckArea && event.target === resizeHandle) {
            action = 'rotate';
        } else if (event.target === resizeHandle) {
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
            rotation: parseFloat(element.dataset.rotation) || 0,
        };
        if (action === 'rotate') {
            const rect = element.getBoundingClientRect();
            start.centerX = rect.left + rect.width / 2;
            start.centerY = rect.top + rect.height / 2;
            start.pointerAngle = Math.atan2(event.clientY - start.centerY, event.clientX - start.centerX);
        }
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
            const newWidth = clampToMinSize(start.width + deltaX / PIXELS_PER_METER);
            const newHeight = clampToMinSize(start.height + deltaY / PIXELS_PER_METER);
            element.dataset.width = newWidth.toString();
            element.dataset.height = newHeight.toString();
            element.style.width = `${metersToPixels(newWidth)}px`;
            element.style.height = `${metersToPixels(newHeight)}px`;
        } else if (action === 'rotate') {
            const pointerAngle = Math.atan2(event.clientY - start.centerY, event.clientX - start.centerX);
            const deltaAngle = (pointerAngle - start.pointerAngle) * (180 / Math.PI);
            const newRotation = start.rotation + deltaAngle;
            element.dataset.rotation = newRotation.toFixed(2);
        }
        updateElementTransform(element);
    });

    element.addEventListener('pointerup', (event) => {
        if (pointerId !== event.pointerId) return;
        element.releasePointerCapture(pointerId);
        const completedAction = action;
        pointerId = null;
        action = null;
        if (completedAction && element.dataset.type === 'item') {
            handleItemInteractionComplete(element, completedAction);
        }
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

function handleItemInteractionComplete(element, completedAction) {
    if (completedAction === 'move') {
        const deck = determineDeckForItem(element);
        const message = deck
            ? `Item moved to ${deck}${getItemHistoryLabel(element)}`
            : `Item moved${getItemHistoryLabel(element)}`;
        addHistoryEntry(message);
        updateItemRecord(element, message, { updateComment: false, updateDeck: true });
    } else if (completedAction === 'resize') {
        const width = parseFloat(element.dataset.width);
        const height = parseFloat(element.dataset.height);
        const formattedWidth = Number.isFinite(width) ? width.toFixed(2) : '0.00';
        const formattedHeight = Number.isFinite(height) ? height.toFixed(2) : '0.00';
        const message = `Item resized to ${formattedWidth}m × ${formattedHeight}m${getItemHistoryLabel(element)}`;
        addHistoryEntry(message);
        updateItemRecord(element, message, { updateComment: false });
    } else if (completedAction === 'rotate') {
        const rotation = parseFloat(element.dataset.rotation);
        const formattedRotation = Number.isFinite(rotation) ? rotation.toFixed(0) : '0';
        const message = `Item rotated to ${formattedRotation}°${getItemHistoryLabel(element)}`;
        addHistoryEntry(message);
        updateItemRecord(element, message, { updateComment: false, updateDeck: false });
    }
}

function getItemHistoryLabel(element) {
    const label = element.textContent.trim();
    return label ? `: ${label}` : '';
}

function rotateItemBy(element, degrees) {
    const current = parseFloat(element.dataset.rotation) || 0;
    const updated = current + degrees;
    element.dataset.rotation = updated.toFixed(2);
    updateElementTransform(element);
    const formattedDegrees = degrees > 0 ? `+${degrees}` : `${degrees}`;
    const message = `Item rotated ${formattedDegrees}°${getItemHistoryLabel(element)}`;
    addHistoryEntry(message);
    updateItemRecord(element, message, { updateComment: false, updateDeck: false });
}

function setItemLockState(element, locked) {
    element.dataset.locked = locked ? 'true' : 'false';
    element.classList.toggle('locked', locked);
    const message = `Item ${locked ? 'locked' : 'unlocked'}${getItemHistoryLabel(element)}`;
    addHistoryEntry(message);
    updateItemRecord(element, message, { updateComment: false, updateDeck: false });
}

function promptResizeItem(element) {
    const currentWidth = parseFloat(element.dataset.width);
    const currentHeight = parseFloat(element.dataset.height);
    const input = prompt(
        'Enter new size in meters (width,height)',
        `${currentWidth.toFixed(2)}, ${currentHeight.toFixed(2)}`
    );
    if (input === null) {
        return;
    }
    const parts = input
        .split(/[x×,]/)
        .map((part) => parseFloat(part.trim()))
        .filter((value) => Number.isFinite(value));
    if (parts.length < 2) {
        alert('Please provide both width and height separated by a comma (e.g. 4, 3).');
        return;
    }
    const [rawWidth, rawHeight] = parts;
    const width = clampToMinSize(rawWidth);
    const height = clampToMinSize(rawHeight);
    element.dataset.width = width.toString();
    element.dataset.height = height.toString();
    element.style.width = `${metersToPixels(width)}px`;
    element.style.height = `${metersToPixels(height)}px`;
    const message = `Item resized to ${width.toFixed(2)}m × ${height.toFixed(2)}m${getItemHistoryLabel(element)}`;
    addHistoryEntry(message);
    updateItemRecord(element, message, { updateComment: false });
    updateElementTransform(element);
}

function promptItemComment(element) {
    const currentComment = element.dataset.comment || '';
    const comment = prompt('Add or edit a comment for this item', currentComment);
    if (comment === null) {
        return;
    }
    const trimmed = comment.trim();
    element.dataset.comment = trimmed;
    const hadComment = Boolean(currentComment.trim());
    if (trimmed) {
        element.setAttribute('data-comment', trimmed);
        element.setAttribute('title', trimmed);
        const message = `${hadComment ? 'Comment updated' : 'Comment added'}${getItemHistoryLabel(element)}`;
        addHistoryEntry(message);
        updateItemRecord(element, message, { updateDeck: false, updateComment: true });
    } else {
        element.removeAttribute('data-comment');
        element.removeAttribute('title');
        const message = `Comment cleared${getItemHistoryLabel(element)}`;
        addHistoryEntry(message);
        updateItemRecord(element, message, { updateDeck: false, updateComment: true });
    }
}

function handleCreateItem() {
    const rawWidth = parseFloat(inputWidth.value);
    const rawHeight = parseFloat(inputHeight.value);
    const width = clampToMinSize(Number.isFinite(rawWidth) ? rawWidth : DEFAULT_ITEM_WIDTH_METERS);
    const height = clampToMinSize(Number.isFinite(rawHeight) ? rawHeight : DEFAULT_ITEM_HEIGHT_METERS);
    const label = inputLabel.value.trim();
    const color = inputColor.value;

    createItemElement({ width, height, label, color, type: 'item' });
    inputWidth.value = width.toFixed(2);
    inputHeight.value = height.toFixed(2);
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
    if (!activeItem) return;

    contextMenu.innerHTML = '';
    const actions = getContextMenuActions(activeItem);
    if (!actions.length) {
        closeContextMenu();
        return;
    }

    actions.forEach(({ action, label, className }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.action = action;
        button.textContent = label;
        button.setAttribute('role', 'menuitem');
        if (className) {
            button.classList.add(className);
        }
        contextMenu.appendChild(button);
    });

    contextMenu.style.transform = `translate(${x}px, ${y}px)`;
    contextMenu.classList.add('open');
}

function closeContextMenu() {
    contextMenu.classList.remove('open');
    contextMenu.style.transform = 'translate(-1000px, -1000px)';
}

function handleContextAction(action) {
    if (!activeItem) return;
    const type = activeItem.dataset.type;
    if (type === 'deck-area') {
        const deckLabel = activeItem.dataset.label || 'Deck';
        const labelSuffix = deckLabel ? `: ${deckLabel}` : '';
        if (action === 'lock-deck') {
            setDeckLockState(activeItem, true);
            addHistoryEntry(`Deck locked${labelSuffix}`);
        } else if (action === 'unlock-deck') {
            setDeckLockState(activeItem, false);
            addHistoryEntry(`Deck unlocked${labelSuffix}`);
        } else if (action === 'rename-deck') {
            renameDeckArea(activeItem);
        } else if (action === 'toggle-deck-name') {
            toggleDeckNameVisibility(activeItem);
        }
    } else {
        if (action === 'delete') {
            const labelSuffix = getItemHistoryLabel(activeItem);
            const message = `Item deleted${labelSuffix}`;
            addHistoryEntry(message);
            recordItemHistory(activeItem, message);
            removeItemRecord(activeItem);
            activeItem.remove();
        } else if (action === 'resize') {
            promptResizeItem(activeItem);
        } else if (action === 'lock-item') {
            setItemLockState(activeItem, true);
        } else if (action === 'unlock-item') {
            setItemLockState(activeItem, false);
        } else if (action === 'comment') {
            promptItemComment(activeItem);
        }
    }
    closeContextMenu();
}

function getContextMenuActions(element) {
    if (!element) return [];
    const type = element.dataset.type;
    if (type === 'deck-area') {
        const locked = element.dataset.locked === 'true';
        const nameHidden = element.dataset.nameHidden === 'true';
        return [
            { action: locked ? 'unlock-deck' : 'lock-deck', label: locked ? 'Unlock deck' : 'Lock deck' },
            { action: 'rename-deck', label: 'Rename deck' },
            { action: 'toggle-deck-name', label: nameHidden ? 'Show name' : 'Hide name' },
        ];
    }
    const locked = element.dataset.locked === 'true';
    const hasComment = Boolean((element.dataset.comment || '').trim());
    const actions = [];
    if (!locked) {
        actions.push({ action: 'resize', label: 'Resize…' });
    }
    actions.push({ action: locked ? 'unlock-item' : 'lock-item', label: locked ? 'Unlock item' : 'Lock item' });
    actions.push({ action: 'comment', label: hasComment ? 'Edit comment' : 'Add comment' });
    actions.push({ action: 'delete', label: 'Delete', className: 'danger' });
    return actions;
}

function setDeckLockState(element, locked) {
    element.dataset.locked = locked ? 'true' : 'false';
    element.classList.toggle('locked', locked);
}

function renameDeckArea(element) {
    const current = element.dataset.label || '';
    const name = prompt('Rename deck', current);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === current) return;
    element.dataset.label = trimmed;
    const nameEl = element.querySelector('.deck-name');
    if (nameEl) {
        nameEl.textContent = trimmed;
    }
    addHistoryEntry(`Deck renamed: ${trimmed}`);
}

function toggleDeckNameVisibility(element) {
    const shouldHide = element.dataset.nameHidden !== 'true';
    element.dataset.nameHidden = shouldHide ? 'true' : 'false';
    element.classList.toggle('name-hidden', shouldHide);
    const nameEl = element.querySelector('.deck-name');
    if (nameEl) {
        nameEl.style.display = shouldHide ? 'none' : '';
    }
    const deckLabel = element.dataset.label || 'Deck';
    const labelSuffix = deckLabel ? `: ${deckLabel}` : '';
    addHistoryEntry(shouldHide ? `Deck name hidden${labelSuffix}` : `Deck name shown${labelSuffix}`);
}

function handleAddDeckArea() {
    const size = DEFAULT_DECK_AREA_SIZE_METERS;
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
        if (event.button !== 0) {
            return;
        }

        const lockedElement = event.target.closest('.item.locked, .deck-area.locked');
        const isWorkspaceSurface = event.target === workspaceContainer || event.target === workspaceContent;

        if (!isWorkspaceSurface && !lockedElement) {
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
        const newScale = Math.min(2.5, Math.max(MIN_SCALE, workspaceState.scale * scaleDelta));

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

function setHistorySortMode(mode) {
    if (mode !== 'alpha' && mode !== 'date') {
        return;
    }
    if (historySortMode === mode) {
        updateSortButtons();
        return;
    }
    historySortMode = mode;
    updateSortButtons();
    refreshItemList();
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

document.addEventListener('contextmenu', (event) => {
    if (!event.target.closest('.item, .deck-area, #context-menu')) {
        closeContextMenu();
    }
});

createItemBtn.addEventListener('click', handleCreateItem);
toggleSidebarBtn.addEventListener('click', toggleSidebar);
createDeckBtn.addEventListener('click', handleCreateDeck);
backButton.addEventListener('click', goBackToSelection);

if (historySearchInput) {
    historySearchInput.addEventListener('input', (event) => {
        historySearchQuery = event.target.value || '';
        refreshItemList();
    });
}

if (sortAlphaBtn) {
    sortAlphaBtn.addEventListener('click', () => {
        setHistorySortMode('alpha');
    });
}

if (sortDateBtn) {
    sortDateBtn.addEventListener('click', () => {
        setHistorySortMode('date');
    });
}

historyList.addEventListener('click', (event) => {
    const button = event.target.closest('.item-history-button');
    if (!button) {
        return;
    }
    const entry = button.closest('.item-summary');
    if (!entry) {
        return;
    }
    const { itemId } = entry.dataset;
    if (!itemId) {
        return;
    }
    const events = itemHistories.get(itemId) || [];
    if (!events.length) {
        alert('No history recorded for this item yet.');
        return;
    }
    const historyText = events
        .map((eventEntry) => `${formatTimestamp(eventEntry.timestamp)} — ${eventEntry.message}`)
        .join('\n');
    alert(historyText);
});

refreshItemList();

initializeDeckSelection();
setupWorkspaceInteractions();
applyWorkspaceTransform();
