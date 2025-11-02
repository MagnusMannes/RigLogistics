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
const addDeckAreaBtn = document.getElementById('add-deck-area');
const toolsButton = document.getElementById('tools-button');
const toolsMenu = document.getElementById('tools-menu');
const measureToggleBtn = document.getElementById('toggle-measure-mode');
const createPlanningJobBtn = document.getElementById('create-planning-job');
const deletePlanningJobBtn = document.getElementById('delete-planning-job');
const planningIndicator = document.getElementById('planning-indicator');
const planningSidebar = document.getElementById('planning-sidebar');
const planningCurrentDeckToggle = document.getElementById('planning-current-deck');
const planningJobsList = document.getElementById('planning-job-list');
const workspaceHeader = document.querySelector('.workspace-header');
const contextMenu = document.getElementById('context-menu');
const zoomValueEl = document.getElementById('zoom-value');
const measurementInstructions = document.getElementById('measurement-instructions');

const inputWidth = document.getElementById('input-width');
const inputHeight = document.getElementById('input-height');
const inputLabel = document.getElementById('input-label');
const inputColor = document.getElementById('input-color');

const measurementOverlay = document.createElement('div');
measurementOverlay.id = 'measurement-overlay';
measurementOverlay.className = 'measurement-overlay';
workspaceContent.appendChild(measurementOverlay);

const planningOverlayHost = document.createElement('div');
planningOverlayHost.id = 'planning-overlays';
planningOverlayHost.className = 'planning-overlays';
workspaceContent.appendChild(planningOverlayHost);

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
let attachmentIdCounter = 0;
let historySortMode = 'alpha';
let historySearchQuery = '';
const measurementState = {
    active: false,
    points: [],
};
let modifyDialogState = null;
const planningState = {
    activeJobIds: new Set(),
};

function updateMeasurementOverlayScale() {
    const measurementScale = 1 / workspaceState.scale;
    measurementOverlay.style.setProperty('--measurement-scale', measurementScale.toString());
}

function metersToPixels(value) {
    return value * PIXELS_PER_METER;
}

function clampToMinSize(value) {
    return Math.max(MIN_ITEM_SIZE_METERS, value);
}

function clearMeasurements() {
    measurementState.points = [];
    measurementOverlay.innerHTML = '';
}

function ensureMeasurementOverlay() {
    if (!measurementOverlay.isConnected) {
        workspaceContent.appendChild(measurementOverlay);
    }
}

function updateMeasureToggleButton() {
    if (!measureToggleBtn) {
        return;
    }
    measureToggleBtn.textContent = measurementState.active ? 'Leave measure mode' : 'Enter measure mode';
    measureToggleBtn.classList.toggle('active', measurementState.active);
    measureToggleBtn.setAttribute('aria-pressed', measurementState.active ? 'true' : 'false');
}

function getWorkspacePointFromEvent(event) {
    const rect = workspaceContainer.getBoundingClientRect();
    // workspace-content is centered with top/left 50%, so account for that offset
    const containerOffsetX = rect.width / 2;
    const containerOffsetY = rect.height / 2;
    const x =
        (event.clientX - rect.left - containerOffsetX - workspaceState.translateX) /
        workspaceState.scale;
    const y =
        (event.clientY - rect.top - containerOffsetY - workspaceState.translateY) /
        workspaceState.scale;
    return { x, y };
}

function formatMeasurementLabel(lengthPixels) {
    const meters = lengthPixels / PIXELS_PER_METER;
    return `${meters.toFixed(2)} Meter`;
}

function addMeasurementPoint(point) {
    measurementState.points.push(point);

    const pointEl = document.createElement('div');
    pointEl.className = 'measurement-point';
    pointEl.style.left = `${point.x}px`;
    pointEl.style.top = `${point.y}px`;
    measurementOverlay.appendChild(pointEl);

    if (measurementState.points.length < 2) {
        return;
    }

    const previousPoint = measurementState.points[measurementState.points.length - 2];
    const dx = point.x - previousPoint.x;
    const dy = point.y - previousPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    const lineEl = document.createElement('div');
    lineEl.className = 'measurement-line';
    lineEl.style.left = `${previousPoint.x}px`;
    lineEl.style.top = `${previousPoint.y}px`;
    lineEl.style.width = `${length}px`;
    lineEl.style.transform = `rotate(${angle}deg)`;
    measurementOverlay.appendChild(lineEl);

    const labelEl = document.createElement('div');
    labelEl.className = 'measurement-label';
    labelEl.textContent = formatMeasurementLabel(length);

    const midX = previousPoint.x + dx / 2;
    const midY = previousPoint.y + dy / 2;
    if (length > 0) {
        const offset = 14;
        const offsetX = (-dy / length) * offset;
        const offsetY = (dx / length) * offset;
        labelEl.style.left = `${midX + offsetX}px`;
        labelEl.style.top = `${midY + offsetY}px`;
    } else {
        labelEl.style.left = `${midX}px`;
        labelEl.style.top = `${midY}px`;
    }
    measurementOverlay.appendChild(labelEl);
}

