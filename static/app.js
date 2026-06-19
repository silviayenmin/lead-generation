// Intercept all fetch requests to automatically append X-API-Key header
(function() {
    const ORIGINAL_FETCH = window.fetch;
    window.fetch = function(url, options = {}) {
        const urlStr = String(url);
        if (urlStr.startsWith("/api/")) {
            if (!options.headers) {
                options.headers = {};
            }
            const apiKey = localStorage.getItem("APP_SECRET_KEY") || "silvia_dev_key";
            if (options.headers instanceof Headers) {
                options.headers.set("X-API-Key", apiKey);
            } else if (Array.isArray(options.headers)) {
                let keyExists = false;
                for (let i = 0; i < options.headers.length; i++) {
                    if (options.headers[i][0] === "X-API-Key") {
                        options.headers[i][1] = apiKey;
                        keyExists = true;
                        break;
                    }
                }
                if (!keyExists) {
                    options.headers.push(["X-API-Key", apiKey]);
                }
            } else {
                options.headers["X-API-Key"] = apiKey;
            }
        }
        return ORIGINAL_FETCH(url, options);
    };
})();

// Theme loading & initialization (runs immediately to prevent unstyled flash)
function initTheme() {
    if (typeof localStorage === 'undefined' || typeof document === 'undefined') return;
    const savedTheme = localStorage.getItem("silvia_theme");
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const currentTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    
    if (document.documentElement) {
        if (currentTheme === 'light') {
            document.documentElement.classList.add('light-theme');
        } else {
            document.documentElement.classList.remove('light-theme');
        }
    }
}
initTheme();

// State variables
let leadsData = [];
let searchesData = [];
let activeSearchId = "all";
let activeLead = null;
let archiveCurrentPage = 1;
const archivePageSize = 10;
const STAGES = ["New", "Drafted", "Emailed", "Replied", "Disqualified"];

// Guided wizard state
let wizardCurrentStep = 1;

// Archive views filter state
let archiveViewFilter = "all";
let archiveSelectedUrls = [];

// DOM Elements
const searchForm = document.getElementById("search-form");
const keywordInput = document.getElementById("keyword");
const platformSelect = document.getElementById("platform");
const timeframeSelect = document.getElementById("timeframe");
const limitSelect = document.getElementById("limit");
const btnSearch = document.getElementById("btn-search");

// Stats Elements
const statTotal = document.getElementById("stat-total");
const statQualified = document.getElementById("stat-qualified");
const statActiveOutreach = document.getElementById("stat-active-outreach");
const statConfidence = document.getElementById("stat-confidence");

// Filters & Grid Toolbar (Dashboard)
const filterPlatform = document.getElementById("filter-platform");
const filterStatus = document.getElementById("filter-status");
const filterCrm = document.getElementById("filter-crm");
const globalSearch = document.getElementById("global-search");

// Containers
const loadingState = document.getElementById("loading-state");
const emptyState = document.getElementById("empty-state");
const tableWrapper = document.getElementById("table-wrapper");
const leadsTbody = document.getElementById("leads-tbody");
const loadingProgress = document.getElementById("loading-progress");
const loadingStatusText = document.getElementById("loading-status-text");

// Tab Navigation Elements
const tabBtnDashboard = document.getElementById("tab-btn-dashboard");
const tabBtnDiscovery = document.getElementById("tab-btn-discovery");
const tabBtnPipeline = document.getElementById("tab-btn-pipeline");
const tabBtnArchive = document.getElementById("tab-btn-archive");
const tabBtnSettings = document.getElementById("tab-btn-settings");

const viewDashboard = document.getElementById("view-dashboard");
const viewDiscovery = document.getElementById("view-discovery");
const viewPipeline = document.getElementById("view-pipeline");
const viewArchive = document.getElementById("view-archive");
const viewSettings = document.getElementById("view-settings");

// Archive Section DOM Elements
const archiveHistoryList = document.getElementById("archive-history-list");
const archiveLeadsTbody = document.getElementById("archive-leads-tbody");
const archiveTableTitle = document.getElementById("archive-table-title");
const archiveFilterPlatform = document.getElementById("archive-filter-platform");
const archiveFilterStatus = document.getElementById("archive-filter-status");
const archiveFilterCrm = document.getElementById("archive-filter-crm");
const archiveEmptyState = document.getElementById("archive-empty-state");
const archiveTableWrapper = document.getElementById("archive-table-wrapper");

// Drawer Details elements
const detailModal = document.getElementById("detail-modal");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalAuthorName = document.getElementById("modal-author-name");
const modalCompanyName = document.getElementById("modal-company-name");
const modalBuyingIntent = document.getElementById("modal-buying-intent");
const modalIntentType = document.getElementById("modal-intent-type");
const modalServiceRequired = document.getElementById("modal-service-required");
const modalIndustry = document.getElementById("modal-industry");
const modalLocation = document.getElementById("modal-location");
const modalNeedDescription = document.getElementById("modal-need-description");
const modalContactInfo = document.getElementById("modal-contact-info");
const modalContactSource = document.getElementById("modal-contact-source");
const modalContactConfidence = document.getElementById("modal-contact-confidence");
const modalLeadCategory = document.getElementById("modal-lead-category");
const modalLeadScore = document.getElementById("modal-lead-score");

// CRM Stage / Email Pitch Elements
const modalCrmStatus = document.getElementById("modal-crm-status");
const btnGeneratePitch = document.getElementById("btn-generate-pitch");
const emailLoader = document.getElementById("email-loader");
const modalEmailBody = document.getElementById("modal-email-body");
const emailBodyPlaceholder = document.getElementById("email-body-placeholder");

// Action Links
const modalBtnLinkedin = document.getElementById("modal-btn-linkedin");
const modalBtnSend = document.getElementById("modal-btn-send");
const modalBtnCopy = document.getElementById("modal-btn-copy");
const modalBtnCopyEmail = document.getElementById("modal-btn-copy-email");

// Custom extensions / settings fields
const btnExportCsvSidebar = document.getElementById("btn-export-csv-sidebar");
const btnEnrichContact = document.getElementById("btn-enrich-contact");
const agencyNameInput = document.getElementById("agency-name");
const agencyInfoInput = document.getElementById("agency-info");
const emailToneSelect = document.getElementById("email-tone");

// Saved Searches and Monitoring Elements
const btnSaveSearch = document.getElementById("btn-save-search");
const btnRunMonitoring = document.getElementById("btn-run-monitoring");
const savedSearchesTbody = document.getElementById("saved-searches-tbody");
const monitoringEmptyState = document.getElementById("monitoring-empty-state");
const performanceTbody = document.getElementById("performance-tbody");
const performanceEmptyState = document.getElementById("performance-empty-state");

