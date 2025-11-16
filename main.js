const selectedDeckKey = 'riglogistics:selectedDeck';
const API_STATE_ENDPOINT = '/api/state';
const STATE_SYNC_DEBOUNCE_MS = 300;
const STATE_SYNC_RETRY_INTERVAL_MS = 5000;
const DEFAULT_MUTATION_TIMESTAMP = Date.now();
const defaultDecks = ['Statfjord A deck', 'Statfjord B deck', 'Statfjord C deck'];
const PENDING_OPS_STORAGE_KEY = 'riglogistics:pendingOps';
const PLANNING_STATE_STORAGE_KEY = 'riglogistics:planningState';
const PIXELS_PER_METER = 60;
const BASE_SCALE = 0.4;
const MIN_SCALE = BASE_SCALE * 0.25;
const MIN_ITEM_SIZE_METERS = 0.5;
const DEFAULT_ITEM_WIDTH_METERS = 5;
const DEFAULT_ITEM_HEIGHT_METERS = 3;
const DEFAULT_DECK_AREA_SIZE_METERS = Number((320 / PIXELS_PER_METER).toFixed(2));
const WORKSPACE_ITEM_FONT_SIZE_PX = 32; // Matches 2rem item font size from styles.css
const WORKSPACE_ITEM_LABEL_PADDING_PX = 8; // Matches 0.5rem padding
const WORKSPACE_ITEM_LINE_HEIGHT = 1.2;
const MM_PER_POINT = 25.4 / 72;
const FALLBACK_ITEM_FONT_SIZE_PT = 10;
const PDF_ITEM_LABEL_MIN_FONT_SIZE_PT = 6;
const PDF_ITEM_LABEL_MAX_FONT_SIZE_PT = 18;
const PDF_TABLE_BODY_FONT_SIZE_PT = 9;
const PDF_TABLE_BODY_LINE_HEIGHT = 1.2;
const PDF_TABLE_ROW_TOP_PADDING_MM = 2;
const PDF_TABLE_ROW_BOTTOM_PADDING_MM = 1;
const LONG_PRESS_DURATION_MS = 550;
const LONG_PRESS_MOVE_THRESHOLD_PX = 10;

const ITEM_SHAPE_LABELS = {
    rectangle: 'Rectangle',
    circle: 'Circle',
    'triangle-right': 'Right triangle',
    'triangle-equilateral': 'Equilateral triangle',
};
const ITEM_SHAPE_KEYS = Object.keys(ITEM_SHAPE_LABELS);

const deckSelectionView = document.getElementById('deck-selection');
const workspaceView = document.getElementById('workspace-view');
const deckListEl = document.getElementById('deck-list');
const createDeckBtn = document.getElementById('create-deck');
const deleteDeckBtn = document.getElementById('delete-deck');
const selectionSettingsButton = document.getElementById('selection-settings-button');
const selectionSettingsMenu = document.getElementById('selection-settings-menu');
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
const deckSettingsButton = document.getElementById('deck-settings-button');
const deckSettingsPanel = document.getElementById('deck-settings-panel');
const deckModifyToggleBtn = document.getElementById('deck-modify-toggle');
const deckDownloadButton = document.getElementById('deck-download-button');
const deckUploadButton = document.getElementById('deck-upload-button');
const deckAddAreaButton = document.getElementById('deck-add-area-button');
const printToPdfButton = document.getElementById('print-to-pdf-button');
const toolsMenuContainer = document.getElementById('tools-menu-container');
const toolsMenuMobileAnchor = document.getElementById('tools-menu-mobile-anchor');
const toolsButton = document.getElementById('tools-button');
const toolsMenu = document.getElementById('tools-menu');
const measureToggleBtn = document.getElementById('toggle-measure-mode');
const togglePlanningModeBtn = document.getElementById('toggle-planning-mode');
const createPlanningJobBtn = document.getElementById('create-planning-job');
const planningIndicator = document.getElementById('planning-indicator');
const planningSidebar = document.getElementById('planning-sidebar');
const planningCurrentDeckToggle = document.getElementById('planning-current-deck');
const planningJobsList = document.getElementById('planning-job-list');
const workspaceHeader = document.querySelector('.workspace-header');
const toolbar = document.querySelector('.toolbar');
const contextMenu = document.getElementById('context-menu');
const zoomValueEl = document.getElementById('zoom-value');
const measurementInstructions = document.getElementById('measurement-instructions');
const deckModifyNotice = document.getElementById('deck-modify-notice');

if (deckModifyNotice) {
    deckModifyNotice.setAttribute('aria-hidden', 'true');
}

setupToolsMenuPlacement();

function setupToolsMenuPlacement() {
    if (!toolsMenuContainer || !toolsMenuMobileAnchor || !toolbar) {
        return;
    }

    const tabletWidthQuery = window.matchMedia('(min-width: 700px) and (max-width: 1100px)');

    const isIpadDevice = () => {
        const ua = navigator.userAgent || '';
        const platform = navigator.platform || '';
        const isModernIpad = platform === 'MacIntel' && navigator.maxTouchPoints > 1;
        return /iPad/i.test(ua) || isModernIpad;
    };

    const updatePlacement = () => {
        const shouldMoveToRightControls = isIpadDevice() && tabletWidthQuery.matches;

        if (shouldMoveToRightControls) {
            if (toolsMenuContainer.parentElement !== toolsMenuMobileAnchor) {
                toolsMenuMobileAnchor.appendChild(toolsMenuContainer);
                toolsMenuMobileAnchor.classList.add('tools-menu-anchor--active');
                toolsMenuContainer.classList.add('tools-menu--tablet');
            }
            return;
        }

        toolsMenuContainer.classList.remove('tools-menu--tablet');
        toolsMenuMobileAnchor.classList.remove('tools-menu-anchor--active');

        if (toolsMenuContainer.parentElement !== toolbar) {
            toolbar.appendChild(toolsMenuContainer);
        }
    };

    const registerMediaQuery = (mediaQuery) => {
        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', updatePlacement);
        } else if (typeof mediaQuery.addListener === 'function') {
            mediaQuery.addListener(updatePlacement);
        }
    };

    registerMediaQuery(tabletWidthQuery);
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('orientationchange', updatePlacement);
    updatePlacement();
}

const inputWidth = document.getElementById('input-width');
const inputHeight = document.getElementById('input-height');
const inputLabel = document.getElementById('input-label');
const inputColor = document.getElementById('input-color');

const measurementOverlay = document.createElement('div');
measurementOverlay.id = 'measurement-overlay';
measurementOverlay.className = 'measurement-overlay';
workspaceContent.appendChild(measurementOverlay);

const planningEditingLayer = document.createElement('div');
planningEditingLayer.id = 'planning-editing-layer';
planningEditingLayer.className = 'planning-editing-layer';
workspaceContent.appendChild(planningEditingLayer);

const planningOverlayHost = document.createElement('div');
planningOverlayHost.id = 'planning-overlays';
planningOverlayHost.className = 'planning-overlays';
workspaceContent.appendChild(planningOverlayHost);

inputWidth.value = DEFAULT_ITEM_WIDTH_METERS.toString();
inputHeight.value = DEFAULT_ITEM_HEIGHT_METERS.toString();
inputWidth.min = inputHeight.min = MIN_ITEM_SIZE_METERS.toString();
inputWidth.step = inputHeight.step = '0.1';

let lastKnownVersion = Number(window.__INITIAL_STATE__?.version) || 0;
let lastMutationTimestamp =
    Number(window.__INITIAL_STATE__?.mutationTimestamp) || DEFAULT_MUTATION_TIMESTAMP;
let pendingOperations = loadPendingOperations();
let decks = loadDecks({ pendingOperationsSnapshot: pendingOperations });
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
    active: false,
    activeJobIds: new Set(),
    showCurrentDeck: true,
    lockCurrentDeck: false,
    editingJobId: null,
};
let deckModifyMode = false;
let stateSyncTimer = null;
let workspaceSaveTimer = null;
let isApplyingRemoteState = false;
let isLoadingWorkspace = false;
let socket = null;
let pendingStateVersion = pendingOperations.length
    ? pendingOperations[pendingOperations.length - 1].version
    : null;
let jsPdfLoaderPromise = null;

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        if (pendingOperations.length) {
            queueStateSync({ immediate: true });
        }
    });
    window.addEventListener('beforeunload', handlePlanningPreferencesUnload);
    window.addEventListener('pagehide', handlePlanningPreferencesUnload);
}

if (pendingOperations.length) {
    setTimeout(() => queueStateSync({ immediate: true }), 0);
}

function normalizeItemShape(shape) {
    if (typeof shape !== 'string') {
        return 'rectangle';
    }
    const normalized = shape.trim().toLowerCase();
    return ITEM_SHAPE_KEYS.includes(normalized) ? normalized : 'rectangle';
}

function getItemShapeLabel(shape) {
    const normalized = normalizeItemShape(shape);
    return ITEM_SHAPE_LABELS[normalized] || ITEM_SHAPE_LABELS.rectangle;
}

function getItemShape(element) {
    if (!element || element.dataset.type !== 'item') {
        return 'rectangle';
    }
    return normalizeItemShape(element.dataset.shape);
}

function applyItemShapeStyles(element, shape) {
    if (!element || element.dataset.type !== 'item') {
        return;
    }
    const normalized = normalizeItemShape(shape);
    element.dataset.shape = normalized;
}

function isItemOnDeckLayer(element) {
    if (!element || element.dataset.type !== 'item') {
        return false;
    }
    return element.dataset.deckLayer === 'true';
}

function applyItemDeckLayerStyles(element) {
    if (!element || element.dataset.type !== 'item') {
        return;
    }
    const deckLayer = isItemOnDeckLayer(element);
    element.classList.toggle('deck-layer-item', deckLayer);
    element.style.zIndex = deckLayer ? '0' : '';
}

function setItemShape(element, shape, { recordHistory = true } = {}) {
    if (!element || element.dataset.type !== 'item') {
        return;
    }
    const normalized = normalizeItemShape(shape);
    const currentShape = getItemShape(element);
    if (currentShape === normalized) {
        return;
    }
    applyItemShapeStyles(element, normalized);
    if (isPlanningItem(element)) {
        if (recordHistory) {
            persistCurrentPlanningJob();
        }
        return;
    }
    if (!recordHistory) {
        return;
    }
    const message = `Item shape set to ${getItemShapeLabel(normalized)}${getItemHistoryLabel(element)}`;
    addHistoryEntry(message);
    updateItemRecord(element, message, { updateComment: false, updateDeck: false });
}

function setItemDeckLayerState(element, deckLayer, { recordHistory = true } = {}) {
    if (!element || element.dataset.type !== 'item') {
        return;
    }
    const shouldEnable = deckLayer === true || deckLayer === 'true';
    const currentlyEnabled = isItemOnDeckLayer(element);
    if (currentlyEnabled === shouldEnable) {
        return;
    }
    element.dataset.deckLayer = shouldEnable ? 'true' : 'false';
    applyItemDeckLayerStyles(element);
    if (isPlanningItem(element)) {
        if (recordHistory) {
            persistCurrentPlanningJob();
        }
        return;
    }
    if (!recordHistory) {
        return;
    }
    const labelSuffix = getItemHistoryLabel(element);
    const message = shouldEnable
        ? `Item moved to deck surface${labelSuffix}`
        : `Item restored to default layer${labelSuffix}`;
    addHistoryEntry(message);
    updateItemRecord(element, message, { updateComment: false, updateDeck: false });
}

function getDeckAreaElements() {
    return Array.from(workspaceContent.querySelectorAll('.deck-area'));
}

function enforceDeckAreaLocks() {
    const deckAreas = getDeckAreaElements();
    deckAreas.forEach((deckArea) => {
        const wasLocked = deckArea.dataset.locked === 'true';
        if (!wasLocked) {
            setDeckLockState(deckArea, true);
            deckArea.dataset.autolocked = 'true';
        } else {
            deckArea.dataset.autolocked = 'false';
        }
    });
}

function releaseAutolockedDeckAreas() {
    const deckAreas = getDeckAreaElements();
    deckAreas.forEach((deckArea) => {
        if (deckArea.dataset.autolocked === 'true') {
            setDeckLockState(deckArea, false);
        }
        delete deckArea.dataset.autolocked;
    });
}

function isPlanningItem(element) {
    return Boolean(element?.dataset?.planningJobId);
}

function getPlanningJob(jobId) {
    if (!currentDeck || !jobId) {
        return null;
    }
    const jobs = getCurrentDeckJobs();
    return jobs.find((job) => job.id === jobId) || null;
}

function ensurePlanningEditingLayer() {
    if (!planningEditingLayer.isConnected) {
        workspaceContent.appendChild(planningEditingLayer);
    }
}

function clearPlanningEditingLayer() {
    const planningElements = Array.from(planningEditingLayer.children);
    planningElements.forEach((element) => {
        element.remove();
    });
}

function loadPlanningJobForEditing(job) {
    ensurePlanningEditingLayer();
    clearPlanningEditingLayer();
    if (!job || !Array.isArray(job.deck?.items)) {
        return;
    }
    const entries = job.deck.items
        .map((entry) => normalizeWorkspaceLayoutEntry(entry))
        .filter((entry) => entry !== null);

    entries
        .filter((entry) => entry.type === 'item')
        .forEach((entry) => {
            const element = createItemElement(
                {
                    width: entry.width,
                    height: entry.height,
                    label: entry.label,
                    color: entry.color,
                    type: 'item',
                    shape: entry.shape,
                    deckLayer: entry.deckLayer,
                },
                {
                    skipHistory: true,
                    skipMetadata: true,
                    container: planningEditingLayer,
                    autoPosition: false,
                }
            );
            element.dataset.planningJobId = job.id;
            element.dataset.x = entry.x.toString();
            element.dataset.y = entry.y.toString();
            element.dataset.rotation = entry.rotation.toString();
            element.dataset.width = entry.width.toString();
            element.dataset.height = entry.height.toString();
            element.dataset.locked = entry.locked ? 'true' : 'false';
            element.classList.toggle('locked', entry.locked);
            element.classList.add('planning-edit-item');
            element.style.background = entry.color;
            element.style.width = `${metersToPixels(entry.width)}px`;
            element.style.height = `${metersToPixels(entry.height)}px`;
            if (entry.comment) {
                element.dataset.comment = entry.comment;
            } else {
                delete element.dataset.comment;
            }
            updateElementTransform(element);
        });
}

function serializePlanningEditingItems() {
    const elements = Array.from(planningEditingLayer.querySelectorAll('.item'));
    return elements.map((element) => {
        const width = Number.parseFloat(element.dataset.width);
        const height = Number.parseFloat(element.dataset.height);
        const x = Number.parseFloat(element.dataset.x);
        const y = Number.parseFloat(element.dataset.y);
        const rotation = Number.parseFloat(element.dataset.rotation);
        const locked = element.dataset.locked === 'true';
        return {
            type: 'item',
            label: getItemLabel(element),
            width: Number.isFinite(width) ? width : DEFAULT_ITEM_WIDTH_METERS,
            height: Number.isFinite(height) ? height : DEFAULT_ITEM_HEIGHT_METERS,
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0,
            rotation: Number.isFinite(rotation) ? rotation : 0,
            locked,
            color: rgbToHex(
                getComputedStyle(element).backgroundColor || element.style.background || '#3a7afe'
            ),
            comment: (element.dataset.comment || '').trim(),
            shape: getItemShape(element),
            deckLayer: isItemOnDeckLayer(element),
        };
    });
}

function touchCurrentDeckTimestamp() {
    if (!currentDeck) {
        return;
    }
    const updatedAt = Date.now();
    currentDeck.updatedAt = updatedAt;
    const target = decks.find((deck) => deck.id === currentDeck.id);
    if (target) {
        target.updatedAt = updatedAt;
    }
}

function persistCurrentPlanningJob() {
    if (!planningState.active) {
        return;
    }
    const jobId = planningState.editingJobId;
    if (!jobId) {
        return;
    }
    const job = getPlanningJob(jobId);
    if (!job) {
        return;
    }
    job.deck.items = serializePlanningEditingItems();
    touchCurrentDeckTimestamp();
    saveDecks();
    renderPlanningJobOverlay(job);
}

