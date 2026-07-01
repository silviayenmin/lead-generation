// Intercept all fetch requests to automatically append X-API-Key header
(function () {
    const ORIGINAL_FETCH = window.fetch;
    window.fetch = function (url, options = {}) {
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
        return ORIGINAL_FETCH(url, options).then(response => {
            if (response.status === 401 && !urlStr.endsWith("/api/auth/verify")) {
                localStorage.removeItem("APP_SECRET_KEY");
                if (typeof showLoginOverlay === "function") {
                    showLoginOverlay();
                }
            }
            return response;
        });
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
let notificationsInterval = null;
let notificationsData = [];
let searchesData = [];
let activeSearchId = "all";
let activeLead = null;
let pendingVerificationEmail = "";
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
const dashboardSearchInput = document.getElementById("dashboard-search-input");
const archiveSearchInput = document.getElementById("archive-search-input");

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
const viewProfile = document.getElementById("view-profile");
const topbarProfilePic = document.getElementById("topbar-profile-pic");

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
const agencyInfoInput = document.getElementById("profile-agency-info");
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
    } else if (cleanPlatform === "google_maps" || cleanPlatform === "google-maps" || cleanPlatform === "googlemaps") {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="brand-svg" style="${style}">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
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

    // Initialize Collapsible Settings Cards (Accordion UX)
    const collapsibleCards = document.querySelectorAll(".collapsible-card");
    collapsibleCards.forEach(card => {
        const titleToggle = card.querySelector(".card-title-toggle");
        const bodyEl = card.querySelector(".collapsible-body");
        const chevronIcon = card.querySelector(".chevron-icon");

        if (titleToggle && bodyEl) {
            titleToggle.addEventListener("click", () => {
                const isCollapsed = card.classList.contains("collapsed");
                if (isCollapsed) {
                    card.classList.remove("collapsed");
                    bodyEl.style.display = "flex";
                    if (chevronIcon) chevronIcon.style.transform = "rotate(180deg)";
                } else {
                    card.classList.add("collapsed");
                    bodyEl.style.display = "none";
                    if (chevronIcon) chevronIcon.style.transform = "rotate(0deg)";
                }
            });
        }
    });

    // Theme toggle setup
    const btnThemeToggle = document.getElementById("btn-theme-toggle");

    function updateThemeIcon() {
        const themeToggleIcon = document.getElementById("theme-toggle-icon");
        if (!themeToggleIcon) return;
        const isLight = document.documentElement.classList.contains('light-theme');
        
        const newIcon = document.createElement("i");
        newIcon.id = "theme-toggle-icon";
        newIcon.setAttribute("data-lucide", isLight ? "moon" : "sun");
        themeToggleIcon.parentNode.replaceChild(newIcon, themeToggleIcon);
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    updateThemeIcon();

    if (btnThemeToggle) {
        btnThemeToggle.addEventListener("click", () => {
            const isLight = document.documentElement.classList.toggle('light-theme');
            localStorage.setItem("silvia_theme", isLight ? 'light' : 'dark');
            updateThemeIcon();
        });
    }

    // Check authentication on page load
    checkAuthentication();

    // Bind login form elements
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", submitLogin);
    }
    const registerForm = document.getElementById("register-form");
    if (registerForm) {
        registerForm.addEventListener("submit", submitRegister);
    }

    const togglePwdBtn = document.getElementById("login-toggle-password");
    const pwdInput = document.getElementById("login-password");
    const eyeIcon = document.getElementById("login-eye-icon");
    if (togglePwdBtn && pwdInput && eyeIcon) {
        togglePwdBtn.addEventListener("click", () => {
            const isPwd = pwdInput.type === "password";
            pwdInput.type = isPwd ? "text" : "password";
            eyeIcon.setAttribute("data-lucide", isPwd ? "eye-off" : "eye");
            if (window.lucide) window.lucide.createIcons();
        });
    }

    const toggleRegPwdBtn = document.getElementById("register-toggle-password");
    const regPwdInput = document.getElementById("register-password");
    const regEyeIcon = document.getElementById("register-eye-icon");
    if (toggleRegPwdBtn && regPwdInput && regEyeIcon) {
        toggleRegPwdBtn.addEventListener("click", () => {
            const isPwd = regPwdInput.type === "password";
            regPwdInput.type = isPwd ? "text" : "password";
            regEyeIcon.setAttribute("data-lucide", isPwd ? "eye-off" : "eye");
            if (window.lucide) window.lucide.createIcons();
        });
    }

    // Toggle overlay login / register views
    const linkShowRegister = document.getElementById("link-show-register");
    const linkShowLogin = document.getElementById("link-show-login");
    const loginCard = document.getElementById("login-card");
    const registerCard = document.getElementById("register-card");

    if (linkShowRegister && loginCard && registerCard) {
        linkShowRegister.onclick = (e) => {
            e.preventDefault();
            loginCard.style.display = "none";
            registerCard.style.display = "flex";
            const regEmailInput = document.getElementById("register-email");
            if (regEmailInput) regEmailInput.focus();
        };
    }
    if (linkShowLogin && loginCard && registerCard) {
        linkShowLogin.onclick = (e) => {
            e.preventDefault();
            registerCard.style.display = "none";
            loginCard.style.display = "flex";
            const loginEmailInput = document.getElementById("login-email");
            if (loginEmailInput) loginEmailInput.focus();
        };
    }

    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
        btnLogout.addEventListener("click", logout);
    }

    // OTP/Forgot Password Elements and Listeners
    const registerOtpForm = document.getElementById("register-otp-form");
    if (registerOtpForm) {
        registerOtpForm.addEventListener("submit", submitRegisterOtp);
    }
    const forgotRequestForm = document.getElementById("forgot-request-form");
    if (forgotRequestForm) {
        forgotRequestForm.addEventListener("submit", submitForgotRequest);
    }
    const forgotVerifyForm = document.getElementById("forgot-verify-form");
    if (forgotVerifyForm) {
        forgotVerifyForm.addEventListener("submit", submitForgotVerify);
    }

    // Toggle forgot password visibility
    const forgotVerifyTogglePwdBtn = document.getElementById("forgot-verify-toggle-password");
    const forgotVerifyPwdInput = document.getElementById("forgot-verify-new-password");
    const forgotVerifyEyeIcon = document.getElementById("forgot-verify-eye-icon");
    if (forgotVerifyTogglePwdBtn && forgotVerifyPwdInput && forgotVerifyEyeIcon) {
        forgotVerifyTogglePwdBtn.addEventListener("click", () => {
            const isPwd = forgotVerifyPwdInput.type === "password";
            forgotVerifyPwdInput.type = isPwd ? "text" : "password";
            forgotVerifyEyeIcon.setAttribute("data-lucide", isPwd ? "eye-off" : "eye");
            if (window.lucide) window.lucide.createIcons();
        });
    }

    // Forgot Password card transitions
    const linkShowForgot = document.getElementById("link-show-forgot");
    const linkForgotRequestBack = document.getElementById("link-forgot-request-back");
    const linkForgotVerifyBack = document.getElementById("link-forgot-verify-back");
    const linkRegisterOtpBack = document.getElementById("link-register-otp-back");

    const forgotRequestCard = document.getElementById("forgot-request-card");
    const forgotVerifyCard = document.getElementById("forgot-verify-card");
    const registerOtpCard = document.getElementById("register-otp-card");

    if (linkShowForgot && loginCard && forgotRequestCard) {
        linkShowForgot.onclick = (e) => {
            e.preventDefault();
            loginCard.style.display = "none";
            forgotRequestCard.style.display = "flex";
            const emailInput = document.getElementById("forgot-request-email");
            if (emailInput) {
                emailInput.value = "";
                emailInput.focus();
            }
            const errorMsg = document.getElementById("forgot-request-error-msg");
            if (errorMsg) errorMsg.style.display = "none";
        };
    }
    if (linkForgotRequestBack && loginCard && forgotRequestCard) {
        linkForgotRequestBack.onclick = (e) => {
            e.preventDefault();
            forgotRequestCard.style.display = "none";
            loginCard.style.display = "flex";
            const loginEmailInput = document.getElementById("login-email");
            if (loginEmailInput) loginEmailInput.focus();
        };
    }
    if (linkForgotVerifyBack && loginCard && forgotVerifyCard) {
        linkForgotVerifyBack.onclick = (e) => {
            e.preventDefault();
            forgotVerifyCard.style.display = "none";
            loginCard.style.display = "flex";
            const loginEmailInput = document.getElementById("login-email");
            if (loginEmailInput) loginEmailInput.focus();
        };
    }
    if (linkRegisterOtpBack && registerCard && registerOtpCard) {
        linkRegisterOtpBack.onclick = (e) => {
            e.preventDefault();
            registerOtpCard.style.display = "none";
            registerCard.style.display = "flex";
            const regEmailInput = document.getElementById("register-email");
            if (regEmailInput) regEmailInput.focus();
        };
    }

    // Bind profile screen change password button
    const btnProfileChangePassword = document.getElementById("btn-profile-change-password");
    if (btnProfileChangePassword) {
        btnProfileChangePassword.addEventListener("click", submitProfilePasswordReset);
    }

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
    if (agencyNameInput && localStorage.getItem("silvia_agency_name")) agencyNameInput.value = localStorage.getItem("silvia_agency_name");
    updateSidebarAgencyName();
    if (agencyInfoInput && localStorage.getItem("silvia_agency_info")) agencyInfoInput.value = localStorage.getItem("silvia_agency_info");
    if (emailToneSelect && localStorage.getItem("silvia_email_tone")) emailToneSelect.value = localStorage.getItem("silvia_email_tone");

    // Register auto-save for settings modifications
    if (agencyNameInput) {
        agencyNameInput.addEventListener("input", () => {
            const val = agencyNameInput.value;
            localStorage.setItem("silvia_agency_name", val);
            localStorage.setItem("agencyName", val);

            const profileBusInput = document.getElementById("profile-business-name");
            if (profileBusInput) profileBusInput.value = val;

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
    if (searchForm) {
        searchForm.addEventListener("submit", handleSearchSubmit);
        searchForm.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
                if (activeTag === "input" || activeTag === "select") {
                    e.preventDefault();
                    if (wizardCurrentStep < 4) {
                        const btnContinue = document.getElementById("btn-wizard-continue");
                        if (btnContinue) {
                            btnContinue.click();
                        }
                    } else {
                        const btnSearchSubmit = document.getElementById("btn-search");
                        if (btnSearchSubmit) {
                            btnSearchSubmit.click();
                        }
                    }
                }
            }
        });
    }
    if (filterPlatform) filterPlatform.addEventListener("change", renderLeads);
    if (filterStatus) filterStatus.addEventListener("change", renderLeads);
    if (filterCrm) filterCrm.addEventListener("change", renderLeads);
    if (dashboardSearchInput) dashboardSearchInput.addEventListener("input", renderLeads);
    
    const filterSearchType = document.getElementById("filter-search-type");
    if (filterSearchType) filterSearchType.addEventListener("change", renderLeads);

    const pipelineSearchInput = document.getElementById("pipeline-search-input");
    const pipelineFilterPlatform = document.getElementById("pipeline-filter-platform");
    const pipelineFilterIntent = document.getElementById("pipeline-filter-intent");
    const pipelineFilterSearchType = document.getElementById("pipeline-filter-search-type");

    if (pipelineSearchInput) pipelineSearchInput.addEventListener("input", renderKanban);
    if (pipelineFilterPlatform) pipelineFilterPlatform.addEventListener("change", renderKanban);
    if (pipelineFilterIntent) pipelineFilterIntent.addEventListener("change", renderKanban);
    if (pipelineFilterSearchType) pipelineFilterSearchType.addEventListener("change", renderKanban);

    const archiveFilterSearchType = document.getElementById("archive-filter-search-type");
    if (archiveFilterSearchType) archiveFilterSearchType.addEventListener("change", () => {
        archiveCurrentPage = 1;
        renderArchiveLeads();
    });

    if (archiveFilterPlatform) archiveFilterPlatform.addEventListener("change", () => {
        archiveCurrentPage = 1;
        if (typeof syncPillsToDropdowns === "function") syncPillsToDropdowns();
        renderArchiveLeads();
    });
    if (archiveFilterStatus) archiveFilterStatus.addEventListener("change", () => {
        archiveCurrentPage = 1;
        if (typeof syncPillsToDropdowns === "function") syncPillsToDropdowns();
        renderArchiveLeads();
    });
    if (archiveFilterCrm) archiveFilterCrm.addEventListener("change", () => {
        archiveCurrentPage = 1;
        if (typeof syncPillsToDropdowns === "function") syncPillsToDropdowns();
        renderArchiveLeads();
    });
    if (archiveSearchInput) {
        archiveSearchInput.addEventListener("input", () => {
            archiveCurrentPage = 1;
            renderArchiveLeads();
        });
    }

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

    // User Profile topbar trigger and button listeners
    if (topbarProfilePic) topbarProfilePic.addEventListener("click", () => switchTab("profile"));

    const btnSaveProfile = document.getElementById("btn-save-user-profile");
    if (btnSaveProfile) btnSaveProfile.addEventListener("click", saveUserProfile);

    const profileBusinessInput = document.getElementById("profile-business-name");
    if (profileBusinessInput) {
        profileBusinessInput.addEventListener("input", () => {
            const val = profileBusinessInput.value;
            if (agencyNameInput) agencyNameInput.value = val;
            localStorage.setItem("silvia_agency_name", val);
            localStorage.setItem("agencyName", val);
            updateSidebarAgencyName();
            updateConfigPreview();
        });
    }

    const btnToggleProfileToken = document.getElementById("btn-toggle-profile-token");
    if (btnToggleProfileToken) btnToggleProfileToken.addEventListener("click", toggleProfileTokenVisibility);

    const btnCopyProfileToken = document.getElementById("btn-copy-profile-token");
    if (btnCopyProfileToken) btnCopyProfileToken.addEventListener("click", copyProfileTokenToClipboard);

    const btnProfileLogout = document.getElementById("btn-profile-logout");
    if (btnProfileLogout) btnProfileLogout.addEventListener("click", logout);

    const btnSaveWebhook = document.getElementById("btn-save-webhook-url");
    if (btnSaveWebhook) btnSaveWebhook.addEventListener("click", saveWebhookUrl);

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
    
    // Candidate details listeners
    const modalSkills = document.getElementById("modal-skills");
    const modalExperienceLevel = document.getElementById("modal-experience-level");
    const modalWorkPreference = document.getElementById("modal-work-preference");
    if (modalSkills) modalSkills.addEventListener("change", saveLeadDetailsFromModal);
    if (modalExperienceLevel) modalExperienceLevel.addEventListener("change", saveLeadDetailsFromModal);
    if (modalWorkPreference) modalWorkPreference.addEventListener("change", saveLeadDetailsFromModal);

    // Verification & Export links
    if (btnExportCsvSidebar) btnExportCsvSidebar.addEventListener("click", exportCampaignCSV);
    if (btnEnrichContact) btnEnrichContact.addEventListener("click", enrichContactEmail);

    // Saved searches and active monitoring triggers
    if (btnSaveSearch) btnSaveSearch.addEventListener("click", saveCurrentSearch);
    if (btnRunMonitoring) btnRunMonitoring.addEventListener("click", runActiveMonitoring);

    // IMAP Configuration save & Sync triggers
    const btnSaveImap = document.getElementById("btn-save-imap-config");
    if (btnSaveImap) btnSaveImap.addEventListener("click", saveImapConfig);

    const btnSyncReplies = document.getElementById("btn-sync-replies-trigger");
    if (btnSyncReplies) btnSyncReplies.addEventListener("click", syncReplies);

    // Google Places API Key save & eye toggles
    const btnSavePlaces = document.getElementById("btn-save-places-key");
    if (btnSavePlaces) btnSavePlaces.addEventListener("click", savePlacesConfig);

    const btnTogglePlacesKey = document.getElementById("btn-toggle-places-key");
    if (btnTogglePlacesKey) {
        btnTogglePlacesKey.addEventListener("click", () => {
            const input = document.getElementById("settings-places-key");
            if (input) {
                const icon = btnTogglePlacesKey.querySelector("i");
                if (input.type === "password") {
                    input.type = "text";
                    if (icon) {
                        icon.setAttribute("data-lucide", "eye-off");
                        lucide.createIcons();
                    }
                } else {
                    input.type = "password";
                    if (icon) {
                        icon.setAttribute("data-lucide", "eye");
                        lucide.createIcons();
                    }
                }
            }
        });
    }

    // Twitter API Key save & eye toggles
    const btnSaveTwitter = document.getElementById("btn-save-twitter-key");
    if (btnSaveTwitter) btnSaveTwitter.addEventListener("click", saveTwitterConfig);

    const btnToggleTwitterKey = document.getElementById("btn-toggle-twitter-key");
    if (btnToggleTwitterKey) {
        btnToggleTwitterKey.addEventListener("click", () => {
            const input = document.getElementById("settings-twitter-key");
            if (input) {
                const icon = btnToggleTwitterKey.querySelector("i");
                if (input.type === "password") {
                    input.type = "text";
                    if (icon) {
                        icon.setAttribute("data-lucide", "eye-off");
                        lucide.createIcons();
                    }
                } else {
                    input.type = "password";
                    if (icon) {
                        icon.setAttribute("data-lucide", "eye");
                        lucide.createIcons();
                    }
                }
            }
        });
    }

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

    // Bind Grid view queries modal trigger
    const btnOpenQueriesModal = document.getElementById("btn-open-queries-modal");
    if (btnOpenQueriesModal) {
        btnOpenQueriesModal.addEventListener("click", openQueriesModal);
    }

    // AI Model Configuration listeners
    const btnSaveModelConfig = document.getElementById("btn-save-model-config");
    if (btnSaveModelConfig) {
        btnSaveModelConfig.addEventListener("click", saveModelConfig);
    }

    // Notification Dropdown listeners
    const btnNotifications = document.getElementById("btn-notifications");
    const notificationsDropdown = document.getElementById("notifications-dropdown");
    const btnNotificationsViewAll = document.getElementById("btn-notifications-view-all");
    const btnNotificationsModalClose = document.getElementById("notifications-modal-close");
    const notificationsModal = document.getElementById("notifications-modal");

    if (btnNotifications && notificationsDropdown) {
        btnNotifications.addEventListener("click", (e) => {
            e.stopPropagation();
            notificationsDropdown.classList.toggle("active");
            if (notificationsDropdown.classList.contains("active")) {
                loadNotifications();
            }
        });
    }

    if (btnNotificationsViewAll) {
        btnNotificationsViewAll.addEventListener("click", (e) => {
            e.stopPropagation();
            if (notificationsDropdown) notificationsDropdown.classList.remove("active");
            openNotificationsModal();
        });
    }

    if (btnNotificationsModalClose && notificationsModal) {
        btnNotificationsModalClose.addEventListener("click", closeNotificationsModal);
        notificationsModal.addEventListener("click", (e) => {
            if (e.target === notificationsModal) {
                closeNotificationsModal();
            }
        });
    }

    // Refresh buttons
    const btnRefreshArchive = document.getElementById("btn-refresh-archive");
    if (btnRefreshArchive) {
        btnRefreshArchive.addEventListener("click", async () => {
            btnRefreshArchive.disabled = true;
            const originalHTML = btnRefreshArchive.innerHTML;
            btnRefreshArchive.innerHTML = `<span class="spinner spinner-tiny"></span> Refreshing...`;
            
            const container = document.querySelector(".archive-stacked-layout");
            if (container) container.classList.add("loading-fade");

            try {
                // Minor delay to let user see transition
                await new Promise(resolve => setTimeout(resolve, 300));
                archiveCurrentPage = 1;
                await loadSearchHistory();
                renderArchiveLeads();
            } catch (err) {
                await showCustomAlert("Error refreshing search archive: " + err.message, "Refresh Error", "danger");
            } finally {
                if (container) container.classList.remove("loading-fade");
                btnRefreshArchive.disabled = false;
                btnRefreshArchive.innerHTML = originalHTML;
                if (window.lucide) window.lucide.createIcons();
            }
        });
    }

    const btnRefreshPipeline = document.getElementById("btn-refresh-pipeline");
    if (btnRefreshPipeline) {
        btnRefreshPipeline.addEventListener("click", async () => {
            btnRefreshPipeline.disabled = true;
            const originalHTML = btnRefreshPipeline.innerHTML;
            btnRefreshPipeline.innerHTML = `<span class="spinner spinner-tiny"></span> Refreshing...`;

            const container = document.querySelector(".kanban-board");
            if (container) container.classList.add("loading-fade");

            try {
                // Minor delay to let user see transition
                await new Promise(resolve => setTimeout(resolve, 300));
                await loadExistingLeads(true);
                renderKanban();
            } catch (err) {
                await showCustomAlert("Error refreshing outreach pipeline: " + err.message, "Refresh Error", "danger");
            } finally {
                if (container) container.classList.remove("loading-fade");
                btnRefreshPipeline.disabled = false;
                btnRefreshPipeline.innerHTML = originalHTML;
                if (window.lucide) window.lucide.createIcons();
            }
        });
    }

    // Close notifications dropdown when clicking outside
    document.addEventListener("click", (e) => {
        if (notificationsDropdown && notificationsDropdown.classList.contains("active")) {
            if (!notificationsDropdown.contains(e.target) && e.target !== btnNotifications && !btnNotifications.contains(e.target)) {
                notificationsDropdown.classList.remove("active");
            }
        }
    });

    // Initial load of model config to populate UI status pills on startup
    loadModelConfig();
});