function activateMeasureMode() {
    if (measurementState.active) {
        return;
    }
    measurementState.active = true;
    ensureMeasurementOverlay();
    clearMeasurements();
    updateMeasureToggleButton();
    workspaceContainer.classList.add('measure-mode');
    if (measurementInstructions) {
        measurementInstructions.hidden = false;
        measurementInstructions.classList.add('visible');
    }
    closeContextMenu();
    document.addEventListener('keydown', handleMeasureKeydown);
}

function deactivateMeasureMode() {
    if (!measurementState.active) {
        return;
    }
    measurementState.active = false;
    updateMeasureToggleButton();
    workspaceContainer.classList.remove('measure-mode');
    if (measurementInstructions) {
        measurementInstructions.classList.remove('visible');
        measurementInstructions.hidden = true;
    }
    document.removeEventListener('keydown', handleMeasureKeydown);
    clearMeasurements();
}

function toggleMeasureMode() {
    if (measurementState.active) {
        deactivateMeasureMode();
    } else {
        activateMeasureMode();
    }
}

function handleMeasurePointerDown(event) {
    if (!measurementState.active) {
        return;
    }
    if (event.button !== 0) {
        return;
    }
    if ('isPrimary' in event && !event.isPrimary) {
        return;
    }
    if (!workspaceContainer.contains(event.target)) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    const point = getWorkspacePointFromEvent(event);
    addMeasurementPoint(point);
}

function handleMeasureKeydown(event) {
    if (event.key === 'Escape') {
        deactivateMeasureMode();
    }
}

function ensurePlanningOverlayHost() {
    if (!planningOverlayHost.isConnected) {
        workspaceContent.appendChild(planningOverlayHost);
    }
}

function clearPlanningOverlays() {
    planningOverlayHost.innerHTML = '';
}