function loadStoredPlanningPreferences() {
    if (typeof localStorage === 'undefined') {
        return {};
    }
    try {
        const raw = localStorage.getItem(PLANNING_STATE_STORAGE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.warn('Failed to load planning preferences', error);
        return {};
    }
}

function saveStoredPlanningPreferences(preferences) {
    if (typeof localStorage === 'undefined') {
        return;
    }
    try {
        const hasEntries = preferences && Object.keys(preferences).length > 0;
        if (!hasEntries) {
            localStorage.removeItem(PLANNING_STATE_STORAGE_KEY);
            return;
        }
        localStorage.setItem(PLANNING_STATE_STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
        console.warn('Failed to persist planning preferences', error);
    }
}

function persistPlanningPreferencesForCurrentDeck() {
    if (!currentDeck || typeof currentDeck.id !== 'string') {
        return;
    }
    const preferences = loadStoredPlanningPreferences();
    preferences[currentDeck.id] = {
        active: planningState.active,
        showCurrentDeck: planningState.showCurrentDeck,
        editingJobId: planningState.editingJobId,
        activeJobIds: Array.from(planningState.activeJobIds),
    };
    saveStoredPlanningPreferences(preferences);
}

function clearPlanningPreferencesForDeck(deckId) {
    if (!deckId) {
        return;
    }
    const preferences = loadStoredPlanningPreferences();
    if (!preferences[deckId]) {
        return;
    }
    delete preferences[deckId];
    saveStoredPlanningPreferences(preferences);
}

function restorePlanningPreferencesForDeck(deck) {
    if (!deck || typeof deck.id !== 'string') {
        planningState.active = false;
        planningState.activeJobIds.clear();
        planningState.showCurrentDeck = true;
        planningState.lockCurrentDeck = false;
        planningState.editingJobId = null;
        return;
    }
    const preferences = loadStoredPlanningPreferences();
    const stored = preferences[deck.id];
    planningState.activeJobIds.clear();
    planningState.lockCurrentDeck = false;
    planningState.editingJobId = null;
    planningState.showCurrentDeck = true;
    planningState.active = false;
    if (!stored) {
        return;
    }
    const validJobIds = new Set(
        Array.isArray(deck.jobs) ? deck.jobs.map((job) => job.id).filter(Boolean) : []
    );
    planningState.active = stored.active === true;
    planningState.showCurrentDeck = stored.showCurrentDeck !== false;
    if (Array.isArray(stored.activeJobIds)) {
        stored.activeJobIds.forEach((jobId) => {
            if (jobId && validJobIds.has(jobId)) {
                planningState.activeJobIds.add(jobId);
            }
        });
    }
    if (typeof stored.editingJobId === 'string' && validJobIds.has(stored.editingJobId)) {
        planningState.editingJobId = stored.editingJobId;
        if (!planningState.activeJobIds.size) {
            planningState.activeJobIds.add(stored.editingJobId);
        }
    }
    if (!planningState.active) {
        planningState.activeJobIds.clear();
        planningState.editingJobId = null;
        planningState.showCurrentDeck = true;
    }
}

function handlePlanningPreferencesUnload() {
    persistCurrentPlanningJob();
    persistPlanningPreferencesForCurrentDeck();
}

function setPlanningEditingJob(jobId) {
    if (!planningState.active) {
        return;
    }
    const normalizedId = typeof jobId === 'string' && jobId.trim() ? jobId : null;
    if (planningState.editingJobId === normalizedId) {
        const existing = getPlanningJob(normalizedId);
        if (existing) {
            loadPlanningJobForEditing(existing);
        } else {
            clearPlanningEditingLayer();
        }
        refreshItemList();
        persistPlanningPreferencesForCurrentDeck();
        return;
    }
    persistCurrentPlanningJob();
    planningState.editingJobId = normalizedId;
    if (!normalizedId) {
        clearPlanningEditingLayer();
        refreshItemList();
        persistPlanningPreferencesForCurrentDeck();
        return;
    }
    const job = getPlanningJob(normalizedId);
    if (!job) {
        clearPlanningEditingLayer();
        refreshItemList();
        persistPlanningPreferencesForCurrentDeck();
        return;
    }
    loadPlanningJobForEditing(job);
    refreshItemList();
    persistPlanningPreferencesForCurrentDeck();
}

function setDeckSettingsVisibility(visible) {
    if (!deckSettingsPanel) {
        return;
    }
    const shouldShow = Boolean(visible);
    deckSettingsPanel.classList.toggle('open', shouldShow);
    deckSettingsPanel.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    if (deckSettingsButton) {
        deckSettingsButton.setAttribute('aria-expanded', shouldShow ? 'true' : 'false');
    }
}

function closeDeckSettingsPanel() {
    setDeckSettingsVisibility(false);
}

function toggleDeckSettingsPanel() {
    if (!deckSettingsPanel) {
        return;
    }
    const isOpen = deckSettingsPanel.classList.contains('open');
    setDeckSettingsVisibility(!isOpen);
    updateDeckSettingsButtons();
}

function updateDeckSettingsButtons() {
    if (deckModifyToggleBtn) {
        deckModifyToggleBtn.textContent = deckModifyMode ? 'Exit modify mode' : 'Enter modify mode';
    }
    if (deckDownloadButton) {
        deckDownloadButton.disabled = false;
        deckDownloadButton.setAttribute('aria-disabled', 'false');
    }
    if (deckUploadButton) {
        deckUploadButton.disabled = !deckModifyMode;
        deckUploadButton.setAttribute('aria-disabled', deckModifyMode ? 'false' : 'true');
    }
    if (deckAddAreaButton) {
        deckAddAreaButton.disabled = !deckModifyMode;
        deckAddAreaButton.setAttribute('aria-disabled', deckModifyMode ? 'false' : 'true');
    }
}

function setDeckModifyMode(active) {
    const shouldActivate = Boolean(active);
    if (shouldActivate) {
        releaseAutolockedDeckAreas();
        document.addEventListener('keydown', handleDeckModifyKeydown);
    } else {
        enforceDeckAreaLocks();
        document.removeEventListener('keydown', handleDeckModifyKeydown);
    }
    if (deckModifyMode === shouldActivate) {
        updateDeckSettingsButtons();
        if (!shouldActivate) {
            closeContextMenu();
        }
        return;
    }
    deckModifyMode = shouldActivate;
    if (deckModifyNotice) {
        deckModifyNotice.hidden = !deckModifyMode;
        deckModifyNotice.setAttribute('aria-hidden', deckModifyMode ? 'false' : 'true');
        deckModifyNotice.classList.toggle('active', deckModifyMode);
    }
    updateDeckSettingsButtons();
    if (!deckModifyMode) {
        closeContextMenu();
        getDeckAreaElements().forEach((deckArea) => hideDeckAreaResizeGuides(deckArea));
    }
}

function handleDeckModifyKeydown(event) {
    if (event.key === 'Escape') {
        event.preventDefault();
        setDeckModifyMode(false);
    }
}

function setPrintToPdfButtonBusy(isBusy) {
    if (!printToPdfButton) {
        return;
    }
    const defaultLabel = printToPdfButton.dataset.originalLabel || printToPdfButton.textContent || 'Print deck to PDF';
    if (!printToPdfButton.dataset.originalLabel) {
        printToPdfButton.dataset.originalLabel = defaultLabel;
    }
    if (isBusy) {
        printToPdfButton.disabled = true;
        printToPdfButton.textContent = 'Preparing PDF…';
    } else {
        printToPdfButton.disabled = false;
        printToPdfButton.textContent = printToPdfButton.dataset.originalLabel || 'Print decks to PDF';
    }
}

async function handlePrintToPdf() {
    if (!currentDeck) {
        alert('Select a deck before printing to PDF.');
        return;
    }
    setPrintToPdfButtonBusy(true);
    try {
        const entries = normalizeDeckLayoutForPrint(currentDeck);
        const jsPdfConstructor = await ensureJsPdfLoaded();
        const deckBounds = getDeckBounds(entries);
        const firstOrientation = determineDeckPageOrientation(deckBounds);
        const doc = new jsPdfConstructor({ orientation: firstOrientation, unit: 'mm', format: 'a4' });
        const bannerTimestamp = formatDeckBannerTimestamp(new Date());
        const bannerHeight = drawDeckPdfBanner(doc, {
            deckName: currentDeck?.name,
            timestamp: bannerTimestamp,
            orientation: firstOrientation,
        });
        renderDeckOnPdf(doc, currentDeck, entries, {
            bounds: deckBounds,
            orientation: firstOrientation,
            hideItemLabels: true,
            topOffset: bannerHeight,
            suppressPageTitle: true,
        });

        const deckAreas = entries.filter((entry) => entry.type === 'deck-area');
        const deckAreaGroups = sortDeckAreaGroupsAlphabetically(groupDeckAreasForPrint(deckAreas));
        deckAreaGroups.forEach((group) => {
            const groupEntries = buildDeckAreaGroupEntries(group, entries);
            if (!groupEntries.length) {
                return;
            }
            const groupBounds = buildDeckAreaGroupBounds(groupEntries);
            const orientation = determineDeckPageOrientation(groupBounds);
            doc.addPage('a4', orientation);
            renderDeckOnPdf(doc, currentDeck, groupEntries, {
                bounds: groupBounds,
                orientation,
                title: buildDeckAreaGroupTitle(currentDeck?.name, group),
            });
        });

        const tableRows = buildItemTableRows(currentDeck, entries);
        const shouldStartSummaryOnNewPage = doc.getNumberOfPages() > 0;
        renderItemsSummaryTable(doc, tableRows, shouldStartSummaryOnNewPage);
        const timestamp = new Date().toISOString().split('T')[0];
        const deckSlug = (currentDeck.name || 'deck')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
            .replace(/-{2,}/g, '-') || 'deck';
        doc.save(`rig-logistics-${deckSlug}-${timestamp}.pdf`);
    } catch (error) {
        console.error('Failed to generate PDF', error);
        alert('Unable to generate the PDF. Please try again.');
    } finally {
        setPrintToPdfButtonBusy(false);
    }
}

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
    if (!planningState.active) {
        return;
    }
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

function generatePlanningJobLabel(existingJobs = []) {
    const deckName = typeof currentDeck?.name === 'string' ? currentDeck.name.trim() : '';
    const baseLabel = deckName ? `${deckName} plan` : 'Planning deck';
    const usedLabels = new Set(
        existingJobs
            .map((job) => (typeof job.label === 'string' ? job.label.trim().toLowerCase() : ''))
            .filter(Boolean)
    );
    let index = existingJobs.length + 1;
    let candidate = `${baseLabel} ${index}`;
    while (usedLabels.has(candidate.toLowerCase())) {
        index += 1;
        candidate = `${baseLabel} ${index}`;
    }
    return candidate;
}

function createDeckRecord(name, { id, jobs, layout, updatedAt } = {}) {
    const timestamp = Number.isFinite(Number(updatedAt)) ? Number(updatedAt) : Date.now();
    return {
        id: typeof id === 'string' && id.trim() ? id : generateDeckId(),
        name: typeof name === 'string' && name.trim() ? name.trim() : 'Deck',
        layout: Array.isArray(layout)
            ? layout
                  .map((entry) => normalizeWorkspaceLayoutEntry(entry))
                  .filter((value) => value !== null)
            : [],
        jobs: Array.isArray(jobs) ? jobs.map((job) => normalizePlanningJob(job)) : [],
        updatedAt: timestamp,
    };
}

function normalizePlanningItem(item) {
    if (!item || typeof item !== 'object') {
        return null;
    }
    const type = item.type === 'item' ? 'item' : 'deck-area';
    if (type !== 'item') {
        return null;
    }
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
    normalized.color =
        typeof item.color === 'string' && item.color.trim() ? item.color : '#3a7afe';
    normalized.shape = normalizeItemShape(item.shape);
    normalized.deckLayer = item.deckLayer === true || item.deckLayer === 'true';
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
    return createDeckRecord(entry.name, {
        id: entry.id,
        jobs: entry.jobs,
        layout: entry.layout,
        updatedAt: entry.updatedAt,
    });
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
        result.shape = normalizeItemShape(item.shape);
        result.deckLayer = item.deckLayer === true || item.deckLayer === 'true';
    } else if (item.type === 'deck-area') {
        result.nameHidden = Boolean(item.nameHidden);
    }
    return result;
}

function attachmentToSerializable(attachment) {
    if (!attachment || typeof attachment !== 'object') {
        return null;
    }
    return {
        id: typeof attachment.id === 'string' ? attachment.id : '',
        name: typeof attachment.name === 'string' ? attachment.name : 'Attachment',
        type: typeof attachment.type === 'string' ? attachment.type : '',
        size: Number.isFinite(Number(attachment.size)) ? Number(attachment.size) : 0,
        dataUrl: typeof attachment.dataUrl === 'string' ? attachment.dataUrl : '',
        addedAt:
            typeof attachment.addedAt === 'string' && attachment.addedAt.trim()
                ? attachment.addedAt
                : new Date().toISOString(),
    };
}

function normalizeHistoryRecord(entry) {
    if (!entry || typeof entry !== 'object') {
        return null;
    }
    const message = typeof entry.message === 'string' && entry.message.trim() ? entry.message.trim() : '';
    if (!message) {
        return null;
    }
    let timestamp = null;
    if (entry.timestamp instanceof Date) {
        timestamp = entry.timestamp.toISOString();
    } else if (typeof entry.timestamp === 'string' && entry.timestamp.trim()) {
        const parsed = new Date(entry.timestamp);
        if (!Number.isNaN(parsed.getTime())) {
            timestamp = parsed.toISOString();
        }
    }
    if (!timestamp) {
        timestamp = new Date().toISOString();
    }
    return { message, timestamp };
}

function historyRecordToEvent(entry) {
    const normalized = normalizeHistoryRecord(entry);
    if (!normalized) {
        return null;
    }
    const parsed = new Date(normalized.timestamp);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return { message: normalized.message, timestamp: parsed };
}

function layoutEntryToSerializable(entry) {
    if (!entry || typeof entry !== 'object') {
        return null;
    }
    const type = entry.type === 'deck-area' ? 'deck-area' : 'item';
    const base = {
        type,
        label:
            typeof entry.label === 'string' && entry.label.trim()
                ? entry.label.trim()
                : type === 'deck-area'
                ? 'Deck area'
                : 'Item',
        width: Number.isFinite(Number(entry.width)) ? Number(entry.width) : DEFAULT_ITEM_WIDTH_METERS,
        height: Number.isFinite(Number(entry.height)) ? Number(entry.height) : DEFAULT_ITEM_HEIGHT_METERS,
        x: Number.isFinite(Number(entry.x)) ? Number(entry.x) : 0,
        y: Number.isFinite(Number(entry.y)) ? Number(entry.y) : 0,
        rotation: Number.isFinite(Number(entry.rotation)) ? Number(entry.rotation) : 0,
        locked: entry.locked === true || entry.locked === 'true',
    };
    if (type === 'item') {
        base.color =
            typeof entry.color === 'string' && entry.color.trim() ? entry.color : '#3a7afe';
        base.comment = typeof entry.comment === 'string' ? entry.comment : '';
        base.shape = normalizeItemShape(entry.shape);
        base.deckLayer = entry.deckLayer === true || entry.deckLayer === 'true';
        if (typeof entry.id === 'string' && entry.id.trim()) {
            base.id = entry.id.trim();
        }
        const attachmentsSource = Array.isArray(entry.attachments) ? entry.attachments : [];
        base.attachments = attachmentsSource
            .map((attachment) => attachmentToSerializable(attachment))
            .filter((value) => value !== null);
        const historySource = Array.isArray(entry.history) ? entry.history : [];
        const history = historySource
            .map((record) => normalizeHistoryRecord(record))
            .filter((value) => value !== null);
        if (history.length) {
            base.history = history;
        }
        if (typeof entry.lastModified === 'string' && entry.lastModified.trim()) {
            const parsed = new Date(entry.lastModified);
            if (!Number.isNaN(parsed.getTime())) {
                base.lastModified = parsed.toISOString();
            }
        } else if (entry.lastModified instanceof Date) {
            base.lastModified = entry.lastModified.toISOString();
        }
    } else {
        base.nameHidden = entry.nameHidden === true || entry.nameHidden === 'true';
    }
    return base;
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
    const updatedAt = Number.isFinite(Number(deck?.updatedAt)) ? Number(deck.updatedAt) : Date.now();
    return {
        id: deck.id,
        name: deck.name,
        layout: Array.isArray(deck.layout)
            ? deck.layout
                  .map((entry) => layoutEntryToSerializable(entry))
                  .filter((value) => value !== null)
            : [],
        jobs: Array.isArray(deck.jobs) ? deck.jobs.map((job) => jobToSerializable(job)) : [],
        updatedAt,
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
    const planningActive = planningState.active;
    const hasDeck = Boolean(currentDeck);
    if (workspaceHeader) {
        workspaceHeader.classList.toggle('planning-mode', planningActive);
    }
    if (planningIndicator) {
        planningIndicator.hidden = !planningActive;
    }
    if (planningSidebar) {
        planningSidebar.classList.toggle('hidden', !planningActive);
        planningSidebar.classList.toggle('disabled', !planningActive || !hasDeck);
    }
    if (planningCurrentDeckToggle) {
        const lockCurrentDeck = planningActive && hasDeck && planningState.lockCurrentDeck;
        if (lockCurrentDeck && !planningState.showCurrentDeck) {
            planningState.showCurrentDeck = true;
        }
        const canToggle = planningActive && hasDeck && !lockCurrentDeck;
        const showCurrentDeck = planningState.showCurrentDeck && planningActive && hasDeck;
        planningCurrentDeckToggle.disabled = !canToggle;
        planningCurrentDeckToggle.setAttribute('aria-disabled', canToggle ? 'false' : 'true');
        planningCurrentDeckToggle.setAttribute('aria-pressed', showCurrentDeck ? 'true' : 'false');
        planningCurrentDeckToggle.classList.toggle('active', showCurrentDeck);
        planningCurrentDeckToggle.classList.toggle('locked', lockCurrentDeck);
        if (lockCurrentDeck) {
            planningCurrentDeckToggle.title = 'Current deck remains primary while planning mode is active.';
        } else {
            planningCurrentDeckToggle.removeAttribute('title');
        }
    }
    if (togglePlanningModeBtn) {
        togglePlanningModeBtn.textContent = planningActive ? 'Exit planning mode' : 'Enter planning mode';
        togglePlanningModeBtn.setAttribute('aria-pressed', planningActive ? 'true' : 'false');
        togglePlanningModeBtn.classList.toggle('active', planningActive);
    }
    if (workspaceContainer) {
        workspaceContainer.classList.toggle('planning-mode-active', planningActive);
        workspaceContainer.classList.toggle(
            'planning-hide-current',
            planningActive && !planningState.showCurrentDeck
        );
    }
}

function updatePlanningControlsState() {
    const planningActive = planningState.active;
    const hasDeck = planningActive && Boolean(currentDeck);
    if (createPlanningJobBtn) {
        createPlanningJobBtn.disabled = !hasDeck;
    }
}

function enterPlanningMode() {
    if (planningState.active) {
        closeToolsMenu();
        return;
    }
    planningState.active = true;
    planningState.showCurrentDeck = true;
    planningState.lockCurrentDeck = false;
    planningState.editingJobId = null;
    clearPlanningEditingLayer();
    renderPlanningJobs();
    refreshItemList();
    persistPlanningPreferencesForCurrentDeck();
    closeToolsMenu();
}

function exitPlanningMode() {
    if (!planningState.active) {
        closeToolsMenu();
        return;
    }
    persistCurrentPlanningJob();
    planningState.active = false;
    planningState.showCurrentDeck = true;
    planningState.lockCurrentDeck = false;
    planningState.editingJobId = null;
    clearPlanningEditingLayer();
    renderPlanningJobs();
    refreshItemList();
    persistPlanningPreferencesForCurrentDeck();
    closeToolsMenu();
}

function togglePlanningMode() {
    if (planningState.active) {
        exitPlanningMode();
    } else {
        enterPlanningMode();
    }
}

function renderPlanningJobOverlay(job) {
    if (!planningState.active) {
        const existing = planningOverlayHost.querySelector(`[data-job-id="${job.id}"]`);
        if (existing) {
            existing.remove();
        }
        return;
    }
    ensurePlanningOverlayHost();
    let overlay = planningOverlayHost.querySelector(`[data-job-id="${job.id}"]`);
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'planning-overlay';
        overlay.dataset.jobId = job.id;
        planningOverlayHost.appendChild(overlay);
    }
    overlay.innerHTML = '';
    const isEditingJob = planningState.editingJobId === job.id;
    overlay.hidden = !planningState.activeJobIds.has(job.id) || isEditingJob;
    job.deck.items.forEach((item) => {
        if (item.type === 'deck-area') {
            return;
        }
        const element = document.createElement('div');
        element.className = `planning-overlay-item ${item.type}`;
        const widthPixels = metersToPixels(item.width);
        const heightPixels = metersToPixels(item.height);
        element.style.width = `${widthPixels}px`;
        element.style.height = `${heightPixels}px`;
        element.style.transform = `translate(${item.x}px, ${item.y}px) rotate(${item.rotation}deg)`;
        const deckLayerEnabled = item.deckLayer === true || item.deckLayer === 'true';
        element.classList.toggle('deck-layer-item', deckLayerEnabled);
        element.style.zIndex = deckLayerEnabled ? '0' : '1';
        if (item.type === 'item') {
            const color = item.color || '#3a7afe';
            element.style.background = color;
            element.classList.toggle('has-dark-text', isColorDark(color));
            element.textContent = item.label || 'Item';
            element.dataset.shape = normalizeItemShape(item.shape);
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
    const planningActive = planningState.active;
    if (!planningActive) {
        clearPlanningOverlays();
        if (planningOverlayHost.isConnected) {
            planningOverlayHost.remove();
        }
        clearPlanningEditingLayer();
        planningState.editingJobId = null;
    }
    if (!currentDeck) {
        planningState.activeJobIds.clear();
        planningState.showCurrentDeck = true;
        planningState.lockCurrentDeck = false;
        planningJobsList.innerHTML = '';
        clearPlanningOverlays();
        if (planningOverlayHost.isConnected) {
            planningOverlayHost.remove();
        }
        clearPlanningEditingLayer();
        planningState.editingJobId = null;
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'list-empty';
        emptyMessage.textContent = 'Select a deck to start planning.';
        planningJobsList.appendChild(emptyMessage);
        updatePlanningControlsState();
        updatePlanningStateUI();
        return;
    }
    const jobs = getCurrentDeckJobs();
    const validIds = new Set(jobs.map((job) => job.id));
    Array.from(planningState.activeJobIds).forEach((jobId) => {
        if (!validIds.has(jobId)) {
            planningState.activeJobIds.delete(jobId);
        }
    });
    if (!validIds.has(planningState.editingJobId)) {
        planningState.editingJobId = null;
        clearPlanningEditingLayer();
    }
    if (planningActive && planningState.editingJobId === null) {
        const next = planningState.activeJobIds.values().next();
        if (!next.done) {
            setPlanningEditingJob(next.value);
        }
    }
    planningJobsList.innerHTML = '';
    if (!jobs.length) {
        planningState.activeJobIds.clear();
        planningState.showCurrentDeck = true;
        planningState.lockCurrentDeck = false;
        clearPlanningOverlays();
        if (planningOverlayHost.isConnected) {
            planningOverlayHost.remove();
        }
        clearPlanningEditingLayer();
        planningState.editingJobId = null;
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'list-empty';
        emptyMessage.textContent = 'No planning decks yet.';
        planningJobsList.appendChild(emptyMessage);
        updatePlanningControlsState();
        updatePlanningStateUI();
        persistPlanningPreferencesForCurrentDeck();
        return;
    }
    if (planningActive) {
        ensurePlanningOverlayHost();
        ensurePlanningEditingLayer();
        if (planningState.editingJobId) {
            const editingJob = getPlanningJob(planningState.editingJobId);
            if (editingJob) {
                const hasElements = planningEditingLayer.querySelector('.item');
                if (!hasElements) {
                    loadPlanningJobForEditing(editingJob);
                }
            }
        }
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
        const isEditing = planningState.editingJobId === job.id;
        toggle.setAttribute('aria-current', isEditing ? 'true' : 'false');
        toggle.classList.toggle('active', isActive);
        toggle.classList.toggle('editing', isEditing);
        toggle.disabled = !planningActive;
        toggle.addEventListener('click', () => togglePlanningJob(job.id));
        entry.appendChild(toggle);
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'planning-job-delete';
        deleteButton.setAttribute('aria-label', `Delete planning deck ${job.label}`);
        deleteButton.textContent = '×';
        deleteButton.disabled = !planningActive;
        deleteButton.addEventListener('click', (event) => {
            event.stopPropagation();
            deletePlanningJob(job.id);
        });
        entry.appendChild(deleteButton);
        planningJobsList.appendChild(entry);
        if (planningActive) {
            renderPlanningJobOverlay(job);
        }
    });
    if (planningActive) {
        planningOverlayHost.querySelectorAll('[data-job-id]').forEach((overlay) => {
            if (!validIds.has(overlay.dataset.jobId)) {
                overlay.remove();
            }
        });
    }
    updatePlanningControlsState();
    updatePlanningStateUI();
    persistPlanningPreferencesForCurrentDeck();
}

function togglePlanningJob(jobId) {
    if (!planningState.active) {
        return;
    }
    if (!currentDeck) {
        return;
    }
    const jobs = getCurrentDeckJobs();
    if (!jobs.some((job) => job.id === jobId)) {
        return;
    }
    const isActive = planningState.activeJobIds.has(jobId);
    if (isActive) {
        planningState.activeJobIds.delete(jobId);
        if (planningState.editingJobId === jobId) {
            const next = planningState.activeJobIds.values().next();
            if (!next.done) {
                setPlanningEditingJob(next.value);
            } else {
                setPlanningEditingJob(null);
            }
        }
    } else {
        planningState.activeJobIds.add(jobId);
        if (!planningState.editingJobId || planningState.editingJobId === jobId) {
            setPlanningEditingJob(jobId);
        }
    }
    renderPlanningJobs();
    refreshItemList();
    persistPlanningPreferencesForCurrentDeck();
}

function handlePlanningCurrentDeckToggle() {
    if (!planningState.active) {
        return;
    }
    if (!currentDeck) {
        return;
    }
    if (planningState.lockCurrentDeck) {
        return;
    }
    planningState.showCurrentDeck = !planningState.showCurrentDeck;
    updatePlanningStateUI();
    persistPlanningPreferencesForCurrentDeck();
}

function deletePlanningJob(jobId) {
    if (!currentDeck) {
        return;
    }
    const jobs = getCurrentDeckJobs();
    const index = jobs.findIndex((job) => job.id === jobId);
    if (index === -1) {
        return;
    }
    const job = jobs[index];
    const shouldDelete = confirm(`Delete planning deck "${job.label}"?`);
    if (!shouldDelete) {
        return;
    }
    jobs.splice(index, 1);
    planningState.activeJobIds.delete(jobId);
    touchCurrentDeckTimestamp();
    saveDecks();
    renderPlanningJobs();
    refreshItemList();
    persistPlanningPreferencesForCurrentDeck();
}

function serializeWorkspaceElements() {
    const elements = Array.from(workspaceContent.querySelectorAll('.item, .deck-area')).filter(
        (element) =>
            !element.closest('#planning-editing-layer') &&
            !element.closest('#planning-overlays')
    );
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
            locked: element.dataset.locked === 'true',
        };
        if (type === 'item') {
            const color = rgbToHex(
                getComputedStyle(element).backgroundColor || element.style.background || '#3a7afe'
            );
            itemData.color = color;
            itemData.comment = (element.dataset.comment || '').trim();
            itemData.shape = getItemShape(element);
            itemData.deckLayer = isItemOnDeckLayer(element);
            const itemId = element.dataset.itemId;
            if (itemId) {
                itemData.id = itemId;
            }
            const metadata = itemId ? itemMetadata.get(itemId) : null;
            const attachmentsSource = Array.isArray(metadata?.attachments) ? metadata.attachments : [];
            itemData.attachments = attachmentsSource
                .map((attachment) => attachmentToSerializable(attachment))
                .filter((value) => value !== null);
            const historySource = itemId && itemHistories.has(itemId) ? itemHistories.get(itemId) : [];
            const serializedHistory = Array.isArray(historySource)
                ? historySource.map((record) => normalizeHistoryRecord(record)).filter((value) => value !== null)
                : [];
            if (serializedHistory.length) {
                itemData.history = serializedHistory;
            }
            let lastModifiedIso = null;
            if (metadata?.lastModified instanceof Date) {
                lastModifiedIso = metadata.lastModified.toISOString();
            } else if (typeof metadata?.lastModified === 'string' && metadata.lastModified.trim()) {
                const parsed = new Date(metadata.lastModified);
                if (!Number.isNaN(parsed.getTime())) {
                    lastModifiedIso = parsed.toISOString();
                }
            }
            if (!lastModifiedIso) {
                lastModifiedIso = new Date().toISOString();
                if (metadata) {
                    metadata.lastModified = new Date(lastModifiedIso);
                    itemMetadata.set(itemId, metadata);
                }
            }
            itemData.lastModified = lastModifiedIso;
        } else {
            itemData.nameHidden = element.dataset.nameHidden === 'true';
        }
        return itemData;
    });
}