// Loader Helpers for Page/Tab Views
function showTabLoader(viewElement, tabName = "") {
    if (!viewElement) return;
    let loader = viewElement.querySelector(".tab-loader");
    const labels = {
        "dashboard": "Loading Dashboard...",
        "discovery": "Loading Lead Discovery...",
        "pipeline": "Loading Lead Pipeline...",
        "archive": "Loading Search Archive...",
        "settings": "Loading Settings...",
        "profile": "Loading User Profile..."
    };
    const labelText = labels[tabName] || "Loading page content...";
    
    if (!loader) {
        loader = document.createElement("div");
        loader.className = "tab-loader";
        loader.innerHTML = `
            <div class="spinner spinner-large"></div>
            <div class="tab-loader-text">${labelText}</div>
        `;
        // Ensure absolute positioning works inside the view
        viewElement.style.position = "relative";
        viewElement.appendChild(loader);
    } else {
        const textEl = loader.querySelector(".tab-loader-text");
        if (textEl) {
            textEl.textContent = labelText;
        }
    }
    // Force layout reflow to trigger CSS transition smoothly
    loader.offsetWidth;
    loader.classList.add("active");
}

function hideTabLoader(viewElement) {
    if (!viewElement) return;
    const loader = viewElement.querySelector(".tab-loader");
    if (loader) {
        loader.classList.remove("active");
    }
}

// View Tabs Switcher
async function switchTab(tabName) {
    const tabs = {
        "dashboard": { btn: tabBtnDashboard, view: viewDashboard },
        "discovery": { btn: tabBtnDiscovery, view: viewDiscovery },
        "pipeline": { btn: tabBtnPipeline, view: viewPipeline },
        "archive": { btn: tabBtnArchive, view: viewArchive },
        "settings": { btn: tabBtnSettings, view: viewSettings },
        "profile": { btn: topbarProfilePic, view: viewProfile }
    };

    Object.keys(tabs).forEach(name => {
        const item = tabs[name];
        if (!item.btn || !item.view) return;
        if (name === tabName) {
            item.btn.classList.add("active");
            item.view.classList.add("active");
            item.view.classList.add("loading-fade");
            showTabLoader(item.view, tabName);
        } else {
            item.btn.classList.remove("active");
            item.view.classList.remove("active");
            item.view.classList.remove("loading-fade");
            hideTabLoader(item.view);
        }
    });

    try {
        if (tabName === "pipeline") {
            await loadExistingLeads(true);
            renderKanban();
        } else if (tabName === "dashboard") {
            await loadExistingLeads(true);
            loadPerformanceAnalytics();
            renderLeads();
        } else if (tabName === "discovery") {
            resetDiscoveryWizard();
            await loadSavedSearches();
        } else if (tabName === "archive") {
            archiveCurrentPage = 1;
            await loadSearchHistory();
            renderArchiveLeads();
        } else if (tabName === "settings") {
            updateConfigPreview();
            await loadImapConfig();
            await loadModelConfig();
            await loadPlacesConfig();
            await loadTwitterConfig();
        } else if (tabName === "profile") {
            await loadUserProfile();
            await loadWebhookUrl();
        }
    } finally {
        const activeItem = tabs[tabName];
        if (activeItem && activeItem.view) {
            setTimeout(() => {
                activeItem.view.classList.remove("loading-fade");
                hideTabLoader(activeItem.view);
            }, 150);
        }
    }
}

// REST Lead Load
async function loadExistingLeads(isInitialNotifications = true) {
    try {
        const response = await fetch("/api/leads");
        const data = await response.json();
        leadsData = data.leads || [];

        // Populate primary stats banner counts globally
        updateGlobalStats(leadsData);
        loadPerformanceAnalytics();
        renderRecommendedLeads();
        renderRecentActivity();
        loadNotifications(isInitialNotifications);

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
    if (typeof wizardCurrentStep !== "undefined" && wizardCurrentStep < 4) {
        e.preventDefault();
        const btnContinue = document.getElementById("btn-wizard-continue");
        if (btnContinue) {
            btnContinue.click();
        }
        return;
    }
    e.preventDefault();

    const keyword = keywordInput.value.trim();
    const timeframe = timeframeSelect.value;
    const limit = parseInt(limitSelect.value);
    const platform = platformSelect ? platformSelect.value : "linkedin";
    const matchTypeSelect = document.getElementById("match-type");
    const match_type = matchTypeSelect ? matchTypeSelect.value : "partial";
    const locationEl = document.getElementById("wizard-location");
    const industryEl = document.getElementById("wizard-industry");
    const location = locationEl ? locationEl.value.trim() : "";
    const industry = industryEl ? industryEl.value.trim() : "";
    const searchTypeEl = document.getElementById("search-type");
    const search_type = searchTypeEl ? searchTypeEl.value : "sales";

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
            body: JSON.stringify({ keyword, timeframe, limit, platform, match_type, location, industry, search_type })
        });

        if (!response.ok) {
            throw new Error(`Search request failed: ${response.statusText}`);
        }

        clearInterval(interval);
        loadingProgress.style.width = "100%";

        // Fetch new state and jump to dashboard view
        await loadExistingLeads(false);

        setTimeout(() => {
            setSearchLoading(false);
            resetDiscoveryWizard();
            switchTab("dashboard");
        }, 500);

    } catch (error) {
        clearInterval(interval);
        setSearchLoading(false);
        await showCustomAlert(`Lead scraper error: ${error.message}`, "Scan Error", "danger");
        console.error(error);
    }
}