function generateDeckId() {
    return `deck-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function generatePlanningJobId() {
    return `plan-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createDeckRecord(name, { id, jobs } = {}) {
    return {
        id: typeof id === 'string' && id.trim() ? id : generateDeckId(),
        name: typeof name === 'string' && name.trim() ? name.trim() : 'Deck',
        jobs: Array.isArray(jobs) ? jobs.map((job) => normalizePlanningJob(job)) : [],
    };
}

function normalizePlanningItem(item) {
    if (!item || typeof item !== 'object') {
        return null;
    }
    const type = item.type === 'deck-area' ? 'deck-area' : 'item';
    const label = typeof item.label === 'string' ? item.label : '';
    const width = Number.parseFloat(item.width);
    const height = Number.parseFloat(item.height);
    const x = Number.parseFloat(item.x);
    const y = Number.parseFloat(item.y);
    const rotation = Number.parseFloat(item.rotation);
    const normalized = {
        type,
        label,
        width: Number.isFinite(width) ? width : DEFAULT_ITEM_WIDTH_METERS,
        height: Number.isFinite(height) ? height : DEFAULT_ITEM_HEIGHT_METERS,
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
        rotation: Number.isFinite(rotation) ? rotation : 0,
    };
    if (type === 'item') {
        normalized.color =
            typeof item.color === 'string' && item.color.trim() ? item.color : '#3a7afe';
    } else {
        normalized.nameHidden = item.nameHidden === true || item.nameHidden === 'true';
    }
    return normalized;
}

function normalizePlanningJob(job) {
    if (!job || typeof job !== 'object') {
        return {
            id: generatePlanningJobId(),
            label: 'Planning job',
            deck: { items: [] },
        };
    }
    const id = typeof job.id === 'string' && job.id.trim() ? job.id : generatePlanningJobId();
    const label = typeof job.label === 'string' && job.label.trim() ? job.label.trim() : 'Planning job';
    const itemsSource = Array.isArray(job.deck?.items) ? job.deck.items : [];
    const items = itemsSource
        .map((item) => normalizePlanningItem(item))
        .filter((value) => value !== null);
    return {
        id,
        label,
        deck: { items },
    };
}

function normalizeDeckEntry(entry) {
    if (typeof entry === 'string') {
        return createDeckRecord(entry);
    }
    if (!entry || typeof entry !== 'object') {
        return createDeckRecord('Deck');
    }
    return createDeckRecord(entry.name, { id: entry.id, jobs: entry.jobs });
}

function planningItemToSerializable(item) {
    const result = {
        type: item.type,
        label: item.label,
        width: item.width,
        height: item.height,
        x: item.x,
        y: item.y,
        rotation: item.rotation,
    };
    if (item.type === 'item') {
        result.color = item.color ?? '#3a7afe';
    } else if (item.type === 'deck-area') {
        result.nameHidden = Boolean(item.nameHidden);
    }
    return result;
}

function jobToSerializable(job) {
    return {
        id: job.id,
        label: job.label,
        deck: {
            items: Array.isArray(job.deck?.items)
                ? job.deck.items.map((item) => planningItemToSerializable(item))
                : [],
        },
    };
}

function deckToSerializable(deck) {
    return {
        id: deck.id,
        name: deck.name,
        jobs: Array.isArray(deck.jobs) ? deck.jobs.map((job) => jobToSerializable(job)) : [],
    };
}

function getCurrentDeckJobs() {
    if (!currentDeck || !Array.isArray(currentDeck.jobs)) {
        return [];
    }
    return currentDeck.jobs;
}

function isColorDark(hex) {
    if (typeof hex !== 'string') {
        return false;
    }
    let value = hex.trim();
    if (!value) {
        return false;
    }
    if (value.startsWith('#')) {
        value = value.slice(1);
    }
    if (value.length === 3) {
        value = value
            .split('')
            .map((char) => char + char)
            .join('');
    }
    if (value.length !== 6) {
        return false;
    }
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    if ([r, g, b].some((component) => Number.isNaN(component))) {
        return false;
    }
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.45;
}

function updatePlanningStateUI() {
    const hasActiveJobs = planningState.activeJobIds.size > 0;
    if (workspaceHeader) {
        workspaceHeader.classList.toggle('planning-mode', hasActiveJobs);
    }
    if (planningIndicator) {
        planningIndicator.hidden = !hasActiveJobs;
    }
    if (planningSidebar) {
        planningSidebar.classList.toggle('disabled', !currentDeck);
    }
    if (planningCurrentDeckToggle) {
        const showCurrentDeck = Boolean(currentDeck) && !hasActiveJobs;
        planningCurrentDeckToggle.setAttribute('aria-pressed', showCurrentDeck ? 'true' : 'false');
        planningCurrentDeckToggle.classList.toggle('active', showCurrentDeck);
        planningCurrentDeckToggle.disabled = !currentDeck;
    }
}

function updatePlanningControlsState() {
    const hasDeck = Boolean(currentDeck);
    if (createPlanningJobBtn) {
        createPlanningJobBtn.disabled = !hasDeck;
    }
    if (deletePlanningJobBtn) {
        const jobCount = hasDeck ? getCurrentDeckJobs().length : 0;
        deletePlanningJobBtn.disabled = !hasDeck || jobCount === 0;
    }
}

function renderPlanningJobOverlay(job) {
    ensurePlanningOverlayHost();
    let overlay = planningOverlayHost.querySelector(`[data-job-id="${job.id}"]`);
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'planning-overlay';
        overlay.dataset.jobId = job.id;
        planningOverlayHost.appendChild(overlay);
    }
    overlay.innerHTML = '';
    overlay.hidden = !planningState.activeJobIds.has(job.id);
    job.deck.items.forEach((item) => {
        const element = document.createElement('div');
        element.className = `planning-overlay-item ${item.type}`;
        const widthPixels = metersToPixels(item.width);
        const heightPixels = metersToPixels(item.height);
        element.style.width = `${widthPixels}px`;
        element.style.height = `${heightPixels}px`;
        element.style.transform = `translate(${item.x}px, ${item.y}px) rotate(${item.rotation}deg)`;
        if (item.type === 'item') {
            const color = item.color || '#3a7afe';
            element.style.background = color;
            element.classList.toggle('has-dark-text', isColorDark(color));
            element.textContent = item.label || 'Item';
        } else {
            const label = document.createElement('div');
            label.className = 'overlay-label';
            label.textContent = item.label || 'Deck area';
            if (item.nameHidden) {
                label.style.display = 'none';
            }
            element.appendChild(label);
        }
        overlay.appendChild(element);
    });
}

function renderPlanningJobs() {
    if (!planningJobsList) {
        return;
    }
    if (!currentDeck) {
        planningState.activeJobIds.clear();
        planningJobsList.innerHTML = '';
        clearPlanningOverlays();
        if (planningOverlayHost.isConnected) {
            planningOverlayHost.remove();
        }
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'list-empty';
        emptyMessage.textContent = 'Select a deck to start planning.';
        planningJobsList.appendChild(emptyMessage);
        updatePlanningControlsState();
        updatePlanningStateUI();
        return;
    }
    ensurePlanningOverlayHost();
    const jobs = getCurrentDeckJobs();
    const validIds = new Set(jobs.map((job) => job.id));
    Array.from(planningState.activeJobIds).forEach((jobId) => {
        if (!validIds.has(jobId)) {
            planningState.activeJobIds.delete(jobId);
        }
    });
    planningJobsList.innerHTML = '';
    if (!jobs.length) {
        planningState.activeJobIds.clear();
        clearPlanningOverlays();
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'list-empty';
        emptyMessage.textContent = 'No planning jobs yet.';
        planningJobsList.appendChild(emptyMessage);
        updatePlanningControlsState();
        updatePlanningStateUI();
        return;
    }
    jobs.forEach((job) => {
        const entry = document.createElement('div');
        entry.className = 'planning-job-entry';
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'ghost planning-toggle planning-job-toggle';
        toggle.textContent = job.label;
        const isActive = planningState.activeJobIds.has(job.id);
        toggle.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        toggle.classList.toggle('active', isActive);
        toggle.addEventListener('click', () => togglePlanningJob(job.id));
        entry.appendChild(toggle);
        planningJobsList.appendChild(entry);
        renderPlanningJobOverlay(job);
    });
    planningOverlayHost.querySelectorAll('[data-job-id]').forEach((overlay) => {
        if (!validIds.has(overlay.dataset.jobId)) {
            overlay.remove();
        }
    });
    updatePlanningControlsState();
    updatePlanningStateUI();
}