// Premium Platform Custom SVG Icons (to bypass missing Lucide brand icons)
function getPlatformIconSvg(platform, size = 14, style = "") {
    const cleanPlatform = String(platform || "").toLowerCase().trim();
    if (cleanPlatform === "linkedin") {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="brand-svg" style="${style}">
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
            <rect x="2" y="9" width="4" height="12"></rect>
            <circle cx="4" cy="4" r="2"></circle>
        </svg>`;
    } else if (cleanPlatform === "facebook") {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="brand-svg" style="${style}">
            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
        </svg>`;
    } else if (cleanPlatform === "twitter" || cleanPlatform === "twitter-x" || cleanPlatform === "x") {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="brand-svg" style="${style}">
            <path d="M4 4l11.733 16h4.267l-11.733 -16z"></path>
            <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"></path>
        </svg>`;
    } else if (cleanPlatform === "reddit") {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="brand-svg" style="${style}">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>`;
    } else {
        // Default globe icon for general web
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="brand-svg" style="${style}">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>`;
    }
}

// Page Initialization
document.addEventListener("DOMContentLoaded", () => {
    // Initialize Lucide Icons
    lucide.createIcons();
    
    // Theme toggle setup
    const btnThemeToggle = document.getElementById("btn-theme-toggle");
    const themeToggleIcon = document.getElementById("theme-toggle-icon");
    
    function updateThemeIcon() {
        if (!themeToggleIcon) return;
        const isLight = document.documentElement.classList.contains('light-theme');
        if (isLight) {
            themeToggleIcon.setAttribute('data-lucide', 'moon');
        } else {
            themeToggleIcon.setAttribute('data-lucide', 'sun');
        }
        lucide.createIcons();
    }
    
    updateThemeIcon();
    
    if (btnThemeToggle) {
        btnThemeToggle.addEventListener("click", () => {
            const isLight = document.documentElement.classList.toggle('light-theme');
            localStorage.setItem("silvia_theme", isLight ? 'light' : 'dark');
            updateThemeIcon();
        });
    }
    
    // Load leads from backend
    loadExistingLeads();
    
    // Sidebar collapsible toggle handler
    const sidebar = document.getElementById("sidebar");
    const sidebarToggle = document.getElementById("sidebar-toggle");
    const toggleIcon = document.getElementById("toggle-icon");
    if (sidebarToggle && sidebar && toggleIcon) {
        sidebarToggle.addEventListener("click", () => {
            sidebar.classList.toggle("collapsed");
            if (sidebar.classList.contains("collapsed")) {
                toggleIcon.setAttribute("data-lucide", "chevron-right");
            } else {
                toggleIcon.setAttribute("data-lucide", "chevron-left");
            }
            lucide.createIcons();
        });
    }

    // "New Scan" trigger topbar CTA
    const btnNewScanTrigger = document.getElementById("btn-new-scan-trigger");
    if (btnNewScanTrigger) {
        btnNewScanTrigger.addEventListener("click", () => {
            switchTab("discovery");
        });
    }

    // Sync sidebar agency name/subtitle on load
    function updateSidebarAgencyName() {
        const sidebarAgencyNameEl = document.getElementById("sidebar-user-agency-name");
        if (sidebarAgencyNameEl) {
            const agencyNameVal = localStorage.getItem("silvia_agency_name") || localStorage.getItem("agencyName") || "Your Workspace";
            sidebarAgencyNameEl.innerText = agencyNameVal;
        }
        const brandSubtitleEl = document.getElementById("sidebar-brand-subtitle");
        if (brandSubtitleEl) {
            const agencyNameVal = localStorage.getItem("silvia_agency_name") || localStorage.getItem("agencyName") || "Your Workspace";
            brandSubtitleEl.innerText = agencyNameVal;
        }
    }

    // Outreach Config Settings hydration from localStorage
    if (localStorage.getItem("silvia_agency_name")) agencyNameInput.value = localStorage.getItem("silvia_agency_name");
    updateSidebarAgencyName();
    if (localStorage.getItem("silvia_agency_info")) agencyInfoInput.value = localStorage.getItem("silvia_agency_info");
    if (localStorage.getItem("silvia_email_tone")) emailToneSelect.value = localStorage.getItem("silvia_email_tone");
    
    // Register auto-save for settings modifications
    if (agencyNameInput) {
        agencyNameInput.addEventListener("input", () => {
            localStorage.setItem("silvia_agency_name", agencyNameInput.value);
            localStorage.setItem("agencyName", agencyNameInput.value);
            updateSidebarAgencyName();
            updateConfigPreview();
        });
    }
    if (agencyInfoInput) {
        agencyInfoInput.addEventListener("input", () => {
            localStorage.setItem("silvia_agency_info", agencyInfoInput.value);
            updateConfigPreview();
        });
    }
    if (emailToneSelect) {
        emailToneSelect.addEventListener("change", () => {
            localStorage.setItem("silvia_email_tone", emailToneSelect.value);
            updateConfigPreview();
        });
    }
    
    // Form and Filtering Event Listeners
    if (searchForm) searchForm.addEventListener("submit", handleSearchSubmit);
    if (filterPlatform) filterPlatform.addEventListener("change", renderLeads);
    if (filterStatus) filterStatus.addEventListener("change", renderLeads);
    if (filterCrm) filterCrm.addEventListener("change", renderLeads);
    if (globalSearch) globalSearch.addEventListener("input", renderLeads);
    
    if (archiveFilterPlatform) archiveFilterPlatform.addEventListener("change", () => {
        archiveCurrentPage = 1;
        renderArchiveLeads();
    });
    if (archiveFilterStatus) archiveFilterStatus.addEventListener("change", () => {
        archiveCurrentPage = 1;
        renderArchiveLeads();
    });
    if (archiveFilterCrm) archiveFilterCrm.addEventListener("change", () => {
        archiveCurrentPage = 1;
        renderArchiveLeads();
    });

    const archiveHistorySearch = document.getElementById("archive-history-search");
    if (archiveHistorySearch) {
        archiveHistorySearch.addEventListener("input", renderArchiveHistory);
    }

    const btnArchivePrev = document.getElementById("archive-pag-prev");
    const btnArchiveNext = document.getElementById("archive-pag-next");
    if (btnArchivePrev) btnArchivePrev.addEventListener("click", () => {
        if (archiveCurrentPage > 1) {
            archiveCurrentPage--;
            renderArchiveLeads();
        }
    });
    if (btnArchiveNext) btnArchiveNext.addEventListener("click", () => {
        archiveCurrentPage++;
        renderArchiveLeads();
    });
    
    // Left Navigation Sidebar tabs
    if (tabBtnDashboard) tabBtnDashboard.addEventListener("click", () => switchTab("dashboard"));
    if (tabBtnDiscovery) tabBtnDiscovery.addEventListener("click", () => switchTab("discovery"));
    if (tabBtnPipeline) tabBtnPipeline.addEventListener("click", () => switchTab("pipeline"));
    if (tabBtnArchive) tabBtnArchive.addEventListener("click", () => switchTab("archive"));
    if (tabBtnSettings) tabBtnSettings.addEventListener("click", () => switchTab("settings"));
    
    // Drawer buttons & form triggers
    if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
    if (modalBtnCopy) modalBtnCopy.addEventListener("click", copyLeadSummary);
    if (modalBtnCopyEmail) modalBtnCopyEmail.addEventListener("click", copyEmailPitch);
    if (modalBtnSend) modalBtnSend.addEventListener("click", handleSendPitch);
    if (btnGeneratePitch) btnGeneratePitch.addEventListener("click", generateAiPitch);
    if (modalCrmStatus) modalCrmStatus.addEventListener("change", handleCrmStatusChange);
    if (modalEmailBody) modalEmailBody.addEventListener("input", handleEmailBodyInput);
    
    // Lead form auto-sync database listeners
    if (modalAuthorName) modalAuthorName.addEventListener("change", saveLeadDetailsFromModal);
    if (modalCompanyName) modalCompanyName.addEventListener("change", saveLeadDetailsFromModal);
    if (modalBuyingIntent) modalBuyingIntent.addEventListener("change", saveLeadDetailsFromModal);
    if (modalIntentType) modalIntentType.addEventListener("change", saveLeadDetailsFromModal);
    if (modalServiceRequired) modalServiceRequired.addEventListener("change", saveLeadDetailsFromModal);
    if (modalIndustry) modalIndustry.addEventListener("change", saveLeadDetailsFromModal);
    if (modalLocation) modalLocation.addEventListener("change", saveLeadDetailsFromModal);
    if (modalNeedDescription) modalNeedDescription.addEventListener("change", saveLeadDetailsFromModal);
    if (modalContactInfo) modalContactInfo.addEventListener("change", saveLeadDetailsFromModal);
    
    // Verification & Export links
    if (btnExportCsvSidebar) btnExportCsvSidebar.addEventListener("click", exportCampaignCSV);
    if (btnEnrichContact) btnEnrichContact.addEventListener("click", enrichContactEmail);

    // Saved searches and active monitoring triggers
    if (btnSaveSearch) btnSaveSearch.addEventListener("click", saveCurrentSearch);
    if (btnRunMonitoring) btnRunMonitoring.addEventListener("click", runActiveMonitoring);
    
    // Drag-and-Drop Columns Listener
    initDragAndDrop();
    
    // Drawer overlay close detection
    if (detailModal) {
        detailModal.addEventListener("click", (e) => {
            if (e.target === detailModal) closeModal();
        });
    }

    // Initialize Lead Discovery Wizard Wizard
    initWizard();

    // Initialize Search Archive filters
    initArchiveViews();

    // Initialize Outreach Config Live Preview tabs
    initConfigPreviewTabs();
});

// View Tabs Switcher
function switchTab(tabName) {
    const tabs = {
        "dashboard": { btn: tabBtnDashboard, view: viewDashboard },
        "discovery": { btn: tabBtnDiscovery, view: viewDiscovery },
        "pipeline": { btn: tabBtnPipeline, view: viewPipeline },
        "archive": { btn: tabBtnArchive, view: viewArchive },
        "settings": { btn: tabBtnSettings, view: viewSettings }
    };

    Object.keys(tabs).forEach(name => {
        const item = tabs[name];
        if (!item.btn || !item.view) return;
        if (name === tabName) {
            item.btn.classList.add("active");
            item.view.classList.add("active");
        } else {
            item.btn.classList.remove("active");
            item.view.classList.remove("active");
        }
    });

    if (tabName === "pipeline") {
        renderKanban();
    } else if (tabName === "dashboard") {
        loadPerformanceAnalytics();
        renderLeads();
    } else if (tabName === "discovery") {
        loadSavedSearches();
    } else if (tabName === "archive") {
        archiveCurrentPage = 1;
        loadSearchHistory();
        renderArchiveLeads();
    } else if (tabName === "settings") {
        updateConfigPreview();
    }
}

// REST Lead Load
async function loadExistingLeads() {
    try {
        const response = await fetch("/api/leads");
        const data = await response.json();
        leadsData = data.leads || [];
        
        // Populate primary stats banner counts globally
        updateGlobalStats(leadsData);
        loadPerformanceAnalytics();
        renderRecommendedLeads();
        renderRecentActivity();
        
        // Initial render matches currently open view
        if (viewDashboard && viewDashboard.classList.contains("active")) {
            renderLeads();
        } else if (viewPipeline && viewPipeline.classList.contains("active")) {
            renderKanban();
        } else if (viewArchive && viewArchive.classList.contains("active")) {
            renderArchiveLeads();
        }
    } catch (error) {
        console.error("Failed loading Leads database:", error);
    }
}

// Scrape Submit
async function handleSearchSubmit(e) {
    e.preventDefault();
    
    const keyword = keywordInput.value.trim();
    const timeframe = timeframeSelect.value;
    const limit = parseInt(limitSelect.value);
    const platform = platformSelect ? platformSelect.value : "linkedin";
    const matchTypeSelect = document.getElementById("match-type");
    const match_type = matchTypeSelect ? matchTypeSelect.value : "partial";
    
    if (!keyword) return;
    
    setSearchLoading(true, platform);
    
    let progress = 5;
    loadingProgress.style.width = `${progress}%`;
    
    const interval = setInterval(() => {
        if (progress < 90) {
            progress += Math.floor(Math.random() * 8) + 2;
            loadingProgress.style.width = `${progress}%`;
            
            if (progress > 30 && progress < 60) {
                loadingStatusText.innerText = "Analyzing post relevance with Llama-3.3 Agent...";
            } else if (progress >= 60) {
                loadingStatusText.innerText = "Extracting details and scoring lead quality...";
            }
        }
    }, 1200);
    
    try {
        const response = await fetch("/api/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ keyword, timeframe, limit, platform, match_type })
        });
        
        if (!response.ok) {
            throw new Error(`Search request failed: ${response.statusText}`);
        }
        
        clearInterval(interval);
        loadingProgress.style.width = "100%";
        
        // Fetch new state and jump to dashboard view
        await loadExistingLeads();
        
        setTimeout(() => {
            setSearchLoading(false);
            // Reset wizard step
            wizardCurrentStep = 1;
            const wizardPanels = document.querySelectorAll(".wizard-step-panel");
            wizardPanels.forEach(p => p.classList.remove("active"));
            document.querySelector(".wizard-step-panel[data-step='1']").classList.add("active");
            
            switchTab("dashboard");
        }, 500);
        
    } catch (error) {
        clearInterval(interval);
        setSearchLoading(false);
        alert(`Lead scraper error: ${error.message}`);
        console.error(error);
    }
}

function setSearchLoading(isLoading, platform = "linkedin") {
    if (isLoading) {
        btnSearch.disabled = true;
        btnSearch.querySelector("span").innerText = "Scanning...";
        loadingState.style.display = "flex";
        const capPlatform = platform === "all" ? "All Web Sources" : platform.charAt(0).toUpperCase() + platform.slice(1);
        loadingStatusText.innerText = `Querying ${capPlatform} via Google Serper API...`;
    } else {
        btnSearch.disabled = false;
        btnSearch.querySelector("span").innerText = "Launch AI Scan";
        loadingState.style.display = "none";
    }
}

// Header Stats update
function updateGlobalStats(leadsList) {
    if (statTotal) statTotal.innerText = leadsList.length;
    
    // Qualified Leads are High Intent + Medium Intent
    const qualified = leadsList.filter(l => {
        const category = l.leadCategory || "";
        if (category) {
            return category === "High Intent" || category === "Medium Intent";
        }
        const status = (l.leadStatus || "").toLowerCase();
        return status.includes("qualif") || status.includes("warm") || status.includes("prospect");
    });
    if (statQualified) statQualified.innerText = qualified.length;
    
    const activeOutreach = leadsList.filter(l => {
        const stage = (l.crmStatus || "").toLowerCase();
        return stage === "drafted" || stage === "emailed" || stage === "replied";
    });
    if (statActiveOutreach) statActiveOutreach.innerText = activeOutreach.length;
    
    let totalScore = 0;
    let count = 0;
    leadsList.forEach(l => {
        let score = l.leadScore;
        if (score === undefined || score === null) {
            score = parseFloat(l.confidenceScore);
            if (!isNaN(score)) {
                if (score <= 1.0) score = score * 100;
            }
        }
        if (score !== undefined && score !== null && !isNaN(score)) {
            totalScore += score;
            count++;
        }
    });
    
    const avgScore = count > 0 ? Math.round(totalScore / count) : 0;
    if (statConfidence) statConfidence.innerText = `${avgScore}%`;

    // Hide trend badges when card metric value is 0
    const trendTotal = document.getElementById("trend-total");
    const trendQualified = document.getElementById("trend-qualified");
    const trendActiveOutreach = document.getElementById("trend-active-outreach");
    const trendConfidence = document.getElementById("trend-confidence");

    if (trendTotal) trendTotal.style.display = leadsList.length === 0 ? "none" : "flex";
    if (trendQualified) trendQualified.style.display = qualified.length === 0 ? "none" : "flex";
    if (trendActiveOutreach) trendActiveOutreach.style.display = activeOutreach.length === 0 ? "none" : "flex";
    if (trendConfidence) trendConfidence.style.display = avgScore === 0 ? "none" : "flex";

    // Sidebar Limits update
    const usageLeads = document.getElementById("usage-leads-discovered");
    const usageOutreach = document.getElementById("usage-outreach-count");
    if (usageLeads) usageLeads.innerText = leadsList.length;
    if (usageOutreach) usageOutreach.innerText = activeOutreach.length;

    // Funnel Chart update
    updateFunnelChart(leadsList);
}

// Funnel chart calculations
function updateFunnelChart(leadsList) {
    const totalCount = leadsList.length;
    const qualifiedCount = leadsList.filter(l => {
        const category = l.leadCategory || "";
        return category === "High Intent" || category === "Medium Intent";
    }).length;
    
    const outreachCount = leadsList.filter(l => {
        const stage = (l.crmStatus || "").toLowerCase();
        return ["drafted", "emailed", "replied"].includes(stage);
    }).length;

    const repliedCount = leadsList.filter(l => (l.crmStatus || "").toLowerCase() === "replied").length;

    const funnelTotal = document.getElementById("funnel-val-total");
    const funnelQualified = document.getElementById("funnel-val-qualified");
    const funnelOutreach = document.getElementById("funnel-val-outreach");
    const funnelReplied = document.getElementById("funnel-val-replied");

    const barQualified = document.getElementById("funnel-bar-qualified");
    const barOutreach = document.getElementById("funnel-bar-outreach");
    const barReplied = document.getElementById("funnel-bar-replied");

    if (funnelTotal) funnelTotal.innerText = totalCount;
    if (funnelQualified) funnelQualified.innerText = qualifiedCount;
    if (funnelOutreach) funnelOutreach.innerText = outreachCount;
    if (funnelReplied) funnelReplied.innerText = repliedCount;

    if (barQualified) barQualified.style.width = totalCount > 0 ? `${Math.round((qualifiedCount / totalCount) * 100)}%` : "0%";
    if (barOutreach) barOutreach.style.width = totalCount > 0 ? `${Math.round((outreachCount / totalCount) * 100)}%` : "0%";
    if (barReplied) barReplied.style.width = totalCount > 0 ? `${Math.round((repliedCount / totalCount) * 100)}%` : "0%";
}

// Badge styling
function getStatusBadgeClass(status) {
    const s = (status || "").toLowerCase();
    if (s.includes("unqualified") || s.includes("not")) return "badge-danger";
    if (s.includes("qualif") || s.includes("prospect")) return "badge-success";
    if (s.includes("warm") || s.includes("potential")) return "badge-warning";
    if (s.includes("info")) return "badge-info";
    return "badge-neutral";
}

function getIntentBadgeClass(intent) {
    const i = (intent || "").toLowerCase();
    if (i.includes("high") || i.includes("hiring")) return "badge-success";
    if (i.includes("med") || i.includes("warm") || i.includes("research")) return "badge-warning";
    if (i.includes("low")) return "badge-neutral";
    return "badge-neutral";
}

function getCrmBadgeClass(crmStatus) {
    const s = (crmStatus || "New").toLowerCase();
    if (s === "new") return "badge-neutral";
    if (s === "new discovery") return "badge-success";
    if (s === "drafted") return "badge-info";
    if (s === "emailed") return "badge-warning";
    if (s === "replied") return "badge-success";
    if (s === "disqualified") return "badge-danger";
    return "badge-neutral";
}

function getLeadPlatform(lead) {
    if (lead.platform) return lead.platform.toLowerCase();
    const url = (lead.sourceUrl || "").toLowerCase();
    if (url.includes("facebook.com")) return "facebook";
    if (url.includes("twitter.com") || url.includes("x.com")) return "twitter";
    if (url.includes("reddit.com")) return "reddit";
    return "linkedin";
}

// Avatar generator helper using UI Initials Avatar API
function getLeadAvatarUrl(name) {
    const cleanName = (name || "U").trim();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=0EA5A4&color=fff&size=64&bold=true`;
}

function getCompanyLogoUrl(company) {
    const cleanComp = (company || "C").trim();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanComp)}&background=037172&color=F8FAFC&size=48&bold=true`;
}

// Grid rows list population matching proposal design
function renderLeads() {
    const dashboardEmptyState = document.getElementById("dashboard-empty-state");
    const dashboardWidgetsGrid = document.getElementById("dashboard-widgets-grid");
    const dashboardLeadsTableCard = document.getElementById("dashboard-leads-table-card");

    if (leadsData.length === 0) {
        if (dashboardEmptyState) dashboardEmptyState.style.display = "flex";
        if (dashboardWidgetsGrid) dashboardWidgetsGrid.style.display = "none";
        if (dashboardLeadsTableCard) dashboardLeadsTableCard.style.display = "none";
        updateGlobalStats(leadsData);
        return;
    } else {
        if (dashboardEmptyState) dashboardEmptyState.style.display = "none";
        if (dashboardWidgetsGrid) dashboardWidgetsGrid.style.display = "grid";
        if (dashboardLeadsTableCard) dashboardLeadsTableCard.style.display = "block";
    }

    if (!leadsTbody) return;
    leadsTbody.innerHTML = "";
    
    const statusVal = filterStatus ? filterStatus.value.toLowerCase() : "all";
    const crmVal = filterCrm ? filterCrm.value.toLowerCase() : "all";
    const platformVal = filterPlatform ? filterPlatform.value.toLowerCase() : "all";
    const searchVal = globalSearch ? globalSearch.value.trim().toLowerCase() : "";
    
    const filtered = leadsData.filter(lead => {
        const leadStatus = String(lead.leadStatus || "").toLowerCase();
        const statusMatch = statusVal === "all" || leadStatus.includes(statusVal);
        
        const leadCrm = String(lead.crmStatus || "New").toLowerCase();
        const crmMatch = crmVal === "all" || leadCrm === crmVal;
        
        const leadPlatform = getLeadPlatform(lead);
        const platformMatch = platformVal === "all" || leadPlatform === platformVal;
        
        const author = String(lead.authorName || "").toLowerCase();
        const company = String(lead.companyName || "").toLowerCase();
        const need = String(lead.needDescription || "").toLowerCase();
        const service = Array.isArray(lead.serviceRequired) 
            ? lead.serviceRequired.join(", ").toLowerCase() 
            : String(lead.serviceRequired || "").toLowerCase();
        const industry = String(lead.industry || "").toLowerCase();
        const location = String(lead.location || "").toLowerCase();
        
        let searchMatch = true;
        if (searchVal) {
            const searchWords = searchVal.split(/\s+/).filter(w => w.length > 0);
            const combinedText = [author, company, need, service, industry, location].join(" ");
            searchMatch = searchWords.every(word => {
                if (combinedText.includes(word)) return true;
                if (word === "manager" && combinedText.includes("management")) return true;
                if (word === "management" && combinedText.includes("manager")) return true;
                if (word === "designer" && combinedText.includes("design")) return true;
                if (word === "design" && combinedText.includes("designer")) return true;
                if (word === "developer" && combinedText.includes("develop")) return true;
                if (word === "dev" && combinedText.includes("develop")) return true;
                return false;
            });
        }
            
        return statusMatch && crmMatch && platformMatch && searchMatch;
    });
    
    // Keep stats updated based on table matching rows
    updateGlobalStats(leadsData);
    
    if (filtered.length === 0) {
        if (emptyState) emptyState.style.display = "flex";
        if (tableWrapper) tableWrapper.style.display = "none";
        return;
    }
    
    if (emptyState) emptyState.style.display = "none";
    if (tableWrapper) tableWrapper.style.display = "block";
    
    // Sort matching leads by structured intent score (descending)
    filtered.sort((a, b) => {
        let scoreA = a.leadScore !== undefined ? a.leadScore : (parseFloat(a.confidenceScore) || 0) * 100;
        let scoreB = b.leadScore !== undefined ? b.leadScore : (parseFloat(b.confidenceScore) || 0) * 100;
        return scoreB - scoreA;
    });
    
    // Slice to top 5 leads for the dashboard view
    const top5Leads = filtered.slice(0, 5);
    
    top5Leads.forEach((lead, idx) => {
        const row = document.createElement("tr");
        row.style.cursor = "pointer";
        
        row.addEventListener("click", (e) => {
            if (e.target.closest("a") || e.target.closest("button")) return;
            openDetailModal(lead);
        });
        
        const displayAuthor = lead.authorName || "Unknown Poster";
        const displayCompany = lead.companyName || "No Company Details";
        const displayRole = Array.isArray(lead.serviceRequired)
            ? lead.serviceRequired.join(", ")
            : (lead.serviceRequired || lead.industry || "Prospect Partner");
        const displayIntentType = lead.intentType || "General Intent";
            
        let score = lead.leadScore;
        if (score === undefined || score === null) {
            score = parseFloat(lead.confidenceScore) || 0;
            if (score <= 1.0 && score > 0) score = Math.round(score * 100);
            if (score === 0) score = 40;
        }
        
        let cleanIntent = lead.leadCategory || lead.buyingIntent || 'Low';
        if (cleanIntent.toLowerCase().includes("high")) cleanIntent = "High";
        else if (cleanIntent.toLowerCase().includes("medium") || cleanIntent.toLowerCase().includes("warm")) cleanIntent = "Medium";
        else if (cleanIntent.toLowerCase().includes("low")) cleanIntent = "Low";
        else if (cleanIntent.length > 15) cleanIntent = cleanIntent.substring(0, 15) + "...";
        
        let displayIntent = cleanIntent;
        if (!displayIntent.toLowerCase().includes("intent")) {
            displayIntent = displayIntent + " Intent";
        }
        
        const emailVal = lead.contactInfo || "";
        const isEmailValid = emailVal && emailVal.includes('@') && emailVal !== 'hello@company.com';
        const isEmailVerified = isEmailValid && lead.contactSource !== 'guessed';
        const emailBadgeLabel = isEmailVerified ? 'Verified' : (lead.contactSource === 'guessed' ? 'Guessed' : 'Unverified');
        const emailBadgeClass = isEmailVerified ? 'badge-success' : (lead.contactSource === 'guessed' ? 'badge-warning' : 'badge-neutral');
        const emailBadgeIcon = isEmailVerified ? 'check' : (lead.contactSource === 'guessed' ? 'help-circle' : 'help-circle');
            
        const platform = getLeadPlatform(lead);
        let platformBadgeColor = "rgba(124, 92, 255, 0.1)";
        let platformColor = "var(--primary)";
        let platformIconName = "linkedin";
        let displayPlatform = "LinkedIn";
        if (platform === "facebook") {
            platformBadgeColor = "rgba(24, 213, 176, 0.1)";
            platformColor = "var(--secondary)";
            platformIconName = "facebook";
            displayPlatform = "Facebook";
        } else if (platform === "twitter") {
            platformBadgeColor = "var(--bg-trans-4)";
            platformColor = "#9CA3AF";
            platformIconName = "twitter";
            displayPlatform = "Twitter/X";
        } else if (platform === "reddit") {
            platformBadgeColor = "rgba(77, 163, 255, 0.1)";
            platformColor = "var(--highlight)";
            platformIconName = "message-square";
            displayPlatform = "Reddit";
        }

        const avatarUrl = getLeadAvatarUrl(displayAuthor);
        const logoUrl = getCompanyLogoUrl(displayCompany);
 
        let contactHtml = "";
        if (isEmailValid) {
            contactHtml = `
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <i data-lucide="${isEmailVerified ? 'check-circle-2' : 'help-circle'}" style="width: 14px; height: 14px; color: ${isEmailVerified ? 'var(--success)' : 'var(--text-muted)'}; flex-shrink: 0;"></i>
                    <span style="font-size: 0.78rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;" title="${emailVal}">${emailVal}</span>
                </div>
            `;
        } else if (emailVal && emailVal.toLowerCase().includes('linkedin') && emailVal !== 'hello@company.com') {
            contactHtml = `
                <a href="${lead.sourceUrl}" target="_blank" style="font-size: 0.78rem; color: var(--primary); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; font-weight: 500;">
                    ${getPlatformIconSvg("linkedin", 12)}
                    <span>LinkedIn Profile</span>
                </a>
            `;
        } else {
            contactHtml = `<span class="no-data">No email found</span>`;
        }

        const recPlatformSvg = getPlatformIconSvg(platform, 13, `color: ${platformColor}; flex-shrink: 0;`);
        row.innerHTML = `
            <td>
                <div class="contact-cell">
                    <img src="${avatarUrl}" class="contact-avatar" alt="Avatar">
                    <div class="contact-name-info">
                        <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.15rem;">
                            <span class="contact-full-name">${displayAuthor}</span>
                            ${recPlatformSvg}
                        </div>
                        <span class="contact-role">${displayRole}</span>
                    </div>
                </div>
            </td>
            <td>
                <div class="company-cell">
                    <img src="${logoUrl}" style="width: 20px; height: 20px; border-radius: 4px;" alt="Logo">
                    <span class="company-name">${displayCompany}</span>
                </div>
            </td>
            <td>
                <div style="display: flex; flex-direction: column; gap: 0.25rem; min-width: 110px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.72rem; font-weight: 500; color: var(--text-primary);">
                        <span>${displayIntent}</span>
                        <span>${score}%</span>
                    </div>
                    <div style="width: 100%; height: 5px; background: var(--bg-trans-5); border-radius: 3px; overflow: hidden;">
                        <div style="width: ${score}%; height: 100%; background: var(--primary-gradient); border-radius: 3px;"></div>
                    </div>
                </div>
            </td>
            <td>
                ${contactHtml}
            </td>
            <td>
                <div style="display: flex; gap: 0.5rem;" onclick="event.stopPropagation()">
                    <a href="${lead.sourceUrl}" class="action-btn" target="_blank" title="View Source Post">
                        <i data-lucide="external-link" style="width: 13px; height: 13px;"></i>
                    </a>
                    <button class="action-btn btn-row-copy" title="Copy Lead details">
                        <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
                    </button>
                </div>
            </td>
        `;
        
        row.querySelector(".btn-row-copy").addEventListener("click", () => {
            copyToClipboard(getFormattedLeadSummary(lead));
        });
        
        leadsTbody.appendChild(row);
    });
    
    lucide.createIcons();
}

// Kanban pipeline Columns populator
function renderKanban() {
    const columns = {
        "New": { cards: document.getElementById("cards-new"), count: document.getElementById("count-new"), items: [] },
        "Drafted": { cards: document.getElementById("cards-drafted"), count: document.getElementById("count-drafted"), items: [] },
        "Emailed": { cards: document.getElementById("cards-emailed"), count: document.getElementById("count-emailed"), items: [] },
        "Replied": { cards: document.getElementById("cards-replied"), count: document.getElementById("count-replied"), items: [] },
        "Disqualified": { cards: document.getElementById("cards-disqualified"), count: document.getElementById("count-disqualified"), items: [] }
    };
    
    Object.keys(columns).forEach(stage => {
        if (columns[stage].cards) columns[stage].cards.innerHTML = "";
    });
    
    leadsData.forEach(lead => {
        const stage = lead.crmStatus || "New";
        const matchedColumn = columns[stage] || columns["New"];
        matchedColumn.items.push(lead);
    });
    
    Object.keys(columns).forEach(stage => {
        const col = columns[stage];
        if (!col.cards || !col.count) return;
        col.count.innerText = col.items.length;
        
        if (col.items.length === 0) {
            col.cards.innerHTML = `<div style="color: var(--text-muted); font-size: 0.72rem; text-align: center; padding: 2rem 0; font-style: italic;">No leads in stage</div>`;
            return;
        }
        
        col.items.forEach(lead => {
            const card = document.createElement("div");
            card.className = "kanban-card";
            card.draggable = true;
            
            card.addEventListener("dblclick", () => openDetailModal(lead));
            
            card.addEventListener("dragstart", (e) => {
                e.dataTransfer.setData("text/plain", lead.sourceUrl);
                card.style.opacity = "0.4";
            });
            
            card.addEventListener("dragend", () => {
                card.style.opacity = "1";
            });
            
            let score = lead.leadScore;
            if (score === undefined || score === null) {
                score = parseFloat(lead.confidenceScore) || 0;
                if (score <= 1.0 && score > 0) score = Math.round(score * 100);
                if (score === 0) score = 40;
            }
            
            const displayCompany = lead.companyName || "No Company Details";
            const displayRequirement = lead.serviceRequired || lead.needDescription || "No requirement extracted";
            
            // Opportunity value calculation
            const estVal = score > 65 ? `$5,000` : `$2,500`;

            const r = 7;
            const circ = 2 * Math.PI * r;
            const offset = circ - (score / 100) * circ;

            const platform = getLeadPlatform(lead);
            let platformColor = "var(--primary)";
            let platformIcon = "linkedin";
            if (platform === "facebook") {
                platformColor = "var(--secondary)";
                platformIcon = "facebook";
            } else if (platform === "reddit") {
                platformColor = "var(--highlight)";
                platformIcon = "message-square";
            } else if (platform === "twitter") {
                platformColor = "#9CA3AF";
                platformIcon = "twitter";
            }

            const avatarUrl = getLeadAvatarUrl(lead.authorName || "Unknown");
            const logoUrl = getCompanyLogoUrl(displayCompany);

            card.innerHTML = `
                <!-- Hover Quick Actions -->
                <div class="card-hover-actions">
                    <button class="card-hover-btn btn-open" title="Expand Lead Details"><i data-lucide="expand" style="width:10px; height:10px;"></i></button>
                    <a href="${lead.sourceUrl}" class="card-hover-btn" target="_blank" title="View Source Post"><i data-lucide="external-link" style="width:10px; height:10px;"></i></a>
                </div>

                <div class="card-header-row">
                    <div class="card-author-info">
                        <img src="${avatarUrl}" class="card-avatar" alt="Avatar">
                        <span class="card-name">${lead.authorName || "Unknown Poster"}</span>
                    </div>
                    <span class="platform-mini-badge" style="background: rgba(255,255,255,0.03); color: ${platformColor};">
                        <i data-lucide="${platformIcon}" style="width: 10px; height: 10px;"></i>
                    </span>
                </div>

                <div class="card-company-row">
                    <img src="${logoUrl}" style="width: 12px; height: 12px; border-radius: 2px;" alt="Logo">
                    <span class="card-company-name">${displayCompany}</span>
                </div>

                <div class="card-service-desc">${displayRequirement}</div>

                <div class="card-metrics-row">
                    <!-- Circular Score Match -->
                    <div class="score-circle-wrapper">
                        <svg class="score-circle-svg" viewBox="0 0 18 18">
                            <circle class="score-circle-bg" cx="9" cy="9" r="${r}"></circle>
                            <circle class="score-circle-val" cx="9" cy="9" r="${r}" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"></circle>
                        </svg>
                        <span class="score-circle-text">${score}%</span>
                    </div>

                    <span class="card-value">${estVal} Val</span>
                </div>
            `;
            
            card.querySelector(".btn-open").addEventListener("click", (e) => {
                e.stopPropagation();
                openDetailModal(lead);
            });

            col.cards.appendChild(card);
        });
    });
    
    lucide.createIcons();
}

function initDragAndDrop() {
    const columns = document.querySelectorAll(".kanban-column");
    columns.forEach(col => {
        col.addEventListener("dragover", (e) => {
            e.preventDefault();
            col.style.borderColor = "var(--primary)";
            col.style.background = "rgba(124, 92, 255, 0.03)";
        });
        
        col.addEventListener("dragleave", () => {
            col.style.borderColor = "";
            col.style.background = "";
        });
        
        col.addEventListener("drop", async (e) => {
            e.preventDefault();
            col.style.borderColor = "";
            col.style.background = "";
            
            const leadUrl = e.dataTransfer.setData ? "" : ""; // fallback
            const targetStage = col.getAttribute("data-stage");
            
            // HTML5 dataTransfer compatibility
            let transferUrl = "";
            try {
                transferUrl = e.dataTransfer.getData("text/plain");
            } catch(err){}

            if (!transferUrl) return;

            const lead = leadsData.find(l => l.sourceUrl === transferUrl);
            if (lead && lead.crmStatus !== targetStage) {
                lead.crmStatus = targetStage;
                
                if (activeLead && activeLead.sourceUrl === lead.sourceUrl) {
                    modalCrmStatus.value = targetStage;
                }
                
                // Redraw instantly
                renderKanban();
                
                try {
                    await fetch("/api/leads/update", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            sourceUrl: lead.sourceUrl,
                            crmStatus: targetStage,
                            draftEmail: lead.draftEmail || ""
                        })
                    });
                    // Refresh dashboard data too
                    updateGlobalStats(leadsData);
                } catch (err) {
                    console.error("Drag stage update error:", err);
                }
            }
        });
    });
}

// Slide Drawer Opening controls
function openDetailModal(lead) {
    activeLead = lead;
    
    modalAuthorName.value = lead.authorName || "";
    modalCompanyName.value = lead.companyName || "";
    modalBuyingIntent.value = lead.buyingIntent || "Unknown";
    modalServiceRequired.value = Array.isArray(lead.serviceRequired)
        ? lead.serviceRequired.join(", ")
        : (lead.serviceRequired || "");
        
    modalIndustry.value = lead.industry || "";
    modalLocation.value = lead.location || "";
    
    modalNeedDescription.value = lead.needDescription || "";
    
    // Check if email is null, undefined, hello@company.com, or empty
    const emailVal = lead.contactInfo || "";
    const isEmailValid = emailVal && emailVal.includes('@') && emailVal !== 'hello@company.com';
    const noEmailSpan = document.getElementById("modal-email-no-data");
    
    if (isEmailValid) {
        modalContactInfo.value = emailVal;
        if (noEmailSpan) noEmailSpan.style.display = "none";
    } else {
        modalContactInfo.value = "";
        if (noEmailSpan) noEmailSpan.style.display = "block";
    }
    
    let score = lead.leadScore;
    if (score === undefined || score === null) {
        score = parseFloat(lead.confidenceScore) || 0;
        if (score <= 1.0 && score > 0) score = Math.round(score * 100);
    }
    if (modalLeadScore) modalLeadScore.innerText = score;

    const category = lead.leadCategory || "Low Intent";
    if (modalLeadCategory) {
        modalLeadCategory.innerText = category;
        modalLeadCategory.className = "badge"; // reset classes
        if (category === "High Intent") {
            modalLeadCategory.classList.add("badge-success");
        } else if (category === "Medium Intent") {
            modalLeadCategory.classList.add("badge-warning");
        } else {
            modalLeadCategory.classList.add("badge-neutral");
        }
    }

    if (modalIntentType) modalIntentType.value = lead.intentType || "General Discussion";
    if (modalContactSource) modalContactSource.innerText = lead.contactSource || "guessed";
    if (modalContactConfidence) modalContactConfidence.innerText = lead.contactConfidence || "low";
    
    modalBtnLinkedin.href = lead.sourceUrl || "#";
    
    // Update platform button visual dynamically based on source url
    if (lead.sourceUrl.includes("facebook.com")) {
        modalBtnLinkedin.innerHTML = `${getPlatformIconSvg("facebook", 14)} View Facebook`;
    } else if (lead.sourceUrl.includes("twitter.com") || lead.sourceUrl.includes("x.com")) {
        modalBtnLinkedin.innerHTML = `${getPlatformIconSvg("twitter", 14)} View Twitter/X`;
    } else if (lead.sourceUrl.includes("reddit.com")) {
        modalBtnLinkedin.innerHTML = `${getPlatformIconSvg("reddit", 14)} View Reddit`;
    } else {
        modalBtnLinkedin.innerHTML = `${getPlatformIconSvg("linkedin", 14)} View LinkedIn`;
    }
    
    modalCrmStatus.value = lead.crmStatus || "New";
    
    // Load existing drafts
    if (lead.draftEmail) {
        modalEmailBody.value = lead.draftEmail;
        modalEmailBody.style.display = "block";
        emailBodyPlaceholder.style.display = "none";
        modalBtnSend.disabled = false;
        modalBtnCopyEmail.disabled = false;
    } else {
        modalEmailBody.value = "";
        modalEmailBody.style.display = "none";
        emailBodyPlaceholder.style.display = "block";
        modalBtnSend.disabled = true;
        modalBtnCopyEmail.disabled = true;
    }
    
    detailModal.classList.add("active");
    document.body.style.overflow = "hidden"; // Keep background scroll locked
    lucide.createIcons();
}

function closeModal() {
    detailModal.classList.remove("active");
    document.body.style.overflow = "auto";
    activeLead = null;
}

// FastAPI Lead Sync
async function syncLeadToBackend() {
    if (!activeLead) return;
    try {
        const response = await fetch("/api/leads/update", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                sourceUrl: activeLead.sourceUrl,
                crmStatus: activeLead.crmStatus,
                draftEmail: activeLead.draftEmail || "",
                authorName: activeLead.authorName || "",
                companyName: activeLead.companyName || "",
                buyingIntent: activeLead.buyingIntent || "",
                intentType: activeLead.intentType || "",
                serviceRequired: activeLead.serviceRequired || "",
                industry: activeLead.industry || "",
                location: activeLead.location || "",
                needDescription: activeLead.needDescription || "",
                contactInfo: activeLead.contactInfo || ""
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            const idx = leadsData.findIndex(l => l.sourceUrl === activeLead.sourceUrl);
            if (idx !== -1) {
                leadsData[idx] = data.lead;
            }
            // Update UI views
            if (viewDashboard && viewDashboard.classList.contains("active")) renderLeads();
            if (viewArchive && viewArchive.classList.contains("active")) renderArchiveLeads();
            updateGlobalStats(leadsData);
        }
    } catch (e) {
        console.error("Backend synchronizer error:", e);
    }
}

function handleCrmStatusChange() {
    if (!activeLead) return;
    activeLead.crmStatus = modalCrmStatus.value;
    syncLeadToBackend();
}

function handleEmailBodyInput() {
    if (!activeLead) return;
    activeLead.draftEmail = modalEmailBody.value;
    if (modalEmailBody.value.trim()) {
        modalBtnSend.disabled = false;
        modalBtnCopyEmail.disabled = false;
    } else {
        modalBtnSend.disabled = true;
        modalBtnCopyEmail.disabled = true;
    }
}

// AI Cold Outreach drafting (Groq Llama-3.3)
async function generateAiPitch() {
    if (!activeLead) return;
    
    btnGeneratePitch.disabled = true;
    emailLoader.style.display = "block";
    emailBodyPlaceholder.style.display = "none";
    modalEmailBody.style.display = "none";
    
    try {
        const agencyName = agencyNameInput.value.trim() || "Silvia Team";
        const agencyInfo = agencyInfoInput.value.trim() || "premier design & development services";
        const emailTone = emailToneSelect.value || "Short & Conversational";

        const response = await fetch("/api/generate-pitch", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                sourceUrl: activeLead.sourceUrl,
                agencyName: agencyName,
                agencyInfo: agencyInfo,
                emailTone: emailTone
            })
        });
        
        if (!response.ok) throw new Error("FastAPI generation request rejected.");
        
        const data = await response.json();
        
        activeLead.draftEmail = data.pitch;
        activeLead.crmStatus = data.crmStatus;
        
        modalCrmStatus.value = data.crmStatus;
        modalEmailBody.value = data.pitch;
        
        emailLoader.style.display = "none";
        modalEmailBody.style.display = "block";
        
        modalBtnSend.disabled = false;
        modalBtnCopyEmail.disabled = false;
        
        const idx = leadsData.findIndex(l => l.sourceUrl === activeLead.sourceUrl);
        if (idx !== -1) {
            leadsData[idx].draftEmail = data.pitch;
            leadsData[idx].crmStatus = data.crmStatus;
        }
        
        if (viewDashboard && viewDashboard.classList.contains("active")) renderLeads();
        if (viewArchive && viewArchive.classList.contains("active")) renderArchiveLeads();
        updateGlobalStats(leadsData);
    } catch (e) {
        emailLoader.style.display = "none";
        emailBodyPlaceholder.style.display = "block";
        alert("Pitch generator error: " + e.message);
    } finally {
        btnGeneratePitch.disabled = false;
    }
}

// Client mailto link execution
async function handleSendPitch() {
    if (!activeLead || !modalEmailBody.value.trim()) return;
    
    const emailText = modalEmailBody.value;
    let subject = "Outreach Details";
    let body = emailText;
    
    if (emailText.includes("Subject:")) {
        const lines = emailText.split("\n");
        const subLine = lines.find(l => l.toLowerCase().startsWith("subject:"));
        if (subLine) {
            subject = subLine.substring(8).trim();
            body = lines.filter(l => !l.toLowerCase().startsWith("subject:")).join("\n").trim();
        }
    }
    
    const contactEmail = activeLead.contactInfo && activeLead.contactInfo.includes("@") ? activeLead.contactInfo : "";
    const mailtoUrl = `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    window.open(mailtoUrl, "_blank");
    
    // Automatically advance stage to Emailed
    activeLead.crmStatus = "Emailed";
    modalCrmStatus.value = "Emailed";
    await syncLeadToBackend();
}