function setSearchLoading(isLoading, platform = "linkedin") {
    if (isLoading) {
        btnSearch.disabled = true;
        btnSearch.querySelector("span").innerText = "Scanning...";
        loadingState.style.display = "flex";
        let capPlatform = platform === "all" ? "All Web Sources" : platform.charAt(0).toUpperCase() + platform.slice(1);
        if (platform === "google_maps") {
            capPlatform = "Google Maps";
        }
        loadingStatusText.innerText = platform === "google_maps"
            ? "Launching Playwright Google Maps scraper..."
            : `Querying ${capPlatform} via Google Serper API...`;
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
    const searchVal = dashboardSearchInput ? dashboardSearchInput.value.trim().toLowerCase() : "";
    const filterSearchType = document.getElementById("filter-search-type");
    const searchTypeVal = filterSearchType ? filterSearchType.value.toLowerCase() : "all";

    const filtered = leadsData.filter(lead => {
        const leadStatus = String(lead.leadStatus || "").toLowerCase().trim();
        let statusMatch = false;
        if (statusVal === "all") {
            statusMatch = true;
        } else if (statusVal === "qualified") {
            statusMatch = (leadStatus === "qualified" || leadStatus === "new lead" || leadStatus === "new");
        } else if (statusVal === "unqualified") {
            statusMatch = (leadStatus === "unqualified" || leadStatus === "not qualified" || leadStatus === "disqualified");
        } else if (statusVal === "warm lead") {
            statusMatch = (leadStatus === "warm lead" || leadStatus === "warm");
        } else if (statusVal === "potential lead") {
            statusMatch = (leadStatus === "potential lead" || leadStatus === "potential" || leadStatus === "cold lead" || leadStatus === "cold");
        } else if (statusVal === "not a lead") {
            statusMatch = (leadStatus === "not a lead" || leadStatus === "not lead");
        } else if (statusVal === "informational") {
            statusMatch = (leadStatus === "informational" || leadStatus === "information");
        } else {
            statusMatch = (leadStatus === statusVal || leadStatus.includes(statusVal));
        }

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
            searchMatch = searchWords.every(word => {
                return author.includes(word) || company.includes(word);
            });
        }

        const leadSearchType = String(lead.search_type || "sales").toLowerCase();
        const searchTypeMatch = searchTypeVal === "all" || leadSearchType === searchTypeVal;

        return statusMatch && crmMatch && platformMatch && searchMatch && searchTypeMatch;
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
        } else if (platform === "google_maps") {
            platformBadgeColor = "rgba(255, 159, 67, 0.1)";
            platformColor = "#FF9F43";
            platformIconName = "map-pin";
            displayPlatform = "Google Maps";
        }

        const avatarUrl = getLeadAvatarUrl(displayAuthor);
        const logoUrl = getCompanyLogoUrl(displayCompany);

        let contactHtml = "";
        if (isEmailValid) {
            contactHtml = `
                <div style="display: flex; flex-direction: column; gap: 0.2rem; align-items: flex-start;">
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                        <i data-lucide="${isEmailVerified ? 'check-circle-2' : 'help-circle'}" style="width: 14px; height: 14px; color: ${isEmailVerified ? 'var(--success)' : 'var(--warning)'}; flex-shrink: 0;"></i>
                        <span style="font-size: 0.78rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;" title="${emailVal}">${emailVal}</span>
                    </div>
                    <span class="badge ${emailBadgeClass}" style="font-size: 0.65rem; padding: 0.1rem 0.35rem; line-height: 1;">${emailBadgeLabel}</span>
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
        
        let candidateBadges = "";
        if (lead.search_type === "recruiter") {
            if (lead.experienceLevel && lead.experienceLevel !== "Unknown") {
                candidateBadges += `<span class="badge badge-success" style="font-size: 0.65rem; padding: 0.1rem 0.35rem; line-height: 1; border-radius: 4px; margin-right: 0.25rem;">${lead.experienceLevel}</span>`;
            }
            if (lead.workPreference && lead.workPreference !== "Unknown") {
                candidateBadges += `<span class="badge badge-primary" style="font-size: 0.65rem; padding: 0.1rem 0.35rem; line-height: 1; border-radius: 4px; margin-right: 0.25rem; background: rgba(14, 165, 164, 0.1); color: var(--accent);">${lead.workPreference}</span>`;
            }
            if (lead.skills) {
                const skillsList = lead.skills.split(",").slice(0, 3).map(s => s.trim());
                skillsList.forEach(sk => {
                    candidateBadges += `<span class="badge badge-neutral" style="font-size: 0.65rem; padding: 0.1rem 0.35rem; line-height: 1; border-radius: 4px; margin-right: 0.25rem;">${sk}</span>`;
                });
            }
        }

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
                        ${candidateBadges ? `<div style="display: flex; flex-wrap: wrap; gap: 0.2rem; margin-top: 0.25rem;">${candidateBadges}</div>` : ""}
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

    const pipelineSearchInput = document.getElementById("pipeline-search-input");
    const pipelineFilterPlatform = document.getElementById("pipeline-filter-platform");
    const pipelineFilterIntent = document.getElementById("pipeline-filter-intent");
    const pipelineFilterSearchType = document.getElementById("pipeline-filter-search-type");

    const searchVal = pipelineSearchInput ? pipelineSearchInput.value.trim().toLowerCase() : "";
    const platformVal = pipelineFilterPlatform ? pipelineFilterPlatform.value.toLowerCase() : "all";
    const intentVal = pipelineFilterIntent ? pipelineFilterIntent.value.toLowerCase() : "all";
    const pipelineSearchTypeVal = pipelineFilterSearchType ? pipelineFilterSearchType.value.toLowerCase() : "all";

    // Dynamic renaming of headers
    const isRecruiting = pipelineSearchTypeVal === "recruiter";
    const colNew = document.querySelector('.kanban-column[data-stage="New"] .header-left span:last-child');
    const colDrafted = document.querySelector('.kanban-column[data-stage="Drafted"] .header-left span:last-child');
    const colEmailed = document.querySelector('.kanban-column[data-stage="Emailed"] .header-left span:last-child');
    const colReplied = document.querySelector('.kanban-column[data-stage="Replied"] .header-left span:last-child');
    const colDisqualified = document.querySelector('.kanban-column[data-stage="Disqualified"] .header-left span:last-child');
    
    if (colNew) colNew.innerText = isRecruiting ? "Discovered" : "New Leads";
    if (colDrafted) colDrafted.innerText = isRecruiting ? "Contacted" : "Drafted Pitch";
    if (colEmailed) colEmailed.innerText = isRecruiting ? "Screening" : "Emailed Out";
    if (colReplied) colReplied.innerText = isRecruiting ? "Interviewing" : "Replied";
    if (colDisqualified) colDisqualified.innerText = isRecruiting ? "Rejected" : "Disqualified";

    leadsData.forEach(lead => {
        // Apply search filter (name or company name)
        if (searchVal) {
            const author = String(lead.authorName || "").toLowerCase();
            const company = String(lead.companyName || "").toLowerCase();
            if (!author.includes(searchVal) && !company.includes(searchVal)) {
                return;
            }
        }

        // Apply platform filter
        if (platformVal !== "all") {
            const leadPlatform = getLeadPlatform(lead);
            if (leadPlatform !== platformVal) {
                return;
            }
        }

        // Apply intent category filter
        if (intentVal !== "all") {
            const category = String(lead.leadCategory || "Low Intent").toLowerCase();
            if (category !== intentVal) {
                return;
            }
        }

        // Apply search type filter
        if (pipelineSearchTypeVal !== "all") {
            const leadSearchType = String(lead.search_type || "sales").toLowerCase();
            if (leadSearchType !== pipelineSearchTypeVal) {
                return;
            }
        }

        const stage = lead.crmStatus || (isRecruiting ? "Discovered" : "New");
        
        // Map recruiter-specific stage names to Sales kanban columns
        let mappedStage = stage;
        if (isRecruiting) {
            if (stage === "Discovered") mappedStage = "New";
            else if (stage === "Contacted") mappedStage = "Drafted";
            else if (stage === "Screening") mappedStage = "Emailed";
            else if (stage === "Interviewing") mappedStage = "Replied";
            else if (stage === "Offered" || stage === "Rejected") mappedStage = "Disqualified";
        }

        const matchedColumn = columns[mappedStage] || columns["New"];
        matchedColumn.items.push(lead);
    });

    Object.keys(columns).forEach(stage => {
        const col = columns[stage];
        if (!col.cards || !col.count) return;

        // Auto-sort items in each column by leadScore descending (so high intents are always at the top)
        col.items.sort((a, b) => {
            let scoreA = a.leadScore;
            if (scoreA === undefined || scoreA === null) {
                scoreA = parseFloat(a.confidenceScore) || 0;
                if (scoreA <= 1.0 && scoreA > 0) scoreA = Math.round(scoreA * 100);
            }
            let scoreB = b.leadScore;
            if (scoreB === undefined || scoreB === null) {
                scoreB = parseFloat(b.confidenceScore) || 0;
                if (scoreB <= 1.0 && scoreB > 0) scoreB = Math.round(scoreB * 100);
            }
            return scoreB - scoreA;
        });

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
            } else if (platform === "google_maps") {
                platformColor = "#FF9F43";
                platformIcon = "map-pin";
            }

            const avatarUrl = getLeadAvatarUrl(lead.authorName || "Unknown");
            const logoUrl = getCompanyLogoUrl(displayCompany);

            let candidateBadges = "";
            if (lead.search_type === "recruiter") {
                if (lead.experienceLevel && lead.experienceLevel !== "Unknown") {
                    candidateBadges += `<span class="badge badge-success" style="font-size: 0.62rem; padding: 0.05rem 0.25rem; line-height: 1; border-radius: 3px; margin-right: 0.2rem;">${lead.experienceLevel}</span>`;
                }
                if (lead.workPreference && lead.workPreference !== "Unknown") {
                    candidateBadges += `<span class="badge badge-primary" style="font-size: 0.62rem; padding: 0.05rem 0.25rem; line-height: 1; border-radius: 3px; margin-right: 0.2rem; background: rgba(14, 165, 164, 0.1); color: var(--accent);">${lead.workPreference}</span>`;
                }
                if (lead.skills) {
                    const skillsList = lead.skills.split(",").slice(0, 2).map(s => s.trim());
                    skillsList.forEach(sk => {
                        candidateBadges += `<span class="badge badge-neutral" style="font-size: 0.62rem; padding: 0.05rem 0.25rem; line-height: 1; border-radius: 3px; margin-right: 0.2rem;">${sk}</span>`;
                    });
                }
            }

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
                        ${getPlatformIconSvg(platform, 10, "display: block;")}
                    </span>
                </div>

                <div class="card-company-row">
                    <img src="${logoUrl}" style="width: 12px; height: 12px; border-radius: 2px;" alt="Logo">
                    <span class="card-company-name">${displayCompany}</span>
                </div>

                <div class="card-service-desc">${displayRequirement}</div>
                ${candidateBadges ? `<div style="display: flex; flex-wrap: wrap; gap: 0.15rem; margin-top: 0.35rem; margin-bottom: 0.25rem;">${candidateBadges}</div>` : ""}

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
            } catch (err) { }

            if (!transferUrl) return;

            const lead = leadsData.find(l => l.sourceUrl === transferUrl);
            if (lead) {
                const isRecruiting = lead.search_type === "recruiter";
                let actualStage = targetStage;
                if (isRecruiting) {
                    if (targetStage === "New") actualStage = "Discovered";
                    else if (targetStage === "Drafted") actualStage = "Contacted";
                    else if (targetStage === "Emailed") actualStage = "Screening";
                    else if (targetStage === "Replied") actualStage = "Interviewing";
                    else if (targetStage === "Disqualified") actualStage = "Rejected";
                }
                
                if (lead.crmStatus !== actualStage) {
                    lead.crmStatus = actualStage;

                    if (activeLead && activeLead.sourceUrl === lead.sourceUrl) {
                        modalCrmStatus.value = actualStage;
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
                                crmStatus: actualStage,
                                draftEmail: lead.draftEmail || "",
                                workPreference: lead.workPreference || "",
                                skills: lead.skills || "",
                                experienceLevel: lead.experienceLevel || "",
                                search_type: lead.search_type || "sales"
                            })
                        });
                        // Refresh dashboard data too
                        updateGlobalStats(leadsData);
                    } catch (err) {
                        console.error("Drag stage update error:", err);
                    }
                }
            }
        });
    });
}

// Slide Drawer Opening controls
function openDetailModal(lead) {
    activeLead = lead;

    const modalSkills = document.getElementById("modal-skills");
    const modalExperienceLevel = document.getElementById("modal-experience-level");
    const modalWorkPreference = document.getElementById("modal-work-preference");
    const candidateSection = document.getElementById("modal-candidate-section");

    if (lead.search_type === "recruiter") {
        if (candidateSection) candidateSection.style.display = "block";
        if (modalSkills) modalSkills.value = lead.skills || "";
        if (modalExperienceLevel) modalExperienceLevel.value = lead.experienceLevel || "Unknown";
        if (modalWorkPreference) modalWorkPreference.value = lead.workPreference || "Unknown";
    } else {
        if (candidateSection) candidateSection.style.display = "none";
    }

    // Dynamically rebuild CRM status dropdown options based on search type
    if (modalCrmStatus) {
        modalCrmStatus.innerHTML = "";
        const isRecruiter = lead.search_type === "recruiter";
        const stages = isRecruiter 
            ? ["Discovered", "Contacted", "Screening", "Interviewing", "Offered", "Rejected"]
            : ["New", "New Discovery", "Drafted", "Emailed", "Replied", "Disqualified"];
        
        stages.forEach(stg => {
            const opt = document.createElement("option");
            opt.value = stg;
            opt.innerText = stg;
            modalCrmStatus.appendChild(opt);
        });
    }

    modalAuthorName.value = lead.authorName || "";
    modalCompanyName.value = lead.companyName || "";
    let rawIntent = String(lead.buyingIntent || "").toLowerCase();
    let cleanIntent = "Unknown";
    if (rawIntent.includes("high")) cleanIntent = "High";
    else if (rawIntent.includes("hiring")) cleanIntent = "Hiring";
    else if (rawIntent.includes("research")) cleanIntent = "Research";
    else if (rawIntent.includes("low")) cleanIntent = "Low";
    else if (rawIntent.includes("none") || rawIntent.includes("no intent")) cleanIntent = "None";
    else if (rawIntent) {
        if (rawIntent.includes("looking for") || rawIntent.includes("need") || rawIntent.includes("services") || rawIntent.includes("develop") || rawIntent.includes("design") || rawIntent.includes("freelance") || rawIntent.includes("partner")) {
            cleanIntent = "High";
        } else {
            cleanIntent = "Unknown";
        }
    }
    modalBuyingIntent.value = cleanIntent;
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
    } else if (lead.sourceUrl.includes("google.com/maps") || lead.sourceUrl.includes("google.co.in/maps") || (lead.platform && lead.platform.toLowerCase() === "google_maps")) {
        modalBtnLinkedin.innerHTML = `${getPlatformIconSvg("google_maps", 14)} Show in Google Maps`;
    } else {
        modalBtnLinkedin.innerHTML = `${getPlatformIconSvg("linkedin", 14)} View LinkedIn`;
    }

    modalCrmStatus.value = lead.crmStatus || (lead.search_type === "recruiter" ? "Discovered" : "New");

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

    // Render Email Replies History inside detail drawer
    const drawerRepliesSection = document.getElementById("drawer-replies-section");
    const drawerRepliesList = document.getElementById("drawer-replies-list");
    if (drawerRepliesSection && drawerRepliesList) {
        const replies = lead.replies || [];
        if (replies.length > 0) {
            drawerRepliesList.innerHTML = "";
            replies.forEach(reply => {
                const replyCard = document.createElement("div");
                replyCard.style.background = "rgba(255, 255, 255, 0.03)";
                replyCard.style.border = "1px solid var(--border-color)";
                replyCard.style.borderRadius = "8px";
                replyCard.style.padding = "10px 12px";
                replyCard.style.display = "flex";
                replyCard.style.flexDirection = "column";
                replyCard.style.gap = "0.25rem";

                replyCard.innerHTML = `
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary);">
                        <strong>From: ${reply.from || "Unknown"}</strong>
                        <span>${reply.date || ""}</span>
                    </div>
                    <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-top: 0.15rem;">
                        Sub: ${reply.subject || "(No Subject)"}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); white-space: pre-wrap; font-style: italic; margin-top: 0.25rem; line-height: 1.3;">
                        "${reply.snippet || ""}"
                    </div>
                `;
                drawerRepliesList.appendChild(replyCard);
            });
            drawerRepliesSection.style.display = "block";
        } else {
            drawerRepliesSection.style.display = "none";
        }
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
                contactInfo: activeLead.contactInfo || "",
                workPreference: activeLead.workPreference || "",
                skills: activeLead.skills || "",
                experienceLevel: activeLead.experienceLevel || "",
                search_type: activeLead.search_type || "sales"
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
        const profileBusInput = document.getElementById("profile-business-name");
        const agencyName = (agencyNameInput ? agencyNameInput.value.trim() : "") || 
                           (profileBusInput ? profileBusInput.value.trim() : "") || 
                           localStorage.getItem("silvia_agency_name") || 
                           "My Business";

        const agencyInfo = (agencyInfoInput ? agencyInfoInput.value.trim() : "") || 
                           localStorage.getItem("silvia_agency_info") || 
                           "premier design & development services";

        const emailTone = (emailToneSelect ? emailToneSelect.value : "") || 
                          localStorage.getItem("silvia_email_tone") || 
                          "Short & Conversational";

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
        await showCustomAlert("Pitch generator error: " + e.message, "Generation Error", "danger");
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
        showCustomAlert("Copied to clipboard!", "Copied", "primary");
    }).catch(err => {
        console.error("Clipboard write error:", err);
    });
}

// Campaign outreach CSV exporter
async function exportCampaignCSV() {
    if (leadsData.length === 0) {
        await showCustomAlert("No lead details to export!", "Export Error", "danger");
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

        activeLead.contactSource = data.contactSource || "guessed";
        activeLead.contactConfidence = data.contactConfidence || "low";

        const modalContactSourceElement = document.getElementById("modal-contact-source");
        const modalContactConfidenceElement = document.getElementById("modal-contact-confidence");
        if (modalContactSourceElement) modalContactSourceElement.innerText = activeLead.contactSource;
        if (modalContactConfidenceElement) modalContactConfidenceElement.innerText = activeLead.contactConfidence;

        const idx = leadsData.findIndex(l => l.sourceUrl === activeLead.sourceUrl);
        if (idx !== -1) {
            leadsData[idx] = { ...activeLead };
        }

        if (viewDashboard && viewDashboard.classList.contains("active")) renderLeads();
        if (viewArchive && viewArchive.classList.contains("active")) renderArchiveLeads();
        updateGlobalStats(leadsData);
    } catch (err) {
        await showCustomAlert("Enrichment lookup failed: " + err.message, "Lookup Failed", "danger");
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

    const modalSkills = document.getElementById("modal-skills");
    const modalExperienceLevel = document.getElementById("modal-experience-level");
    const modalWorkPreference = document.getElementById("modal-work-preference");
    
    if (modalSkills) activeLead.skills = modalSkills.value;
    if (modalExperienceLevel) activeLead.experienceLevel = modalExperienceLevel.value;
    if (modalWorkPreference) activeLead.workPreference = modalWorkPreference.value;

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

    // Filter history list items
    const filteredSearches = searchesData.filter(search => {
        const displayKeyword = search.keyword || "Scan Query";
        return !filterVal || displayKeyword.toLowerCase().includes(filterVal);
    });

    let visibleSearches = filteredSearches;
    let showMoreCard = false;

    if (!filterVal && filteredSearches.length > 10) {
        visibleSearches = filteredSearches.slice(0, 10);
        showMoreCard = true;
    }

    // Add history list items
    visibleSearches.forEach(search => {
        const displayKeyword = search.keyword || "Scan Query";

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
        const exactBadgeHtml = isExact ? `<span class="badge-exact">Exact</span>` : "";

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
        const searchType = search.search_type || "sales";
        const typeBadgeHtml = searchType === "recruiter" ? `<span class="badge-recruiter" style="background: rgba(14, 165, 164, 0.1); color: var(--accent); padding: 0.1rem 0.35rem; font-size: 0.65rem; border-radius: 4px; font-weight: 600; line-height: 1; margin-left: 4px;">HR Mode</span>` : "";

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
                <span class="badge-platform badge-platform-${platform}">${getPlatformIconSvg(platform, 10)}${capPlatform}</span>
                ${typeBadgeHtml}
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

    // Add "View More" card if searches exceed 10
    if (showMoreCard) {
        const moreCard = document.createElement("div");
        moreCard.className = "history-item-more";
        moreCard.innerHTML = `
            <i data-lucide="layout-grid"></i>
            <span>+ ${filteredSearches.length - 10} More</span>
        `;
        moreCard.addEventListener("click", openQueriesModal);
        archiveHistoryList.appendChild(moreCard);
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// Grid Queries Modal Control
function openQueriesModal() {
    const modal = document.getElementById("queries-modal");
    if (!modal) return;
    modal.style.display = "flex";

    // Force a minor delay for CSS scale transform animation activation
    setTimeout(() => {
        modal.classList.add("active");
    }, 10);

    renderModalQueries();

    // Bind modal close buttons
    const closeBtn = document.getElementById("queries-modal-close");
    if (closeBtn) {
        closeBtn.onclick = closeQueriesModal;
    }

    // Close on overlay background click
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeQueriesModal();
        }
    };

    // Bind search filter input
    const searchInput = document.getElementById("modal-queries-search");
    if (searchInput) {
        searchInput.value = "";
        searchInput.oninput = renderModalQueries;
        searchInput.focus();
    }
}

function closeQueriesModal() {
    const modal = document.getElementById("queries-modal");
    if (!modal) return;
    modal.classList.remove("active");
    setTimeout(() => {
        modal.style.display = "none";
    }, 200);
}

function renderModalQueries() {
    const gridContainer = document.getElementById("modal-queries-grid");
    if (!gridContainer) return;
    gridContainer.innerHTML = "";

    const searchInput = document.getElementById("modal-queries-search");
    const filterVal = searchInput ? searchInput.value.trim().toLowerCase() : "";

    searchesData.forEach(search => {
        const displayKeyword = search.keyword || "Scan Query";
        if (filterVal && !displayKeyword.toLowerCase().includes(filterVal)) {
            return;
        }

        const card = document.createElement("div");
        card.className = `history-item ${activeSearchId === search.id ? "active" : ""}`;
        card.style.margin = "0";
        card.style.width = "auto";
        card.style.minWidth = "0";
        card.addEventListener("click", () => {
            activeSearchId = search.id;
            archiveCurrentPage = 1;
            closeQueriesModal();
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
        const exactBadgeHtml = isExact ? `<span class="badge-exact">Exact</span>` : "";

        const platform = search.platform || "linkedin";
        const capPlatform = platform === "all" ? "All Web" : platform.charAt(0).toUpperCase() + platform.slice(1);
        const searchType = search.search_type || "sales";
        const typeBadgeHtml = searchType === "recruiter" ? `<span class="badge-recruiter" style="background: rgba(14, 165, 164, 0.1); color: var(--accent); padding: 0.1rem 0.35rem; font-size: 0.65rem; border-radius: 4px; font-weight: 600; line-height: 1; margin-left: 4px;">HR Mode</span>` : "";

        card.innerHTML = `
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
                <span class="badge-platform badge-platform-${platform}">${getPlatformIconSvg(platform, 10)}${capPlatform}</span>
                ${typeBadgeHtml}
            </div>
        `;

        const deleteBtn = card.querySelector(".btn-delete-search");
        if (deleteBtn) {
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                closeQueriesModal();
                confirmDeleteSearch(search.id);
            });
        }

        gridContainer.appendChild(card);
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
    const searchVal = archiveSearchInput ? archiveSearchInput.value.trim().toLowerCase() : "";
    const filterArchiveSearchType = document.getElementById("archive-filter-search-type");
    const searchTypeVal = filterArchiveSearchType ? filterArchiveSearchType.value.toLowerCase() : "all";

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

        const leadStatus = String(lead.leadStatus || "").toLowerCase().trim();
        let statusMatch = false;
        if (statusVal === "all") {
            statusMatch = true;
        } else if (statusVal === "qualified") {
            statusMatch = (leadStatus === "qualified" || leadStatus === "new lead" || leadStatus === "new");
        } else if (statusVal === "unqualified") {
            statusMatch = (leadStatus === "unqualified" || leadStatus === "not qualified" || leadStatus === "disqualified");
        } else if (statusVal === "warm lead") {
            statusMatch = (leadStatus === "warm lead" || leadStatus === "warm");
        } else if (statusVal === "potential lead") {
            statusMatch = (leadStatus === "potential lead" || leadStatus === "potential" || leadStatus === "cold lead" || leadStatus === "cold");
        } else if (statusVal === "not a lead") {
            statusMatch = (leadStatus === "not a lead" || leadStatus === "not lead");
        } else if (statusVal === "informational") {
            statusMatch = (leadStatus === "informational" || leadStatus === "information");
        } else {
            statusMatch = (leadStatus === statusVal || leadStatus.includes(statusVal));
        }

        const leadCrm = String(lead.crmStatus || "New").toLowerCase();
        const crmMatch = crmVal === "all" || leadCrm === crmVal;

        const leadPlatform = getLeadPlatform(lead);
        const platformMatch = platformVal === "all" || leadPlatform === platformVal;

        let searchMatch = true;
        if (searchVal) {
            const searchWords = searchVal.split(/\s+/).filter(w => w.length > 0);
            const author = String(lead.authorName || "").toLowerCase();
            const company = String(lead.companyName || "").toLowerCase();
            searchMatch = searchWords.every(word => {
                return author.includes(word) || company.includes(word);
            });
        }

        const leadSearchType = String(lead.search_type || "sales").toLowerCase();
        const searchTypeMatch = searchTypeVal === "all" || leadSearchType === searchTypeVal;

        return statusMatch && crmMatch && platformMatch && searchMatch && searchTypeMatch;
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

        const emailBadgeLabel = isEmailVerified ? 'Verified' : (lead.contactSource === 'guessed' ? 'Guessed' : 'Unverified');
        const emailBadgeClass = isEmailVerified ? 'badge-success' : (lead.contactSource === 'guessed' ? 'badge-warning' : 'badge-neutral');

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
        } else if (platform === "google_maps") {
            platformColor = "#FF9F43";
            platformIconName = "map-pin";
            displayPlatform = "Google Maps";
        }

        const avatarUrl = getLeadAvatarUrl(displayAuthor);
        const logoUrl = getCompanyLogoUrl(displayCompany);

        const isChecked = archiveSelectedUrls.includes(lead.sourceUrl);

        let contactHtml = "";
        if (isEmailValid) {
            contactHtml = `
                <div style="display: flex; flex-direction: column; gap: 0.2rem; align-items: flex-start;">
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                        <i data-lucide="${isEmailVerified ? 'check-circle-2' : 'help-circle'}" style="width: 12px; height: 12px; color: ${isEmailVerified ? 'var(--success)' : 'var(--warning)'}; flex-shrink: 0;"></i>
                        <span style="font-size: 0.78rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;" title="${emailVal}">${emailVal}</span>
                    </div>
                    <span class="badge ${emailBadgeClass}" style="font-size: 0.65rem; padding: 0.1rem 0.35rem; line-height: 1;">${emailBadgeLabel}</span>
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
        
        let candidateBadges = "";
        if (lead.search_type === "recruiter") {
            if (lead.experienceLevel && lead.experienceLevel !== "Unknown") {
                candidateBadges += `<span class="badge badge-success" style="font-size: 0.65rem; padding: 0.1rem 0.35rem; line-height: 1; border-radius: 4px; margin-right: 0.25rem;">${lead.experienceLevel}</span>`;
            }
            if (lead.workPreference && lead.workPreference !== "Unknown") {
                candidateBadges += `<span class="badge badge-primary" style="font-size: 0.65rem; padding: 0.1rem 0.35rem; line-height: 1; border-radius: 4px; margin-right: 0.25rem; background: rgba(14, 165, 164, 0.1); color: var(--accent);">${lead.workPreference}</span>`;
            }
            if (lead.skills) {
                const skillsList = lead.skills.split(",").slice(0, 3).map(s => s.trim());
                skillsList.forEach(sk => {
                    candidateBadges += `<span class="badge badge-neutral" style="font-size: 0.65rem; padding: 0.1rem 0.35rem; line-height: 1; border-radius: 4px; margin-right: 0.25rem;">${sk}</span>`;
                });
            }
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
                            ${leadPlatSvg}
                        </div>
                        <span class="contact-role">${displayRole}</span>
                        ${candidateBadges ? `<div style="display: flex; flex-wrap: wrap; gap: 0.2rem; margin-top: 0.25rem;">${candidateBadges}</div>` : ""}
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
        if (btnBack) {
            btnBack.disabled = (wizardCurrentStep === 1);
            btnBack.style.visibility = (wizardCurrentStep === 1) ? "hidden" : "visible";
        }

        if (wizardCurrentStep === 4) {
            if (btnContinue) btnContinue.style.display = "none";
        } else {
            if (btnContinue) {
                btnContinue.style.display = "inline-flex";
                btnContinue.innerHTML = `Continue <i data-lucide="arrow-right"></i>`;
            }
        }

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
    window.updateWizardUI = updateWizardUI;

    if (btnContinue) {
        btnContinue.addEventListener("click", async () => {
            if (wizardCurrentStep === 2) {
                const keyword = document.getElementById("keyword").value.trim();
                if (!keyword) {
                    await showCustomAlert("Please specify an audience search keyword query!", "Keyword Required", "danger");
                    return;
                }
            }
            if (wizardCurrentStep === 3) {
                // Populate review summary card dynamically
                const keywordEl = document.getElementById("keyword");
                const industryEl = document.getElementById("wizard-industry");
                const locationEl = document.getElementById("wizard-location");
                const platformEl = document.getElementById("platform");
                const timeframeEl = document.getElementById("timeframe");
                const limitEl = document.getElementById("limit");
                const sliderEl = document.getElementById("wizard-intent-score-min");

                const keyword = keywordEl ? keywordEl.value.trim() : "";
                const industry = industryEl ? industryEl.value.trim() : "";
                const location = locationEl ? locationEl.value.trim() : "";
                let audienceText = keyword;
                if (industry) audienceText += ` in ${industry}`;
                if (location) audienceText += ` (${location})`;
                
                const summaryAudience = document.getElementById("review-summary-audience");
                if (summaryAudience) summaryAudience.innerText = audienceText || "Any";

                const platformVal = platformEl ? platformEl.value : "linkedin";
                let platformText = platformVal.charAt(0).toUpperCase() + platformVal.slice(1);
                if (platformVal === "google_maps") {
                    platformText = "Google Maps";
                }
                const summarySource = document.getElementById("review-summary-source");
                if (summarySource) summarySource.innerText = platformText;

                const timeframe = timeframeEl ? timeframeEl.options[timeframeEl.selectedIndex].text : "Past 3 Months";
                const limit = limitEl ? limitEl.value : "10";
                const summaryFilters = document.getElementById("review-summary-filters");
                if (summaryFilters) summaryFilters.innerText = `${timeframe} (${limit} leads)`;

                const threshold = sliderEl ? sliderEl.value : "40";
                const summaryScore = document.getElementById("review-summary-score");
                if (summaryScore) summaryScore.innerText = `${threshold}% Min Match`;
            }
            if (wizardCurrentStep < 4) {
                wizardCurrentStep++;
                updateWizardUI();
            }
        });
    }

    // Prevent Enter key in wizard inputs from submitting the form and instead trigger next step
    const wizardInputs = ["keyword", "wizard-location", "wizard-industry"];
    wizardInputs.forEach(id => {
        const inputEl = document.getElementById(id);
        if (inputEl) {
            inputEl.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    if (wizardCurrentStep < 4) {
                        const btnContinue = document.getElementById("btn-wizard-continue");
                        if (btnContinue) {
                            btnContinue.click();
                        }
                    } else {
                        const btnSearchSubmit = document.getElementById("btn-search");
                        if (btnSearchSubmit) {
                            btnSearchSubmit.click();
                        }
                    }
                }
            });
        }
    });

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