function togglePlanningJob(jobId) {
    if (!currentDeck) {
        return;
    }
    const jobs = getCurrentDeckJobs();
    if (!jobs.some((job) => job.id === jobId)) {
        return;
    }
    if (planningState.activeJobIds.has(jobId)) {
        planningState.activeJobIds.delete(jobId);
    } else {
        planningState.activeJobIds.add(jobId);
    }
    renderPlanningJobs();
}

function handlePlanningCurrentDeckToggle() {
    if (!currentDeck) {
        return;
    }
    if (!planningState.activeJobIds.size) {
        return;
    }
    planningState.activeJobIds.clear();
    renderPlanningJobs();
}

function serializeWorkspaceElements() {
    const elements = Array.from(workspaceContent.querySelectorAll('.item, .deck-area'));
    return elements.map((element) => {
        const type = element.dataset.type === 'deck-area' ? 'deck-area' : 'item';
        const label =
            type === 'deck-area'
                ? element.dataset.label || getItemLabel(element)
                : getItemLabel(element);
        const width = Number.parseFloat(element.dataset.width);
        const height = Number.parseFloat(element.dataset.height);
        const x = Number.parseFloat(element.dataset.x);
        const y = Number.parseFloat(element.dataset.y);
        const rotation = Number.parseFloat(element.dataset.rotation);
        const itemData = {
            type,
            label,
            width: Number.isFinite(width) ? width : DEFAULT_ITEM_WIDTH_METERS,
            height: Number.isFinite(height) ? height : DEFAULT_ITEM_HEIGHT_METERS,
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0,
            rotation: Number.isFinite(rotation) ? rotation : 0,
        };
        if (type === 'item') {
            const color = rgbToHex(
                getComputedStyle(element).backgroundColor || element.style.background || '#3a7afe'
            );
            itemData.color = color;
        } else {
            itemData.nameHidden = element.dataset.nameHidden === 'true';
        }
        return itemData;
    });
}

function handleCreatePlanningJob() {
    if (!currentDeck) {
        alert('Select a deck before creating a planning job.');
        return;
    }
    const label = prompt('Name for the new planning job?');
    if (label === null) {
        return;
    }
    const trimmed = label.trim();
    if (!trimmed) {
        alert('Please provide a name for the planning job.');
        return;
    }
    const job = {
        id: generatePlanningJobId(),
        label: trimmed,
        deck: { items: serializeWorkspaceElements() },
    };
    const jobs = getCurrentDeckJobs();
    jobs.push(job);
    planningState.activeJobIds.clear();
    planningState.activeJobIds.add(job.id);
    saveDecks();
    renderPlanningJobs();
    closeToolsMenu();
}