function copyEmailPitch() {
    if (!modalEmailBody.value.trim()) return;
    copyToClipboard(modalEmailBody.value);
}

function getFormattedLeadSummary(lead) {
    return `Lead Detail Summary:
-------------------------
Author: ${lead.authorName || "Unknown"}
Company: ${lead.companyName || "Unknown"}
Service Needed: ${lead.serviceRequired || "Not Specified"}
Buying Intent: ${lead.buyingIntent || "None"}
Location: ${lead.location || "Not Specified"}
Need Description: ${lead.needDescription || "None"}
Contact: ${lead.contactInfo || "LinkedIn Profile"}
Confidence: ${lead.confidenceScore}
CRM Stage: ${lead.crmStatus || "New"}
Source Post: ${lead.sourceUrl || "N/A"}`;
}

function copyLeadSummary() {
    if (!activeLead) return;
    copyToClipboard(getFormattedLeadSummary(activeLead));
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert("Copied to clipboard!");
    }).catch(err => {
        console.error("Clipboard write error:", err);
    });
}

// Campaign outreach CSV exporter
function exportCampaignCSV() {
    if (leadsData.length === 0) {
        alert("No lead details to export!");
        return;
    }
    
    let csvRows = [];
    csvRows.push("Email,FirstName,LastName,CompanyName,Subject,Icebreaker,PostUrl,ConfidenceScore,CrmStatus");
    
    leadsData.forEach(lead => {
        const email = lead.contactInfo && lead.contactInfo.includes("@") ? lead.contactInfo : "";
        
        const author = lead.authorName || "Friend";
        const parts = author.split(" ");
        const firstName = parts[0] || "Friend";
        const lastName = parts.slice(1).join(" ") || "";
        
        const company = (lead.companyName || "").replace(/"/g, '""');
        
        let subject = "Outreach";
        let body = lead.draftEmail || "";
        if (body.includes("Subject:")) {
            const lines = body.split("\n");
            const subLine = lines.find(l => l.toLowerCase().startsWith("subject:"));
            if (subLine) {
                subject = subLine.substring(8).trim().replace(/"/g, '""');
                body = lines.filter(l => !l.toLowerCase().startsWith("subject:")).join("\n").trim();
            }
        }
        body = body.replace(/"/g, '""');
        
        const postUrl = lead.sourceUrl || "";
        const score = lead.confidenceScore || 0;
        const status = lead.crmStatus || "New";
        
        csvRows.push(`"${email}","${firstName}","${lastName}","${company}","${subject}","${body}","${postUrl}","${score}","${status}"`);
    });
    
    const csvString = csvRows.join("\r\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "silvia_campaign_outreach.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Real-time contact email verification Lookup
async function enrichContactEmail() {
    if (!activeLead) return;
    
    const btnEnrich = document.getElementById("btn-enrich-contact");
    const enrichLoader = document.getElementById("enrich-loader");
    
    btnEnrich.disabled = true;
    enrichLoader.style.display = "flex";
    
    try {
        const response = await fetch("/api/enrich-contact", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                sourceUrl: activeLead.sourceUrl
            })
        });
        
        if (!response.ok) throw new Error("Contact verification service rejected lookup.");
        
        const data = await response.json();
        
        if (data.authorName) {
            activeLead.authorName = data.authorName;
            modalAuthorName.value = data.authorName;
        }
        if (data.companyName) {
            activeLead.companyName = data.companyName;
            modalCompanyName.value = data.companyName;
        }
        if (data.industry) {
            activeLead.industry = data.industry;
            modalIndustry.value = data.industry;
        }
        if (data.location) {
            activeLead.location = data.location;
            modalLocation.value = data.location;
        }
        activeLead.contactInfo = data.contactInfo;
        modalContactInfo.value = data.contactInfo;
        
        const idx = leadsData.findIndex(l => l.sourceUrl === activeLead.sourceUrl);
        if (idx !== -1) {
            leadsData[idx] = { ...activeLead };
        }
        
        if (viewDashboard && viewDashboard.classList.contains("active")) renderLeads();
        if (viewArchive && viewArchive.classList.contains("active")) renderArchiveLeads();
        updateGlobalStats(leadsData);
    } catch (err) {
        alert("Enrichment lookup failed: " + err.message);
    } finally {
        btnEnrich.disabled = false;
        enrichLoader.style.display = "none";
    }
}

// Drawer auto-save inputs onchange
async function saveLeadDetailsFromModal() {
    if (!activeLead) return;
    
    activeLead.authorName = modalAuthorName.value;
    activeLead.companyName = modalCompanyName.value;
    activeLead.buyingIntent = modalBuyingIntent.value;
    activeLead.intentType = modalIntentType.value;
    activeLead.serviceRequired = modalServiceRequired.value;
    activeLead.industry = modalIndustry.value;
    activeLead.location = modalLocation.value;
    activeLead.needDescription = modalNeedDescription.value;
    activeLead.contactInfo = modalContactInfo.value;
    
    const idx = leadsData.findIndex(l => l.sourceUrl === activeLead.sourceUrl);
    if (idx !== -1) {
        leadsData[idx] = { ...activeLead };
    }
    
    await syncLeadToBackend();
    
    if (viewDashboard && viewDashboard.classList.contains("active")) renderLeads();
    if (viewArchive && viewArchive.classList.contains("active")) renderArchiveLeads();
}

// REST Searches Load
async function loadSearchHistory() {
    try {
        const response = await fetch("/api/searches");
        const data = await response.json();
        searchesData = data.searches || [];
        renderArchiveHistory();
    } catch (error) {
        console.error("Failed loading searches database:", error);
    }
}

// Render Search Archive History Sidebar List
function renderArchiveHistory() {
    if (!archiveHistoryList) return;
    archiveHistoryList.innerHTML = "";
    
    const searchInput = document.getElementById("archive-history-search");
    const filterVal = searchInput ? searchInput.value.trim().toLowerCase() : "";
    
    // Render "All Leads" item if filter is empty
    if (!filterVal) {
        const allItem = document.createElement("div");
        allItem.className = `history-item ${activeSearchId === "all" ? "active" : ""}`;
        allItem.addEventListener("click", () => {
            activeSearchId = "all";
            archiveCurrentPage = 1;
            renderArchiveHistory();
            renderArchiveLeads();
        });
        allItem.innerHTML = `
            <div class="history-item-accent"></div>
            <div class="history-item-header">
                <span class="history-item-keyword">All leads database</span>
                <span class="history-item-count">${leadsData.length}</span>
            </div>
            <div class="history-item-meta">
                <span><i data-lucide="globe"></i>Entire database</span>
                <span><i data-lucide="layers"></i>All Web</span>
            </div>
        `;
        archiveHistoryList.appendChild(allItem);
    }
    
    // Add history list items
    searchesData.forEach(search => {
        const displayKeyword = search.keyword || "Scan Query";
        if (filterVal && !displayKeyword.toLowerCase().includes(filterVal)) {
            return;
        }
        
        const item = document.createElement("div");
        item.className = `history-item ${activeSearchId === search.id ? "active" : ""}`;
        item.addEventListener("click", () => {
            activeSearchId = search.id;
            archiveCurrentPage = 1;
            renderArchiveHistory();
            renderArchiveLeads();
        });
        
        const leadCount = search.leadUrls ? search.leadUrls.filter(url => leadsData.some(l => l.sourceUrl === url)).length : 0;
        let formattedDate = "Recent";
        if (search.timestamp) {
            try {
                const date = new Date(search.timestamp);
                formattedDate = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            } catch (e) {
                console.error(e);
            }
        }
        
        let truncatedKeyword = displayKeyword;
        if (truncatedKeyword.length > 20) {
            truncatedKeyword = truncatedKeyword.substring(0, 20) + "...";
        }
        
        const isExact = search.matchType === "exact";
        const exactBadgeHtml = isExact ? ` <span class="badge badge-neutral" style="font-size: 0.65rem; padding: 2px 4px; line-height: 1; vertical-align: middle; margin-left: 4px; background: rgba(3,113,114,0.15); color: var(--secondary);">Exact</span>` : "";
        
        let displayTimeframe = "All Time";
        if (search.timeframe) {
            if (search.timeframe === "qdr:d") displayTimeframe = "24 Hours";
            else if (search.timeframe === "qdr:w") displayTimeframe = "Past Week";
            else if (search.timeframe === "qdr:m") displayTimeframe = "Past Month";
            else if (search.timeframe === "qdr:m2") displayTimeframe = "2 Months";
            else if (search.timeframe === "qdr:m3") displayTimeframe = "3 Months";
        }
        
        const platform = search.platform || "linkedin";
        let platformIconName = "linkedin";
        let platformColor = "var(--primary)";
        if (platform === "facebook") {
            platformIconName = "facebook";
            platformColor = "var(--secondary)";
        } else if (platform === "twitter") {
            platformIconName = "twitter";
            platformColor = "#9CA3AF";
        } else if (platform === "reddit") {
            platformIconName = "message-square";
            platformColor = "var(--highlight)";
        }
        
        const capPlatform = platform === "all" ? "All Web" : platform.charAt(0).toUpperCase() + platform.slice(1);
        if (platform === "all") {
            platformIconName = "globe";
        }
        
        item.innerHTML = `
            <div class="history-item-accent"></div>
            <div class="history-item-header">
                <span class="history-item-keyword" title="${displayKeyword}">${truncatedKeyword}${exactBadgeHtml}</span>
                <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                    <span class="history-item-count">${leadCount}</span>
                    <button class="btn-delete-search" title="Delete Search Query">
                        <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                    </button>
                </div>
            </div>
            <div class="history-item-meta">
                <span><i data-lucide="clock"></i>${formattedDate}</span>
                <span style="display: inline-flex; align-items: center; gap: 4px;">${getPlatformIconSvg(platform, 11, `color: ${platformColor}; flex-shrink: 0;`)}${capPlatform}</span>
            </div>
        `;

        const deleteBtn = item.querySelector(".btn-delete-search");
        if (deleteBtn) {
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                confirmDeleteSearch(search.id);
            });
        }

        archiveHistoryList.appendChild(item);
    });
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// Premium custom themed confirmation dialog replacement
function showCustomConfirm(message, title = "Confirm Action", type = "danger") {
    return new Promise((resolve) => {
        // Create container overlay
        const overlay = document.createElement("div");
        overlay.className = "custom-confirm-overlay";
        
        // Define theme icon
        let iconName = "alert-triangle";
        if (type === "danger") {
            iconName = "trash-2";
        } else if (type === "primary") {
            iconName = "check-circle";
        }
        
        // Modal box HTML
        overlay.innerHTML = `
            <div class="custom-confirm-box" onclick="event.stopPropagation()">
                <div class="custom-confirm-title">
                    <i data-lucide="${iconName}"></i>
                    <span>${title}</span>
                </div>
                <div class="custom-confirm-message">${message}</div>
                <div class="custom-confirm-buttons">
                    <button type="button" class="custom-confirm-btn cancel" id="custom-confirm-btn-cancel">Cancel</button>
                    <button type="button" class="custom-confirm-btn ${type}" id="custom-confirm-btn-ok">OK</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Parse the Lucide icon inside the modal
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
        // Trigger reflow then activate animation
        overlay.offsetHeight; // force reflow
        overlay.classList.add("active");
        
        const btnCancel = overlay.querySelector("#custom-confirm-btn-cancel");
        const btnOk = overlay.querySelector("#custom-confirm-btn-ok");
        
        const closeConfirm = (result) => {
            overlay.classList.remove("active");
            overlay.addEventListener("transitionend", () => {
                overlay.remove();
            }, { once: true });
            resolve(result);
        };
        
        btnCancel.addEventListener("click", () => closeConfirm(false));
        btnOk.addEventListener("click", () => closeConfirm(true));
        
        // Close on overlay background click
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                closeConfirm(false);
            }
        });
    });
}

// Premium custom themed alert modal
function showCustomAlert(message, title = "Notification", type = "primary") {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "custom-confirm-overlay";
        
        let iconName = "info";
        if (type === "primary") iconName = "info";
        else if (type === "danger") iconName = "alert-circle";
        
        overlay.innerHTML = `
            <div class="custom-confirm-box" onclick="event.stopPropagation()">
                <div class="custom-confirm-title">
                    <i data-lucide="${iconName}"></i>
                    <span>${title}</span>
                </div>
                <div class="custom-confirm-message">${message}</div>
                <div class="custom-confirm-buttons">
                    <button type="button" class="custom-confirm-btn ${type}" id="custom-confirm-btn-ok">OK</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
        overlay.offsetHeight;
        overlay.classList.add("active");
        
        const btnOk = overlay.querySelector("#custom-confirm-btn-ok");
        
        const closeAlert = () => {
            overlay.classList.remove("active");
            overlay.addEventListener("transitionend", () => {
                overlay.remove();
            }, { once: true });
            resolve();
        };
        
        btnOk.addEventListener("click", closeAlert);
        
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                closeAlert();
            }
        });
    });
}