function resetDiscoveryWizard() {
    wizardCurrentStep = 1;
    const searchForm = document.getElementById("search-form");
    if (searchForm) {
        searchForm.reset();
    }
    
    // Reset platform option cards to default
    const platformCards = document.querySelectorAll(".platform-option-card");
    const platformHiddenInput = document.getElementById("platform");
    platformCards.forEach(card => {
        const plat = card.getAttribute("data-platform");
        if (plat === "linkedin") {
            card.classList.add("active");
        } else {
            card.classList.remove("active");
        }
    });
    if (platformHiddenInput) {
        platformHiddenInput.value = "linkedin";
    }

    // Reset range slider text display
    const sliderVal = document.getElementById("wizard-intent-score-val");
    if (sliderVal) {
        sliderVal.innerText = "40% Match";
    }

    // Reset range slider element
    const sliderInput = document.getElementById("wizard-intent-score-min");
    if (sliderInput) {
        sliderInput.value = 40;
    }

    // Reset estimate text
    const estimateText = document.getElementById("wizard-estimate-count");
    if (estimateText) {
        estimateText.innerText = "10 - 25";
    }

    // Update the wizard stepper nodes & progress fill bar
    if (typeof window.updateWizardUI === "function") {
        window.updateWizardUI();
    }
}