function serializeWorkspaceItemsForPlanning({ includeDeckAreas = false } = {}) {
    return serializeWorkspaceElements().filter((entry) => {
        if (entry.type === 'deck-area') {
            return includeDeckAreas;
        }
        return entry.type === 'item';
    });
}

function normalizeDeckLayoutForPrint(deck) {
    if (!deck || !Array.isArray(deck.layout)) {
        return [];
    }
    return deck.layout
        .map((entry) => normalizeWorkspaceLayoutEntry(entry))
        .filter((entry) => entry !== null);
}

function getDeckBounds(entries) {
    if (!Array.isArray(entries) || !entries.length) {
        return { minX: 0, minY: 0, maxX: 10, maxY: 10, width: 10, height: 10 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    entries.forEach((entry) => {
        const xMeters = (Number(entry.x) || 0) / PIXELS_PER_METER;
        const yMeters = (Number(entry.y) || 0) / PIXELS_PER_METER;
        const widthMeters = Number(entry.width) || DEFAULT_ITEM_WIDTH_METERS;
        const heightMeters = Number(entry.height) || DEFAULT_ITEM_HEIGHT_METERS;
        const rotationDegrees = normalizeRotationDegrees(entry.rotation);
        if (Math.abs(rotationDegrees) < 0.01) {
            minX = Math.min(minX, xMeters);
            minY = Math.min(minY, yMeters);
            maxX = Math.max(maxX, xMeters + widthMeters);
            maxY = Math.max(maxY, yMeters + heightMeters);
        } else {
            const radians = degreesToRadians(rotationDegrees);
            const centerX = xMeters + widthMeters / 2;
            const centerY = yMeters + heightMeters / 2;
            const corners = [
                rotatePoint(xMeters, yMeters, centerX, centerY, radians),
                rotatePoint(xMeters + widthMeters, yMeters, centerX, centerY, radians),
                rotatePoint(xMeters + widthMeters, yMeters + heightMeters, centerX, centerY, radians),
                rotatePoint(xMeters, yMeters + heightMeters, centerX, centerY, radians),
            ];
            corners.forEach((corner) => {
                minX = Math.min(minX, corner.x);
                minY = Math.min(minY, corner.y);
                maxX = Math.max(maxX, corner.x);
                maxY = Math.max(maxY, corner.y);
            });
        }
    });
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return { minX: 0, minY: 0, maxX: 10, maxY: 10, width: 10, height: 10 };
    }
    const width = Math.max(maxX - minX, 1);
    const height = Math.max(maxY - minY, 1);
    return { minX, minY, maxX, maxY, width, height };
}

function determineDeckPageOrientation(bounds) {
    if (!bounds) {
        return 'landscape';
    }
    if (bounds.height > bounds.width) {
        return 'portrait';
    }
    return 'landscape';
}

function getA4Dimensions(orientation = 'landscape') {
    const isLandscape = orientation === 'landscape';
    return {
        width: isLandscape ? 297 : 210,
        height: isLandscape ? 210 : 297,
    };
}

async function ensureJsPdfLoaded() {
    if (window.jspdf?.jsPDF) {
        return window.jspdf.jsPDF;
    }
    if (!jsPdfLoaderPromise) {
        jsPdfLoaderPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
            script.async = true;
            script.onload = () => {
                if (window.jspdf?.jsPDF) {
                    resolve(window.jspdf.jsPDF);
                } else {
                    reject(new Error('jsPDF did not initialize'));
                }
            };
            script.onerror = () => reject(new Error('Failed to load jsPDF'));
            document.head.appendChild(script);
        });
    }
    try {
        return await jsPdfLoaderPromise;
    } catch (error) {
        jsPdfLoaderPromise = null;
        throw error;
    }
}