// Confirm and delete a search query history item
async function confirmDeleteSearch(searchId) {
    const confirmed = await showCustomConfirm(
        "Are you sure you want to delete this search query history? This won't delete the leads associated with it, but they will no longer be grouped under this query.",
        "Delete Search Query",
        "danger"
    );
    if (!confirmed) {
        return;
    }
    try {
        const response = await fetch(`/api/searches/${searchId}`, {
            method: "DELETE"
        });
        const result = await response.json();
        if (response.ok && result.status === "success") {
            // Filter searchesData locally to remove the deleted search
            searchesData = searchesData.filter(s => s.id !== searchId);
            
            // Reset activeSearchId to "all" if the deleted search was the active one
            if (activeSearchId === searchId) {
                activeSearchId = "all";
                archiveCurrentPage = 1;
            }
            
            // Refresh the UI
            renderArchiveHistory();
            renderArchiveLeads();
        } else {
            await showCustomAlert("Failed to delete search: " + (result.detail || result.message || "Unknown error"), "Deletion Failed", "danger");
        }
    } catch (error) {
        console.error("Failed to delete search query:", error);
        await showCustomAlert("An error occurred while deleting search query.", "Error", "danger");
    }
}

// Confirm and delete a single lead
async function confirmDeleteLead(sourceUrl) {
    const confirmed = await showCustomConfirm(
        "Are you sure you want to delete this lead? This action cannot be undone.",
        "Delete Lead",
        "danger"
    );
    if (!confirmed) {
        return;
    }
    try {
        const response = await fetch(`/api/leads?sourceUrl=${encodeURIComponent(sourceUrl)}`, {
            method: "DELETE"
        });
        const result = await response.json();
        if (response.ok && result.status === "success") {
            // Remove from local data
            leadsData = leadsData.filter(l => l.sourceUrl !== sourceUrl);
            
            // Also remove from selection if it was selected
            archiveSelectedUrls = archiveSelectedUrls.filter(u => u !== sourceUrl);
            updateBulkActionsBar();
            
            // Update global dashboard components
            updateGlobalStats(leadsData);
            if (typeof loadPerformanceAnalytics === "function") loadPerformanceAnalytics();
            if (typeof renderRecommendedLeads === "function") renderRecommendedLeads();
            if (typeof renderRecentActivity === "function") renderRecentActivity();
            
            // Re-render
            renderArchiveLeads();
            renderArchiveHistory();
        } else {
            await showCustomAlert("Failed to delete lead: " + (result.detail || result.message || "Unknown error"), "Deletion Failed", "danger");
        }
    } catch (error) {
        console.error("Failed to delete lead:", error);
        await showCustomAlert("An error occurred while deleting the lead.", "Error", "danger");
    }
}