function syncPillsToDropdowns() {
    const viewAllBtn = document.getElementById("archive-view-all");
    const viewHighBtn = document.getElementById("archive-view-high");
    const viewLiBtn = document.getElementById("archive-view-li");
    const viewFbBtn = document.getElementById("archive-view-fb");
    const viewRepliedBtn = document.getElementById("archive-view-replied");
    const viewsPills = [viewAllBtn, viewHighBtn, viewLiBtn, viewFbBtn, viewRepliedBtn];

    viewsPills.forEach(btn => { if (btn) btn.classList.remove("active"); });

    const platform = archiveFilterPlatform ? archiveFilterPlatform.value : "all";
    const crm = archiveFilterCrm ? archiveFilterCrm.value : "all";

    if (platform === "linkedin") {
        archiveViewFilter = "all";
        if (viewLiBtn) viewLiBtn.classList.add("active");
    } else if (platform === "facebook") {
        archiveViewFilter = "all";
        if (viewFbBtn) viewFbBtn.classList.add("active");
    } else if (crm.toLowerCase() === "replied") {
        archiveViewFilter = "all";
        if (viewRepliedBtn) viewRepliedBtn.classList.add("active");
    } else if (archiveViewFilter === "high") {
        if (viewHighBtn) viewHighBtn.classList.add("active");
    } else {
        if (viewAllBtn) viewAllBtn.classList.add("active");
    }
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
        if (mode === "linkedin") {
            if (archiveFilterPlatform) archiveFilterPlatform.value = "linkedin";
            if (archiveFilterCrm) archiveFilterCrm.value = "all";
            archiveViewFilter = "all";
        } else if (mode === "facebook") {
            if (archiveFilterPlatform) archiveFilterPlatform.value = "facebook";
            if (archiveFilterCrm) archiveFilterCrm.value = "all";
            archiveViewFilter = "all";
        } else if (mode === "replied") {
            if (archiveFilterCrm) archiveFilterCrm.value = "Replied";
            if (archiveFilterPlatform) archiveFilterPlatform.value = "all";
            archiveViewFilter = "all";
        } else if (mode === "all") {
            if (archiveFilterPlatform) archiveFilterPlatform.value = "all";
            if (archiveFilterCrm) archiveFilterCrm.value = "all";
            if (archiveFilterStatus) archiveFilterStatus.value = "all";
            if (archiveSearchInput) archiveSearchInput.value = "";
        } else if (mode === "high") {
            if (archiveFilterPlatform) archiveFilterPlatform.value = "all";
            if (archiveFilterCrm) archiveFilterCrm.value = "all";
            if (archiveFilterStatus) archiveFilterStatus.value = "all";
        }

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

    // Register event listeners for interactive preview test variables
    const testVarAuthor = document.getElementById("test-var-author");
    const testVarCompany = document.getElementById("test-var-company");
    const testVarService = document.getElementById("test-var-service");

    if (testVarAuthor) testVarAuthor.addEventListener("input", updateConfigPreview);
    if (testVarCompany) testVarCompany.addEventListener("input", updateConfigPreview);
    if (testVarService) testVarService.addEventListener("input", updateConfigPreview);
}