function handleDeletePlanningJob() {
    if (!currentDeck) {
        alert('Select a deck before deleting planning jobs.');
        return;
    }
    const jobs = getCurrentDeckJobs();
    if (!jobs.length) {
        alert('There are no planning jobs to delete.');
        return;
    }
    if (jobs.length === 1) {
        const [job] = jobs;
        const shouldDelete = confirm(`Delete planning job "${job.label}"?`);
        if (!shouldDelete) {
            return;
        }
        jobs.splice(0, 1);
        planningState.activeJobIds.clear();
        saveDecks();
        renderPlanningJobs();
        closeToolsMenu();
        return;
    }
    const options = jobs
        .map((job, index) => `${index + 1}. ${job.label}`)
        .join('\n');
    const input = prompt(`Enter the number of the planning job to delete:\n${options}`);
    if (!input) {
        return;
    }
    const selectedIndex = Number.parseInt(input, 10);
    if (!Number.isFinite(selectedIndex) || selectedIndex < 1 || selectedIndex > jobs.length) {
        alert('Please enter a valid number.');
        return;
    }
    const [removed] = jobs.splice(selectedIndex - 1, 1);
    planningState.activeJobIds.delete(removed.id);
    saveDecks();
    renderPlanningJobs();
    closeToolsMenu();
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

function generateAttachmentId() {
    attachmentIdCounter += 1;
    return `attachment-${Date.now()}-${attachmentIdCounter}`;
}

function ensureItemMetadataRecord(element) {
    if (!element || element.dataset.type !== 'item') {
        return null;
    }
    if (!element.dataset.itemId) {
        registerItem(element);
    }
    const itemId = element.dataset.itemId;
    if (!itemId) {
        return null;
    }
    if (!itemMetadata.has(itemId)) {
        itemMetadata.set(itemId, {
            id: itemId,
            element,
            label: getItemLabel(element),
            deck: determineDeckForItem(element),
            lastModified: new Date(),
            comment: (element.dataset.comment || '').trim(),
            attachments: [],
        });
    }
    const metadata = itemMetadata.get(itemId);
    if (!Array.isArray(metadata.attachments)) {
        metadata.attachments = [];
    }
    metadata.element = element;
    return metadata;
}

function getItemAttachments(element) {
    const metadata = ensureItemMetadataRecord(element);
    return metadata ? metadata.attachments : [];
}

function updateAttachmentIndicator(element) {
    if (!element || element.dataset.type !== 'item') {
        return;
    }
    const attachments = getItemAttachments(element);
    element.dataset.hasAttachments = attachments.length ? 'true' : 'false';
}

function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    let index = 0;
    let size = bytes;
    while (size >= 1024 && index < units.length - 1) {
        size /= 1024;
        index += 1;
    }
    return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function closeModifyDialog() {
    if (modifyDialogState && modifyDialogState.overlay) {
        modifyDialogState.overlay.remove();
    }
    modifyDialogState = null;
    document.removeEventListener('keydown', handleModifyDialogKeydown);
}

function handleModifyDialogKeydown(event) {
    if (event.key === 'Escape') {
        closeModifyDialog();
    }
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
    const existing = itemMetadata.get(itemId);
    const metadata = {
        id: itemId,
        element,
        label: getItemLabel(element),
        deck: determineDeckForItem(element),
        lastModified: timestamp,
        comment: (element.dataset.comment || '').trim(),
        attachments: existing && Array.isArray(existing?.attachments) ? existing.attachments : [],
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
        attachments: [],
    };
    metadata.label = getItemLabel(element);
    if (updateDeck) {
        metadata.deck = determineDeckForItem(element);
    }
    if (updateComment) {
        metadata.comment = (element.dataset.comment || '').trim();
    }
    if (!Array.isArray(metadata.attachments)) {
        metadata.attachments = [];
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
        deckEl.textContent = `Deck: ${currentDeck ? currentDeck.name : 'Unassigned'}`;

        const modifiedEl = document.createElement('div');
        modifiedEl.className = 'item-summary-detail';
        modifiedEl.textContent = `Last modified: ${formatTimestamp(item.lastModified)}`;

        const attachmentsCount = Array.isArray(item.attachments) ? item.attachments.length : 0;
        const attachmentsEl = document.createElement('div');
        attachmentsEl.className = 'item-summary-detail';
        attachmentsEl.textContent = attachmentsCount
            ? `Attachments: ${attachmentsCount}`
            : 'Attachments: none';

        const commentEl = document.createElement('div');
        commentEl.className = 'item-summary-comment';
        commentEl.textContent = item.comment ? `Comment: ${item.comment}` : 'No comment';

        li.append(header, deckEl, modifiedEl, attachmentsEl, commentEl);
        historyList.appendChild(li);
    });
}

function loadDecks() {
    const stored = localStorage.getItem(decksKey);
    let shouldPersist = false;
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length) {
                const normalized = parsed.map((entry) => {
                    const normalizedEntry = normalizeDeckEntry(entry);
                    if (typeof entry === 'string' || entry?.name !== normalizedEntry.name || !entry?.jobs) {
                        shouldPersist = true;
                    }
                    return normalizedEntry;
                });
                if (shouldPersist) {
                    const serializable = normalized.map((deck) => deckToSerializable(deck));
                    localStorage.setItem(decksKey, JSON.stringify(serializable));
                }
                return normalized;
            }
        } catch (err) {
            console.warn('Unable to parse stored decks', err);
        }
    }
    const defaults = defaultDecks.map((name) => createDeckRecord(name));
    localStorage.setItem(decksKey, JSON.stringify(defaults.map((deck) => deckToSerializable(deck))));
    return defaults;
}

function saveDecks() {
    const serializable = decks.map((deck) => deckToSerializable(deck));
    localStorage.setItem(decksKey, JSON.stringify(serializable));
}

function renderDeckList() {
    deckListEl.innerHTML = '';
    decks.forEach((deck) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = deck.name;
        button.dataset.deckId = deck.id;
        button.addEventListener('click', () => selectDeck(deck));
        deckListEl.appendChild(button);
    });
}

function selectDeck(deck) {
    let selectedDeck = deck;
    if (!selectedDeck) {
        return;
    }
    if (typeof selectedDeck === 'string') {
        selectedDeck = decks.find((entry) => entry.id === selectedDeck || entry.name === selectedDeck);
    }
    if (!selectedDeck) {
        return;
    }
    currentDeck = selectedDeck;
    deactivateMeasureMode();
    planningState.activeJobIds.clear();
    localStorage.setItem(selectedDeckKey, currentDeck.name);
    deckSelectionView.classList.remove('active');
    workspaceView.classList.add('active');
    history = [];
    workspaceContent.innerHTML = '';
    ensureMeasurementOverlay();
    ensurePlanningOverlayHost();
    clearPlanningOverlays();
    clearMeasurements();
    itemMetadata.clear();
    itemHistories.clear();
    refreshItemList();
    workspaceState.scale = BASE_SCALE;
    applyWorkspaceTransform();
    closeToolsMenu();
    renderPlanningJobs();
}