// Render leads table specifically for Search Archive
function renderArchiveLeads() {
    if (!archiveLeadsTbody) return;
    archiveLeadsTbody.innerHTML = "";
    
    const statusVal = archiveFilterStatus ? archiveFilterStatus.value.toLowerCase() : "all";
    const crmVal = archiveFilterCrm ? archiveFilterCrm.value.toLowerCase() : "all";
    const platformVal = archiveFilterPlatform ? archiveFilterPlatform.value.toLowerCase() : "all";
    
    let leadsToRender = [];
    if (activeSearchId === "all") {
        leadsToRender = leadsData;
        if (archiveTableTitle) archiveTableTitle.innerText = "All leads database";
    } else {
        const search = searchesData.find(s => s.id === activeSearchId);
        if (search) {
            const urls = search.leadUrls || [];
            leadsToRender = leadsData.filter(l => urls.includes(l.sourceUrl));
            if (archiveTableTitle) archiveTableTitle.innerText = `Leads from: "${search.keyword}"`;
        } else {
            leadsToRender = leadsData;
            if (archiveTableTitle) archiveTableTitle.innerText = "All leads database";
        }
    }
    
    const filtered = leadsToRender.filter(lead => {
        // Filter by header tabs first
        if (archiveViewFilter === "high") {
            if ((lead.leadCategory || "") !== "High Intent") return false;
        } else if (archiveViewFilter === "facebook") {
            if (getLeadPlatform(lead) !== "facebook") return false;
        } else if (archiveViewFilter === "linkedin") {
            if (getLeadPlatform(lead) !== "linkedin") return false;
        } else if (archiveViewFilter === "replied") {
            if ((lead.crmStatus || "").toLowerCase() !== "replied") return false;
        }

        const leadStatus = String(lead.leadStatus || "").toLowerCase();
        const statusMatch = statusVal === "all" || leadStatus.includes(statusVal);
        
        const leadCrm = String(lead.crmStatus || "New").toLowerCase();
        const crmMatch = crmVal === "all" || leadCrm === crmVal;
        
        const leadPlatform = getLeadPlatform(lead);
        const platformMatch = platformVal === "all" || leadPlatform === platformVal;
        
        return statusMatch && crmMatch && platformMatch;
    });
    
    // Update dynamic dashboard metrics
    const statTotalEl = document.getElementById("archive-stat-total");
    const statHighEl = document.getElementById("archive-stat-high");
    const statQueriesEl = document.getElementById("archive-stat-queries");
    const statContactsEl = document.getElementById("archive-stat-contacts");

    if (statTotalEl) statTotalEl.innerText = filtered.length;
    if (statHighEl) {
        const highIntentLeads = filtered.filter(l => (l.leadCategory || l.buyingIntent || '').toLowerCase().includes('high')).length;
        const highPct = filtered.length > 0 ? Math.round((highIntentLeads / filtered.length) * 100) : 0;
        statHighEl.innerText = `${highIntentLeads} (${highPct}%)`;
    }
    if (statQueriesEl) statQueriesEl.innerText = searchesData.length;
    if (statContactsEl) {
        const contactsFound = filtered.filter(l => {
            const info = l.contactInfo || '';
            const isEmailValid = info && info.includes('@') && info !== 'hello@company.com';
            const isLinkedIn = info && info.toLowerCase().includes('linkedin') && info !== 'hello@company.com';
            return isEmailValid || isLinkedIn;
        }).length;
        const contactPct = filtered.length > 0 ? Math.round((contactsFound / filtered.length) * 100) : 0;
        statContactsEl.innerText = `${contactPct}%`;
    }
    
    // Update the badge count
    const tableBadge = document.getElementById("archive-table-badge");
    if (tableBadge) {
        tableBadge.innerText = `${filtered.length} leads`;
    }
    
    const archivePagination = document.getElementById("archive-pagination");
    const archivePagPrev = document.getElementById("archive-pag-prev");
    const archivePagNext = document.getElementById("archive-pag-next");
    const archivePagText = document.getElementById("archive-pag-text");

    if (filtered.length === 0) {
        if (archiveEmptyState) archiveEmptyState.style.display = "flex";
        if (archiveTableWrapper) archiveTableWrapper.style.display = "none";
        if (archivePagination) archivePagination.style.display = "none";
        return;
    }
    
    if (archiveEmptyState) archiveEmptyState.style.display = "none";
    if (archiveTableWrapper) archiveTableWrapper.style.display = "block";
    if (archivePagination) archivePagination.style.display = "flex";

    const totalPages = Math.ceil(filtered.length / archivePageSize) || 1;
    if (archiveCurrentPage > totalPages) {
        archiveCurrentPage = totalPages;
    }
    if (archiveCurrentPage < 1) {
        archiveCurrentPage = 1;
    }

    if (archivePagPrev) archivePagPrev.disabled = (archiveCurrentPage === 1);
    if (archivePagNext) archivePagNext.disabled = (archiveCurrentPage === totalPages);
    if (archivePagText) archivePagText.innerText = `Page ${archiveCurrentPage} of ${totalPages}`;

    const startIdx = (archiveCurrentPage - 1) * archivePageSize;
    const endIdx = startIdx + archivePageSize;
    const paginatedLeads = filtered.slice(startIdx, endIdx);

    paginatedLeads.forEach((lead, idx) => {
        const row = document.createElement("tr");
        row.style.cursor = "pointer";
        
        row.addEventListener("click", (e) => {
            if (e.target.closest("a") || e.target.closest("button") || e.target.closest("input[type='checkbox']")) return;
            openDetailModal(lead);
        });
        
        const displayAuthor = lead.authorName || "Unknown Poster";
        const displayCompany = lead.companyName || "No Company Details";
        const displayRole = Array.isArray(lead.serviceRequired)
            ? lead.serviceRequired.join(", ")
            : (lead.serviceRequired || lead.industry || "Prospect Partner");
            
        let score = lead.leadScore;
        if (score === undefined || score === null) {
            score = parseFloat(lead.confidenceScore) || 0;
            if (score <= 1.0 && score > 0) score = Math.round(score * 100);
            if (score === 0) score = 40;
        }
        
        let cleanIntent = lead.leadCategory || lead.buyingIntent || 'Low';
        if (cleanIntent.toLowerCase().includes("high")) cleanIntent = "High";
        else if (cleanIntent.toLowerCase().includes("medium") || cleanIntent.toLowerCase().includes("warm")) cleanIntent = "Medium";
        else if (cleanIntent.toLowerCase().includes("low")) cleanIntent = "Low";
        else if (cleanIntent.length > 15) cleanIntent = cleanIntent.substring(0, 15) + "...";
        
        let displayIntent = cleanIntent;
        if (!displayIntent.toLowerCase().includes("intent")) {
            displayIntent = displayIntent + " Intent";
        }
        
        let categoryClass = "badge-neutral";
        if (cleanIntent === "High") categoryClass = "badge-success";
        else if (cleanIntent === "Medium") categoryClass = "badge-warning";
        
        const emailVal = lead.contactInfo || "";
        const isEmailValid = emailVal && emailVal.includes('@') && emailVal !== 'hello@company.com';
        const isEmailVerified = isEmailValid && lead.contactSource !== 'guessed';
            
        const platform = getLeadPlatform(lead);
        let platformColor = "var(--primary)";
        let platformIconName = "linkedin";
        let displayPlatform = "LinkedIn";
        if (platform === "facebook") {
            platformColor = "var(--secondary)";
            platformIconName = "facebook";
            displayPlatform = "Facebook";
        } else if (platform === "twitter") {
            platformColor = "#9CA3AF";
            platformIconName = "twitter";
            displayPlatform = "Twitter/X";
        } else if (platform === "reddit") {
            platformColor = "var(--highlight)";
            platformIconName = "message-square";
            displayPlatform = "Reddit";
        }

        const avatarUrl = getLeadAvatarUrl(displayAuthor);
        const logoUrl = getCompanyLogoUrl(displayCompany);

        const isChecked = archiveSelectedUrls.includes(lead.sourceUrl);

        let contactHtml = "";
        if (isEmailValid) {
            contactHtml = `
                <div class="badge ${isEmailVerified ? 'badge-success' : 'badge-warning'}" style="gap: 4px; padding: 0.2rem 0.5rem; font-size: 0.72rem; font-weight: 500;">
                    <i data-lucide="${isEmailVerified ? 'check-circle-2' : 'help-circle'}" style="width: 12px; height: 12px; flex-shrink: 0;"></i>
                    <span style="max-width: 115px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${emailVal}">${emailVal}</span>
                </div>
            `;
        } else if (emailVal && emailVal.toLowerCase().includes('linkedin') && emailVal !== 'hello@company.com') {
            contactHtml = `
                <a href="${lead.sourceUrl}" target="_blank" class="badge badge-info" style="gap: 4px; padding: 0.2rem 0.5rem; font-size: 0.72rem; font-weight: 500; text-decoration: none; display: inline-flex;">
                    ${getPlatformIconSvg("linkedin", 12, "flex-shrink: 0;")}
                    <span>Profile Link</span>
                </a>
            `;
        } else {
            contactHtml = `<span class="no-data" style="color: var(--text-muted); font-size: 0.75rem; font-style: italic;">No contact found</span>`;
        }

        const leadPlatSvg = getPlatformIconSvg(platform, 13, `color: ${platformColor}; flex-shrink: 0;`);
        row.innerHTML = `
            <td style="padding: 0.5rem 0.75rem;">
                <input type="checkbox" class="custom-checkbox archive-lead-checkbox" value="${lead.sourceUrl}" ${isChecked ? "checked" : ""}>
            </td>
            <td>
                <div class="contact-cell">
                    <img src="${avatarUrl}" class="contact-avatar" alt="Avatar">
                    <div class="contact-name-info">
                        <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.15rem;">
                            <span class="contact-full-name">${displayAuthor}</span>
                            ${leadPlatSvg}
                        </div>
                        <span class="contact-role">${displayRole}</span>
                    </div>
                </div>
            </td>
            <td>
                <div class="company-cell">
                    <img src="${logoUrl}" style="width: 20px; height: 20px; border-radius: 4px;" alt="Logo">
                    <span class="company-name">${displayCompany}</span>
                </div>
            </td>
            <td>
                <div style="display: flex; flex-direction: column; gap: 0.25rem; min-width: 110px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                        <span class="badge ${categoryClass}" style="font-size: 0.65rem; padding: 0.05rem 0.35rem;">${displayIntent}</span>
                        <span style="font-size: 0.72rem; font-weight: 600; color: var(--text-primary);">${score}%</span>
                    </div>
                    <div style="width: 100%; height: 4px; background: var(--bg-trans-5); border-radius: 3px; overflow: hidden;">
                        <div style="width: ${score}%; height: 100%; background: ${cleanIntent === 'High' ? 'var(--secondary-gradient)' : 'var(--primary-gradient)'}; border-radius: 3px;"></div>
                    </div>
                </div>
            </td>
            <td>
                ${contactHtml}
            </td>
            <td>
                <div style="display: flex; gap: 0.5rem;" onclick="event.stopPropagation()">
                    <a href="${lead.sourceUrl}" class="action-btn" target="_blank" title="View Source Post">
                        <i data-lucide="external-link" style="width: 13px; height: 13px;"></i>
                    </a>
                    <button class="action-btn btn-row-copy" title="Copy Lead details">
                        <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
                    </button>
                    <button class="action-btn btn-row-delete" title="Delete Lead">
                        <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
                    </button>
                </div>
            </td>
        `;
        
        row.querySelector(".btn-row-copy").addEventListener("click", () => {
            copyToClipboard(getFormattedLeadSummary(lead));
        });

        row.querySelector(".btn-row-delete").addEventListener("click", () => {
            confirmDeleteLead(lead.sourceUrl);
        });

        // Checkbox listener
        const checkbox = row.querySelector(".archive-lead-checkbox");
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                if (!archiveSelectedUrls.includes(lead.sourceUrl)) archiveSelectedUrls.push(lead.sourceUrl);
            } else {
                archiveSelectedUrls = archiveSelectedUrls.filter(u => u !== lead.sourceUrl);
            }
            updateBulkActionsBar();
        });
        
        archiveLeadsTbody.appendChild(row);
    });
    
    lucide.createIcons();
}