function hexToRgb(color) {
    if (typeof color !== 'string') {
        return { r: 58, g: 122, b: 254 };
    }
    let hex = color.trim();
    if (hex.startsWith('#')) {
        hex = hex.slice(1);
    }
    if (hex.length === 3) {
        hex = hex
            .split('')
            .map((char) => char + char)
            .join('');
    }
    if (hex.length !== 6 || /[^0-9a-f]/i.test(hex)) {
        return { r: 58, g: 122, b: 254 };
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some((value) => Number.isNaN(value))) {
        return { r: 58, g: 122, b: 254 };
    }
    return { r, g, b };
}

function getItemLocationLabel(item, deckAreas, deckName) {
    const deckLabel = deckName || 'Deck';
    if (!Array.isArray(deckAreas) || !deckAreas.length) {
        return deckLabel;
    }
    const itemX = (Number(item.x) || 0) / PIXELS_PER_METER;
    const itemY = (Number(item.y) || 0) / PIXELS_PER_METER;
    const width = Number(item.width) || DEFAULT_ITEM_WIDTH_METERS;
    const height = Number(item.height) || DEFAULT_ITEM_HEIGHT_METERS;
    const centerX = itemX + width / 2;
    const centerY = itemY + height / 2;
    const containingArea = deckAreas.find((area) => {
        const areaX = (Number(area.x) || 0) / PIXELS_PER_METER;
        const areaY = (Number(area.y) || 0) / PIXELS_PER_METER;
        const areaWidth = Number(area.width) || DEFAULT_DECK_AREA_SIZE_METERS;
        const areaHeight = Number(area.height) || DEFAULT_DECK_AREA_SIZE_METERS;
        return (
            centerX >= areaX &&
            centerX <= areaX + areaWidth &&
            centerY >= areaY &&
            centerY <= areaY + areaHeight
        );
    });
    if (!containingArea) {
        return deckLabel;
    }
    const areaLabel = containingArea.label || 'Deck area';
    return `${deckLabel} – ${areaLabel}`;
}

function buildItemTableRows(deck, entriesOverride) {
    if (!deck) {
        return [];
    }
    const deckEntries = Array.isArray(entriesOverride) ? entriesOverride : normalizeDeckLayoutForPrint(deck);
    const rows = [];
    const deckAreas = deckEntries.filter((entry) => entry.type === 'deck-area');
    deckEntries
        .filter((entry) => entry.type === 'item')
        .forEach((item) => {
            const lastModified = new Date(item.lastModified || Date.now());
            if (Number.isNaN(lastModified.getTime())) {
                lastModified.setTime(Date.now());
            }
            rows.push({
                itemLabel: item.label || 'Item',
                locationLabel: getItemLocationLabel(item, deckAreas, deck.name),
                lastModified,
                comment: item.comment || '',
            });
        });
    rows.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    return rows;
}

function formatTableDate(value) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        return '';
    }
    try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(value);
    } catch (error) {
        return value.toLocaleString();
    }
}

function drawDeckAreaConnections(doc, deckAreas, bounds, scale, offsetX, offsetY) {
    if (!deckAreas.length) {
        return;
    }
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    for (let i = 0; i < deckAreas.length; i += 1) {
        for (let j = i + 1; j < deckAreas.length; j += 1) {
            const a = deckAreas[i];
            const b = deckAreas[j];
            const aX = (Number(a.x) || 0) / PIXELS_PER_METER + (Number(a.width) || 0) / 2;
            const aY = (Number(a.y) || 0) / PIXELS_PER_METER + (Number(a.height) || 0) / 2;
            const bX = (Number(b.x) || 0) / PIXELS_PER_METER + (Number(b.width) || 0) / 2;
            const bY = (Number(b.y) || 0) / PIXELS_PER_METER + (Number(b.height) || 0) / 2;
            const distanceMeters = Math.hypot(aX - bX, aY - bY);
            if (distanceMeters < 1) {
                const startX = offsetX + (aX - bounds.minX) * scale;
                const startY = offsetY + (aY - bounds.minY) * scale;
                const endX = offsetX + (bX - bounds.minX) * scale;
                const endY = offsetY + (bY - bounds.minY) * scale;
                doc.line(startX, startY, endX, endY);
            }
        }
    }
}

function getDeckAreaMetrics(entry) {
    const widthMeters = Number(entry.width) || DEFAULT_DECK_AREA_SIZE_METERS;
    const heightMeters = Number(entry.height) || DEFAULT_DECK_AREA_SIZE_METERS;
    const xMeters = (Number(entry.x) || 0) / PIXELS_PER_METER;
    const yMeters = (Number(entry.y) || 0) / PIXELS_PER_METER;
    return {
        x: xMeters,
        y: yMeters,
        width: widthMeters,
        height: heightMeters,
        centerX: xMeters + widthMeters / 2,
        centerY: yMeters + heightMeters / 2,
    };
}

function getItemCenterInMeters(entry) {
    const widthMeters = Number(entry.width) || DEFAULT_ITEM_WIDTH_METERS;
    const heightMeters = Number(entry.height) || DEFAULT_ITEM_HEIGHT_METERS;
    const xMeters = (Number(entry.x) || 0) / PIXELS_PER_METER;
    const yMeters = (Number(entry.y) || 0) / PIXELS_PER_METER;
    return {
        x: xMeters + widthMeters / 2,
        y: yMeters + heightMeters / 2,
    };
}

function isPointInsideDeckArea(pointX, pointY, deckArea) {
    if (!deckArea) {
        return false;
    }
    const metrics = getDeckAreaMetrics(deckArea);
    return (
        pointX >= metrics.x &&
        pointX <= metrics.x + metrics.width &&
        pointY >= metrics.y &&
        pointY <= metrics.y + metrics.height
    );
}

function isItemInsideDeckArea(item, deckArea) {
    if (!item || !deckArea) {
        return false;
    }
    const center = getItemCenterInMeters(item);
    return isPointInsideDeckArea(center.x, center.y, deckArea);
}

function isItemInDeckAreaGroup(item, deckAreas) {
    if (!Array.isArray(deckAreas) || !deckAreas.length) {
        return false;
    }
    return deckAreas.some((area) => isItemInsideDeckArea(item, area));
}

function groupDeckAreasForPrint(deckAreas, thresholdMeters = 1) {
    const normalized = Array.isArray(deckAreas)
        ? deckAreas
              .map((area) => ({ area, metrics: getDeckAreaMetrics(area) }))
              .filter((entry) => entry.area)
        : [];
    if (!normalized.length) {
        return [];
    }
    const groups = [];
    const visited = new Set();
    normalized.forEach((entry) => {
        if (visited.has(entry.area)) {
            return;
        }
        const stack = [entry];
        const group = [];
        visited.add(entry.area);
        while (stack.length) {
            const current = stack.pop();
            group.push(current.area);
            normalized.forEach((candidate) => {
                if (visited.has(candidate.area)) {
                    return;
                }
                const distance = Math.hypot(
                    candidate.metrics.centerX - current.metrics.centerX,
                    candidate.metrics.centerY - current.metrics.centerY
                );
                if (distance < thresholdMeters) {
                    visited.add(candidate.area);
                    stack.push(candidate);
                }
            });
        }
        groups.push(group);
    });
    return groups;
}

function buildDeckAreaGroupEntries(deckAreas, deckEntries) {
    if (!Array.isArray(deckAreas) || !deckAreas.length) {
        return [];
    }
    const items = Array.isArray(deckEntries)
        ? deckEntries.filter((entry) => entry.type === 'item' && isItemInDeckAreaGroup(entry, deckAreas))
        : [];
    return [...deckAreas, ...items];
}

function buildDeckAreaGroupBounds(entries, padding = 0.5) {
    const baseBounds = getDeckBounds(entries);
    const safePadding = Number.isFinite(padding) ? Math.max(0, padding) : 0;
    const minX = baseBounds.minX - safePadding;
    const minY = baseBounds.minY - safePadding;
    const maxX = baseBounds.maxX + safePadding;
    const maxY = baseBounds.maxY + safePadding;
    return {
        minX,
        minY,
        maxX,
        maxY,
        width: Math.max(maxX - minX, 0.5),
        height: Math.max(maxY - minY, 0.5),
    };
}

function buildDeckAreaGroupTitle(deckName, deckAreas) {
    const deckLabel = deckName || 'Deck';
    if (!Array.isArray(deckAreas) || !deckAreas.length) {
        return deckLabel;
    }
    const labels = deckAreas
        .map((area) => (typeof area.label === 'string' && area.label.trim() ? area.label.trim() : 'Deck area'))
        .filter((value, index, array) => array.indexOf(value) === index);
    return `${deckLabel} – ${labels.join(' + ')}`;
}

function sortDeckAreaGroupsAlphabetically(groups) {
    if (!Array.isArray(groups) || !groups.length) {
        return [];
    }
    const collator = typeof Intl !== 'undefined' ? new Intl.Collator(undefined, { sensitivity: 'base' }) : null;
    const normalizeLabel = (value) =>
        typeof value === 'string' && value.trim() ? value.trim() : 'Deck area';
    const getGroupKey = (group) => {
        if (!Array.isArray(group) || !group.length) {
            return 'Deck area';
        }
        const labels = group
            .map((area) => normalizeLabel(area?.label))
            .filter((label) => !!label)
            .sort((a, b) => {
                if (collator) {
                    return collator.compare(a, b);
                }
                return a.localeCompare(b);
            });
        return labels.join(' | ') || 'Deck area';
    };
    return groups
        .slice()
        .sort((a, b) => {
            const keyA = getGroupKey(a);
            const keyB = getGroupKey(b);
            if (collator) {
                return collator.compare(keyA, keyB);
            }
            return keyA.localeCompare(keyB);
        });
}

function sortEntriesForPdf(entries) {
    if (!Array.isArray(entries)) {
        return [];
    }
    return entries.slice().sort((a, b) => getEntryRenderPriority(a) - getEntryRenderPriority(b));
}

function getEntryRenderPriority(entry) {
    if (!entry) {
        return 0;
    }
    if (entry.type === 'deck-area') {
        return 0;
    }
    if (entry.deckLayer === true || entry.deckLayer === 'true') {
        return 1;
    }
    return 2;
}

function normalizeRotationDegrees(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    let rotation = numeric % 360;
    if (rotation > 180) {
        rotation -= 360;
    } else if (rotation < -180) {
        rotation += 360;
    }
    return rotation;
}

function degreesToRadians(value) {
    return (value * Math.PI) / 180;
}

function rotatePoint(pointX, pointY, centerX, centerY, radians) {
    if (!Number.isFinite(radians) || radians === 0) {
        return { x: pointX, y: pointY };
    }
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const dx = pointX - centerX;
    const dy = pointY - centerY;
    return {
        x: centerX + dx * cos - dy * sin,
        y: centerY + dx * sin + dy * cos,
    };
}

function drawRotatedRect(doc, x, y, width, height, rotationDegrees, style = 'S') {
    const normalized = normalizeRotationDegrees(rotationDegrees);
    if (Math.abs(normalized) < 0.01) {
        doc.rect(x, y, width, height, style);
        return;
    }
    const radians = degreesToRadians(normalized);
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const corners = [
        rotatePoint(x, y, centerX, centerY, radians),
        rotatePoint(x + width, y, centerX, centerY, radians),
        rotatePoint(x + width, y + height, centerX, centerY, radians),
        rotatePoint(x, y + height, centerX, centerY, radians),
    ];
    drawRotatedPolygon(doc, corners, centerX, centerY, 0, style);
}

function drawRotatedPolygon(doc, points, centerX, centerY, rotationDegrees, style = 'S') {
    const normalized = normalizeRotationDegrees(rotationDegrees);
    if (!Array.isArray(points) || points.length < 3) {
        return;
    }
    const radians = Math.abs(normalized) < 0.01 ? 0 : degreesToRadians(normalized);
    const rotatedPoints = radians
        ? points.map((point) => rotatePoint(point.x, point.y, centerX, centerY, radians))
        : points;
    const segments = rotatedPoints.map((point, index) => {
        const next = rotatedPoints[(index + 1) % rotatedPoints.length];
        return [next.x - point.x, next.y - point.y];
    });
    doc.lines(segments, rotatedPoints[0].x, rotatedPoints[0].y, [1, 1], style, true);
}

function drawItemShape(doc, shape, x, y, width, height, rotationDegrees, style = 'FD') {
    const normalizedShape = normalizeItemShape(shape);
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    if (normalizedShape === 'circle') {
        doc.ellipse(centerX, centerY, width / 2, height / 2, style);
        return;
    }
    if (normalizedShape === 'triangle-right') {
        const points = [
            { x, y },
            { x: x + width, y: y + height },
            { x, y: y + height },
        ];
        drawRotatedPolygon(doc, points, centerX, centerY, rotationDegrees, style);
        return;
    }
    if (normalizedShape === 'triangle-equilateral') {
        const points = [
            { x: x + width / 2, y },
            { x, y: y + height },
            { x: x + width, y: y + height },
        ];
        drawRotatedPolygon(doc, points, centerX, centerY, rotationDegrees, style);
        return;
    }
    drawRotatedRect(doc, x, y, width, height, rotationDegrees, style);
}

function drawRotatedTextBlock(doc, lines, centerX, centerY, rotationDegrees, { fontSize, lineHeight } = {}) {
    const safeLines = Array.isArray(lines) && lines.length ? lines : [''];
    const normalizedRotation = normalizeRotationDegrees(rotationDegrees);
    if (Math.abs(normalizedRotation) < 0.01) {
        doc.text(safeLines, centerX, centerY, { align: 'center', baseline: 'middle' });
        return;
    }

    let activeFontSize = Number.isFinite(fontSize) ? fontSize : 10;
    if (!Number.isFinite(fontSize) && typeof doc.getFontSize === 'function') {
        const currentSize = Number(doc.getFontSize());
        if (Number.isFinite(currentSize) && currentSize > 0) {
            activeFontSize = currentSize;
        }
    }
    const safeLineHeightRatio = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 1.2;
    const lineSpacing = activeFontSize * safeLineHeightRatio;
    const totalHeight = lineSpacing * safeLines.length;
    const radians = degreesToRadians(normalizedRotation);

    safeLines.forEach((line, index) => {
        const textWidth = doc.getTextWidth(line || '');
        const localX = -textWidth / 2;
        const localY = -totalHeight / 2 + (index + 0.5) * lineSpacing;
        const { x, y } = rotatePoint(centerX + localX, centerY + localY, centerX, centerY, radians);
        doc.text(line, x, y, { baseline: 'middle' });
    });
}

function getItemLabelBounds(width, height, shape) {
    const padding = 4;
    const baseWidth = Math.max(width - padding, 4);
    const baseHeight = Math.max(height - padding, 4);
    const normalizedShape = normalizeItemShape(shape);
    if (normalizedShape === 'circle') {
        const diameter = Math.min(baseWidth, baseHeight);
        const squareSize = diameter / Math.sqrt(2);
        return { width: squareSize, height: squareSize };
    }
    if (normalizedShape === 'triangle-right') {
        return { width: baseWidth * 0.85, height: baseHeight * 0.6 };
    }
    if (normalizedShape === 'triangle-equilateral') {
        return { width: baseWidth * 0.75, height: baseHeight * 0.55 };
    }
    return { width: baseWidth, height: baseHeight };
}

function buildItemLabelLayout(doc, label, width, height, shape, scale) {
    const bounds = getItemLabelBounds(width, height, shape);
    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : null;
    const mmPerWorkspacePixel = safeScale ? safeScale / PIXELS_PER_METER : null;
    const computedFontSizePt = mmPerWorkspacePixel
        ? (WORKSPACE_ITEM_FONT_SIZE_PX * mmPerWorkspacePixel) / MM_PER_POINT
        : FALLBACK_ITEM_FONT_SIZE_PT;
    const fontSizePt = Math.min(
        Math.max(computedFontSizePt, PDF_ITEM_LABEL_MIN_FONT_SIZE_PT),
        PDF_ITEM_LABEL_MAX_FONT_SIZE_PT
    );
    const paddingMm = mmPerWorkspacePixel
        ? WORKSPACE_ITEM_LABEL_PADDING_PX * mmPerWorkspacePixel
        : WORKSPACE_ITEM_LABEL_PADDING_PX * 0.25;
    const availableWidth = Math.max(bounds.width - paddingMm * 2, bounds.width * 0.25, 2);
    const availableHeight = Math.max(bounds.height - paddingMm * 2, fontSizePt * MM_PER_POINT);
    const safeText = typeof label === 'string' ? label.trim() : '';
    doc.setFontSize(fontSizePt);
    const lines = safeText ? doc.splitTextToSize(safeText, availableWidth) : [];
    const fontSizeMm = fontSizePt * MM_PER_POINT;
    const lineHeightMm = fontSizeMm * WORKSPACE_ITEM_LINE_HEIGHT;
    const maxLines = Math.max(Math.floor(availableHeight / lineHeightMm), 1);
    const trimmedLines = lines.slice(0, maxLines);
    return { lines: trimmedLines, fontSize: fontSizePt, lineHeight: WORKSPACE_ITEM_LINE_HEIGHT };
}