function goBackToSelection() {
    currentDeck = null;
    deactivateMeasureMode();
    planningState.activeJobIds.clear();
    localStorage.removeItem(selectedDeckKey);
    deckSelectionView.classList.add('active');
    workspaceView.classList.remove('active');
    renderPlanningJobs();
}

function applyWorkspaceTransform() {
    workspaceContent.style.transform = `translate(${workspaceState.translateX}px, ${workspaceState.translateY}px) scale(${workspaceState.scale})`;
    updateMeasurementOverlayScale();
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
        updateAttachmentIndicator(element);
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

function duplicateItem(element) {
    if (!element || element.dataset.type !== 'item') {
        return null;
    }
    const width = parseFloat(element.dataset.width) || DEFAULT_ITEM_WIDTH_METERS;
    const height = parseFloat(element.dataset.height) || DEFAULT_ITEM_HEIGHT_METERS;
    const label = getItemLabel(element);
    const color = rgbToHex(getComputedStyle(element).backgroundColor || element.style.background || '#3a7afe');
    const duplicate = createItemElement({ width, height, label, color, type: 'item' });
    const offset = 40;
    const baseX = parseFloat(element.dataset.x) || 0;
    const baseY = parseFloat(element.dataset.y) || 0;
    duplicate.dataset.x = (baseX + offset).toString();
    duplicate.dataset.y = (baseY + offset).toString();
    updateElementTransform(duplicate);
    const originalAttachments = getItemAttachments(element);
    if (originalAttachments.length) {
        const duplicateMetadata = ensureItemMetadataRecord(duplicate);
        duplicateMetadata.attachments = originalAttachments.map((attachment) => ({
            ...attachment,
            id: generateAttachmentId(),
        }));
        updateAttachmentIndicator(duplicate);
    }
    const message = `Item duplicated${getItemHistoryLabel(duplicate)}`;
    addHistoryEntry(message);
    updateItemRecord(duplicate, message, { updateComment: false });
    return duplicate;
}

function removeItemAttachment(element, attachmentId) {
    const metadata = ensureItemMetadataRecord(element);
    if (!metadata) {
        return;
    }
    const index = metadata.attachments.findIndex((attachment) => attachment.id === attachmentId);
    if (index === -1) {
        return;
    }
    const [removed] = metadata.attachments.splice(index, 1);
    const message = `Attachment removed (${removed.name})${getItemHistoryLabel(element)}`;
    addHistoryEntry(message);
    updateItemRecord(element, message, { updateComment: false });
    updateAttachmentIndicator(element);
    if (modifyDialogState) {
        renderModifyDialogAttachments();
    }
}

function promptItemAttachment(element, { onComplete } = {}) {
    if (!element || element.dataset.type !== 'item') {
        return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '';
    input.multiple = true;
    input.addEventListener('change', () => {
        const files = Array.from(input.files || []);
        if (!files.length) {
            return;
        }
        files.forEach((file) => {
            const reader = new FileReader();
            reader.onload = () => {
                const metadata = ensureItemMetadataRecord(element);
                if (!metadata) {
                    return;
                }
                metadata.attachments.push({
                    id: generateAttachmentId(),
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    dataUrl: typeof reader.result === 'string' ? reader.result : '',
                    addedAt: new Date().toISOString(),
                });
                const message = `Attachment added (${file.name})${getItemHistoryLabel(element)}`;
                addHistoryEntry(message);
                updateItemRecord(element, message, { updateComment: false });
                updateAttachmentIndicator(element);
                if (typeof onComplete === 'function') {
                    onComplete();
                }
            };
            reader.readAsDataURL(file);
        });
        input.value = '';
    });
    input.click();
}

function renderModifyDialogAttachments() {
    if (!modifyDialogState || !modifyDialogState.attachmentsList) {
        return;
    }
    const { attachmentsList, element, locked } = modifyDialogState;
    attachmentsList.innerHTML = '';
    const attachments = getItemAttachments(element);
    if (!attachments.length) {
        const empty = document.createElement('li');
        empty.className = 'attachment-empty';
        empty.textContent = 'No attachments yet.';
        attachmentsList.appendChild(empty);
        return;
    }
    attachments.forEach((attachment) => {
        const item = document.createElement('li');
        item.className = 'attachment-item';
        const link = document.createElement('a');
        link.href = attachment.dataUrl || '#';
        link.target = '_blank';
        link.rel = 'noopener';
        link.download = attachment.name;
        link.textContent = `${attachment.name} (${formatFileSize(attachment.size)})`;
        item.appendChild(link);
        if (!locked) {
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'ghost attachment-remove';
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => {
                removeItemAttachment(element, attachment.id);
            });
            item.appendChild(removeButton);
        }
        attachmentsList.appendChild(item);
    });
}

function openItemModifyDialog(element) {
    if (!element || element.dataset.type !== 'item') {
        return;
    }
    closeModifyDialog();
    const locked = element.dataset.locked === 'true';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeModifyDialog();
        }
    });

    const dialog = document.createElement('div');
    dialog.className = 'modal-panel';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const title = document.createElement('h2');
    title.textContent = locked ? 'Item details' : 'Modify item';
    const titleId = `modify-dialog-title-${Date.now()}`;
    title.id = titleId;
    dialog.setAttribute('aria-labelledby', titleId);
    dialog.appendChild(title);

    const form = document.createElement('form');
    form.className = 'modify-form';

    const sizeFieldset = document.createElement('fieldset');
    const sizeLegend = document.createElement('legend');
    sizeLegend.textContent = 'Size (meters)';
    sizeFieldset.appendChild(sizeLegend);

    const widthInput = document.createElement('input');
    widthInput.type = 'number';
    widthInput.min = MIN_ITEM_SIZE_METERS.toString();
    widthInput.step = '0.1';
    widthInput.value = (parseFloat(element.dataset.width) || DEFAULT_ITEM_WIDTH_METERS).toFixed(2);
    widthInput.required = true;
    widthInput.setAttribute('aria-label', 'Width in meters');

    const heightInput = document.createElement('input');
    heightInput.type = 'number';
    heightInput.min = MIN_ITEM_SIZE_METERS.toString();
    heightInput.step = '0.1';
    heightInput.value = (parseFloat(element.dataset.height) || DEFAULT_ITEM_HEIGHT_METERS).toFixed(2);
    heightInput.required = true;
    heightInput.setAttribute('aria-label', 'Height in meters');

    sizeFieldset.append(widthInput, heightInput);

    const labelFieldset = document.createElement('fieldset');
    const labelLegend = document.createElement('legend');
    labelLegend.textContent = 'Label';
    labelFieldset.appendChild(labelLegend);
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    const currentLabel = element.textContent.trim();
    labelInput.value = currentLabel === 'Unnamed item' ? '' : currentLabel;
    labelInput.placeholder = 'Item label';
    labelFieldset.appendChild(labelInput);

    const colorFieldset = document.createElement('fieldset');
    const colorLegend = document.createElement('legend');
    colorLegend.textContent = 'Color';
    colorFieldset.appendChild(colorLegend);
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    const computedStyle = getComputedStyle(element);
    colorInput.value = rgbToHex(computedStyle.backgroundColor || element.style.background || '#3a7afe');
    colorInput.setAttribute('aria-label', 'Item color');
    colorFieldset.appendChild(colorInput);

    const actions = document.createElement('div');
    actions.className = 'modify-actions';
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'ghost';
    cancelButton.textContent = 'Close';
    cancelButton.addEventListener('click', () => {
        closeModifyDialog();
    });

    const saveButton = document.createElement('button');
    saveButton.type = 'submit';
    saveButton.className = 'primary';
    saveButton.textContent = locked ? 'Done' : 'Apply changes';

    const duplicateButton = document.createElement('button');
    duplicateButton.type = 'button';
    duplicateButton.className = 'ghost';
    duplicateButton.textContent = 'Duplicate item';
    duplicateButton.addEventListener('click', () => {
        duplicateItem(element);
    });

    const attachmentSection = document.createElement('section');
    attachmentSection.className = 'modify-section';
    const attachmentHeader = document.createElement('div');
    attachmentHeader.className = 'modify-section-header';
    const attachmentTitle = document.createElement('h3');
    attachmentTitle.textContent = 'Attachments';
    attachmentHeader.appendChild(attachmentTitle);

    if (!locked) {
        const addAttachmentButton = document.createElement('button');
        addAttachmentButton.type = 'button';
        addAttachmentButton.className = 'ghost';
        addAttachmentButton.textContent = 'Add attachment';
        addAttachmentButton.addEventListener('click', () => {
            promptItemAttachment(element, { onComplete: renderModifyDialogAttachments });
        });
        attachmentHeader.appendChild(addAttachmentButton);
    }

    attachmentSection.appendChild(attachmentHeader);
    const attachmentsList = document.createElement('ul');
    attachmentsList.className = 'attachment-list';
    attachmentSection.appendChild(attachmentsList);

    form.append(sizeFieldset, labelFieldset, colorFieldset, attachmentSection);
    actions.append(cancelButton);
    if (!locked) {
        actions.append(duplicateButton, saveButton);
    } else {
        actions.append(saveButton);
    }
    form.append(actions);
    dialog.appendChild(form);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    modifyDialogState = { overlay, element, attachmentsList, locked };
    renderModifyDialogAttachments();
    document.addEventListener('keydown', handleModifyDialogKeydown);

    if (locked) {
        widthInput.disabled = true;
        heightInput.disabled = true;
        labelInput.disabled = true;
        colorInput.disabled = true;
        duplicateButton.disabled = true;
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (locked) {
            closeModifyDialog();
            return;
        }
        applyItemModifications(element, {
            width: parseFloat(widthInput.value),
            height: parseFloat(heightInput.value),
            label: labelInput.value,
            color: colorInput.value,
        });
        closeModifyDialog();
    });
}