// Stepper wizard navigation logic
function initWizard() {
    const btnBack = document.getElementById("btn-wizard-back");
    const btnContinue = document.getElementById("btn-wizard-continue");
    const progressFill = document.getElementById("wizard-progress-fill");

    const stepPanels = document.querySelectorAll(".wizard-step-panel");
    const stepperNodes = document.querySelectorAll(".stepper-node");

    function updateWizardUI() {
        stepPanels.forEach(p => {
            const step = parseInt(p.getAttribute("data-step"));
            if (step === wizardCurrentStep) {
                p.classList.add("active");
            } else {
                p.classList.remove("active");
            }
        });

        stepperNodes.forEach(node => {
            const step = parseInt(node.getAttribute("data-step"));
            if (step === wizardCurrentStep) {
                node.classList.add("active");
                node.classList.remove("completed");
            } else if (step < wizardCurrentStep) {
                node.classList.add("completed");
                node.classList.remove("active");
            } else {
                node.classList.remove("active", "completed");
            }
        });

        // Progress fill width
        const pct = ((wizardCurrentStep - 1) / 3) * 100;
        if (progressFill) progressFill.style.width = `${pct}%`;

        // Buttons state
        if (btnBack) btnBack.disabled = (wizardCurrentStep === 1);

        if (wizardCurrentStep === 4) {
            if (btnContinue) btnContinue.style.display = "none";
        } else {
            if (btnContinue) {
                btnContinue.style.display = "inline-flex";
                btnContinue.innerHTML = `Continue <i data-lucide="arrow-right"></i>`;
                lucide.createIcons();
            }
        }
    }

    if (btnContinue) {
        btnContinue.addEventListener("click", async () => {
            if (wizardCurrentStep === 1) {
                const keyword = document.getElementById("keyword").value.trim();
                if (!keyword) {
                    await showCustomAlert("Please specify an audience search keyword query!", "Keyword Required", "danger");
                    return;
                }
            }
            if (wizardCurrentStep < 4) {
                wizardCurrentStep++;
                updateWizardUI();
            }
        });
    }

    if (btnBack) {
        btnBack.addEventListener("click", () => {
            if (wizardCurrentStep > 1) {
                wizardCurrentStep--;
                updateWizardUI();
            }
        });
    }

    // Platform option cards trigger hidden input
    const platformCards = document.querySelectorAll(".platform-option-card");
    const platformHiddenInput = document.getElementById("platform");
    platformCards.forEach(card => {
        card.addEventListener("click", () => {
            platformCards.forEach(c => c.classList.remove("active"));
            card.classList.add("active");
            const platVal = card.getAttribute("data-platform");
            if (platformHiddenInput) platformHiddenInput.value = platVal;
        });
    });

    // Range slider score text
    const intentSlider = document.getElementById("wizard-intent-score-min");
    const intentValText = document.getElementById("wizard-intent-score-val");
    if (intentSlider && intentValText) {
        intentSlider.addEventListener("input", () => {
            intentValText.innerText = `${intentSlider.value}% Match`;
            // Randomly randomize estimate to feel interactive
            const countMin = Math.max(1, Math.round(30 - (intentSlider.value / 3)));
            const countMax = Math.max(2, Math.round(55 - (intentSlider.value / 2.2)));
            document.getElementById("wizard-estimate-count").innerText = `${countMin} - ${countMax}`;
        });
    }

    updateWizardUI();
}