function updateConfigPreview() {
    const emailMockup = document.getElementById("email-composer-mockup");
    const linkedinMockup = document.getElementById("linkedin-chat-mockup");

    const previewBodyEmail = document.getElementById("live-pitch-preview-body");
    const previewBodyLinkedin = document.getElementById("live-pitch-preview-body-linkedin");

    const targetEmail = document.getElementById("preview-target-email");
    const targetSubject = document.getElementById("preview-target-subject");

    const linkedinName = document.getElementById("linkedin-preview-name");
    const linkedinAvatar = document.getElementById("linkedin-preview-avatar");

    const agencyName = agencyNameInput ? agencyNameInput.value.trim() : "My Business";
    const agencyInfo = agencyInfoInput ? agencyInfoInput.value.trim() : "premier design & development services";
    const emailTone = emailToneSelect ? emailToneSelect.value : "Short & Conversational";

    const testAuthorVal = document.getElementById("test-var-author")?.value.trim() || "Sarah Jenkins";
    const testCompanyVal = document.getElementById("test-var-company")?.value.trim() || "Acme Corp";
    const testServiceVal = document.getElementById("test-var-service")?.value.trim() || "React Development";

    if (configPreviewTab === "email") {
        if (emailMockup) emailMockup.style.display = "flex";
        if (linkedinMockup) linkedinMockup.style.display = "none";

        if (targetEmail) targetEmail.innerText = "contact@buyercompany.com";

        let subjectText = `Outreach Pitch - ${agencyName}`;
        let bodyHtml = "";

        if (emailTone === "Professional & Formal") {
            subjectText = `Inquiry: Support with ${testServiceVal} for ${testCompanyVal} - ${agencyName}`;
            bodyHtml = `Dear <mark>${testAuthorVal}</mark>,<br><br>
I hope this message finds you well.<br><br>
I am writing on behalf of <strong>${agencyName}</strong> regarding your recent request for assistance with <mark>${testServiceVal}</mark> at <mark>${testCompanyVal}</mark>.<br><br>
Our organization specializes in delivering premium solutions in the area of ${agencyInfo}. We have a proven track record of helping companies optimize their operations and implement high-performing technologies.<br><br>
I would welcome the opportunity to schedule a formal introduction call next week to discuss how we can support your team in achieving its goals. Please let me know your availability.<br><br>
Sincerely,<br>
The ${agencyName} Team`;
        } else if (emailTone === "Value Pitch (Free Audit)") {
            subjectText = `Free audit: ${testServiceVal} optimization for ${testCompanyVal}`;
            bodyHtml = `Hi <mark>${testAuthorVal}</mark>,<br><br>
I noticed <mark>${testCompanyVal}</mark> is sourcing support for <mark>${testServiceVal}</mark>. We specialize in ${agencyInfo} at <strong>${agencyName}</strong>.<br><br>
To show you the value we can bring, we would love to conduct a complimentary audit of your current system or setup. No strings attached—we will simply identify 3 key performance or design bottlenecks and send over our recommendations.<br><br>
Would you be open to a quick 10-minute session to kick off this audit?<br><br>
Best regards,<br>
The ${agencyName} Team`;
        } else if (emailTone === "Aggressive Pitch (Meeting link)") {
            subjectText = `10x your ${testServiceVal} delivery - ${agencyName} + ${testCompanyVal}`;
            bodyHtml = `Hi <mark>${testAuthorVal}</mark>,<br><br>
If you're looking for help with <mark>${testServiceVal}</mark>, let's get straight to the point. Most agencies promise results but fail to deliver. At <strong>${agencyName}</strong>, we are experts in ${agencyInfo}.<br><br>
We guarantee to streamline your <mark>${testServiceVal}</mark> pipeline and deliver robust, production-ready code in half the time of standard timelines.<br><br>
Let's skip the endless back-and-forth. Pick a time directly on my calendar here to discuss: <strong>calendly.com/${agencyName.toLowerCase().replace(/[^a-z0-9]/g, '')}/demo</strong><br><br>
Thanks,<br>
The ${agencyName} Team`;
        } else {
            // Default: Short & Conversational
            subjectText = `Outreach Pitch - ${agencyName}`;
            bodyHtml = `Hi <mark>${testAuthorVal}</mark>,<br><br>
I saw your recent post mentioning that <mark>${testCompanyVal}</mark> is looking for support with <mark>${testServiceVal}</mark>.<br><br>
We run <strong>${agencyName}</strong>, specializing in ${agencyInfo}. Given your requirements, I think our background aligns perfectly.<br><br>
Are you open to a brief chat or a free code review this week?<br><br>
Best,<br>
The ${agencyName} Team`;
        }

        if (targetSubject) targetSubject.innerText = subjectText;
        if (previewBodyEmail) previewBodyEmail.innerHTML = bodyHtml;

    } else {
        if (emailMockup) emailMockup.style.display = "none";
        if (linkedinMockup) linkedinMockup.style.display = "flex";

        if (linkedinName) linkedinName.innerText = testAuthorVal;
        if (linkedinAvatar) {
            const initials = testAuthorVal.split(" ").map(w => w.charAt(0)).join("").substring(0, 2).toUpperCase();
            linkedinAvatar.innerText = initials || "U";
        }

        let linkedinHtml = "";

        if (emailTone === "Professional & Formal") {
            linkedinHtml = `Hello <mark>${testAuthorVal}</mark>. I trust you are having a productive week. I observed your inquiry regarding support for <mark>${testServiceVal}</mark> at <mark>${testCompanyVal}</mark>. <strong>${agencyName}</strong> offers extensive expertise in ${agencyInfo}, and we would be pleased to evaluate your project needs. Let me know if we can arrange a brief introductory call.`;
        } else if (emailTone === "Value Pitch (Free Audit)") {
            linkedinHtml = `Hi <mark>${testAuthorVal}</mark>! Saw you're looking for support with <mark>${testServiceVal}</mark>. We run <strong>${agencyName}</strong> (specialists in ${agencyInfo}). To show you how we work, we'd love to run a free audit on your current setup and share 3 actionable optimization tips. Open to this?`;
        } else if (emailTone === "Aggressive Pitch (Meeting link)") {
            linkedinHtml = `Hey <mark>${testAuthorVal}</mark> - saw your post about <mark>${testServiceVal}</mark> for <mark>${testCompanyVal}</mark>. We build high-velocity ${agencyInfo} at <strong>${agencyName}</strong>. Let's hop on a quick 5-min call to see if we can help you hit your milestones ahead of schedule: calendly.com/${agencyName.toLowerCase().replace(/[^a-z0-9]/g, '')}/demo`;
        } else {
            // Default: Short & Conversational
            linkedinHtml = `Hey <mark>${testAuthorVal}</mark>! Saw your post about <mark>${testCompanyVal}</mark> looking for help with <mark>${testServiceVal}</mark>. At <strong>${agencyName}</strong>, we build ${agencyInfo}. I think our design/dev capabilities match your request exactly. Do you have 5 minutes to discuss this?`;
        }

        if (previewBodyLinkedin) previewBodyLinkedin.innerHTML = linkedinHtml;
    }

    if (window.lucide) window.lucide.createIcons();
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
    } catch (e) {
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
                } catch (e) { }
            }

            const isExact = search.matchType === "exact";
            const exactBadgeHtml = isExact ? ` <span class="badge badge-neutral" style="font-size: 0.65rem; padding: 2px 4px; line-height: 1; vertical-align: middle; margin-left: 4px; background: rgba(3,113,114,0.15); color: var(--secondary);">Exact</span>` : ` <span class="badge badge-neutral" style="font-size: 0.65rem; padding: 2px 4px; line-height: 1; vertical-align: middle; margin-left: 4px;">Partial</span>`;

            let metaHtml = "";
            if (search.location || search.industry) {
                metaHtml += `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px; display: flex; gap: 6px; align-items: center;">`;
                if (search.industry) {
                    metaHtml += `<span style="display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="building" style="width: 10px; height: 10px;"></i> ${search.industry}</span>`;
                }
                if (search.location) {
                    metaHtml += `<span style="display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="map-pin" style="width: 10px; height: 10px;"></i> ${search.location}</span>`;
                }
                metaHtml += `</div>`;
            }

            row.innerHTML = `
                <td>
                    <strong style="color: var(--text-primary);">${keyword}</strong>${exactBadgeHtml}
                    ${metaHtml}
                </td>
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
    const locationEl = document.getElementById("wizard-location");
    const industryEl = document.getElementById("wizard-industry");
    const location = locationEl ? locationEl.value.trim() : "";
    const industry = industryEl ? industryEl.value.trim() : "";
    const searchTypeEl = document.getElementById("search-type");
    const search_type = searchTypeEl ? searchTypeEl.value : "sales";

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
            body: JSON.stringify({ keyword, platform, timeframe, match_type, location, industry, search_type })
        });

        if (response.ok) {
            await showCustomAlert("Search configuration successfully saved to active monitoring database!", "Search Saved", "primary");
            keywordInput.value = "";
            loadSavedSearches();
            wizardCurrentStep = 1;
            if (typeof window.updateWizardUI === "function") {
                window.updateWizardUI();
            }
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
                } catch (e) { }
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
    } catch (err) {
        console.error("Failed to load performance analytics:", err);
    }
}

// Authentication Control & Session Functions (Option A)
async function checkAuthentication() {
    const apiKey = localStorage.getItem("APP_SECRET_KEY");
    if (!apiKey) {
        showLoginOverlay();
        return;
    }

    try {
        const response = await fetch("/api/auth/verify");
        if (response.status === 200) {
            hideLoginOverlay();
            loadExistingLeads();
            switchTab("dashboard");
            if (!notificationsInterval) {
                notificationsInterval = setInterval(() => loadNotifications(false), 20000);
            }
        } else {
            localStorage.removeItem("APP_SECRET_KEY");
            showLoginOverlay();
        }
    } catch (e) {
        console.error("Auth check connection error:", e);
        // Do not force logout on transient network failure, but keep overlay safe
        showLoginOverlay();
    }
}

function showLoginOverlay() {
    const overlay = document.getElementById("login-overlay");
    if (overlay) {
        overlay.style.display = "flex";
        overlay.style.opacity = "1";
    }

    const loginCard = document.getElementById("login-card");
    const registerCard = document.getElementById("register-card");
    const registerOtpCard = document.getElementById("register-otp-card");
    const forgotRequestCard = document.getElementById("forgot-request-card");
    const forgotVerifyCard = document.getElementById("forgot-verify-card");

    if (loginCard) loginCard.style.display = "flex";
    if (registerCard) registerCard.style.display = "none";
    if (registerOtpCard) registerOtpCard.style.display = "none";
    if (forgotRequestCard) forgotRequestCard.style.display = "none";
    if (forgotVerifyCard) forgotVerifyCard.style.display = "none";

    const emailInput = document.getElementById("login-email");
    if (emailInput) {
        emailInput.value = "";
        emailInput.focus();
    }
    const pwdInput = document.getElementById("login-password");
    if (pwdInput) {
        pwdInput.value = "";
    }

    const errorMsg = document.getElementById("login-error-msg");
    if (errorMsg) {
        errorMsg.style.display = "none";
    }
    const regErrorMsg = document.getElementById("register-error-msg");
    if (regErrorMsg) {
        regErrorMsg.style.display = "none";
    }
    const regOtpErrorMsg = document.getElementById("register-otp-error-msg");
    if (regOtpErrorMsg) {
        regOtpErrorMsg.style.display = "none";
    }
    const forgotReqErrorMsg = document.getElementById("forgot-request-error-msg");
    if (forgotReqErrorMsg) {
        forgotReqErrorMsg.style.display = "none";
    }
    const forgotVerifyErrorMsg = document.getElementById("forgot-verify-error-msg");
    if (forgotVerifyErrorMsg) {
        forgotVerifyErrorMsg.style.display = "none";
    }
    const forgotVerifySuccessMsg = document.getElementById("forgot-verify-success-msg");
    if (forgotVerifySuccessMsg) {
        forgotVerifySuccessMsg.style.display = "none";
    }
}

function hideLoginOverlay() {
    const overlay = document.getElementById("login-overlay");
    if (overlay) {
        overlay.style.opacity = "0";
        setTimeout(() => {
            overlay.style.display = "none";
        }, 300);
    }
}

async function submitLogin(e) {
    if (e) e.preventDefault();

    const emailInput = document.getElementById("login-email");
    const pwdInput = document.getElementById("login-password");
    const errorMsg = document.getElementById("login-error-msg");
    const submitBtn = document.getElementById("login-submit-btn");

    if (!emailInput || !pwdInput) return;
    const email = emailInput.value.trim();
    const password = pwdInput.value.trim();
    if (!email || !password) return;

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Signing In...</span><i data-lucide="loader" class="animate-spin"></i>`;
        if (window.lucide) window.lucide.createIcons();
    }
    if (errorMsg) errorMsg.style.display = "none";

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        if (response.status === 200) {
            const data = await response.json();
            if (data.session_token) {
                localStorage.setItem("APP_SECRET_KEY", data.session_token);
                hideLoginOverlay();

                // Reload dashboard metrics and leads
                loadExistingLeads();
                renderArchiveHistory();
                renderArchiveLeads();
                if (typeof renderMetricsWidgets === "function") {
                    renderMetricsWidgets();
                }
                switchTab("dashboard");
            } else {
                throw new Error("Invalid session token payload");
            }
        } else {
            if (errorMsg) {
                errorMsg.style.display = "flex";
            }
            pwdInput.value = "";
            pwdInput.focus();
        }
    } catch (err) {
        console.error("Login authentication error:", err);
        if (errorMsg) {
            errorMsg.style.display = "flex";
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Sign In</span><i data-lucide="arrow-right"></i>`;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

async function submitRegister(e) {
    if (e) e.preventDefault();

    const emailInput = document.getElementById("register-email");
    const pwdInput = document.getElementById("register-password");
    const errorMsg = document.getElementById("register-error-msg");
    const errorText = document.getElementById("register-error-text");
    const submitBtn = document.getElementById("register-submit-btn");

    if (!emailInput || !pwdInput) return;
    const email = emailInput.value.trim();
    const password = pwdInput.value.trim();
    if (!email || !password) return;

    if (password.length < 6) {
        if (errorMsg && errorText) {
            errorText.innerText = "Password must be at least 6 characters long";
            errorMsg.style.display = "flex";
        }
        pwdInput.focus();
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Sending OTP Code...</span><i data-lucide="loader" class="animate-spin"></i>`;
        if (window.lucide) window.lucide.createIcons();
    }
    if (errorMsg) errorMsg.style.display = "none";

    try {
        const response = await fetch("/api/auth/register-request", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        if (response.status === 200) {
            pendingVerificationEmail = email;

            // Transition to registration OTP card
            const registerCard = document.getElementById("register-card");
            const registerOtpCard = document.getElementById("register-otp-card");
            if (registerCard && registerOtpCard) {
                registerCard.style.display = "none";
                registerOtpCard.style.display = "flex";

                const otpInput = document.getElementById("register-otp-code");
                if (otpInput) {
                    otpInput.value = "";
                    otpInput.focus();
                }
            }
            // Clear passwords
            pwdInput.value = "";
        } else {
            const errData = await response.json();
            if (errorMsg && errorText) {
                errorText.innerText = errData.detail || "Registration failed. Try a different email.";
                errorMsg.style.display = "flex";
            }
            pwdInput.value = "";
            pwdInput.focus();
        }
    } catch (err) {
        console.error("Registration request error:", err);
        if (errorMsg && errorText) {
            errorText.innerText = "Registration failed. Try again later.";
            errorMsg.style.display = "flex";
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Create Account</span><i data-lucide="arrow-right"></i>`;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

async function submitRegisterOtp(e) {
    if (e) e.preventDefault();

    const otpInput = document.getElementById("register-otp-code");
    const errorMsg = document.getElementById("register-otp-error-msg");
    const errorText = document.getElementById("register-otp-error-text");
    const submitBtn = document.getElementById("register-otp-submit-btn");

    if (!otpInput) return;
    const otp = otpInput.value.trim();
    if (!otp || !pendingVerificationEmail) return;

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Verifying Code...</span><i data-lucide="loader" class="animate-spin"></i>`;
        if (window.lucide) window.lucide.createIcons();
    }
    if (errorMsg) errorMsg.style.display = "none";

    try {
        const response = await fetch("/api/auth/register-verify", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email: pendingVerificationEmail, otp })
        });

        if (response.status === 200) {
            const data = await response.json();
            if (data.session_token) {
                localStorage.setItem("APP_SECRET_KEY", data.session_token);
                hideLoginOverlay();

                // Reload dashboard metrics and leads
                loadExistingLeads();
                renderArchiveHistory();
                renderArchiveLeads();
                if (typeof renderMetricsWidgets === "function") {
                    renderMetricsWidgets();
                }
                switchTab("dashboard");
            } else {
                throw new Error("Invalid session token response");
            }
        } else {
            const errData = await response.json();
            if (errorMsg && errorText) {
                errorText.innerText = errData.detail || "Invalid or expired OTP code";
                errorMsg.style.display = "flex";
            }
            otpInput.value = "";
            otpInput.focus();
        }
    } catch (err) {
        console.error("Registration verify error:", err);
        if (errorMsg && errorText) {
            errorText.innerText = "Verification failed. Try again later.";
            errorMsg.style.display = "flex";
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Verify Code</span><i data-lucide="check"></i>`;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

async function submitForgotRequest(e) {
    if (e) e.preventDefault();

    const emailInput = document.getElementById("forgot-request-email");
    const errorMsg = document.getElementById("forgot-request-error-msg");
    const errorText = document.getElementById("forgot-request-error-text");
    const submitBtn = document.getElementById("forgot-request-submit-btn");

    if (!emailInput) return;
    const email = emailInput.value.trim();
    if (!email) return;

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Sending OTP...</span><i data-lucide="loader" class="animate-spin"></i>`;
        if (window.lucide) window.lucide.createIcons();
    }
    if (errorMsg) errorMsg.style.display = "none";

    try {
        const response = await fetch("/api/auth/forgot-request", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email })
        });

        if (response.status === 200) {
            pendingVerificationEmail = email;

            // Transition to forgot verification card
            const forgotRequestCard = document.getElementById("forgot-request-card");
            const forgotVerifyCard = document.getElementById("forgot-verify-card");
            if (forgotRequestCard && forgotVerifyCard) {
                forgotRequestCard.style.display = "none";
                forgotVerifyCard.style.display = "flex";

                const otpInput = document.getElementById("forgot-verify-otp-code");
                const newPwdInput = document.getElementById("forgot-verify-new-password");
                if (otpInput) {
                    otpInput.value = "";
                    otpInput.focus();
                }
                if (newPwdInput) newPwdInput.value = "";
            }
        } else {
            const errData = await response.json();
            if (errorMsg && errorText) {
                errorText.innerText = errData.detail || "User with this email does not exist";
                errorMsg.style.display = "flex";
            }
        }
    } catch (err) {
        console.error("Forgot request error:", err);
        if (errorMsg && errorText) {
            errorText.innerText = "Request failed. Try again later.";
            errorMsg.style.display = "flex";
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Send Recovery Code</span><i data-lucide="arrow-right"></i>`;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

async function submitForgotVerify(e) {
    if (e) e.preventDefault();

    const otpInput = document.getElementById("forgot-verify-otp-code");
    const pwdInput = document.getElementById("forgot-verify-new-password");
    const errorMsg = document.getElementById("forgot-verify-error-msg");
    const errorText = document.getElementById("forgot-verify-error-text");
    const successMsg = document.getElementById("forgot-verify-success-msg");
    const submitBtn = document.getElementById("forgot-verify-submit-btn");

    if (!otpInput || !pwdInput) return;
    const otp = otpInput.value.trim();
    const new_password = pwdInput.value.trim();
    if (!otp || !new_password || !pendingVerificationEmail) return;

    if (new_password.length < 6) {
        if (errorMsg && errorText) {
            errorText.innerText = "New password must be at least 6 characters long";
            errorMsg.style.display = "flex";
        }
        pwdInput.focus();
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Resetting Password...</span><i data-lucide="loader" class="animate-spin"></i>`;
        if (window.lucide) window.lucide.createIcons();
    }
    if (errorMsg) errorMsg.style.display = "none";
    if (successMsg) successMsg.style.display = "none";

    try {
        const response = await fetch("/api/auth/forgot-verify", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email: pendingVerificationEmail, otp, new_password })
        });

        if (response.status === 200) {
            const data = await response.json();
            if (successMsg) {
                const successText = successMsg.querySelector("span");
                if (successText) successText.innerText = "Password successfully updated! Redirecting to login...";
                successMsg.style.display = "flex";
            }

            // Wait 2 seconds to let the user see the success message, then redirect to login screen
            setTimeout(() => {
                const loginCard = document.getElementById("login-card");
                const forgotVerifyCard = document.getElementById("forgot-verify-card");
                if (loginCard && forgotVerifyCard) {
                    forgotVerifyCard.style.display = "none";
                    loginCard.style.display = "flex";
                    const loginEmailInput = document.getElementById("login-email");
                    if (loginEmailInput) {
                        loginEmailInput.value = pendingVerificationEmail || "";
                        const loginPasswordInput = document.getElementById("login-password");
                        if (loginPasswordInput) {
                            loginPasswordInput.value = "";
                            loginPasswordInput.focus();
                        }
                    }
                }
                if (successMsg) successMsg.style.display = "none";
            }, 2000);
        } else {
            const errData = await response.json();
            if (errorMsg && errorText) {
                errorText.innerText = errData.detail || "Invalid recovery code or email";
                errorMsg.style.display = "flex";
            }
        }
    } catch (err) {
        console.error("Forgot verify error:", err);
        if (errorMsg && errorText) {
            errorText.innerText = "Reset failed. Try again later.";
            errorMsg.style.display = "flex";
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Reset Password</span><i data-lucide="check"></i>`;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

async function submitProfilePasswordReset(e) {
    if (e) e.preventDefault();

    const currentInput = document.getElementById("profile-current-password");
    const newInput = document.getElementById("profile-new-password");
    const confirmInput = document.getElementById("profile-confirm-password");
    const submitBtn = document.getElementById("btn-profile-change-password");

    if (!currentInput || !newInput || !confirmInput) return;
    const current_password = currentInput.value;
    const new_password = newInput.value;
    const confirm_password = confirmInput.value;

    if (!current_password || !new_password || !confirm_password) {
        showCustomAlert("Please fill in all password fields.", "Incomplete Fields", "warning");
        return;
    }

    if (new_password.length < 6) {
        showCustomAlert("New password must be at least 6 characters long.", "Invalid Password", "warning");
        newInput.focus();
        return;
    }

    if (new_password !== confirm_password) {
        showCustomAlert("New password and confirm password do not match.", "Mismatch", "warning");
        confirmInput.focus();
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i data-lucide="loader" class="animate-spin" style="width: 16px; height: 16px;"></i> Updating...`;
        if (window.lucide) window.lucide.createIcons();
    }

    try {
        const response = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ current_password, new_password })
        });

        if (response.status === 200) {
            const data = await response.json();
            if (data.session_token) {
                // Update local secret token since previous session token got deleted/rotated
                localStorage.setItem("APP_SECRET_KEY", data.session_token);
            }
            showCustomAlert("Your password has been successfully updated!", "Success", "success");
            currentInput.value = "";
            newInput.value = "";
            confirmInput.value = "";
        } else {
            const errData = await response.json();
            showCustomAlert(errData.detail || "Failed to reset password.", "Error Resetting", "danger");
        }
    } catch (err) {
        console.error("Profile password reset error:", err);
        showCustomAlert("An error occurred during password update. Please try again.", "Error", "danger");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i data-lucide="key-round" style="width: 16px; height: 16px;"></i> Change Password`;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

async function logout() {
    const apiKey = localStorage.getItem("APP_SECRET_KEY");
    if (apiKey) {
        try {
            await fetch("/api/auth/logout", {
                method: "POST"
            });
        } catch (e) {
            console.error("Logout request failed:", e);
        }
    }
    if (notificationsInterval) {
        clearInterval(notificationsInterval);
        notificationsInterval = null;
    }
    localStorage.removeItem("APP_SECRET_KEY");
    showLoginOverlay();
}

async function loadImapConfig() {
    const imapServerInput = document.getElementById("settings-imap-server");
    const imapPortInput = document.getElementById("settings-imap-port");
    const imapEmailInput = document.getElementById("settings-imap-email");
    const imapPasswordInput = document.getElementById("settings-imap-password");

    if (!imapServerInput) return;

    try {
        const secretKey = localStorage.getItem("APP_SECRET_KEY") || "";
        const response = await fetch("/api/outreach/config", {
            headers: { "X-API-Key": secretKey }
        });
        if (response.ok) {
            const data = await response.json();
            const config = data.config || {};
            imapServerInput.value = config.imap_server || "";
            imapPortInput.value = config.imap_port || "993";
            imapEmailInput.value = config.imap_email || "";
            imapPasswordInput.value = config.imap_password || "";
        }
    } catch (err) {
        console.error("Failed to load IMAP settings:", err);
    }
}

async function saveImapConfig() {
    const imapServerInput = document.getElementById("settings-imap-server");
    const imapPortInput = document.getElementById("settings-imap-port");
    const imapEmailInput = document.getElementById("settings-imap-email");
    const imapPasswordInput = document.getElementById("settings-imap-password");

    if (!imapServerInput) return;

    const payload = {
        imap_server: imapServerInput.value.trim(),
        imap_port: imapPortInput.value.trim(),
        imap_email: imapEmailInput.value.trim(),
        imap_password: imapPasswordInput.value
    };

    if (!payload.imap_server || !payload.imap_port || !payload.imap_email || !payload.imap_password) {
        await showCustomAlert("Please fill in all IMAP settings fields.", "Incomplete Fields", "warning");
        return;
    }

    const btnSave = document.getElementById("btn-save-imap-config");
    if (btnSave) btnSave.disabled = true;

    try {
        const secretKey = localStorage.getItem("APP_SECRET_KEY") || "";
        const response = await fetch("/api/outreach/config", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": secretKey
            },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            await showCustomAlert("IMAP inbox configurations saved successfully!", "Settings Saved", "success");
        } else {
            const errData = await response.json();
            await showCustomAlert(errData.detail || "Failed to save IMAP configuration.", "Error Saving", "danger");
        }
    } catch (err) {
        await showCustomAlert("Network error saving email configuration: " + err.message, "Connection Error", "danger");
    } finally {
        if (btnSave) btnSave.disabled = false;
    }
}

async function syncReplies() {
    const btnSync = document.getElementById("btn-sync-replies-trigger");
    if (btnSync) {
        btnSync.disabled = true;
        btnSync.innerHTML = `<span class="spinner spinner-tiny"></span> Syncing...`;
    }

    try {
        const secretKey = localStorage.getItem("APP_SECRET_KEY") || "";
        const response = await fetch("/api/outreach/sync-replies", {
            method: "POST",
            headers: { "X-API-Key": secretKey }
        });

        if (response.ok) {
            const data = await response.json();
            const count = data.newRepliesCount || 0;

            // Always reload the leads database to pull cleaned/updated messages
            await loadExistingLeads(false);

            // If the lead drawer is currently open, refresh its content with updated data
            if (activeLead) {
                const freshLead = leadsData.find(l => l.sourceUrl === activeLead.sourceUrl);
                if (freshLead) {
                    openDetailModal(freshLead);
                }
            }

            if (count > 0) {
                await showCustomAlert(`Success! Sync detected ${count} new email replies. Leads updated in pipeline!`, "Sync Completed", "success");
            } else {
                await showCustomAlert("Sync completed. No new email replies from qualified leads found.", "Sync Completed", "info");
            }
        } else {
            const errData = await response.json();
            await showCustomAlert(errData.detail || "Sync failed. Check settings credentials.", "Sync Failed", "danger");
        }
    } catch (err) {
        await showCustomAlert("Network error running reply check: " + err.message, "Connection Error", "danger");
    } finally {
        if (btnSync) {
            btnSync.disabled = false;
            btnSync.innerHTML = `<i data-lucide="refresh-cw"></i> Sync Replies`;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

async function loadPlacesConfig() {
    const placesKeyInput = document.getElementById("settings-places-key");
    const placesPill = document.getElementById("profile-health-places");

    if (!placesKeyInput) return;

    try {
        const secretKey = localStorage.getItem("APP_SECRET_KEY") || "";
        const response = await fetch("/api/outreach/places", {
            headers: { "X-API-Key": secretKey }
        });
        if (response.ok) {
            const data = await response.json();
            placesKeyInput.value = data.places_api_key || "";
            
            if (placesPill) {
                if (data.is_configured) {
                    placesPill.className = "status-pulse-pill status-active";
                    placesPill.querySelector(".status-text").innerText = "Active";
                } else {
                    placesPill.className = "status-pulse-pill status-inactive";
                    placesPill.querySelector(".status-text").innerText = "Fallback: Playwright";
                }
            }
        }
    } catch (err) {
        console.error("Failed to load Google Places settings:", err);
    }
}

async function savePlacesConfig() {
    const placesKeyInput = document.getElementById("settings-places-key");
    if (!placesKeyInput) return;

    const placesKey = placesKeyInput.value.trim();

    const btnSave = document.getElementById("btn-save-places-key");
    if (btnSave) btnSave.disabled = true;

    try {
        const secretKey = localStorage.getItem("APP_SECRET_KEY") || "";
        const response = await fetch("/api/outreach/places", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": secretKey
            },
            body: JSON.stringify({ places_api_key: placesKey })
        });
        if (response.ok) {
            await showCustomAlert("Google Places configuration saved successfully!", "Settings Saved", "success");
            await loadPlacesConfig();
        } else {
            const errData = await response.json();
            await showCustomAlert(errData.detail || "Failed to save Google Places configuration.", "Error Saving", "danger");
        }
    } catch (err) {
        await showCustomAlert("Network error saving Google Places configuration: " + err.message, "Connection Error", "danger");
    } finally {
        if (btnSave) btnSave.disabled = false;
    }
}

async function loadTwitterConfig() {
    const twitterKeyInput = document.getElementById("settings-twitter-key");
    const twitterPill = document.getElementById("profile-health-twitter");

    if (!twitterKeyInput) return;

    try {
        const secretKey = localStorage.getItem("APP_SECRET_KEY") || "";
        const response = await fetch("/api/outreach/twitter", {
            headers: { "X-API-Key": secretKey }
        });
        if (response.ok) {
            const data = await response.json();
            twitterKeyInput.value = data.twitter_api_key || "";
            
            if (twitterPill) {
                if (data.is_configured) {
                    twitterPill.className = "status-pulse-pill status-active";
                    twitterPill.querySelector(".status-text").innerText = "Active";
                } else {
                    twitterPill.className = "status-pulse-pill status-inactive";
                    twitterPill.querySelector(".status-text").innerText = "Fallback: Serper";
                }
            }
        }
    } catch (err) {
        console.error("Failed to load Twitter settings:", err);
    }
}

async function saveTwitterConfig() {
    const twitterKeyInput = document.getElementById("settings-twitter-key");
    if (!twitterKeyInput) return;

    const twitterKey = twitterKeyInput.value.trim();

    const btnSave = document.getElementById("btn-save-twitter-key");
    if (btnSave) btnSave.disabled = true;

    try {
        const secretKey = localStorage.getItem("APP_SECRET_KEY") || "";
        const response = await fetch("/api/outreach/twitter", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": secretKey
            },
            body: JSON.stringify({ twitter_api_key: twitterKey })
        });
        if (response.ok) {
            await showCustomAlert("Twitter configuration saved successfully!", "Settings Saved", "success");
            await loadTwitterConfig();
        } else {
            const errData = await response.json();
            await showCustomAlert(errData.detail || "Failed to save Twitter configuration.", "Error Saving", "danger");
        }
    } catch (err) {
        await showCustomAlert("Network error saving Twitter configuration: " + err.message, "Connection Error", "danger");
    } finally {
        if (btnSave) btnSave.disabled = false;
    }
}

// User Profile View Functions
async function loadUserProfile() {
    const displayNameInput = document.getElementById("profile-display-name");
    const businessNameInput = document.getElementById("profile-business-name");
    const joinedDateInput = document.getElementById("profile-joined-date");
    const apiTokenInput = document.getElementById("profile-api-token");

    const displayNameHeading = document.getElementById("profile-display-name-heading");
    const emailSubheading = document.getElementById("profile-email-subheading");
    const avatarCircle = document.getElementById("profile-avatar-circle");

    try {
        const secretKey = localStorage.getItem("APP_SECRET_KEY") || "";
        const response = await fetch("/api/user/profile", {
            headers: { "X-API-Key": secretKey }
        });
        if (response.ok) {
            const data = await response.json();
            const profile = data.profile || {};
            const stats = data.stats || {};

            // Populate Details
            if (displayNameInput) displayNameInput.value = profile.displayName || "";
            if (businessNameInput) businessNameInput.value = profile.businessName || "";
            if (agencyInfoInput) agencyInfoInput.value = profile.agencyInfo || "";

            // Sync with Outreach Config variables & localStorage
            if (profile.businessName) {
                if (typeof agencyNameInput !== 'undefined' && agencyNameInput) {
                    agencyNameInput.value = profile.businessName;
                } else {
                    const inputEl = document.getElementById("agency-name");
                    if (inputEl) inputEl.value = profile.businessName;
                }
                localStorage.setItem("silvia_agency_name", profile.businessName);
                localStorage.setItem("agencyName", profile.businessName);
                if (typeof updateSidebarAgencyName === 'function') updateSidebarAgencyName();
            }
            if (profile.agencyInfo) {
                localStorage.setItem("silvia_agency_info", profile.agencyInfo);
            }
            if (typeof updateConfigPreview === 'function') updateConfigPreview();

            if (profile.joinedDate) {
                const date = new Date(profile.joinedDate);
                const dateStr = date.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
                if (joinedDateInput) joinedDateInput.value = dateStr;
                const joinedText = document.getElementById("profile-joined-date-text");
                if (joinedText) joinedText.innerText = dateStr;
            }

            // Mask or set token
            if (apiTokenInput) {
                apiTokenInput.value = profile.apiToken || "silvia_dev_key";
                apiTokenInput.dataset.token = profile.apiToken || "silvia_dev_key";
                apiTokenInput.type = "password"; // Default hidden
            }

            const webhookPill = document.getElementById("profile-health-webhook");
            if (webhookPill) {
                if (profile.webhookUrl) {
                    webhookPill.className = "status-pulse-pill status-active";
                    webhookPill.querySelector(".status-text").innerText = "Active";
                } else {
                    webhookPill.className = "status-pulse-pill status-inactive";
                    webhookPill.querySelector(".status-text").innerText = "Inactive";
                }
            }

            // Set headings
            if (displayNameHeading) displayNameHeading.innerText = profile.displayName || "User";
            if (emailSubheading) emailSubheading.innerText = profile.email || "user@example.com";
            const businessSubheading = document.getElementById("profile-business-subheading");
            if (businessSubheading) businessSubheading.innerText = profile.businessName || "Company";

            // Set Avatar Initials
            if (avatarCircle) {
                const name = profile.displayName || profile.email || "U";
                const initials = name.split(" ").map(w => w.charAt(0)).join("").substring(0, 2).toUpperCase();
                avatarCircle.innerText = initials;
            }

            // Populate Quota Stats
            const totalScans = stats.scansCount || 0;
            const totalLeads = stats.leadsCount || 0;
            const totalQualified = stats.qualifiedLeadsCount || 0;

            const scansPct = Math.min((totalScans / 100) * 100, 100);
            const leadsPct = Math.min((totalLeads / 1000) * 100, 100);
            const qualifiedPct = Math.min((totalQualified / 500) * 100, 100);

            const txtScans = document.getElementById("profile-usage-scans");
            const txtLeads = document.getElementById("profile-usage-leads");
            const txtQualified = document.getElementById("profile-usage-qualified");

            const barScans = document.getElementById("profile-progress-scans");
            const barLeads = document.getElementById("profile-progress-leads");
            const barQualified = document.getElementById("profile-progress-qualified");

            if (txtScans) txtScans.innerText = `${totalScans.toLocaleString()} / 100`;
            if (txtLeads) txtLeads.innerText = `${totalLeads.toLocaleString()} / 1,000`;
            if (txtQualified) txtQualified.innerText = `${totalQualified.toLocaleString()} / 500`;

            // Wrap in setTimeout to ensure layout reflow occurs before transition animations start
            setTimeout(() => {
                if (barScans) barScans.style.width = `${scansPct.toFixed(1)}%`;
                if (barLeads) barLeads.style.width = `${leadsPct.toFixed(1)}%`;
                if (barQualified) barQualified.style.width = `${qualifiedPct.toFixed(1)}%`;
            }, 50);

            // Dynamically check IMAP integration status
            try {
                const imapResponse = await fetch("/api/outreach/config", {
                    headers: { "X-API-Key": secretKey }
                });
                if (imapResponse.ok) {
                    const imapData = await imapResponse.json();
                    const config = imapData.config || {};
                    const imapPill = document.getElementById("profile-health-imap");
                    if (imapPill) {
                        if (config.imap_server && config.imap_email) {
                            imapPill.className = "status-pulse-pill status-active";
                            imapPill.querySelector(".status-text").innerText = "Active";
                        } else {
                            imapPill.className = "status-pulse-pill status-inactive";
                            imapPill.querySelector(".status-text").innerText = "Not Configured";
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to load IMAP settings for status check:", e);
            }
        }
    } catch (err) {
        console.error("Failed loading user profile:", err);
    }
}

async function saveUserProfile() {
    const displayNameInput = document.getElementById("profile-display-name");
    const businessNameInput = document.getElementById("profile-business-name");
    const btnSave = document.getElementById("btn-save-user-profile");

    if (!displayNameInput) return;

    const payload = {
        displayName: displayNameInput.value.trim(),
        businessName: businessNameInput ? businessNameInput.value.trim() : "",
        agencyInfo: agencyInfoInput ? agencyInfoInput.value.trim() : ""
    };

    if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = `<span class="spinner spinner-tiny"></span> Saving...`;
    }

    try {
        const secretKey = localStorage.getItem("APP_SECRET_KEY") || "";
        const response = await fetch("/api/user/profile/update", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": secretKey
            },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            if (payload.agencyInfo) {
                localStorage.setItem("silvia_agency_info", payload.agencyInfo);
            }
            await showCustomAlert("User profile settings updated successfully!", "Profile Saved", "success");
            loadUserProfile(); // Reload visual headers
        } else {
            const errData = await response.json();
            await showCustomAlert(errData.detail || "Failed to save profile settings.", "Error Saving", "danger");
        }
    } catch (err) {
        await showCustomAlert("Network error saving profile settings: " + err.message, "Connection Error", "danger");
    } finally {
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = `<i data-lucide="save"></i> Save Changes`;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

async function saveWebhookUrl() {
    const webhookUrlInput = document.getElementById("settings-webhook-url");
    const btnSave = document.getElementById("btn-save-webhook-url");

    if (!webhookUrlInput) return;

    const webhookUrl = webhookUrlInput.value.trim();

    if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = `<span class="spinner spinner-tiny"></span> Saving...`;
    }

    try {
        const secretKey = localStorage.getItem("APP_SECRET_KEY") || "";
        const response = await fetch("/api/outreach/webhook", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": secretKey
            },
            body: JSON.stringify({ webhook_url: webhookUrl })
        });
        if (response.ok) {
            await showCustomAlert("CRM / Zapier Webhook URL saved successfully!", "Settings Saved", "success");
            await loadUserProfile(); // Reload user profile to update status badge
        } else {
            const errData = await response.json();
            await showCustomAlert(errData.detail || "Failed to save Webhook URL.", "Error Saving", "danger");
        }
    } catch (err) {
        await showCustomAlert("Network error saving Webhook URL: " + err.message, "Connection Error", "danger");
    } finally {
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = `<i data-lucide="save" style="width: 12px; height: 12px;"></i> Save`;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

async function loadWebhookUrl() {
    const webhookUrlInput = document.getElementById("settings-webhook-url");
    if (!webhookUrlInput) return;

    try {
        const secretKey = localStorage.getItem("APP_SECRET_KEY") || "";
        const response = await fetch("/api/outreach/webhook", {
            headers: { "X-API-Key": secretKey }
        });
        if (response.ok) {
            const data = await response.json();
            webhookUrlInput.value = data.webhook_url || "";
        }
    } catch (err) {
        console.error("Failed to load Webhook URL settings:", err);
    }
}

function toggleProfileTokenVisibility() {
    const apiTokenInput = document.getElementById("profile-api-token");
    const toggleBtn = document.getElementById("btn-toggle-profile-token");

    if (!apiTokenInput) return;

    if (apiTokenInput.type === "password") {
        apiTokenInput.type = "text";
        if (toggleBtn) toggleBtn.innerHTML = `<i data-lucide="eye-off" style="width: 15px; height: 15px;"></i>`;
    } else {
        apiTokenInput.type = "password";
        if (toggleBtn) toggleBtn.innerHTML = `<i data-lucide="eye" style="width: 15px; height: 15px;"></i>`;
    }
    if (window.lucide) window.lucide.createIcons();
}

async function copyProfileTokenToClipboard() {
    const apiTokenInput = document.getElementById("profile-api-token");
    if (!apiTokenInput) return;

    const rawToken = apiTokenInput.dataset.token || apiTokenInput.value;

    try {
        await copyToClipboard(rawToken);
        await showCustomAlert("Developer API Secret Key copied to clipboard!", "Key Copied", "success");
    } catch (err) {
        await showCustomAlert("Failed to copy token: " + err.message, "Copy Failed", "danger");
    }
}

let cachedModelConfig = null;

function updateModelFieldsVisibility(providerType) {
    const ollamaGroup = document.getElementById("settings-model-ollama-host-group");
    if (ollamaGroup) {
        ollamaGroup.style.display = providerType === "ollama" ? "block" : "none";
    }
}

async function loadModelConfig() {
    const presetSelect = document.getElementById("settings-model-preset-select");
    const providerTypeSelect = document.getElementById("settings-model-type-select");
    const modelNameInput = document.getElementById("settings-model-name");
    const ollamaHostInput = document.getElementById("settings-model-ollama-host");
    const tempSlider = document.getElementById("settings-model-temperature");
    const tempValLabel = document.getElementById("settings-model-temperature-val");
    const statusTextModel = document.getElementById("status-text-model");

    if (!presetSelect) return;

    try {
        const secretKey = localStorage.getItem("APP_SECRET_KEY") || "";
        const response = await fetch("/api/model-config", {
            headers: { "X-API-Key": secretKey }
        });
        if (response.ok) {
            const data = await response.json();
            cachedModelConfig = data;

            // Populate the presets dropdown
            presetSelect.innerHTML = "";
            const presets = Object.keys(data.providers || {});
            presets.forEach(presetName => {
                const opt = document.createElement("option");
                opt.value = presetName;
                opt.textContent = presetName;
                presetSelect.appendChild(opt);
            });

            // Set current active preset
            const activePreset = data.active_provider || "groq";
            presetSelect.value = activePreset;

            // Load preset settings into the form fields
            const loadPresetIntoForm = (presetName) => {
                const pConf = (data.providers || {})[presetName] || {};
                providerTypeSelect.value = pConf.provider_type || "groq";
                modelNameInput.value = pConf.model || "";
                ollamaHostInput.value = pConf.base_url || "http://localhost:11434";
                
                const temp = pConf.temperature !== undefined ? pConf.temperature : 0.7;
                tempSlider.value = temp;
                tempValLabel.innerText = temp;

                updateModelFieldsVisibility(pConf.provider_type || "groq");
            };

            loadPresetIntoForm(activePreset);

            // Bind events for preset selection change
            presetSelect.onchange = (e) => {
                loadPresetIntoForm(e.target.value);
            };

            // Bind change events to sync input edits into cachedModelConfig in memory
            const syncInputsToCache = () => {
                const selectedPreset = presetSelect.value;
                if (!cachedModelConfig.providers[selectedPreset]) {
                    cachedModelConfig.providers[selectedPreset] = {};
                }
                const pConf = cachedModelConfig.providers[selectedPreset];
                pConf.provider_type = providerTypeSelect.value;
                pConf.model = modelNameInput.value.trim();
                pConf.base_url = ollamaHostInput.value.trim();
                pConf.temperature = parseFloat(tempSlider.value);
            };

            providerTypeSelect.onchange = (e) => {
                updateModelFieldsVisibility(e.target.value);
                syncInputsToCache();
            };
            modelNameInput.oninput = syncInputsToCache;
            ollamaHostInput.oninput = syncInputsToCache;
            tempSlider.oninput = (e) => {
                tempValLabel.innerText = e.target.value;
                syncInputsToCache();
            };

            // Update status text on the card header
            if (statusTextModel) {
                const activePresetConf = (data.providers || {})[activePreset] || {};
                const activeType = activePresetConf.provider_type || "groq";
                const providerMap = {
                    "groq": "Groq",
                    "openai": "OpenAI",
                    "ollama": "Ollama",
                    "anthropic": "Anthropic"
                };
                const providerName = providerMap[activeType] || activeType;
                let displayModel = activePresetConf.model || "";
                if (!displayModel) {
                    if (activeType === "groq") displayModel = "llama-3.3-70b-versatile";
                    else if (activeType === "openai") displayModel = "gpt-4o-mini";
                    else if (activeType === "ollama") displayModel = "llama3";
                    else if (activeType === "anthropic") displayModel = "claude-3-5-sonnet-20240620";
                }
                statusTextModel.innerText = `${providerName} (${displayModel})`;
            }
        }
    } catch (err) {
        console.error("Failed to load AI Model Configuration:", err);
    }
}

async function saveModelConfig() {
    const presetSelect = document.getElementById("settings-model-preset-select");
    const btnSave = document.getElementById("btn-save-model-config");

    if (!presetSelect || !cachedModelConfig) return;

    if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = `<span class="loading-spinner" style="border-top-color: white;"></span> Saving...`;
    }

    try {
        const secretKey = localStorage.getItem("APP_SECRET_KEY") || "";
        
        // Update active provider in the cached config object
        cachedModelConfig.active_provider = presetSelect.value;

        const response = await fetch("/api/model-config", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": secretKey
            },
            body: JSON.stringify(cachedModelConfig)
        });

        if (response.ok) {
            await showCustomAlert("AI Model Configuration saved successfully!", "Settings Saved", "success");
            await loadModelConfig(); // Reload to refresh status pill & mask inputs
        } else {
            const errData = await response.json();
            await showCustomAlert(errData.detail || "Failed to save AI Model Configuration.", "Error Saving", "danger");
        }
    } catch (err) {
        await showCustomAlert("Network error saving AI Model Configuration: " + err.message, "Connection Error", "danger");
    } finally {
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = `<i data-lucide="save" style="width: 12px; height: 12px;"></i> Save Model Configuration`;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}


// ==========================================================================
// NOTIFICATION SYSTEM CONTROLLERS
// ==========================================================================

function escapeHTML(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function loadNotifications(isInitial = false) {
    try {
        const response = await fetch("/api/notifications");
        if (!response.ok) return;

        const data = await response.json();
        if (!data || data.status !== "success") return;

        const oldNotifications = [...notificationsData];
        notificationsData = data.notifications || [];

        // Check for new notifications to trigger Toast popups
        if (!isInitial && oldNotifications.length > 0) {
            notificationsData.forEach(notif => {
                const wasPresent = oldNotifications.some(old => old._id === notif._id);
                if (!wasPresent && !notif.is_read) {
                    showToastNotification(notif);
                }
            });
        }

        renderNotifications();
    } catch (err) {
        console.error("Error loading notifications:", err);
    }
}

function renderNotifications() {
    const listEl = document.getElementById("notifications-list");
    const dotEl = document.getElementById("unread-notification-dot");
    if (!listEl) return;

    const unreadNotifications = notificationsData.filter(n => !n.is_read);
    const unreadCount = unreadNotifications.length;
    
    if (dotEl) {
        dotEl.style.display = unreadCount > 0 ? "block" : "none";
    }

    if (unreadCount === 0) {
        listEl.innerHTML = `
            <div class="notifications-empty-state">
                <i data-lucide="bell-off" style="width: 24px; height: 24px;"></i>
                <p>No new notifications</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    listEl.innerHTML = unreadNotifications.map(notif => {
        const typeClass = notif.type === "hot_lead" ? "hot_lead" : "reply";
        const iconName = notif.type === "hot_lead" ? "flame" : "message-square";
        
        let displayTime = "";
        try {
            const date = new Date(notif.timestamp);
            displayTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | " + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        } catch(e) {
            displayTime = notif.timestamp;
        }

        return `
            <div class="notification-item unread" onclick="handleNotificationClick('${notif._id}', '${notif.lead_url}')">
                <div class="notification-item-icon ${typeClass}">
                    <i data-lucide="${iconName}" style="width: 14px; height: 14px;"></i>
                </div>
                <div class="notification-content-box">
                    <div class="notification-title">${escapeHTML(notif.title)}</div>
                    <div class="notification-message">${escapeHTML(notif.message)}</div>
                    <div class="notification-time">${displayTime}</div>
                </div>
            </div>
        `;
    }).join("");

    if (window.lucide) window.lucide.createIcons();
}