function fitTextWithinRect(doc, text, width, height, { maxFontSize = 10, minFontSize = 6, lineHeight = 1.2 } = {}) {
    const safeText = typeof text === 'string' ? text.trim() : '';
    const safeLineHeight = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 1.2;
    if (!safeText) {
        return { lines: [], fontSize: minFontSize, lineHeight: safeLineHeight };
    }
    const safeWidth = Math.max(width - 2, 4);
    const safeHeight = Math.max(height - 2, minFontSize);
    let fontSize = maxFontSize;
    let lines = [];
    while (fontSize >= minFontSize) {
        doc.setFontSize(fontSize);
        lines = doc.splitTextToSize(safeText, safeWidth);
        const totalHeight = lines.length * fontSize * safeLineHeight;
        if (totalHeight <= safeHeight || fontSize === minFontSize) {
            return { lines, fontSize, lineHeight: safeLineHeight };
        }
        fontSize = Math.max(fontSize - 0.5, minFontSize);
    }
    return { lines, fontSize: minFontSize, lineHeight: safeLineHeight };
}

const PDF_FIRST_PAGE_BANNER_HEIGHT = 14;

function formatDeckBannerTimestamp(date = new Date()) {
    const pad = (value) => String(value).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function drawDeckPdfBanner(doc, { deckName, timestamp, orientation } = {}) {
    const safeDeckName = typeof deckName === 'string' && deckName.trim() ? deckName.trim() : 'Deck';
    const safeTimestamp = typeof timestamp === 'string' && timestamp.trim() ? timestamp.trim() : formatDeckBannerTimestamp();
    const pageOrientation = orientation || 'portrait';
    const { width: pageWidth } = getA4Dimensions(pageOrientation);
    const bannerHeight = PDF_FIRST_PAGE_BANNER_HEIGHT;
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, bannerHeight, 'F');
    const margin = 12;
    const centerY = bannerHeight / 2;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(safeDeckName, margin, centerY, { baseline: 'middle' });
    doc.setFontSize(11);
    doc.text(safeTimestamp, pageWidth - margin, centerY, { align: 'right', baseline: 'middle' });
    return bannerHeight;
}

function renderDeckOnPdf(
    doc,
    deck,
    entries,
    { bounds, orientation, title, hideItemLabels = false, topOffset = 0, suppressPageTitle = false } = {}
) {
    const deckName = deck?.name || 'Deck';
    const safeBounds = bounds || getDeckBounds(entries);
    const pageOrientation = orientation || determineDeckPageOrientation(safeBounds);
    const { width: pageWidth, height: pageHeight } = getA4Dimensions(pageOrientation);
    const margin = 12;
    const safeTopOffset = Number.isFinite(topOffset) ? Math.max(topOffset, 0) : 0;
    const headerY = margin + safeTopOffset;
    const headerHeight = suppressPageTitle ? 0 : 6;
    const drawingTop = headerY + headerHeight;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - drawingTop - margin;
    const deckWidth = Math.max(safeBounds.width, 0.5);
    const deckHeight = Math.max(safeBounds.height, 0.5);
    const scale = Math.min(usableWidth / deckWidth, usableHeight / deckHeight);
    const offsetX = margin;
    const offsetY = drawingTop;

    const pageTitle = typeof title === 'string' && title.trim() ? title.trim() : deckName;
    if (!suppressPageTitle) {
        doc.setFontSize(16);
        doc.setTextColor(15, 23, 42);
        doc.text(pageTitle, margin, headerY);
    }

    const sortedEntries = sortEntriesForPdf(entries);

    if (!sortedEntries.length) {
        doc.setFontSize(12);
        doc.text('No layout data for this deck yet.', margin, headerY + 8);
        return;
    }

    sortedEntries.forEach((entry) => {
        const xMeters = (Number(entry.x) || 0) / PIXELS_PER_METER;
        const yMeters = (Number(entry.y) || 0) / PIXELS_PER_METER;
        const widthMeters = Number(entry.width) || DEFAULT_ITEM_WIDTH_METERS;
        const heightMeters = Number(entry.height) || DEFAULT_ITEM_HEIGHT_METERS;
        const x = offsetX + (xMeters - safeBounds.minX) * scale;
        const y = offsetY + (yMeters - safeBounds.minY) * scale;
        const width = widthMeters * scale;
        const height = heightMeters * scale;
        const label = entry.label || (entry.type === 'deck-area' ? 'Deck area' : 'Item');
        const rotationDegrees = normalizeRotationDegrees(entry.rotation);
        const hasRotation = Math.abs(rotationDegrees) > 0.01;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        if (entry.type === 'deck-area') {
            doc.setFont('helvetica', 'normal');
            doc.setFillColor(241, 245, 249);
            doc.setDrawColor(15, 23, 42);
            drawRotatedRect(doc, x, y, width, height, rotationDegrees, 'FD');
            doc.setTextColor(15, 23, 42);
            const deckTextLayout = fitTextWithinRect(doc, label, width, height, {
                maxFontSize: 11,
                minFontSize: 6,
            });
            doc.setFontSize(deckTextLayout.fontSize);
            const deckLines = deckTextLayout.lines.length ? deckTextLayout.lines : [''];
            if (hasRotation) {
                drawRotatedTextBlock(doc, deckLines, centerX, centerY, rotationDegrees, {
                    fontSize: deckTextLayout.fontSize,
                    lineHeight: deckTextLayout.lineHeight,
                });
            } else {
                doc.text(deckLines, centerX, centerY, { align: 'center', baseline: 'middle' });
            }
        } else {
            const { r, g, b } = hexToRgb(entry.color || '#3a7afe');
            doc.setFillColor(r, g, b);
            doc.setDrawColor(15, 23, 42);
            drawItemShape(doc, entry.shape, x, y, width, height, rotationDegrees, 'FD');
            if (!hideItemLabels) {
                doc.setFont('helvetica', 'bold');
                const textColor = isColorDark(entry.color || '#3a7afe') ? 255 : 15;
                doc.setTextColor(textColor, textColor, textColor);
                const itemTextLayout = buildItemLabelLayout(doc, label, width, height, entry.shape, scale);
                doc.setFontSize(itemTextLayout.fontSize);
                const itemText = itemTextLayout.lines.length ? itemTextLayout.lines : [''];
                drawRotatedTextBlock(doc, itemText, centerX, centerY, rotationDegrees, {
                    fontSize: itemTextLayout.fontSize,
                    lineHeight: itemTextLayout.lineHeight,
                });
            }
        }
    });

    const deckAreas = sortedEntries.filter((entry) => entry.type === 'deck-area');
    drawDeckAreaConnections(doc, deckAreas, safeBounds, scale, offsetX, offsetY);
}

function renderItemsSummaryTable(doc, rows, shouldStartOnNewPage) {
    const tableRows = Array.isArray(rows) ? rows : [];
    if (shouldStartOnNewPage) {
        doc.addPage('a4', 'portrait');
    }
    const orientation = 'portrait';
    const { width: pageWidth, height: pageHeight } = getA4Dimensions(orientation);
    const margin = 12;
    const tableWidth = pageWidth - margin * 2;
    const itemWidth = 38;
    const locationWidth = 58;
    const lastModifiedWidth = 32;
    const commentWidth = Math.max(tableWidth - itemWidth - locationWidth - lastModifiedWidth, 40);
    const headerHeight = 8;
    let cursorY = margin;
    const bodyFontSizePt = PDF_TABLE_BODY_FONT_SIZE_PT;
    const bodyFontSizeMm = bodyFontSizePt * MM_PER_POINT;
    const bodyLineHeightMm = bodyFontSizeMm * PDF_TABLE_BODY_LINE_HEIGHT;

    const drawHeader = (title) => {
        doc.setFontSize(16);
        doc.setTextColor(15, 23, 42);
        doc.text(title, margin, cursorY);
        cursorY += 4;
        doc.setFillColor(226, 232, 240);
        doc.rect(margin, cursorY, tableWidth, headerHeight, 'F');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text('Item', margin + 2, cursorY + 5);
        doc.text('Location', margin + itemWidth + 2, cursorY + 5);
        doc.text('Last modified', margin + itemWidth + locationWidth + 2, cursorY + 5);
        doc.text('Comment', margin + itemWidth + locationWidth + lastModifiedWidth + 2, cursorY + 5);
        cursorY += headerHeight + 2;
    };

    drawHeader('Item summary');

    if (!tableRows.length) {
        doc.setFontSize(11);
        doc.setTextColor(100, 116, 139);
        doc.text('No items available yet.', margin, cursorY + 6);
        return;
    }

    tableRows.forEach((row, index) => {
        const itemText = doc.splitTextToSize(row.itemLabel, itemWidth - 2);
        const locationText = doc.splitTextToSize(row.locationLabel, locationWidth - 2);
        const safeComment = typeof row.comment === 'string' && row.comment.trim() ? row.comment.trim() : '—';
        const commentText = doc.splitTextToSize(safeComment, commentWidth - 2);
        const rowLines = Math.max(itemText.length, locationText.length, commentText.length, 1);
        const rowHeight =
            PDF_TABLE_ROW_TOP_PADDING_MM + rowLines * bodyLineHeightMm + PDF_TABLE_ROW_BOTTOM_PADDING_MM;
        if (cursorY + rowHeight > pageHeight - margin) {
            doc.addPage('a4', 'portrait');
            cursorY = margin;
            drawHeader('Item summary (cont.)');
        }
        doc.setFontSize(bodyFontSizePt);
        doc.setTextColor(15, 23, 42);
        const textTop = cursorY + PDF_TABLE_ROW_TOP_PADDING_MM;
        doc.text(itemText, margin + 1, textTop, { baseline: 'top' });
        doc.text(locationText, margin + itemWidth + 1, textTop, { baseline: 'top' });
        doc.text(formatTableDate(row.lastModified) || '—', margin + itemWidth + locationWidth + 1, textTop, {
            baseline: 'top',
        });
        doc.text(commentText, margin + itemWidth + locationWidth + lastModifiedWidth + 1, textTop, {
            baseline: 'top',
        });
        cursorY += rowHeight;
        if (index < tableRows.length - 1) {
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.2);
            doc.line(margin, cursorY, margin + tableWidth, cursorY);
        }
    });
}

function normalizeAttachmentEntry(attachment) {
    if (!attachment || typeof attachment !== 'object') {
        return null;
    }
    const id =
        typeof attachment.id === 'string' && attachment.id.trim()
            ? attachment.id.trim()
            : generateAttachmentId();
    const name = typeof attachment.name === 'string' ? attachment.name : 'Attachment';
    const type = typeof attachment.type === 'string' ? attachment.type : '';
    const size = Number.isFinite(Number(attachment.size)) ? Number(attachment.size) : 0;
    const dataUrl = typeof attachment.dataUrl === 'string' ? attachment.dataUrl : '';
    const addedAt =
        typeof attachment.addedAt === 'string' && attachment.addedAt.trim()
            ? attachment.addedAt
            : new Date().toISOString();
    return { id, name, type, size, dataUrl, addedAt };
}

function normalizeWorkspaceLayoutEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        return null;
    }
    const type = entry.type === 'deck-area' ? 'deck-area' : 'item';
    const labelSource = typeof entry.label === 'string' ? entry.label.trim() : '';
    const label = labelSource || (type === 'deck-area' ? 'Deck area' : 'Item');
    const rawWidth = Number.parseFloat(entry.width);
    const rawHeight = Number.parseFloat(entry.height);
    const rawX = Number.parseFloat(entry.x);
    const rawY = Number.parseFloat(entry.y);
    const rawRotation = Number.parseFloat(entry.rotation);
    const width = Number.isFinite(rawWidth) ? clampToMinSize(rawWidth) : DEFAULT_ITEM_WIDTH_METERS;
    const height = Number.isFinite(rawHeight) ? clampToMinSize(rawHeight) : DEFAULT_ITEM_HEIGHT_METERS;
    const normalized = {
        type,
        label,
        width,
        height,
        x: Number.isFinite(rawX) ? rawX : 0,
        y: Number.isFinite(rawY) ? rawY : 0,
        rotation: Number.isFinite(rawRotation) ? rawRotation : 0,
        locked: entry.locked === true || entry.locked === 'true',
    };
    if (type === 'item') {
        const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : generateItemId();
        const color =
            typeof entry.color === 'string' && entry.color.trim()
                ? entry.color.trim()
                : '#3a7afe';
        normalized.color = color;
        normalized.shape = normalizeItemShape(entry.shape);
        normalized.deckLayer = entry.deckLayer === true || entry.deckLayer === 'true';
        normalized.comment = typeof entry.comment === 'string' ? entry.comment : '';
        normalized.id = id;
        const attachmentsSource = Array.isArray(entry.attachments) ? entry.attachments : [];
        normalized.attachments = attachmentsSource
            .map((attachment) => normalizeAttachmentEntry(attachment))
            .filter((value) => value !== null);
        const historySource = Array.isArray(entry.history) ? entry.history : [];
        normalized.history = historySource
            .map((record) => normalizeHistoryRecord(record))
            .filter((value) => value !== null);
        if (typeof entry.lastModified === 'string' && entry.lastModified.trim()) {
            const parsed = new Date(entry.lastModified);
            if (!Number.isNaN(parsed.getTime())) {
                normalized.lastModified = parsed.toISOString();
            }
        }
        if (!normalized.lastModified && normalized.history && normalized.history.length) {
            normalized.lastModified = normalized.history[0].timestamp;
        }
        if (!normalized.lastModified) {
            normalized.lastModified = new Date().toISOString();
        }
    } else {
        normalized.nameHidden = entry.nameHidden === true || entry.nameHidden === 'true';
    }
    return normalized;
}

function loadWorkspaceLayout(entries, { recordHistory = false } = {}) {
    if (!Array.isArray(entries)) {
        return;
    }
    isLoadingWorkspace = true;
    try {
        const deckAreas = [];
        const items = [];
        entries.forEach((entry) => {
            if (!entry || typeof entry !== 'object') {
                return;
            }
            if (entry.type === 'deck-area') {
                deckAreas.push(entry);
            } else {
                items.push(entry);
            }
        });

        const removable = Array.from(workspaceContent.querySelectorAll('.item, .deck-area'));
        removable.forEach((element) => {
            if (element.dataset.type === 'item') {
                removeItemRecord(element);
            }
            element.remove();
        });

        itemMetadata.clear();
        itemHistories.clear();

        const instantiate = (data) => {
            const normalized = normalizeWorkspaceLayoutEntry(data);
            if (!normalized) {
                return null;
            }
            const element = createItemElement(
                {
                    width: normalized.width,
                    height: normalized.height,
                    label: normalized.label,
                    color: normalized.type === 'item' ? normalized.color : '#ffffff',
                    type: normalized.type,
                    shape: normalized.shape,
                    deckLayer: normalized.deckLayer,
                },
                { skipHistory: true, skipMetadata: true, autoPosition: false }
            );
            element.dataset.x = normalized.x.toString();
            element.dataset.y = normalized.y.toString();
            element.dataset.rotation = normalized.rotation.toString();
            element.dataset.width = normalized.width.toString();
            element.dataset.height = normalized.height.toString();
            element.style.width = `${metersToPixels(normalized.width)}px`;
            element.style.height = `${metersToPixels(normalized.height)}px`;
            updateElementTransform(element);

            if (normalized.type === 'item') {
                element.style.background = normalized.color;
                element.dataset.comment = normalized.comment || '';
                element.dataset.locked = normalized.locked ? 'true' : 'false';
                element.classList.toggle('locked', normalized.locked);
                element.dataset.itemId = normalized.id;
                const parsedLastModified = new Date(normalized.lastModified);
                const lastModifiedDate = Number.isNaN(parsedLastModified.getTime())
                    ? new Date()
                    : parsedLastModified;
                const metadata = {
                    id: normalized.id,
                    element,
                    label: getItemLabel(element),
                    deck: determineDeckForItem(element),
                    lastModified: lastModifiedDate,
                    comment: (element.dataset.comment || '').trim(),
                    attachments: Array.isArray(normalized.attachments)
                        ? normalized.attachments.map((attachment) => ({ ...attachment }))
                        : [],
                };
                itemMetadata.set(normalized.id, metadata);
                const historyEvents = Array.isArray(normalized.history)
                    ? normalized.history
                          .map((record) => historyRecordToEvent(record))
                          .filter((value) => value !== null)
                    : [];
                itemHistories.set(normalized.id, historyEvents.slice(0, 50));
                updateAttachmentIndicator(element);
            } else {
                element.dataset.label = normalized.label;
                const nameEl = element.querySelector('.deck-name');
                if (nameEl) {
                    nameEl.textContent = normalized.label;
                    nameEl.style.display = normalized.nameHidden ? 'none' : '';
                }
                element.dataset.nameHidden = normalized.nameHidden ? 'true' : 'false';
                element.classList.toggle('name-hidden', normalized.nameHidden);
                setDeckLockState(element, normalized.locked);
            }
            delete element.dataset.autolocked;
            return element;
        };

        [...deckAreas].reverse().forEach((entry) => {
            instantiate(entry);
        });
        items.forEach((entry) => {
            instantiate(entry);
        });

        if (recordHistory) {
            addHistoryEntry('Workspace layout imported');
        }
        refreshItemList();

        if (deckModifyMode) {
            releaseAutolockedDeckAreas();
        } else {
            enforceDeckAreaLocks();
        }
    } finally {
        isLoadingWorkspace = false;
    }
}

