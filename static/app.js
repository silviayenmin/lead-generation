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

    // Outreach Config Settings hydration from localStorage
    if (localStorage.getItem("silvia_agency_name")) agencyNameInput.value = localStorage.getItem("silvia_agency_name");
    if (localStorage.getItem("silvia_agency_info")) agencyInfoInput.value = localStorage.getItem("silvia_agency_info");
    if (localStorage.getItem("silvia_email_tone")) emailToneSelect.value = localStorage.getItem("silvia_email_tone");
    
    // Register auto-save for settings modifications
    if (agencyNameInput) {
        agencyNameInput.addEventListener("input", () => {
            localStorage.setItem("silvia_agency_name", agencyNameInput.value);
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
            body: JSON.stringify({ keyword, timeframe, limit, platform })
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
        const isEmailVerified = emailVal && emailVal.includes('@') && lead.contactSource !== 'guessed';
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
        if (emailVal && emailVal.includes('@')) {
            contactHtml = `
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <i data-lucide="${isEmailVerified ? 'check-circle-2' : 'help-circle'}" style="width: 14px; height: 14px; color: ${isEmailVerified ? 'var(--success)' : 'var(--text-muted)'}; flex-shrink: 0;"></i>
                    <span style="font-size: 0.78rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;" title="${emailVal}">${emailVal}</span>
                </div>
            `;
        } else if (emailVal && emailVal.toLowerCase().includes('linkedin')) {
            contactHtml = `
                <a href="${lead.sourceUrl}" target="_blank" style="font-size: 0.78rem; color: var(--primary); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; font-weight: 500;">
                    <i data-lucide="linkedin" style="width: 12px; height: 12px;"></i>
                    <span>LinkedIn Profile</span>
                </a>
            `;
        } else {
            contactHtml = `<span style="color: var(--text-muted); font-size: 0.78rem;">—</span>`;
        }

        row.innerHTML = `
            <td>
                <div class="contact-cell">
                    <img src="${avatarUrl}" class="contact-avatar" alt="Avatar">
                    <div class="contact-name-info">
                        <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.15rem;">
                            <span class="contact-full-name">${displayAuthor}</span>
                            <i data-lucide="${platformIconName}" style="width: 13px; height: 13px; color: ${platformColor}; flex-shrink: 0;" title="${displayPlatform}"></i>
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
    modalContactInfo.value = lead.contactInfo || "";
    
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
        modalBtnLinkedin.innerHTML = `<i data-lucide="facebook"></i> View Facebook`;
    } else if (lead.sourceUrl.includes("twitter.com") || lead.sourceUrl.includes("x.com")) {
        modalBtnLinkedin.innerHTML = `<i data-lucide="twitter"></i> View Twitter/X`;
    } else if (lead.sourceUrl.includes("reddit.com")) {
        modalBtnLinkedin.innerHTML = `<i data-lucide="message-square"></i> View Reddit`;
    } else {
        modalBtnLinkedin.innerHTML = `<i data-lucide="linkedin"></i> View LinkedIn`;
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
    
    // Add "All Leads" item first
    const allItem = document.createElement("div");
    allItem.className = `history-item ${activeSearchId === "all" ? "active" : ""}`;
    allItem.addEventListener("click", () => {
        activeSearchId = "all";
        archiveCurrentPage = 1;
        renderArchiveHistory();
        renderArchiveLeads();
    });
    allItem.innerHTML = `
        <div class="history-item-header">
            <span class="history-item-keyword">All leads database</span>
            <span class="history-item-count">${leadsData.length}</span>
        </div>
        <div class="history-item-meta">
            <span>Entire database</span>
            <span>-</span>
        </div>
    `;
    archiveHistoryList.appendChild(allItem);
    
    // Add history list items
    searchesData.forEach(search => {
        const item = document.createElement("div");
        item.className = `history-item ${activeSearchId === search.id ? "active" : ""}`;
        item.addEventListener("click", () => {
            activeSearchId = search.id;
            archiveCurrentPage = 1;
            renderArchiveHistory();
            renderArchiveLeads();
        });
        
        const leadCount = search.leadUrls ? search.leadUrls.length : 0;
        let formattedDate = "Recent";
        if (search.timestamp) {
            try {
                const date = new Date(search.timestamp);
                formattedDate = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            } catch (e) {
                console.error(e);
            }
        }
        
        let displayKeyword = search.keyword || "Scan Query";
        if (displayKeyword.length > 20) {
            displayKeyword = displayKeyword.substring(0, 20) + "...";
        }
        
        let displayTimeframe = "All Time";
        if (search.timeframe) {
            if (search.timeframe === "qdr:d") displayTimeframe = "24 Hours";
            else if (search.timeframe === "qdr:w") displayTimeframe = "Past Week";
            else if (search.timeframe === "qdr:m") displayTimeframe = "Past Month";
            else if (search.timeframe === "qdr:m2") displayTimeframe = "2 Months";
            else if (search.timeframe === "qdr:m3") displayTimeframe = "3 Months";
        }
        
        const platform = search.platform || "linkedin";
        const capPlatform = platform === "all" ? "All Web" : platform.charAt(0).toUpperCase() + platform.slice(1);
        
        item.innerHTML = `
            <div class="history-item-header">
                <span class="history-item-keyword" title="${search.keyword}">${displayKeyword}</span>
                <span class="history-item-count">${leadCount}</span>
            </div>
            <div class="history-item-meta">
                <span>${formattedDate}</span>
                <span>${capPlatform} • ${displayTimeframe}</span>
            </div>
        `;
        archiveHistoryList.appendChild(item);
    });
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
        const isEmailVerified = emailVal && emailVal.includes('@') && lead.contactSource !== 'guessed';
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

        const isChecked = archiveSelectedUrls.includes(lead.sourceUrl);

        let contactHtml = "";
        if (emailVal && emailVal.includes('@')) {
            contactHtml = `
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <i data-lucide="${isEmailVerified ? 'check-circle-2' : 'help-circle'}" style="width: 14px; height: 14px; color: ${isEmailVerified ? 'var(--success)' : 'var(--text-muted)'}; flex-shrink: 0;"></i>
                    <span style="font-size: 0.78rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;" title="${emailVal}">${emailVal}</span>
                </div>
            `;
        } else if (emailVal && emailVal.toLowerCase().includes('linkedin')) {
            contactHtml = `
                <a href="${lead.sourceUrl}" target="_blank" style="font-size: 0.78rem; color: var(--primary); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; font-weight: 500;">
                    <i data-lucide="linkedin" style="width: 12px; height: 12px;"></i>
                    <span>LinkedIn Profile</span>
                </a>
            `;
        } else {
            contactHtml = `<span style="color: var(--text-muted); font-size: 0.78rem;">—</span>`;
        }

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
                            <i data-lucide="${platformIconName}" style="width: 13px; height: 13px; color: ${platformColor}; flex-shrink: 0;" title="${displayPlatform}"></i>
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
        btnContinue.addEventListener("click", () => {
            if (wizardCurrentStep === 1) {
                const keyword = document.getElementById("keyword").value.trim();
                if (!keyword) {
                    alert("Please specify an audience search keyword query!");
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
    const viewFbBtn = document.getElementById("archive-view-fb");
    const viewRepliedBtn = document.getElementById("archive-view-replied");
    
    const viewsPills = [viewAllBtn, viewHighBtn, viewFbBtn, viewRepliedBtn];
    
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
        alert(`Bulk updated ${archiveSelectedUrls.length} leads to stage "${targetStage}"!`);
        archiveSelectedUrls = [];
        const selectAllCheckbox = document.getElementById("archive-select-all-checkbox");
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        updateBulkActionsBar();
        await loadExistingLeads();
    } catch (err) {
        alert("Bulk action failed: " + err.message);
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
            
            row.innerHTML = `
                <td><strong style="color: var(--text-primary);">${keyword}</strong></td>
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
            
            row.querySelector(".btn-delete-saved").addEventListener("click", () => {
                alert("Saved searches can be modified in config or run automatically!");
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
    
    if (!keyword) {
        alert("Please enter a keyword first!");
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
            body: JSON.stringify({ keyword, platform, timeframe })
        });
        
        if (response.ok) {
            alert("Search configuration successfully saved to active monitoring database!");
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
        alert("Failed to save search: " + err.message);
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
            
            alert(`Monitoring run completed successfully!\nRan ${runCount} saved searches.\nFound ${newFound} new qualified leads (marked as 'New Discovery').`);
            
            // Reload all leads database and saved searches
            await loadExistingLeads();
            loadSavedSearches();
        } else {
            throw new Error("Monitoring API execution rejected");
        }
    } catch (err) {
        alert("Monitoring run failed: " + err.message);
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