async function handleNotificationClick(notifId, leadUrl) {
    try {
        await fetch("/api/notifications/read", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ notification_id: notifId })
        });
        
        // Hide dropdown
        const dropdown = document.getElementById("notifications-dropdown");
        if (dropdown) dropdown.classList.remove("active");

        // Hide modal
        closeNotificationsModal();

        // Reload notifications
        await loadNotifications();

        // If there's a lead associated, navigate to it and open drawer
        if (leadUrl) {
            // Find lead in global leadsData
            const lead = leadsData.find(l => l.sourceUrl === leadUrl);
            if (lead) {
                // If on another tab, switch to Pipeline tab
                const pipelineTab = document.querySelector('[data-view="pipeline"]');
                if (pipelineTab) pipelineTab.click();
                
                // Open lead details panel
                openDetailModal(lead);
            }
        }
    } catch (err) {
        console.error("Error handling notification click:", err);
    }
}

function closeNotificationsModal() {
    const modal = document.getElementById("notifications-modal");
    if (!modal) return;
    modal.classList.remove("active");
    setTimeout(() => {
        modal.style.display = "none";
    }, 200);
}

async function openNotificationsModal() {
    const modal = document.getElementById("notifications-modal");
    if (!modal) return;

    modal.style.display = "flex";
    setTimeout(() => {
        modal.classList.add("active");
    }, 10);

    try {
        const response = await fetch("/api/notifications");
        if (!response.ok) return;

        const data = await response.json();
        if (!data || data.status !== "success") return;

        const allNotifications = data.notifications || [];
        
        // Filter notifications to last 2 days (48 hours)
        const twoDaysAgo = new Date();
        twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

        let filtered = allNotifications.filter(n => {
            const ts = new Date(n.timestamp);
            return ts >= twoDaysAgo;
        });

        // Fallback to top 10 if there are very few items in the last 2 days
        if (filtered.length < 5) {
            filtered = allNotifications.slice(0, 10);
        }

        // Group by Date Category
        const todayStr = new Date().toDateString();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

        const groups = { today: [], yesterday: [], older: [] };
        filtered.forEach(notif => {
            const d = new Date(notif.timestamp);
            const dStr = d.toDateString();
            if (dStr === todayStr) {
                groups.today.push(notif);
            } else if (dStr === yesterdayStr) {
                groups.yesterday.push(notif);
            } else {
                groups.older.push(notif);
            }
        });

        renderNotificationsHistory(groups);

    } catch (err) {
        console.error("Error opening notifications modal:", err);
    }
}