function handleCreatePlanningJob() {
    if (!planningState.active) {
        alert('Enter planning mode before creating a planning deck.');
        return;
    }
    if (!currentDeck) {
        alert('Select a deck before creating a planning deck.');
        return;
    }
    const jobs = getCurrentDeckJobs();
    const defaultLabel = generatePlanningJobLabel(jobs);
    const inputLabel = prompt('Name your new planning deck', defaultLabel);
    if (inputLabel === null) {
        return;
    }
    const label = inputLabel.trim() ? inputLabel.trim() : defaultLabel;
    const duplicateItems = confirm(
        'Duplicate current items into this planning deck?\nSelect OK to duplicate, or Cancel to start blank.'
    );
    persistCurrentPlanningJob();
    const items = duplicateItems ? serializeWorkspaceItemsForPlanning() : [];
    const job = {
        id: generatePlanningJobId(),
        label,
        deck: { items },
    };
    jobs.push(job);
    planningState.activeJobIds.clear();
    planningState.activeJobIds.add(job.id);
    setPlanningEditingJob(job.id);
    touchCurrentDeckTimestamp();
    saveDecks();
    renderPlanningJobs();
    persistPlanningPreferencesForCurrentDeck();
}

const workspaceState = {
    scale: BASE_SCALE,
    translateX: 0,
    translateY: 0,
};