// Archive Views buttons
function initArchiveViews() {
    const viewAllBtn = document.getElementById("archive-view-all");
    const viewHighBtn = document.getElementById("archive-view-high");
    const viewLiBtn = document.getElementById("archive-view-li");
    const viewFbBtn = document.getElementById("archive-view-fb");
    const viewRepliedBtn = document.getElementById("archive-view-replied");
    
    const viewsPills = [viewAllBtn, viewHighBtn, viewLiBtn, viewFbBtn, viewRepliedBtn];
    
    function setArchiveViewFilter(mode, activeBtn) {
        archiveViewFilter = mode;
        viewsPills.forEach(btn => {
            if (btn) btn.classList.remove("active");
        });
        if (activeBtn) activeBtn.classList.add("active");
        archiveCurrentPage = 1;
        renderArchiveLeads();
    }
    
    if (viewAllBtn) viewAllBtn.addEventListener("click", () => setArchiveViewFilter("all", viewAllBtn));
    if (viewHighBtn) viewHighBtn.addEventListener("click", () => setArchiveViewFilter("high", viewHighBtn));
    if (viewLiBtn) viewLiBtn.addEventListener("click", () => setArchiveViewFilter("linkedin", viewLiBtn));
    if (viewFbBtn) viewFbBtn.addEventListener("click", () => setArchiveViewFilter("facebook", viewFbBtn));
    if (viewRepliedBtn) viewRepliedBtn.addEventListener("click", () => setArchiveViewFilter("replied", viewRepliedBtn));

    // Master select all checkbox
    const selectAllCheckbox = document.getElementById("archive-select-all-checkbox");
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener("change", () => {
            const rowCheckboxes = document.querySelectorAll(".archive-lead-checkbox");
            rowCheckboxes.forEach(cb => {
                cb.checked = selectAllCheckbox.checked;
                const url = cb.value;
                if (selectAllCheckbox.checked) {
                    if (!archiveSelectedUrls.includes(url)) archiveSelectedUrls.push(url);
                } else {
                    archiveSelectedUrls = archiveSelectedUrls.filter(u => u !== url);
                }
            });
            updateBulkActionsBar();
        });
    }

    // Bulk action triggers
    const btnBulkExport = document.getElementById("btn-bulk-export");
    const btnBulkDraft = document.getElementById("btn-bulk-stage-draft");
    const btnBulkDisqualify = document.getElementById("btn-bulk-stage-disqualify");

    if (btnBulkExport) {
        btnBulkExport.addEventListener("click", () => {
            if (archiveSelectedUrls.length === 0) return;
            const leadsToExport = leadsData.filter(l => archiveSelectedUrls.includes(l.sourceUrl));
            let csvRows = [];
            csvRows.push("Email,FirstName,LastName,CompanyName,PostUrl,CrmStatus");
            leadsToExport.forEach(lead => {
                const parts = (lead.authorName || "Friend").split(" ");
                csvRows.push(`"${lead.contactInfo || ""}","${parts[0]}","${parts.slice(1).join(" ")}","${(lead.companyName || "").replace(/"/g, '""')}","${lead.sourceUrl}","${lead.crmStatus || "New"}"`);
            });
            const blob = new Blob([csvRows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `bulk_leads_export_${archiveSelectedUrls.length}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    if (btnBulkDraft) {
        btnBulkDraft.addEventListener("click", () => handleBulkAction("Drafted"));
    }
    if (btnBulkDisqualify) {
        btnBulkDisqualify.addEventListener("click", () => handleBulkAction("Disqualified"));
    }

    const btnBulkDelete = document.getElementById("btn-bulk-delete");
    if (btnBulkDelete) {
        btnBulkDelete.addEventListener("click", async () => {
            if (archiveSelectedUrls.length === 0) return;
            const confirmed = await showCustomConfirm(
                `Are you sure you want to delete ${archiveSelectedUrls.length} selected lead(s)? This action cannot be undone.`,
                "Delete Selected Leads",
                "danger"
            );
            if (!confirmed) {
                return;
            }
            try {
                const response = await fetch("/api/leads/bulk-delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ urls: archiveSelectedUrls })
                });
                const result = await response.json();
                if (response.ok && result.status === "success") {
                    await showCustomAlert(`Successfully deleted ${archiveSelectedUrls.length} leads.`, "Success", "primary");
                    
                    // Remove deleted URLs from leadsData locally
                    leadsData = leadsData.filter(l => !archiveSelectedUrls.includes(l.sourceUrl));
                    
                    // Clear selection arrays
                    archiveSelectedUrls = [];
                    const selectAllCheckbox = document.getElementById("archive-select-all-checkbox");
                    if (selectAllCheckbox) selectAllCheckbox.checked = false;
                    
                    // Hide bulk actions bar
                    updateBulkActionsBar();
                    
                    // Update global UI state
                    updateGlobalStats(leadsData);
                    if (typeof loadPerformanceAnalytics === "function") loadPerformanceAnalytics();
                    if (typeof renderRecommendedLeads === "function") renderRecommendedLeads();
                    if (typeof renderRecentActivity === "function") renderRecentActivity();
                    
                    // Re-render
                    renderArchiveLeads();
                    renderArchiveHistory();
                } else {
                    await showCustomAlert("Bulk delete failed: " + (result.detail || result.message || "Unknown error"), "Error", "danger");
                }
            } catch (err) {
                await showCustomAlert("Bulk delete action failed: " + err.message, "Error", "danger");
            }
        });
    }
}

async function handleBulkAction(targetStage) {
    if (archiveSelectedUrls.length === 0) return;
    
    const promises = archiveSelectedUrls.map(url => {
        const lead = leadsData.find(l => l.sourceUrl === url);
        return fetch("/api/leads/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sourceUrl: url,
                crmStatus: targetStage,
                draftEmail: lead ? lead.draftEmail || "" : ""
            })
        });
    });
    
    try {
        await Promise.all(promises);
        await showCustomAlert(`Bulk updated ${archiveSelectedUrls.length} leads to stage "${targetStage}"!`, "Bulk Action Success", "primary");
        archiveSelectedUrls = [];
        const selectAllCheckbox = document.getElementById("archive-select-all-checkbox");
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        updateBulkActionsBar();
        await loadExistingLeads();
    } catch (err) {
        await showCustomAlert("Bulk action failed: " + err.message, "Bulk Action Failed", "danger");
    }
}

function updateBulkActionsBar() {
    const bar = document.getElementById("bulk-actions-bar");
    const countLabel = document.getElementById("bulk-selected-count");
    if (!bar || !countLabel) return;

    if (archiveSelectedUrls.length > 0) {
        countLabel.innerText = `${archiveSelectedUrls.length} leads selected`;
        bar.classList.add("active");
    } else {
        bar.classList.remove("active");
    }
}

// Outreach Config Live Previews
let configPreviewTab = "email";
function initConfigPreviewTabs() {
    const configTabEmail = document.getElementById("config-preview-tab-email");
    const configTabLinkedin = document.getElementById("config-preview-tab-linkedin");
    
    if (configTabEmail) {
        configTabEmail.addEventListener("click", () => {
            configTabEmail.classList.add("active");
            if (configTabLinkedin) configTabLinkedin.classList.remove("active");
            configPreviewTab = "email";
            updateConfigPreview();
        });
    }
    if (configTabLinkedin) {
        configTabLinkedin.addEventListener("click", () => {
            configTabLinkedin.classList.add("active");
            if (configTabEmail) configTabEmail.classList.remove("active");
            configPreviewTab = "linkedin";
            updateConfigPreview();
        });
    }
}

function updateConfigPreview() {
    const previewBody = document.getElementById("live-pitch-preview-body");
    const targetEmail = document.getElementById("preview-target-email");
    const targetSubject = document.getElementById("preview-target-subject");
    const subjectContainer = document.getElementById("preview-subject-container");
    
    if (!previewBody) return;
    
    const agencyName = agencyNameInput ? agencyNameInput.value.trim() : "Silvia Team";
    const agencyInfo = agencyInfoInput ? agencyInfoInput.value.trim() : "premier design & development services";
    const emailTone = emailToneSelect ? emailToneSelect.value : "Short & Conversational";
    
    if (configPreviewTab === "email") {
        if (subjectContainer) subjectContainer.style.display = "block";
        if (targetEmail) targetEmail.innerText = "contact@buyercompany.com";
        if (targetSubject) targetSubject.innerText = `Outreach Pitch - ${agencyName}`;
        
        previewBody.innerHTML = `Hi <mark>{AuthorName}</mark>,

I saw your recent post mentioning that <mark>{CompanyName}</mark> is looking for support with <mark>{ServiceRequired}</mark>.

We run <strong>${agencyName}</strong>, specializing in ${agencyInfo}. Given your requirements, I think our background aligns perfectly.

I drafted this custom email pitch using our <strong>${emailTone}</strong> tone framework. Are you open to a brief chat or a free code review this week?

Best,
The ${agencyName} Team`;
    } else {
        if (subjectContainer) subjectContainer.style.display = "none";
        if (targetEmail) targetEmail.innerText = "linkedin.com/in/decision-maker-profile";
        
        previewBody.innerHTML = `Hey <mark>{AuthorName}</mark>!

Saw your post about <mark>{CompanyName}</mark> looking for help with <mark>{ServiceRequired}</mark>. At <strong>${agencyName}</strong>, we build ${agencyInfo}.

I think our design/dev capabilities match your request exactly. Do you have 5 minutes to discuss this?`;
    }
}

// AI Recommended leads rendering
function renderRecommendedLeads() {
    const container = document.getElementById("rec-leads-list");
    if (!container) return;
    container.innerHTML = "";

    const candidates = leadsData
        .filter(l => ["new", "new discovery"].includes((l.crmStatus || "New").toLowerCase()))
        .sort((a, b) => {
            const scoreA = a.leadScore !== undefined ? a.leadScore : (parseFloat(a.confidenceScore) || 0) * 100;
            const scoreB = b.leadScore !== undefined ? b.leadScore : (parseFloat(b.confidenceScore) || 0) * 100;
            return scoreB - scoreA;
        })
        .slice(0, 3);

    if (candidates.length === 0) {
        container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.72rem; font-style: italic; padding: 0.5rem 0; text-align: center;">No recommendations yet. Run scans to populate.</div>`;
        return;
    }

    candidates.forEach(lead => {
        const div = document.createElement("div");
        div.className = "rec-lead-item";
        div.style.cursor = "pointer";
        div.addEventListener("click", () => openDetailModal(lead));

        const author = lead.authorName || "Unknown Poster";
        const company = lead.companyName || "No Company Details";
        let score = lead.leadScore;
        if (score === undefined || score === null) {
            score = parseFloat(lead.confidenceScore) || 0;
            if (score <= 1.0 && score > 0) score = Math.round(score * 100);
            if (score === 0) score = 40;
        }
        const badgeClass = score >= 75 ? "badge-success" : (score >= 45 ? "badge-warning" : "badge-neutral");

        div.innerHTML = `
            <div class="rec-lead-meta">
                <span class="rec-lead-name">${author}</span>
                <span class="rec-lead-details">${company}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.35rem;">
                <span class="badge ${badgeClass}" style="font-size: 0.65rem; padding: 0.05rem 0.3rem;">${score}% Match</span>
                <i data-lucide="chevron-right" style="width: 12px; height: 12px; color: var(--text-muted);"></i>
            </div>
        `;
        container.appendChild(div);
    });
    lucide.createIcons();
}

// Activity feed logger
function renderRecentActivity() {
    const container = document.getElementById("activity-list");
    if (!container) return;
    container.innerHTML = "";

    const activities = [];

    // Searches runs
    searchesData.slice(0, 2).forEach(s => {
        const count = s.leadUrls ? s.leadUrls.length : 0;
        activities.push({
            type: "primary-state",
            text: `Scan finished for keyword <strong>"${s.keyword}"</strong>, parsed <strong>${count} leads</strong>.`,
            time: s.timestamp ? formatActivityDate(s.timestamp) : "Recent"
        });
    });

    // AI generated drafts
    const draftedLeads = leadsData.filter(l => l.crmStatus === "Drafted").slice(0, 2);
    draftedLeads.forEach(l => {
        activities.push({
            type: "info-state",
            text: `AI generated custom pitch draft for <strong>${l.authorName || "Unknown"}</strong>.`,
            time: "Recent"
        });
    });

    // Verification emails
    const emailedLeads = leadsData.filter(l => l.crmStatus === "Emailed").slice(0, 1);
    emailedLeads.forEach(l => {
        activities.push({
            type: "success-state",
            text: `Campaign outreach sent to <strong>${l.authorName || "Unknown"}</strong>.`,
            time: "Recent"
        });
    });

    // Fallbacks
    if (activities.length < 3) {
        activities.push({
            type: "info-state",
            text: "Decison-maker emails qualified and added to outreach pipeline.",
            time: "1 hour ago"
        });
        activities.push({
            type: "success-state",
            text: "Background monitor scanned active saved queries index.",
            time: "3 hours ago"
        });
    }

    activities.slice(0, 4).forEach(act => {
        const div = document.createElement("div");
        div.className = `activity-item ${act.type}`;
        div.innerHTML = `
            <div class="activity-node"></div>
            <div class="activity-text">${act.text}</div>
            <div class="activity-time">${act.time}</div>
        `;
        container.appendChild(div);
    });
}

function formatActivityDate(isoStr) {
    try {
        const date = new Date(isoStr);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch(e) {
        return "Recent";
    }
}

// Saved Searches & Monitoring Operations
async function loadSavedSearches() {
    if (!savedSearchesTbody) return;
    try {
        const response = await fetch("/api/saved-searches");
        const data = await response.json();
        const searches = data.searches || [];
        
        savedSearchesTbody.innerHTML = "";
        
        if (searches.length === 0) {
            if (monitoringEmptyState) monitoringEmptyState.style.display = "block";
            return;
        }
        
        if (monitoringEmptyState) monitoringEmptyState.style.display = "none";
        
        searches.forEach(search => {
            const row = document.createElement("tr");
            
            const keyword = search.keyword || "";
            const platform = search.platform || "linkedin";
            const capPlatform = platform === "all" ? "All Web" : platform.charAt(0).toUpperCase() + platform.slice(1);
            
            let timeframe = "All Time";
            if (search.timeframe === "qdr:d") timeframe = "24 Hours";
            else if (search.timeframe === "qdr:w") timeframe = "Past Week";
            else if (search.timeframe === "qdr:m") timeframe = "Past Month";
            else if (search.timeframe === "qdr:m2") timeframe = "2 Months";
            else if (search.timeframe === "qdr:m3") timeframe = "3 Months";
            
            let formattedLastRun = "Never";
            if (search.lastRun) {
                try {
                    const runDate = new Date(search.lastRun);
                    formattedLastRun = runDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                } catch(e) {}
            }
            
            const isExact = search.matchType === "exact";
            const exactBadgeHtml = isExact ? ` <span class="badge badge-neutral" style="font-size: 0.65rem; padding: 2px 4px; line-height: 1; vertical-align: middle; margin-left: 4px; background: rgba(3,113,114,0.15); color: var(--secondary);">Exact</span>` : ` <span class="badge badge-neutral" style="font-size: 0.65rem; padding: 2px 4px; line-height: 1; vertical-align: middle; margin-left: 4px;">Partial</span>`;

            row.innerHTML = `
                <td><strong style="color: var(--text-primary);">${keyword}</strong>${exactBadgeHtml}</td>
                <td><span class="badge badge-neutral">${capPlatform}</span></td>
                <td><span>${timeframe}</span></td>
                <td><span>${formattedLastRun}</span></td>
                <td><strong style="color: var(--secondary);">${search.leadsFoundCount || 0} Leads</strong></td>
                <td>
                    <button class="action-btn btn-delete-saved" title="Delete Saved Search" style="border-color: var(--error-border); color: var(--error);">
                        <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
                    </button>
                </td>
            `;
            
            row.querySelector(".btn-delete-saved").addEventListener("click", async () => {
                await showCustomAlert("Saved searches can be modified in config or run automatically!", "Information", "primary");
            });
            
            savedSearchesTbody.appendChild(row);
        });
        
        lucide.createIcons();
    } catch (err) {
        console.error("Failed to load saved searches:", err);
    }
}

async function saveCurrentSearch() {
    const keyword = keywordInput.value.trim();
    const platform = platformSelect ? platformSelect.value : "linkedin";
    const timeframe = timeframeSelect.value;
    const matchTypeSelect = document.getElementById("match-type");
    const match_type = matchTypeSelect ? matchTypeSelect.value : "partial";
    
    if (!keyword) {
        await showCustomAlert("Please enter a keyword first!", "Keyword Required", "danger");
        return;
    }
    
    btnSaveSearch.disabled = true;
    const origHtml = btnSaveSearch.innerHTML;
    btnSaveSearch.innerHTML = `<i data-lucide="loader" class="spinner spinner-tiny"></i> Saving...`;
    lucide.createIcons();
    
    try {
        const response = await fetch("/api/saved-searches", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ keyword, platform, timeframe, match_type })
        });
        
        if (response.ok) {
            await showCustomAlert("Search configuration successfully saved to active monitoring database!", "Search Saved", "primary");
            keywordInput.value = "";
            loadSavedSearches();
            // Reset stepper wizard
            wizardCurrentStep = 1;
            const wizardPanels = document.querySelectorAll(".wizard-step-panel");
            wizardPanels.forEach(p => p.classList.remove("active"));
            document.querySelector(".wizard-step-panel[data-step='1']").classList.add("active");
            switchTab("discovery");
        } else {
            throw new Error("API rejected saved search request");
        }
    } catch (err) {
        await showCustomAlert("Failed to save search: " + err.message, "Error", "danger");
    } finally {
        btnSaveSearch.disabled = false;
        btnSaveSearch.innerHTML = origHtml;
        lucide.createIcons();
    }
}

async function runActiveMonitoring() {
    btnRunMonitoring.disabled = true;
    const origHtml = btnRunMonitoring.innerHTML;
    btnRunMonitoring.innerHTML = `<i data-lucide="refresh-cw" class="spinner spinner-tiny" style="animation: spin 1s linear infinite;"></i> Running Monitoring...`;
    lucide.createIcons();
    
    try {
        const response = await fetch("/api/saved-searches/run", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const summary = data.summary || {};
            const newFound = summary.newLeadsFound || 0;
            const runCount = summary.searchesRun || 0;
            
            await showCustomAlert(`Monitoring run completed successfully!\nRan ${runCount} saved searches.\nFound ${newFound} new qualified leads (marked as 'New Discovery').`, "Monitoring Complete", "primary");
            
            // Reload all leads database and saved searches
            await loadExistingLeads();
            loadSavedSearches();
        } else {
            throw new Error("Monitoring API execution rejected");
        }
    } catch (err) {
        await showCustomAlert("Monitoring run failed: " + err.message, "Error", "danger");
    } finally {
        btnRunMonitoring.disabled = false;
        btnRunMonitoring.innerHTML = origHtml;
        lucide.createIcons();
    }
}

async function loadPerformanceAnalytics() {
    if (!performanceTbody) return;
    try {
        const response = await fetch("/api/performance");
        const data = await response.json();
        const history = (data.history || []).slice(0, 5);
        
        performanceTbody.innerHTML = "";
        
        if (history.length === 0) {
            if (performanceEmptyState) performanceEmptyState.style.display = "block";
            return;
        }
        
        if (performanceEmptyState) performanceEmptyState.style.display = "none";
        
        history.forEach(search => {
            const row = document.createElement("tr");
            
            const keyword = search.keyword || "";
            const platform = search.platform || "linkedin";
            const capPlatform = platform === "all" ? "All Web" : platform.charAt(0).toUpperCase() + platform.slice(1);
            
            let formattedDate = "N/A";
            if (search.timestamp) {
                try {
                    const date = new Date(search.timestamp);
                    formattedDate = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                } catch(e) {}
            }
            
            const resultsFound = search.resultsFound !== undefined ? search.resultsFound : 0;
            const qualifiedLeads = search.qualifiedLeadsCount !== undefined ? search.qualifiedLeadsCount : 0;
            const rate = search.qualificationRate !== undefined ? search.qualificationRate : 0;
            
            row.innerHTML = `
                <td><strong style="color: var(--text-primary);">${keyword}</strong></td>
                <td><span class="badge badge-neutral">${capPlatform}</span></td>
                <td><span>${formattedDate}</span></td>
                <td><span>${resultsFound} posts</span></td>
                <td><span style="color: var(--secondary); font-weight: 600;">${qualifiedLeads} qualified</span></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-weight: 600; color: var(--text-primary); min-width: 32px;">${rate}%</span>
                        <div style="flex: 1; height: 5px; background: var(--bg-trans-5); border-radius: 3px; overflow: hidden; min-width: 85px;">
                            <div style="width: ${rate}%; height: 100%; background: var(--secondary); border-radius: 3px;"></div>
                        </div>
                    </div>
                </td>
            `;
            performanceTbody.appendChild(row);
        });
    } catch(err) {
        console.error("Failed to load performance analytics:", err);
    }
}