function rgbToHex(color) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return '#3a7afe';
    }
    ctx.fillStyle = color || '#3a7afe';
    return ctx.fillStyle;
}

function applyItemModifications(element, { width, height, label, color }) {
    if (!element || element.dataset.type !== 'item') {
        return;
    }
    const currentWidth = parseFloat(element.dataset.width) || DEFAULT_ITEM_WIDTH_METERS;
    const currentHeight = parseFloat(element.dataset.height) || DEFAULT_ITEM_HEIGHT_METERS;
    const normalizedWidth = clampToMinSize(Number.isFinite(width) ? width : currentWidth);
    const normalizedHeight = clampToMinSize(Number.isFinite(height) ? height : currentHeight);
    const previousLabel = getItemLabel(element);
    const previousColor = rgbToHex(getComputedStyle(element).backgroundColor || element.style.background || '#3a7afe');

    const changes = [];
    if (normalizedWidth !== currentWidth || normalizedHeight !== currentHeight) {
        element.dataset.width = normalizedWidth.toString();
        element.dataset.height = normalizedHeight.toString();
        element.style.width = `${metersToPixels(normalizedWidth)}px`;
        element.style.height = `${metersToPixels(normalizedHeight)}px`;
        changes.push(`size ${normalizedWidth.toFixed(2)}m × ${normalizedHeight.toFixed(2)}m`);
    }

    const trimmedLabel = label.trim();
    if (trimmedLabel && trimmedLabel !== previousLabel) {
        element.textContent = trimmedLabel;
        changes.push(`label "${trimmedLabel}"`);
    } else if (!trimmedLabel && previousLabel !== 'Unnamed item') {
        element.textContent = 'Unnamed item';
        changes.push('label cleared');
    }

    if (color && color !== previousColor) {
        element.style.background = color;
        changes.push(`color ${color}`);
    }

    if (!changes.length) {
        return;
    }
    updateAttachmentIndicator(element);
    updateElementTransform(element);
    const message = `Item modified (${changes.join(', ')})${getItemHistoryLabel(element)}`;
    addHistoryEntry(message);
    updateItemRecord(element, message, { updateComment: false });
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

function toggleToolsMenu() {
    if (!toolsMenu) {
        return;
    }
    const shouldOpen = !toolsMenu.classList.contains('open');
    toolsMenu.classList.toggle('open', shouldOpen);
    if (toolsButton) {
        toolsButton.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    }
    if (shouldOpen) {
        updateMeasureToggleButton();
        updatePlanningStateUI();
    }
}

function closeToolsMenu() {
    if (toolsMenu) {
        toolsMenu.classList.remove('open');
    }
    if (toolsButton) {
        toolsButton.setAttribute('aria-expanded', 'false');
    }
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
        if (action === 'modify-item') {
            closeContextMenu();
            openItemModifyDialog(activeItem);
            return;
        } else if (action === 'attach-file') {
            promptItemAttachment(activeItem, { onComplete: renderModifyDialogAttachments });
        } else if (action === 'delete') {
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
    actions.push({ action: 'modify-item', label: locked ? 'View details…' : 'Modify…' });
    if (!locked) {
        actions.push({ action: 'attach-file', label: 'Attach file…' });
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
        label: `${currentDeck?.name || 'Deck'} area`,
        color: '#ffffff',
        type: 'deck-area',
    });
    closeToolsMenu();
}

function initializeDeckSelection() {
    renderDeckList();
    const storedSelection = localStorage.getItem(selectedDeckKey);
    if (storedSelection) {
        const deck = decks.find(
            (entry) => entry.id === storedSelection || entry.name === storedSelection
        );
        if (deck) {
            selectDeck(deck);
        }
    }
    renderPlanningJobs();
    updatePlanningControlsState();
    updatePlanningStateUI();
}

function handleCreateDeck() {
    const name = prompt('Name of the new deck?');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (decks.some((deck) => deck.name === trimmed)) {
        alert('A deck with that name already exists.');
        return;
    }
    decks.push(createDeckRecord(trimmed));
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
    closeToolsMenu();
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

if (toolsButton) {
    toolsButton.setAttribute('aria-haspopup', 'true');
    toolsButton.setAttribute('aria-expanded', 'false');
    toolsButton.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleToolsMenu();
    });
}

if (toolsMenu) {
    toolsMenu.addEventListener('click', (event) => {
        event.stopPropagation();
    });
}

if (addDeckAreaBtn) {
    addDeckAreaBtn.addEventListener('click', handleAddDeckArea);
}

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

if (measureToggleBtn) {
    measureToggleBtn.addEventListener('click', () => {
        toggleMeasureMode();
        closeToolsMenu();
    });
}

if (planningCurrentDeckToggle) {
    planningCurrentDeckToggle.addEventListener('click', () => {
        handlePlanningCurrentDeckToggle();
    });
}

if (createPlanningJobBtn) {
    createPlanningJobBtn.addEventListener('click', () => {
        handleCreatePlanningJob();
    });
}

if (deletePlanningJobBtn) {
    deletePlanningJobBtn.addEventListener('click', () => {
        handleDeletePlanningJob();
    });
}

workspaceContainer.addEventListener('pointerdown', handleMeasurePointerDown, true);

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

updateMeasureToggleButton();
updatePlanningStateUI();

refreshItemList();

initializeDeckSelection();
setupWorkspaceInteractions();
applyWorkspaceTransform();