function calculateCenteredPosition(widthMeters, heightMeters) {
    const widthPx = metersToPixels(widthMeters);
    const heightPx = metersToPixels(heightMeters);
    const containerRect =
        workspaceContainer && typeof workspaceContainer.getBoundingClientRect === 'function'
            ? workspaceContainer.getBoundingClientRect()
            : null;
    const contentRect =
        workspaceContent && typeof workspaceContent.getBoundingClientRect === 'function'
            ? workspaceContent.getBoundingClientRect()
            : null;
    const scale = Number.isFinite(workspaceState.scale) && workspaceState.scale !== 0
        ? workspaceState.scale
        : BASE_SCALE;

    if (containerRect && contentRect && Number.isFinite(scale) && scale !== 0) {
        const centerX = containerRect.left + containerRect.width / 2;
        const centerY = containerRect.top + containerRect.height / 2;
        const workspaceCenterX = (centerX - contentRect.left) / scale;
        const workspaceCenterY = (centerY - contentRect.top) / scale;
        if (Number.isFinite(workspaceCenterX) && Number.isFinite(workspaceCenterY)) {
            return {
                x: workspaceCenterX - widthPx / 2,
                y: workspaceCenterY - heightPx / 2,
            };
        }
    }

    const computedStyle = workspaceContent ? getComputedStyle(workspaceContent) : null;
    const contentWidth =
        (workspaceContent && workspaceContent.offsetWidth) ||
        (computedStyle ? Number.parseFloat(computedStyle.width) : widthPx) ||
        widthPx;
    const contentHeight =
        (workspaceContent && workspaceContent.offsetHeight) ||
        (computedStyle ? Number.parseFloat(computedStyle.height) : heightPx) ||
        heightPx;
    return {
        x: (contentWidth - widthPx) / 2,
        y: (contentHeight - heightPx) / 2,
    };
}

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
    if (isPlanningItem(element)) {
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
    if (isPlanningItem(element)) {
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
    if (isPlanningItem(element)) {
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
    if (!isLoadingWorkspace) {
        scheduleWorkspaceSave();
    }
}

function updateItemRecord(element, message, { updateComment = true, updateDeck = true } = {}) {
    if (!element || element.dataset.type !== 'item') {
        return;
    }
    if (isPlanningItem(element)) {
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
    if (!isLoadingWorkspace) {
        scheduleWorkspaceSave();
    }
}

function removeItemRecord(element) {
    if (!element || element.dataset.type !== 'item') {
        return;
    }
    if (isPlanningItem(element)) {
        return;
    }
    const itemId = element.dataset.itemId;
    if (!itemId) {
        return;
    }
    itemMetadata.delete(itemId);
    itemHistories.delete(itemId);
    refreshItemList();
    if (!isLoadingWorkspace) {
        scheduleWorkspaceSave();
    }
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
    let items = Array.from(itemMetadata.values()).filter((item) => item && item.element);

    const planningActive = planningState.active;
    if (planningActive) {
        const allowedPlanningJobIds = new Set(planningState.activeJobIds);
        if (planningState.editingJobId) {
            allowedPlanningJobIds.add(planningState.editingJobId);
        }
        items = items.filter((item) => {
            const planningJobId = item.element?.dataset?.planningJobId;
            if (!planningJobId) {
                return false;
            }
            return allowedPlanningJobIds.has(planningJobId);
        });
    } else {
        items = items.filter((item) => !isPlanningItem(item.element));
    }

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

        const element = item.element;
        const planningJobId = element?.dataset?.planningJobId;
        const currentDeck = determineDeckForItem(element) || item.deck || null;
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
        let deckLabel = 'Unassigned';
        if (planningJobId) {
            const job = getPlanningJob(planningJobId);
            deckLabel = job ? `Planning: ${job.label}` : 'Planning deck';
        } else if (currentDeck) {
            if (typeof currentDeck === 'string') {
                deckLabel = currentDeck;
            } else if (currentDeck?.name) {
                deckLabel = currentDeck.name;
            } else if (currentDeck?.label) {
                deckLabel = currentDeck.label;
            }
        }
        deckEl.textContent = `Deck: ${deckLabel}`;

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

function loadPendingOperations() {
    try {
        const raw = localStorage.getItem(PENDING_OPS_STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .map((entry) => ({
                version: Number(entry?.version) || 0,
                timestamp: Number(entry?.timestamp) || Date.now(),
                state: entry?.state && typeof entry.state === 'object' ? entry.state : null,
            }))
            .filter((entry) => entry.version > 0 && entry.state && Array.isArray(entry.state.decks));
    } catch (error) {
        console.warn('Failed to load pending deck operations', error);
        return [];
    }
}

function persistPendingOperations() {
    try {
        if (!pendingOperations.length) {
            localStorage.removeItem(PENDING_OPS_STORAGE_KEY);
            return;
        }
        localStorage.setItem(
            PENDING_OPS_STORAGE_KEY,
            JSON.stringify(
                pendingOperations.map((entry) => ({
                    version: entry.version,
                    timestamp: entry.timestamp,
                    state: entry.state,
                }))
            )
        );
    } catch (error) {
        console.warn('Failed to persist pending deck operations', error);
    }
}

function getLatestPendingVersion() {
    if (!pendingOperations.length) {
        return lastKnownVersion || 0;
    }
    const lastEntry = pendingOperations[pendingOperations.length - 1];
    return Number(lastEntry?.version) || lastKnownVersion || 0;
}

function enqueuePendingOperation() {
    if (!Array.isArray(decks) || !decks.length) {
        return;
    }
    const nextVersion = getLatestPendingVersion() + 1;
    const timestamp = Date.now();
    lastMutationTimestamp = timestamp;
    const payload = getSerializableState();
    payload.version = nextVersion;
    payload.mutationTimestamp = lastMutationTimestamp;
    const entry = {
        version: nextVersion,
        timestamp,
        state: payload,
    };
    pendingOperations.push(entry);
    pendingStateVersion = entry.version;
    persistPendingOperations();
}

function clearPendingOperationsThrough(version) {
    if (!Number.isFinite(version)) {
        return;
    }
    const targetVersion = Number(version);
    const nextQueue = pendingOperations.filter((entry) => Number(entry.version) > targetVersion);
    const didChange = nextQueue.length !== pendingOperations.length;
    pendingOperations = nextQueue;
    if (didChange) {
        persistPendingOperations();
    }
    pendingStateVersion = pendingOperations.length
        ? pendingOperations[pendingOperations.length - 1].version
        : null;
}

function loadDecks({ pendingOperationsSnapshot } = {}) {
    const snapshot = Array.isArray(pendingOperationsSnapshot)
        ? pendingOperationsSnapshot
        : [];
    if (snapshot.length) {
        const latest = snapshot[snapshot.length - 1];
        const pendingState = latest?.state;
        if (pendingState && Array.isArray(pendingState.decks) && pendingState.decks.length) {
            const derivedVersion = Number(pendingState.version ?? latest.version);
            if (Number.isFinite(derivedVersion)) {
                lastKnownVersion = derivedVersion;
            }
            const derivedTimestamp = Number(
                pendingState.mutationTimestamp ?? latest.timestamp ?? Date.now()
            );
            if (Number.isFinite(derivedTimestamp) && derivedTimestamp > 0) {
                lastMutationTimestamp = derivedTimestamp;
            }
            return pendingState.decks.map((entry) => normalizeDeckEntry(entry));
        }
    }
    const initialState = window.__INITIAL_STATE__;
    if (initialState && Array.isArray(initialState.decks) && initialState.decks.length) {
        const normalized = initialState.decks.map((entry) => normalizeDeckEntry(entry));
        if (Number.isFinite(Number(initialState.version))) {
            lastKnownVersion = Number(initialState.version);
        }
        if (Number.isFinite(Number(initialState.mutationTimestamp))) {
            lastMutationTimestamp = Number(initialState.mutationTimestamp);
        }
        return normalized;
    }
    return defaultDecks.map((name) => createDeckRecord(name));
}

function saveDecks() {
    enqueuePendingOperation();
    queueStateSync();
}

function getSerializableState() {
    return {
        version: lastKnownVersion,
        decks: Array.isArray(decks) ? decks.map((deck) => deckToSerializable(deck)) : [],
        mutationTimestamp: lastMutationTimestamp,
    };
}

function queueStateSync({ immediate = false } = {}) {
    if (isApplyingRemoteState) {
        return;
    }
    if (!pendingOperations.length) {
        return;
    }
    if (immediate) {
        if (stateSyncTimer) {
            clearTimeout(stateSyncTimer);
            stateSyncTimer = null;
        }
        syncStateWithServer();
        return;
    }
    if (stateSyncTimer) {
        clearTimeout(stateSyncTimer);
    }
    stateSyncTimer = setTimeout(() => {
        stateSyncTimer = null;
        syncStateWithServer();
    }, STATE_SYNC_DEBOUNCE_MS);
}

function scheduleStateSyncRetry() {
    if (stateSyncTimer) {
        return;
    }
    stateSyncTimer = setTimeout(() => {
        stateSyncTimer = null;
        syncStateWithServer();
    }, STATE_SYNC_RETRY_INTERVAL_MS);
}

async function syncStateWithServer() {
    if (isApplyingRemoteState) {
        return;
    }
    if (!pendingOperations.length) {
        return;
    }
    const snapshot = pendingOperations[pendingOperations.length - 1];
    const payload = snapshot?.state
        ? {
              version: snapshot.version,
              decks: Array.isArray(snapshot.state.decks) ? snapshot.state.decks : [],
          }
        : null;
    if (!payload) {
        return;
    }
    try {
        const response = await fetch(API_STATE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }
        const result = await response.json();
        applyStateFromServer(result, { replaceWorkspace: false, force: true });
    } catch (error) {
        console.error('Failed to sync decks with server', error);
        scheduleStateSyncRetry();
    }
}

function performWorkspaceSave() {
    if (!currentDeck) {
        return;
    }
    const layout = serializeWorkspaceElements();
    currentDeck.layout = layout;
    const updatedAt = Date.now();
    currentDeck.updatedAt = updatedAt;
    const target = decks.find((deck) => deck.id === currentDeck.id);
    if (target) {
        target.layout = layout;
        target.updatedAt = updatedAt;
    }
    enqueuePendingOperation();
    queueStateSync();
}

function scheduleWorkspaceSave({ immediate = false } = {}) {
    if (isLoadingWorkspace || isApplyingRemoteState || !currentDeck) {
        return;
    }
    if (immediate) {
        if (workspaceSaveTimer) {
            clearTimeout(workspaceSaveTimer);
            workspaceSaveTimer = null;
        }
        performWorkspaceSave();
        return;
    }
    if (workspaceSaveTimer) {
        clearTimeout(workspaceSaveTimer);
    }
    workspaceSaveTimer = setTimeout(() => {
        workspaceSaveTimer = null;
        performWorkspaceSave();
    }, 200);
}

function applyStateFromServer(nextState, { replaceWorkspace = true, force = false } = {}) {
    if (!nextState || !Array.isArray(nextState.decks)) {
        return;
    }
    const nextVersion = Number(nextState.version) || 0;
    if (
        !force &&
        nextVersion &&
        pendingStateVersion !== null &&
        Number(nextVersion) < Number(pendingStateVersion)
    ) {
        return;
    }
    if (!force && nextVersion && nextVersion <= lastKnownVersion) {
        return;
    }
    const previousDeckId = currentDeck?.id || null;
    isApplyingRemoteState = true;
    decks = nextState.decks.map((entry) => normalizeDeckEntry(entry));
    if (nextVersion) {
        lastKnownVersion = nextVersion;
        clearPendingOperationsThrough(nextVersion);
    }
    const incomingMutationTimestamp = Number(nextState.mutationTimestamp);
    if (Number.isFinite(incomingMutationTimestamp) && incomingMutationTimestamp > 0) {
        lastMutationTimestamp = incomingMutationTimestamp;
    }
    renderDeckList();
    if (previousDeckId) {
        const updatedDeck = decks.find((deck) => deck.id === previousDeckId);
        if (updatedDeck) {
            currentDeck = updatedDeck;
            if (replaceWorkspace) {
                history = [];
                loadWorkspaceLayout(Array.isArray(currentDeck.layout) ? currentDeck.layout : []);
            }
        } else {
            goBackToSelection();
        }
    }
    renderPlanningJobs();
    refreshItemList();
    isApplyingRemoteState = false;
}

async function fetchLatestState() {
    try {
        const response = await fetch(API_STATE_ENDPOINT);
        if (!response.ok) {
            return;
        }
        const payload = await response.json();
        applyStateFromServer(payload, { replaceWorkspace: Boolean(currentDeck), force: true });
    } catch (error) {
        console.error('Failed to fetch latest state', error);
    }
}

function connectRealtime() {
    if (typeof io !== 'function') {
        console.warn('Realtime collaboration requires socket.io.');
        return;
    }
    const socketUrl =
        typeof window.__SOCKET_URL__ === 'string' && window.__SOCKET_URL__.trim()
            ? window.__SOCKET_URL__
            : undefined;
    socket = io(socketUrl, { transports: ['websocket', 'polling'] });
    socket.on('state:init', (payload) => {
        applyStateFromServer(payload, { replaceWorkspace: true, force: true });
    });
    socket.on('state:update', (payload) => {
        const incomingVersion = Number(payload?.version);
        if (pendingStateVersion !== null && Number.isFinite(incomingVersion) && incomingVersion === pendingStateVersion) {
            return;
        }
        applyStateFromServer(payload, { replaceWorkspace: true });
    });
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
    if (currentDeck) {
        persistPlanningPreferencesForCurrentDeck();
    }
    setDeckModifyMode(false);
    closeDeckSettingsPanel();
    currentDeck = selectedDeck;
    deactivateMeasureMode();
    planningState.activeJobIds.clear();
    planningState.showCurrentDeck = true;
    planningState.lockCurrentDeck = false;
    planningState.editingJobId = null;
    const selectionValue =
        typeof currentDeck.id === 'string' && currentDeck.id
            ? currentDeck.id
            : currentDeck.name;
    if (selectionValue) {
        localStorage.setItem(selectedDeckKey, selectionValue);
    }
    deckSelectionView.classList.remove('active');
    workspaceView.classList.add('active');
    history = [];
    workspaceContent.innerHTML = '';
    clearPlanningEditingLayer();
    ensureMeasurementOverlay();
    ensurePlanningEditingLayer();
    ensurePlanningOverlayHost();
    clearPlanningOverlays();
    clearMeasurements();
    itemMetadata.clear();
    itemHistories.clear();
    loadWorkspaceLayout(Array.isArray(currentDeck.layout) ? currentDeck.layout : []);
    workspaceState.scale = BASE_SCALE;
    workspaceState.translateX = 0;
    workspaceState.translateY = 0;
    applyWorkspaceTransform();
    restorePlanningPreferencesForDeck(currentDeck);
    closeToolsMenu();
    renderPlanningJobs();
}

function goBackToSelection() {
    if (currentDeck) {
        persistPlanningPreferencesForCurrentDeck();
    }
    currentDeck = null;
    deactivateMeasureMode();
    planningState.activeJobIds.clear();
    planningState.showCurrentDeck = true;
    planningState.lockCurrentDeck = false;
    planningState.editingJobId = null;
    localStorage.removeItem(selectedDeckKey);
    deckSelectionView.classList.add('active');
    workspaceView.classList.remove('active');
    clearPlanningEditingLayer();
    renderPlanningJobs();
    setDeckModifyMode(false);
    closeDeckSettingsPanel();
    closeToolsMenu();
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

function ensureDeckAreaGuideElements(element) {
    if (!element || element.dataset.type !== 'deck-area') {
        return null;
    }
    let container = element.querySelector('.deck-area-guides');
    if (!container) {
        container = document.createElement('div');
        container.className = 'deck-area-guides';

        const widthGuide = document.createElement('div');
        widthGuide.className = 'deck-area-guide deck-area-guide-width';
        const widthLabel = document.createElement('span');
        widthLabel.className = 'deck-area-guide-label';
        widthGuide.appendChild(widthLabel);

        const heightGuide = document.createElement('div');
        heightGuide.className = 'deck-area-guide deck-area-guide-height';
        const heightLabel = document.createElement('span');
        heightLabel.className = 'deck-area-guide-label';
        heightGuide.appendChild(heightLabel);

        container.append(widthGuide, heightGuide);
        element.appendChild(container);
    }
    return container;
}

function updateDeckAreaResizeGuides(element) {
    if (!element || element.dataset.type !== 'deck-area') {
        return;
    }
    const container = ensureDeckAreaGuideElements(element);
    if (!container) {
        return;
    }
    const width = Number.parseFloat(element.dataset.width);
    const height = Number.parseFloat(element.dataset.height);
    const widthLabel = container.querySelector('.deck-area-guide-width .deck-area-guide-label');
    const heightLabel = container.querySelector('.deck-area-guide-height .deck-area-guide-label');
    if (widthLabel) {
        const formattedWidth = Number.isFinite(width) ? width.toFixed(2) : '0.00';
        widthLabel.textContent = `${formattedWidth} m`;
    }
    if (heightLabel) {
        const formattedHeight = Number.isFinite(height) ? height.toFixed(2) : '0.00';
        heightLabel.textContent = `${formattedHeight} m`;
    }
}

function showDeckAreaResizeGuides(element) {
    if (!element || element.dataset.type !== 'deck-area') {
        return;
    }
    ensureDeckAreaGuideElements(element);
    updateDeckAreaResizeGuides(element);
    element.classList.add('show-resize-guides');
}

function hideDeckAreaResizeGuides(element) {
    if (!element || element.dataset.type !== 'deck-area') {
        return;
    }
    element.classList.remove('show-resize-guides');
}

function createItemElement(
    { width, height, label, color, type = 'item', shape = 'rectangle', deckLayer = false },
    options = {}
) {
    const {
        skipHistory = false,
        skipMetadata = false,
        container = workspaceContent,
        autoPosition = true,
    } = options;
    const element = document.createElement('div');
    element.className = type;
    element.dataset.type = type;
    element.dataset.rotation = '0';
    element.dataset.width = width.toString();
    element.dataset.height = height.toString();
    element.dataset.locked = 'false';
    element.dataset.comment = '';
    element.style.width = `${metersToPixels(width)}px`;
    element.style.height = `${metersToPixels(height)}px`;
    const centeredPosition = autoPosition ? calculateCenteredPosition(width, height) : null;
    const initialX = centeredPosition && Number.isFinite(centeredPosition.x) ? centeredPosition.x : 0;
    const initialY = centeredPosition && Number.isFinite(centeredPosition.y) ? centeredPosition.y : 0;
    element.dataset.x = initialX.toFixed(2);
    element.dataset.y = initialY.toFixed(2);
    if (type === 'item') {
        element.style.background = color;
        element.textContent = label || 'New item';
        applyItemShapeStyles(element, shape);
        element.dataset.deckLayer = deckLayer ? 'true' : 'false';
        applyItemDeckLayerStyles(element);
        if (!skipMetadata) {
            updateAttachmentIndicator(element);
        } else {
            element.dataset.hasAttachments = 'false';
        }
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
        if (container === workspaceContent) {
            container.insertBefore(element, container.firstChild);
        } else {
            container.appendChild(element);
        }
    } else {
        container.appendChild(element);
    }
    if (!skipHistory) {
        addHistoryEntry(creationMessage);
    }
    if (type === 'item' && !skipMetadata) {
        registerItem(element, skipHistory ? null : creationMessage);
    }
    return element;
}

function setupItemInteractions(element, resizeHandle) {
    let pointerId = null;
    let action = null;
    let start = {};
    let longPressTimer = null;
    let longPressTriggered = false;
    let lastPointerPosition = { x: 0, y: 0 };

    const clearLongPressTimer = () => {
        if (longPressTimer !== null) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };

    const releasePointerCaptureSafely = () => {
        if (pointerId === null) {
            return;
        }
        try {
            if (typeof element.hasPointerCapture === 'function') {
                if (element.hasPointerCapture(pointerId)) {
                    element.releasePointerCapture(pointerId);
                }
            } else {
                element.releasePointerCapture(pointerId);
            }
        } catch (error) {
            // Some browsers may throw if capture is no longer active; ignore.
        }
    };

    const triggerLongPress = () => {
        if (longPressTriggered) {
            return;
        }
        longPressTriggered = true;
        clearLongPressTimer();
        releasePointerCaptureSafely();
        action = null;
        activeItem = element;
        openContextMenu(lastPointerPosition.x, lastPointerPosition.y);
    };

    element.addEventListener('pointerdown', (event) => {
        const isTouchPointer = event.pointerType === 'touch';
        if (event.button !== 0 && !isTouchPointer) {
            return;
        }

        const isDeckArea = element.dataset.type === 'deck-area';
        const isLockedDeck = isDeckArea && element.dataset.locked === 'true';
        const isLockedItem = !isDeckArea && element.dataset.locked === 'true';
        const isLocked = isLockedDeck || isLockedItem;

        if (isDeckArea && !deckModifyMode) {
            return;
        }

        if (isTouchPointer) {
            event.preventDefault();
        }

        if (!isDeckArea && event.target === resizeHandle) {
            action = 'rotate';
        } else if (event.target === resizeHandle) {
            action = 'resize';
        } else {
            action = 'move';
        }
        if (isLocked) {
            action = null;
        }
        pointerId = event.pointerId;
        longPressTriggered = false;
        clearLongPressTimer();
        lastPointerPosition.x = event.clientX;
        lastPointerPosition.y = event.clientY;
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
        if (action === 'resize' && element.dataset.type === 'deck-area') {
            showDeckAreaResizeGuides(element);
        }

        if (isTouchPointer) {
            longPressTimer = window.setTimeout(triggerLongPress, LONG_PRESS_DURATION_MS);
        }
    });

    element.addEventListener('pointermove', (event) => {
        if (pointerId !== event.pointerId) return;
        lastPointerPosition.x = event.clientX;
        lastPointerPosition.y = event.clientY;
        if (!longPressTriggered && longPressTimer !== null) {
            const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
            if (distance > LONG_PRESS_MOVE_THRESHOLD_PX) {
                clearLongPressTimer();
            }
        }
        if (longPressTriggered) {
            return;
        }
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
            if (element.dataset.type === 'deck-area') {
                updateDeckAreaResizeGuides(element);
            }
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
        const wasDeckAreaResize = action === 'resize' && element.dataset.type === 'deck-area';
        clearLongPressTimer();
        releasePointerCaptureSafely();
        const completedAction = longPressTriggered ? null : action;
        pointerId = null;
        action = null;
        if (wasDeckAreaResize) {
            hideDeckAreaResizeGuides(element);
        }
        if (completedAction && element.dataset.type === 'item') {
            handleItemInteractionComplete(element, completedAction);
        }
        longPressTriggered = false;
    });

    element.addEventListener('pointercancel', () => {
        const wasResize = action === 'resize';
        clearLongPressTimer();
        releasePointerCaptureSafely();
        pointerId = null;
        action = null;
        if (wasResize && element.dataset.type === 'deck-area') {
            hideDeckAreaResizeGuides(element);
        }
        longPressTriggered = false;
    });

    element.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        clearLongPressTimer();
        longPressTriggered = false;
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
    if (isPlanningItem(element)) {
        persistCurrentPlanningJob();
        return;
    }
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
    if (isPlanningItem(element)) {
        persistCurrentPlanningJob();
        return;
    }
    const formattedDegrees = degrees > 0 ? `+${degrees}` : `${degrees}`;
    const message = `Item rotated ${formattedDegrees}°${getItemHistoryLabel(element)}`;
    addHistoryEntry(message);
    updateItemRecord(element, message, { updateComment: false, updateDeck: false });
}

function setItemLockState(element, locked) {
    element.dataset.locked = locked ? 'true' : 'false';
    element.classList.toggle('locked', locked);
    if (isPlanningItem(element)) {
        persistCurrentPlanningJob();
        return;
    }
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
    updateElementTransform(element);
    if (isPlanningItem(element)) {
        persistCurrentPlanningJob();
        return;
    }
    const message = `Item resized to ${width.toFixed(2)}m × ${height.toFixed(2)}m${getItemHistoryLabel(element)}`;
    addHistoryEntry(message);
    updateItemRecord(element, message, { updateComment: false });
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
        if (isPlanningItem(element)) {
            persistCurrentPlanningJob();
            return;
        }
        const message = `${hadComment ? 'Comment updated' : 'Comment added'}${getItemHistoryLabel(element)}`;
        addHistoryEntry(message);
        updateItemRecord(element, message, { updateDeck: false, updateComment: true });
    } else {
        element.removeAttribute('data-comment');
        element.removeAttribute('title');
        if (isPlanningItem(element)) {
            persistCurrentPlanningJob();
            return;
        }
        const message = `Comment cleared${getItemHistoryLabel(element)}`;
        addHistoryEntry(message);
        updateItemRecord(element, message, { updateDeck: false, updateComment: true });
    }
}

function duplicateItem(element) {
    if (!element || element.dataset.type !== 'item') {
        return null;
    }
    const planningItem = isPlanningItem(element);
    const width = parseFloat(element.dataset.width) || DEFAULT_ITEM_WIDTH_METERS;
    const height = parseFloat(element.dataset.height) || DEFAULT_ITEM_HEIGHT_METERS;
    const label = getItemLabel(element);
    const color = rgbToHex(getComputedStyle(element).backgroundColor || element.style.background || '#3a7afe');
    const duplicateOptions = planningItem
        ? {
              skipHistory: true,
              skipMetadata: true,
              container: planningEditingLayer,
              autoPosition: false,
          }
        : { autoPosition: false };
    const duplicate = createItemElement(
        {
            width,
            height,
            label,
            color,
            type: 'item',
            shape: getItemShape(element),
            deckLayer: isItemOnDeckLayer(element),
        },
        duplicateOptions
    );
    const offset = 40;
    const baseX = parseFloat(element.dataset.x) || 0;
    const baseY = parseFloat(element.dataset.y) || 0;
    duplicate.dataset.x = (baseX + offset).toString();
    duplicate.dataset.y = (baseY + offset).toString();
    updateElementTransform(duplicate);
    if (planningItem) {
        duplicate.dataset.planningJobId = element.dataset.planningJobId;
        duplicate.classList.add('planning-edit-item');
        persistCurrentPlanningJob();
        return duplicate;
    }
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
    if (isPlanningItem(element)) {
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
    const planningItem = isPlanningItem(element);
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

    const shapeFieldset = document.createElement('fieldset');
    const shapeLegend = document.createElement('legend');
    shapeLegend.textContent = 'Shape';
    shapeFieldset.appendChild(shapeLegend);
    const shapeButtonGroup = document.createElement('div');
    shapeButtonGroup.className = 'shape-button-group';
    const shapeOptions = [
        { value: 'rectangle', label: 'Rectangle' },
        { value: 'circle', label: 'Circle' },
        { value: 'triangle-right', label: 'Right triangle' },
        { value: 'triangle-equilateral', label: 'Equilateral triangle' },
    ];
    const shapeButtons = [];
    const updateShapeButtons = () => {
        const currentShape = getItemShape(element);
        shapeButtons.forEach((button) => {
            const isActive = button.dataset.shapeValue === currentShape;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    };
    shapeOptions.forEach((option) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ghost shape-option-button';
        button.dataset.shapeValue = option.value;
        button.textContent = option.label;
        button.addEventListener('click', () => {
            if (locked) {
                return;
            }
            setItemShape(element, option.value);
            updateShapeButtons();
        });
        button.setAttribute('aria-pressed', 'false');
        shapeButtons.push(button);
        shapeButtonGroup.appendChild(button);
    });
    shapeFieldset.appendChild(shapeButtonGroup);

    const layerFieldset = document.createElement('fieldset');
    const layerLegend = document.createElement('legend');
    layerLegend.textContent = 'Layering';
    layerFieldset.appendChild(layerLegend);
    const deckLayerButton = document.createElement('button');
    deckLayerButton.type = 'button';
    deckLayerButton.className = 'ghost deck-layer-button';
    const updateDeckLayerButton = () => {
        const deckLayerEnabled = isItemOnDeckLayer(element);
        deckLayerButton.textContent = deckLayerEnabled
            ? 'Restore default layer'
            : 'Place under other items';
        deckLayerButton.setAttribute('aria-pressed', deckLayerEnabled ? 'true' : 'false');
    };
    deckLayerButton.addEventListener('click', () => {
        if (locked) {
            return;
        }
        setItemDeckLayerState(element, !isItemOnDeckLayer(element));
        updateDeckLayerButton();
    });
    layerFieldset.appendChild(deckLayerButton);

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

    if (!locked && !planningItem) {
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

    form.append(sizeFieldset, labelFieldset, colorFieldset, shapeFieldset, layerFieldset, attachmentSection);
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

    updateShapeButtons();
    updateDeckLayerButton();

    if (locked) {
        widthInput.disabled = true;
        heightInput.disabled = true;
        labelInput.disabled = true;
        colorInput.disabled = true;
        duplicateButton.disabled = true;
        shapeButtons.forEach((button) => {
            button.disabled = true;
            button.setAttribute('aria-disabled', 'true');
        });
        deckLayerButton.disabled = true;
        deckLayerButton.setAttribute('aria-disabled', 'true');
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
    const planningItem = isPlanningItem(element);
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
    if (planningItem) {
        persistCurrentPlanningJob();
        return;
    }
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

    if (planningState.active && planningState.editingJobId) {
        const element = createItemElement(
            { width, height, label, color, type: 'item' },
            { skipHistory: true, skipMetadata: true, container: planningEditingLayer }
        );
        element.dataset.planningJobId = planningState.editingJobId;
        element.classList.add('planning-edit-item');
        updateElementTransform(element);
        persistCurrentPlanningJob();
        inputWidth.value = width.toFixed(2);
        inputHeight.value = height.toFixed(2);
        inputLabel.value = '';
        return;
    }

    createItemElement({ width, height, label, color, type: 'item' });
    inputWidth.value = width.toFixed(2);
    inputHeight.value = height.toFixed(2);
    inputLabel.value = '';
}

function setSidebarVisibility(visible) {
    if (!historySidebar) {
        return;
    }

    historySidebar.classList.toggle('hidden', !visible);

    if (toggleSidebarBtn) {
        toggleSidebarBtn.setAttribute('aria-pressed', visible ? 'true' : 'false');
        toggleSidebarBtn.textContent = visible ? 'Hide list' : 'Show list';
    }
}

function toggleSidebar(forceVisible) {
    if (!historySidebar) {
        return;
    }

    const isCurrentlyVisible = !historySidebar.classList.contains('hidden');
    const shouldBeVisible =
        typeof forceVisible === 'boolean' ? forceVisible : !isCurrentlyVisible;

    setSidebarVisibility(shouldBeVisible);
}

const initialSidebarVisible =
    historySidebar && !historySidebar.classList.contains('hidden');
setSidebarVisibility(Boolean(initialSidebarVisible));

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
        closeDeckSettingsPanel();
        updateDeckSettingsButtons();
    } else {
        closeDeckSettingsPanel();
    }
}

function closeToolsMenu() {
    if (toolsMenu) {
        toolsMenu.classList.remove('open');
    }
    if (toolsButton) {
        toolsButton.setAttribute('aria-expanded', 'false');
    }
    closeDeckSettingsPanel();
}

function updateSelectionSettingsMenuState(open) {
    if (!selectionSettingsMenu || !selectionSettingsButton) {
        return;
    }
    selectionSettingsMenu.classList.toggle('open', open);
    selectionSettingsMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
    selectionSettingsButton.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function toggleSelectionSettingsMenu() {
    if (!selectionSettingsMenu) {
        return;
    }
    const shouldOpen = !selectionSettingsMenu.classList.contains('open');
    updateSelectionSettingsMenuState(shouldOpen);
}

function closeSelectionSettingsMenu() {
    updateSelectionSettingsMenuState(false);
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
        if (!deckModifyMode) {
            closeContextMenu();
            return;
        }
        const deckLabel = activeItem.dataset.label || 'Deck';
        const labelSuffix = deckLabel ? `: ${deckLabel}` : '';
        if (action === 'lock-deck') {
            setDeckLockState(activeItem, true);
            addHistoryEntry(`Deck locked${labelSuffix}`);
            scheduleWorkspaceSave({ immediate: true });
        } else if (action === 'unlock-deck') {
            setDeckLockState(activeItem, false);
            addHistoryEntry(`Deck unlocked${labelSuffix}`);
            scheduleWorkspaceSave({ immediate: true });
        } else if (action === 'rename-deck') {
            renameDeckArea(activeItem);
        } else if (action === 'toggle-deck-name') {
            toggleDeckNameVisibility(activeItem);
        } else if (action === 'delete-deck') {
            const shouldDelete = confirm(`Delete deck area "${deckLabel}"?`);
            if (shouldDelete) {
                addHistoryEntry(`Deck area deleted${labelSuffix}`);
                activeItem.remove();
                activeItem = null;
                scheduleWorkspaceSave({ immediate: true });
            }
        }
    } else {
        if (action === 'modify-item') {
            closeContextMenu();
            openItemModifyDialog(activeItem);
            return;
        } else if (action === 'attach-file') {
            promptItemAttachment(activeItem, { onComplete: renderModifyDialogAttachments });
        } else if (action === 'delete') {
            if (isPlanningItem(activeItem)) {
                activeItem.remove();
                persistCurrentPlanningJob();
            } else {
                const labelSuffix = getItemHistoryLabel(activeItem);
                const message = `Item deleted${labelSuffix}`;
                addHistoryEntry(message);
                recordItemHistory(activeItem, message);
                removeItemRecord(activeItem);
                activeItem.remove();
                scheduleWorkspaceSave({ immediate: true });
            }
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
        if (!deckModifyMode) {
            return [];
        }
        const locked = element.dataset.locked === 'true';
        const nameHidden = element.dataset.nameHidden === 'true';
        return [
            { action: locked ? 'unlock-deck' : 'lock-deck', label: locked ? 'Unlock deck' : 'Lock deck' },
            { action: 'rename-deck', label: 'Rename deck' },
            { action: 'toggle-deck-name', label: nameHidden ? 'Show name' : 'Hide name' },
            { action: 'delete-deck', label: 'Delete deck area', className: 'danger' },
        ];
    }
    const locked = element.dataset.locked === 'true';
    const hasComment = Boolean((element.dataset.comment || '').trim());
    const planningItem = isPlanningItem(element);
    const actions = [];
    actions.push({ action: 'modify-item', label: locked ? 'View details…' : 'Modify…' });
    if (!locked) {
        if (!planningItem) {
            actions.push({ action: 'attach-file', label: 'Attach file…' });
        }
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
    scheduleWorkspaceSave({ immediate: true });
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
    scheduleWorkspaceSave();
}

function handleAddDeckArea() {
    if (!deckModifyMode) {
        alert('Enter deck modify mode before adding deck areas.');
        return;
    }
    const size = DEFAULT_DECK_AREA_SIZE_METERS;
    createItemElement({
        width: size,
        height: size,
        label: `${currentDeck?.name || 'Deck'} area`,
        color: '#ffffff',
        type: 'deck-area',
    });
    closeToolsMenu();
    scheduleWorkspaceSave();
}

function initializeDeckSelection() {
    setDeckModifyMode(false);
    updateDeckSettingsButtons();
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
    closeSelectionSettingsMenu();
}

function handleDeleteDeck() {
    if (!decks.length) {
        alert('There are no decks to delete.');
        return;
    }
    const options = decks
        .map((deck, index) => `${index + 1}. ${deck.name}`)
        .join('\n');
    const input = prompt(`Enter the number of the deck to delete:\n${options}`);
    if (input === null) {
        return;
    }
    const selectedIndex = Number.parseInt(input, 10);
    if (!Number.isFinite(selectedIndex) || selectedIndex < 1 || selectedIndex > decks.length) {
        alert('Please enter a valid number.');
        return;
    }
    const deckToRemove = decks[selectedIndex - 1];
    const shouldDelete = confirm(
        `Delete deck "${deckToRemove.name}"? This will also remove its planning decks.`
    );
    if (!shouldDelete) {
        return;
    }
    decks.splice(selectedIndex - 1, 1);
    clearPlanningPreferencesForDeck(deckToRemove.id);
    saveDecks();
    renderDeckList();
    if (currentDeck && currentDeck.id === deckToRemove.id) {
        goBackToSelection();
    }
    closeSelectionSettingsMenu();
}

function getDeckLayoutFilenameSegment(name) {
    if (typeof name !== 'string') {
        return 'workspace';
    }
    const normalized = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || 'workspace';
}

function handleDownloadDecks() {
    if (!currentDeck) {
        alert('Select a deck before downloading a layout.');
        return;
    }
    const layoutItems = serializeWorkspaceElements();
    const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        deck: { id: currentDeck.id, name: currentDeck.name },
        items: layoutItems,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().slice(0, 10);
    const deckSegment = getDeckLayoutFilenameSegment(currentDeck.name);
    link.download = `riglogistics-layout-${deckSegment}-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function handleUploadDecks() {
    if (!deckModifyMode) {
        alert('Enter deck modify mode before uploading a layout.');
        return;
    }
    if (!currentDeck) {
        alert('Select a deck before uploading a layout.');
        return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', async () => {
        const [file] = Array.from(input.files || []);
        if (!file) {
            return;
        }
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const layoutEntries = Array.isArray(parsed?.items)
                ? parsed.items
                : Array.isArray(parsed)
                ? parsed
                : null;
            if (!Array.isArray(layoutEntries) || !layoutEntries.length) {
                alert('The selected file does not contain any layout data.');
                return;
            }
            const normalized = layoutEntries
                .map((entry) => normalizeWorkspaceLayoutEntry(entry))
                .filter((entry) => entry !== null);
            if (!normalized.length) {
                alert('No valid layout entries were found in the selected file.');
                return;
            }
            loadWorkspaceLayout(normalized, { recordHistory: true });
            scheduleWorkspaceSave({ immediate: true });
            alert(`Loaded ${normalized.length} layout item${normalized.length === 1 ? '' : 's'} from backup.`);
        } catch (error) {
            console.error('Unable to import layout', error);
            alert('Unable to import the layout. Please ensure the file is a valid layout backup.');
        } finally {
            input.value = '';
        }
    });
    input.click();
}

function setupWorkspaceInteractions() {
    if (!workspaceContainer) {
        return;
    }
    let isPanning = false;
    let panStart = { x: 0, y: 0, translateX: 0, translateY: 0 };
    const activeTouchPointers = new Map();
    let pinchState = null;

    const clampScale = (value) => Math.min(2.5, Math.max(MIN_SCALE, value));

    const beginPan = (event) => {
        isPanning = true;
        panStart = {
            x: event.clientX,
            y: event.clientY,
            translateX: workspaceState.translateX,
            translateY: workspaceState.translateY,
        };
        if (event.pointerType !== 'touch') {
            try {
                workspaceContainer.setPointerCapture(event.pointerId);
            } catch (error) {
                // Ignore if pointer capture is not supported or already active.
            }
        }
    };

    const initializePinchState = () => {
        if (activeTouchPointers.size < 2) {
            return null;
        }
        const touches = Array.from(activeTouchPointers.values()).slice(0, 2);
        const [first, second] = touches;
        const distance = Math.hypot(second.x - first.x, second.y - first.y);
        if (!Number.isFinite(distance) || distance === 0) {
            return null;
        }
        const rect = workspaceContainer.getBoundingClientRect();
        const centerClientX = (first.x + second.x) / 2;
        const centerClientY = (first.y + second.y) / 2;
        return {
            distance,
            centerX: centerClientX - rect.left,
            centerY: centerClientY - rect.top,
            scale: workspaceState.scale,
            translateX: workspaceState.translateX,
            translateY: workspaceState.translateY,
        };
    };

    const applyPinchTransform = () => {
        if (!pinchState || activeTouchPointers.size < 2) {
            return;
        }
        const touches = Array.from(activeTouchPointers.values()).slice(0, 2);
        const [first, second] = touches;
        const currentDistance = Math.hypot(second.x - first.x, second.y - first.y);
        if (!Number.isFinite(currentDistance) || currentDistance === 0) {
            return;
        }
        const rect = workspaceContainer.getBoundingClientRect();
        const centerClientX = (first.x + second.x) / 2;
        const centerClientY = (first.y + second.y) / 2;
        const centerX = centerClientX - rect.left;
        const centerY = centerClientY - rect.top;

        const previousScale = pinchState.scale;
        const scaleMultiplier = currentDistance / pinchState.distance;
        const nextScale = clampScale(previousScale * scaleMultiplier);
        if (!Number.isFinite(previousScale) || previousScale === 0) {
            return;
        }
        const workspaceCenterX = (pinchState.centerX - pinchState.translateX) / previousScale;
        const workspaceCenterY = (pinchState.centerY - pinchState.translateY) / previousScale;

        workspaceState.scale = nextScale;
        workspaceState.translateX = centerX - workspaceCenterX * nextScale;
        workspaceState.translateY = centerY - workspaceCenterY * nextScale;
        applyWorkspaceTransform();

        pinchState = {
            distance: currentDistance,
            centerX,
            centerY,
            scale: workspaceState.scale,
            translateX: workspaceState.translateX,
            translateY: workspaceState.translateY,
        };
    };

    workspaceContainer.addEventListener('pointerdown', (event) => {
        const isTouchPointer = event.pointerType === 'touch';
        if (event.button !== 0 && !isTouchPointer) {
            return;
        }

        const lockedElement = event.target.closest('.item.locked, .deck-area.locked');
        const isWorkspaceSurface = event.target === workspaceContainer || event.target === workspaceContent;

        if (!isWorkspaceSurface && !lockedElement) {
            return;
        }
        if (isTouchPointer) {
            event.preventDefault();
            activeTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (activeTouchPointers.size >= 2) {
                pinchState = initializePinchState();
                isPanning = false;
                return;
            }
            beginPan(event);
            return;
        }
        beginPan(event);
    });

    workspaceContainer.addEventListener('pointermove', (event) => {
        if (event.pointerType === 'touch' && activeTouchPointers.has(event.pointerId)) {
            activeTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (pinchState && activeTouchPointers.size >= 2) {
                event.preventDefault();
                applyPinchTransform();
                return;
            }
        }
        if (!isPanning) {
            return;
        }
        const deltaX = event.clientX - panStart.x;
        const deltaY = event.clientY - panStart.y;
        workspaceState.translateX = panStart.translateX + deltaX;
        workspaceState.translateY = panStart.translateY + deltaY;
        applyWorkspaceTransform();
    });

    const stopPan = (event) => {
        if (!isPanning) return;
        try {
            if (typeof workspaceContainer.hasPointerCapture === 'function') {
                if (workspaceContainer.hasPointerCapture(event.pointerId)) {
                    workspaceContainer.releasePointerCapture(event.pointerId);
                }
            } else {
                workspaceContainer.releasePointerCapture(event.pointerId);
            }
        } catch (error) {
            // Ignore if pointer capture was already released.
        }
        isPanning = false;
    };

    const clearTouchPointer = (event) => {
        if (activeTouchPointers.has(event.pointerId)) {
            activeTouchPointers.delete(event.pointerId);
        }
        if (activeTouchPointers.size < 2) {
            pinchState = null;
        }
    };

    workspaceContainer.addEventListener('pointerup', (event) => {
        clearTouchPointer(event);
        stopPan(event);
    });
    workspaceContainer.addEventListener('pointercancel', (event) => {
        clearTouchPointer(event);
        stopPan(event);
    });

    workspaceContainer.addEventListener('wheel', (event) => {
        event.preventDefault();
        const scaleDelta = event.deltaY < 0 ? 1.1 : 0.9;
        const newScale = clampScale(workspaceState.scale * scaleDelta);

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

function handleGlobalPointerDown(event) {
    const target = event?.target;
    if (
        (selectionSettingsButton && selectionSettingsButton.contains(target)) ||
        (selectionSettingsMenu && selectionSettingsMenu.contains(target))
    ) {
        return;
    }
    closeToolsMenu();
    closeContextMenu();
    closeSelectionSettingsMenu();
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

if (deckSettingsButton) {
    deckSettingsButton.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleDeckSettingsPanel();
    });
}

if (deckSettingsPanel) {
    deckSettingsPanel.addEventListener('click', (event) => {
        event.stopPropagation();
    });
}

if (deckModifyToggleBtn) {
    deckModifyToggleBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        setDeckModifyMode(!deckModifyMode);
    });
}

if (deckDownloadButton) {
    deckDownloadButton.addEventListener('click', (event) => {
        event.stopPropagation();
        handleDownloadDecks();
    });
}

if (deckUploadButton) {
    deckUploadButton.addEventListener('click', (event) => {
        event.stopPropagation();
        handleUploadDecks();
    });
}

if (deckAddAreaButton) {
    deckAddAreaButton.addEventListener('click', (event) => {
        event.stopPropagation();
        handleAddDeckArea();
    });
}

if (printToPdfButton) {
    printToPdfButton.addEventListener('click', (event) => {
        event.stopPropagation();
        handlePrintToPdf();
    });
}

if (selectionSettingsButton) {
    selectionSettingsButton.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleSelectionSettingsMenu();
    });
}

if (selectionSettingsMenu) {
    selectionSettingsMenu.addEventListener('click', (event) => {
        event.stopPropagation();
    });
}

document.addEventListener('click', handleGlobalPointerDown);

deckSelectionView.addEventListener('click', (event) => {
    if (
        selectionSettingsMenu &&
        selectionSettingsButton &&
        !selectionSettingsMenu.contains(event.target) &&
        !selectionSettingsButton.contains(event.target)
    ) {
        closeSelectionSettingsMenu();
    }
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

if (togglePlanningModeBtn) {
    togglePlanningModeBtn.addEventListener('click', () => {
        togglePlanningMode();
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

workspaceContainer.addEventListener('pointerdown', handleMeasurePointerDown, true);

createItemBtn.addEventListener('click', handleCreateItem);
toggleSidebarBtn.addEventListener('click', toggleSidebar);
createDeckBtn.addEventListener('click', handleCreateDeck);
if (deleteDeckBtn) {
    deleteDeckBtn.addEventListener('click', handleDeleteDeck);
}
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
connectRealtime();
fetchLatestState();