function renderNotificationsHistory(groups) {
    const listEl = document.getElementById("notifications-history-list");
    if (!listEl) return;

    const hasItems = groups.today.length > 0 || groups.yesterday.length > 0 || groups.older.length > 0;

    if (!hasItems) {
        listEl.innerHTML = `
            <div class="notifications-empty-state" style="padding: 3rem 0;">
                <i data-lucide="bell-off" style="width: 32px; height: 32px;"></i>
                <p>No notifications found in history</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    let html = "";

    const renderGroup = (title, items) => {
        if (items.length === 0) return;
        html += `<div class="notification-group-header">${title}</div>`;
        items.forEach(notif => {
            const isUnread = !notif.is_read;
            const typeClass = notif.type === "hot_lead" ? "hot_lead" : "reply";
            const iconName = notif.type === "hot_lead" ? "flame" : "message-square";

            let displayTime = "";
            try {
                const date = new Date(notif.timestamp);
                displayTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | " + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            } catch(e) {
                displayTime = notif.timestamp;
            }

            html += `
                <div class="notification-item ${isUnread ? 'unread' : ''}" onclick="handleNotificationClick('${notif._id}', '${notif.lead_url}')">
                    <div class="notification-item-icon ${typeClass}">
                        <i data-lucide="${iconName}" style="width: 14px; height: 14px;"></i>
                    </div>
                    <div class="notification-content-box">
                        <div class="notification-title">${escapeHTML(notif.title)}</div>
                        <div class="notification-message">${escapeHTML(notif.message)}</div>
                        <div class="notification-time">${displayTime}</div>
                    </div>
                </div>
            `;
        });
    };

    renderGroup("Today", groups.today);
    renderGroup("Yesterday", groups.yesterday);
    renderGroup("Older Notifications", groups.older);

    listEl.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
}

function showToastNotification(notif) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const card = document.createElement("div");
    const typeClass = notif.type === "hot_lead" ? "hot_lead" : "reply";
    const iconName = notif.type === "hot_lead" ? "flame" : "message-square";

    card.className = `toast-card ${typeClass}`;
    card.innerHTML = `
        <div class="toast-icon ${typeClass}">
            <i data-lucide="${iconName}" style="width: 16px; height: 16px;"></i>
        </div>
        <div class="toast-body">
            <div class="toast-title">${escapeHTML(notif.title)}</div>
            <div class="toast-message">${escapeHTML(notif.message)}</div>
        </div>
        <button class="toast-close" onclick="event.stopPropagation(); this.parentElement.remove();">
            <i data-lucide="x"></i>
        </button>
    `;

    // Click handler to open the lead details directly
    card.addEventListener("click", () => {
        handleNotificationClick(notif._id, notif.lead_url);
        card.remove();
    });

    container.appendChild(card);
    if (window.lucide) window.lucide.createIcons();

    // Play a subtle high-quality notification sound
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 note
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
    } catch(e) {}

    // Auto-remove after 6 seconds
    setTimeout(() => {
        if (card.parentElement) {
            card.classList.add("hide");
            setTimeout(() => card.remove(), 300);
        }
    }, 6000);
}


