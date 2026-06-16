/**
 * tracker.js — Applications Module (v5 - Enhanced)
 * Bidirectional sync, live PDF preview, JSON editing, preset selector, safe template guard.
 */

import { api } from './api.js?v=4';
import { state } from './app.js';

// ── State ─────────────────────────────────────────────────────────────────────
let applications  = [];
let filterSearch  = '';
let filterStatus  = '';
let sortBy        = 'updated_desc';
let distFiles     = [];
let saveDebounce  = null;

// Tracks whether the currently loaded PDF config came from a system recipe
let _loadedFromSystemTemplate = null; // null = no, string = recipe key it came from

// ── Resolve full content (ID refs → actual text objects) ──────────────────────
function resolveFullContent(recipe) {
    const globalLibrary = state.data?.library || {};
    const personal = state.data?.personal || {};
    const out = {};

    // Build a merged library with any recipe-specific overrides included.
    const library = {};
    for (const section of Object.keys(globalLibrary)) {
        library[section] = { ...globalLibrary[section] };
    }
    if (recipe.library && typeof recipe.library === 'object') {
        for (const section of Object.keys(recipe.library)) {
            library[section] = { ...(library[section] || {}), ...recipe.library[section] };
        }
    }

    // Personal info (name, email, phone, etc.) always included at top
    out.personal = { ...personal, ...(recipe.personal || {}) };

    // Sections toggle map
    if (recipe.sections) out.sections = { ...recipe.sections };

    const resolveTextValue = (section, key) => {
        if (!key) return key;
        if (typeof key === 'object') {
            if (key.id && library[section]?.[key.id]) {
                return { id: key.id, ...library[section][key.id], ...key };
            }
            return key;
        }
        const resolved = library[section]?.[key];
        if (typeof resolved === 'string') return resolved;
        if (resolved) return { id: key, ...resolved };
        return key;
    };

    // role_title — resolve string ID → actual title text or object
    if (recipe.role_title) {
        out.role_title = resolveTextValue('role_title', recipe.role_title);
    }

    // professional_summary — resolve string ID → full summary text
    if (recipe.professional_summary) {
        out.professional_summary = resolveTextValue('professional_summary', recipe.professional_summary);
    }
    
    // cover letter
    out.cover_letter = recipe.cover_letter || "";

    // education — resolve string ID → full object
    if (recipe.education) {
        if (typeof recipe.education === 'object') {
            out.education = recipe.education.id && library.education?.[recipe.education.id]
                ? { id: recipe.education.id, ...library.education[recipe.education.id], ...recipe.education }
                : recipe.education;
        } else {
            const resolved = library.education?.[recipe.education];
            out.education = resolved ? { id: recipe.education, ...resolved } : { id: recipe.education };
        }
    }

    const resolveItem = (section, item) => {
        if (!item) return item;
        if (typeof item === 'object') {
            if (item.id && library[section]?.[item.id]) {
                return { id: item.id, ...library[section][item.id], ...item };
            }
            return item;
        }
        const libItem = library[section]?.[item];
        if (libItem) return { id: item, ...libItem };
        return { id: item, _note: 'library item not found' };
    };

    // Array sections: skills, projects, certifications, achievements, additional_info
    const arraySections = ['skills', 'projects', 'certifications', 'achievements', 'additional_info'];
    for (const section of arraySections) {
        const entries = recipe[section];
        if (!entries || !Array.isArray(entries)) continue;
        out[section] = entries.map(entry => resolveItem(section, entry));
    }

    return out;
}

const STATUS_CONFIG = {
    'Bookmarked': { color: '#7c3aed', bg: 'rgba(124,58,237,0.15)', icon: '<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">bookmark</span>' },
    'Applied':    { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', icon: '<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">upload</span>' },
    'Screening':  { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: '<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">search</span>' },
    'Interview':  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', icon: '<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">chat</span>' },
    'Offer':      { color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: '<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">celebration</span>' },
    'Rejected':   { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: '<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">close</span>' },
    'Withdrawn':  { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', icon: '<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">undo</span>' },
};

const STATUS_OPTIONS = Object.keys(STATUS_CONFIG);
const PLATFORMS = [
    'Mail', 'Naukri', 'Unstop', 'Hirist', 'Cutshort', 
    'LinkedIn', 'Internshala', 'Wellfound', 'Indeed', 
    'Career Page', 'Referral', 'Other'
];

const formatAppJsonWithComments = (payload) => {
    let jsonStr = JSON.stringify(payload, null, 2);
    jsonStr = jsonStr.replace(/"status":\s*"(.*?)"(,?)/, '"status": "$1"$2 // Options: ' + Object.keys(STATUS_CONFIG).join(', '));
    jsonStr = jsonStr.replace(/"priority":\s*"(.*?)"(,?)/, '"priority": "$1"$2 // Options: High, Medium, Low');
    jsonStr = jsonStr.replace(/"platform":\s*"(.*?)"(,?)/, '"platform": "$1"$2 // Options: ' + PLATFORMS.join(', '));
    return jsonStr;
};

const parseCleanJson = (jsonStr) => {
    let clean = jsonStr;
    // 1. Strip comments safely (ignoring http:// or https://)
    clean = clean.replace(/(^|[^:])\/\/.*$/gm, '$1');
    
    // 2. Fix literal newlines in strings (often caused by pasting AI output)
    clean = clean.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/gs, function(match) {
        return match.replace(/\n/g, '\\n').replace(/\r/g, '');
    });
    
    return JSON.parse(clean.trim());
};

// ── Master Instruction for AI Job Application Processing ─────────────────────
const MASTER_INSTRUCTION = {
    "master_instruction": {
        "role": "Expert ATS Resume Optimizer, Career Assistant, and Application Manager",
        "objective": "Process any Job Description (JD) and generate a complete application package optimized for ATS, readability, and an exactly one-page resume.",
        "workflow_order": [
            "Extract and summarize the exact Job Description.",
            "Identify Company, Role, Location, Experience Required, Employment Type, Required Skills, Preferred Skills, ATS Keywords, Contact Email, Closing Date, and Platform.",
            "Recommend the most suitable resume PDF variant.",
            "Generate the filled application JSON (including email.to from the extracted Contact Email).",
            "Generate the tailored resume customization JSON.",
            "Generate the ready-to-send email (to, subject, body).",
            "Generate the tailored cover letter.",
            "Validate that the final resume fits exactly one page.",
            "Automatically revise until all validation checks pass."
        ],
        "resume_variant_selection": {
            "BIBIN_RAJU_SD.pdf": [
                "Software Engineer",
                "Full Stack Developer",
                "Java Developer",
                "Python Developer",
                "General Developer",
                "Freshers",
                "Internships"
            ],
            "BIBIN_RAJU_BC.pdf": [
                "Backend Developer",
                "Node.js Developer",
                "Django Developer",
                "Flask Developer",
                "API Developer",
                "Database-heavy roles"
            ],
            "BIBIN_RAJU_SYS.pdf": [
                "System Engineer",
                "DevOps Engineer",
                "Cloud Engineer",
                "Linux Administrator",
                "SRE",
                "Infrastructure roles"
            ],
            "BIBIN_RAJU_MOB.pdf": [
                "Flutter Developer",
                "Android Developer",
                "Mobile Developer",
                "Kotlin Developer"
            ],
            "experience_rule": "Use *_X variants only if the role requires 2+ years of experience, seniority, leadership, or management responsibilities.",
            "default_resume_variant": "BIBIN_RAJU_SD.pdf"
        },
        "resume_generation_rules": {
            "summary": {
                "required": true,
                "sentences": {
                    "minimum": 2,
                    "maximum": 3
                },
                "words": {
                    "minimum": 35,
                    "preferred_range": [
                        38,
                        45
                    ],
                    "maximum": 45
                },
                "focus": "Target role, strongest qualifications, measurable strengths, and ATS keywords."
            },
            "skills": {
                "required": true,
                "exact_categories": 6,
                "keywords_per_category": 4,
                "preferred_categories": [
                    "Languages",
                    "Web Development",
                    "Frameworks",
                    "Databases",
                    "Developer Tools",
                    "Deployment"
                ],
                "focus": "Concentrate ATS keywords here."
            },
            "projects": {
                "required": true,
                "exact_projects": 5,
                "bullet_distribution": {
                    "preferred": [
                        4,
                        4,
                        3,
                        3,
                        3
                    ]
                },
                "total_bullets": {
                    "minimum": 15,
                    "default": 17,
                    "maximum": 17
                },
                "reduce_bullets_only_if_page_exceeds_target": true,
                "max_words_per_bullet": 12,
                "ordering": "Most relevant first.",
                "expansion_priority": [
                    "Add measurable outcomes.",
                    "Add implementation details.",
                    "Add optimization impact.",
                    "Add collaboration details."
                ],
                "compression_priority": [
                    "Remove generic wording.",
                    "Remove least relevant detail.",
                    "Remove secondary metrics.",
                    "Never remove technologies."
                ],
                "rules": [
                    "Use action verbs.",
                    "Include measurable outcomes when possible.",
                    "Mention technologies used.",
                    "Avoid generic descriptions.",
                    "Tailor highlights to JD keywords."
                ]
            },
            "education": {
                "required": true,
                "exact_entries": 1,
                "structure": {
                    "degree": true,
                    "institution": true,
                    "year": true
                }
            },
            "certifications": {
                "required": true,
                "minimum_items": 4,
                "maximum_items": 5,
                "use_maximum_only_if_below_fill_target": true,
                "structure": {
                    "name": true,
                    "issuer": true,
                    "year": true
                },
                "focus": "Prefer certifications matching the JD.",
                "priority": [
                    "Direct JD relevance",
                    "Programming",
                    "Cloud",
                    "Database",
                    "General technical"
                ]
            },
            "achievements": {
                "required": true,
                "exact_items": 3,
                "structure": {
                    "name": true,
                    "issuer": true,
                    "year": true
                },
                "focus": "Short, recognizable, and concise."
            },
            "additional_info": {
                "required": true,
                "exact_items": 2,
                "structure": {
                    "areas_of_interest": true,
                    "languages": true
                },
                "areas_of_interest": {
                    "exact_keywords": 4,
                    "focus": "Use exactly 4 role-specific keywords (e.g. Java Development, Backend Systems, Databases, Problem Solving)."
                },
                "languages": {
                    "exact_value": "English, Malayalam"
                }
            },
            "cover_letter": {
                "required": true,
                "max_paragraphs": 3,
                "structure": [
                    "Paragraph 1: Express interest in the company and role.",
                    "Paragraph 2: Highlight relevant skills, projects, and qualifications.",
                    "Paragraph 3: Appreciation and closing."
                ],
                "tone": "Professional, human, enthusiastic."
            }
        },
        "layout_rules": {
            "exactly_one_page": true,
            "section_order": [
                "Header",
                "Professional Summary",
                "Skills",
                "Projects",
                "Education",
                "Certifications",
                "Achievements",
                "Languages"
            ],
            "page_fill_engine": {
                "target_fill_percent": 98,
                "acceptable_range": [
                    96,
                    99
                ],
                "auto_adjust": true,
                "expand_order": [
                    "ProjectHighlights",
                    "Summary",
                    "Certifications",
                    "AreasOfInterest"
                ],
                "compress_order": [
                    "Certifications",
                    "AreasOfInterest",
                    "Summary",
                    "ProjectHighlights"
                ],
                "step_size": "one bullet or one item at a time",
                "max_revision_cycles": 5
            },
            "visual_balance_rules": {
                "avoid_large_empty_sections": true,
                "maintain_similar_section_density": true,
                "prefer_expanding_existing_sections_over_new_sections": true,
                "maximum_unused_vertical_space_percent": 5,
                "avoid_overcrowding": true
            }
        },
        "email_rules": {
            "required": true,
            "to_rule": "Extract the contact/recruitment email from the JD (e.g. careers@company.com, hr@company.com). If found, use it as the recipient. If not found, leave blank.",
            "subject_format": "Application for [Role] \u2013 Bibin Raju",
            "greeting_rule": "Use 'Dear Hiring Team' by default. Use 'Dear Mr./Ms. [Surname]' only if the surname is explicitly provided in the JD.",
            "body_structure": [
                "Introduce interest in the role.",
                "Mention degree and relevant skills.",
                "Reference attached resume.",
                "Express appreciation.",
                "Professional sign-off."
            ],
            "signature": {
                "name": "Bibin Raju",
                "phone": "+91 90740 85302",
                "email": "bibinraju541@gmail.com",
                "linkedin": "linkedin.com/in/bibinraju"
            },
            "required_fields": [
                "to",
                "subject",
                "body",
                "signature"
            ]
        },
        "validation_checklist": {
            "valid_json": true,
            "schema_preserved": true,
            "correct_assigned_pdf": true,
            "exactly_one_page": true,
            "ats_keyword_coverage_percent": 80,
            "summary_word_range": [
                35,
                45
            ],
            "skill_categories": 6,
            "keywords_per_skill_category": 4,
            "project_count": 5,
            "project_total_bullets_range": [
                15,
                17
            ],
            "project_bullet_distribution_preferred": [
                4,
                4,
                3,
                3,
                3
            ],
            "project_bullet_word_limit": 12,
            "certification_count_range": [
                4,
                5
            ],
            "achievement_count": 3,
            "education_entries": 1,
            "additional_info_items": 2,
            "areas_of_interest_keywords": 4,
            "cover_letter_generated": true,
            "email_to_filled": true,
            "email_subject_body_generated": true,
            "auto_revise_until_valid": true,
            "max_revision_cycles": 5
        },
        "hard_validation": [
            "Return valid JSON only.",
            "Schema preserved exactly \u2014 no extra fields, no missing fields.",
            "Correct assigned PDF selected.",
            "Exactly 6 skill categories.",
            "Exactly 5 projects.",
            "Exactly 3 achievements.",
            "Exactly 1 education entry.",
            "Additional Info contains only Areas of Interest and Languages.",
            "Areas of Interest contains exactly 4 role-specific keywords.",
            "Summary is 35\u201345 words.",
            "Projects contain 15\u201317 bullets total.",
            "Each bullet is at most 12 words.",
            "Certifications contain 4\u20135 items.",
            "Email to, subject, and body are generated.",
            "Cover letter is generated.",
            "ATS keyword coverage is at least 80%.",
            "Resume estimated utilization is between 96\u201399%.",
            "Maximum revision cycles: 5."
        ],
        "ats_distribution": {
            "skills": 50,
            "projects": 35,
            "summary": 10,
            "cover_letter": 5
        },
        "variant_resolution_rule": "Choose the most specialized variant. If multiple qualify equally, use BIBIN_RAJU_SD.pdf.",
        "ultimate_directive": "Generate the strongest ATS-optimized application package possible. Preserve schema integrity and ATS compliance first. Then optimize visual balance using renderer-estimated page utilization until the resume occupies 96\u201399% of one page with minimal whitespace, no overcrowding, and consistent section density. If constraints conflict, preserve schema and ATS relevance first, then adjust content dynamically until all validations pass.",
        "output_format_rule": "Return ONLY the fully filled application JSON. No explanations, no markdown formatting, no code blocks, no introductory or closing text. Just the raw JSON object.",
        "required_keyword_coverage_percent": 80
    }
};

// ── Application JSON Schema Template ─────────────────────────────────────────
const APPLICATION_SCHEMA = {
    "company": "",
    "role": "",
    "status": "Applied",
    "priority": "Medium",
    "location": "",
    "platform": "",
    "job_url": "",
    "notes": "",
    "assigned_pdf": "",
    "job_description": "",
    "resume_template": {
        "role_title": "",
        "summary": "",
        "skills": {
            "Languages": [],
            "Web Development": [],
            "Frameworks": [],
            "Databases": [],
            "Developer Tools": [],
            "Deployment": []
        },
        "projects": [
            {
                "name": "",
                "technologies": "",
                "highlights": []
            },
            {
                "name": "",
                "technologies": "",
                "highlights": []
            },
            {
                "name": "",
                "technologies": "",
                "highlights": []
            },
            {
                "name": "",
                "technologies": "",
                "highlights": []
            },
            {
                "name": "",
                "technologies": "",
                "highlights": []
            }
        ],
        "education": {
            "degree": "",
            "institution": "",
            "year": ""
        },
        "certifications": [
            {
                "name": "",
                "issuer": "",
                "year": ""
            },
            {
                "name": "",
                "issuer": "",
                "year": ""
            },
            {
                "name": "",
                "issuer": "",
                "year": ""
            },
            {
                "name": "",
                "issuer": "",
                "year": ""
            },
            {
                "name": "",
                "issuer": "",
                "year": ""
            }
        ],
        "achievements": [
            {
                "name": "",
                "issuer": "",
                "year": ""
            },
            {
                "name": "",
                "issuer": "",
                "year": ""
            },
            {
                "name": "",
                "issuer": "",
                "year": ""
            }
        ],
        "additional_info": {
            "areas_of_interest": "",
            "languages": ""
        },
        "cover_letter": ""
    },
    "email": {
        "to": "",
        "cc": "",
        "subject": "",
        "body": ""
    }
};

// ── Toast ─────────────────────────────────────────────────────────────────────
export function toast(msg, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: '<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">check</span>', error: '<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">close</span>', info: '<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">info</span>' };
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `
        <span class="toast-icon">${icons[type] || '<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">check</span>'}</span>
        <span class="toast-msg">${msg}</span>
        <button class="toast-dismiss" onclick="this.parentElement.remove()"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">close</span></button>`;
    container.appendChild(t);
    setTimeout(() => {
        t.classList.add('toast-out');
        setTimeout(() => t.remove(), 220);
    }, duration);
}

// ── Save Indicator ────────────────────────────────────────────────────────────
function setSaveIndicator(state) {
    const el = document.getElementById('tracker-save-indicator');
    if (!el) return;
    if (state === 'saving') {
        el.className = 'save-indicator saving';
        el.innerHTML = '<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">hourglass_empty</span> Saving…';
    } else if (state === 'saved') {
        el.className = 'save-indicator saved';
        el.innerHTML = '<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">check</span> Saved';
        setTimeout(() => { el.textContent = ''; el.className = 'save-indicator'; }, 2000);
    } else {
        el.className = 'save-indicator';
        el.textContent = '';
    }
}

// ── API ───────────────────────────────────────────────────────────────────────
export const trackerApi = {
    async list() {
        const res = await fetch('/applications');
        const data = await res.json();
        return data.applications || [];
    },
    async create(payload) {
        const res = await fetch('/applications', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await res.json();
    },
    async update(id, payload) {
        const res = await fetch(`/applications/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await res.json();
    },
    async delete(id) {
        const res = await fetch(`/applications/${id}`, { method: 'DELETE' });
        return await res.json();
    },
    async buildForApp(appId, path, onLine) {
        const res = await fetch(`/applications/${path}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            onLine(decoder.decode(value));
        }
    },
};

// ── Utilities ─────────────────────────────────────────────────────────────────
function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtRel(iso) {
    if (!iso) return '';
    const diff = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff}d ago`;
    return fmtDate(iso);
}

// ── Load ──────────────────────────────────────────────────────────────────────
export async function loadTracker() {
    const grid = document.getElementById('apps-grid');
    if (grid) {
        grid.innerHTML = Array(3).fill(0).map(() => `
            <div class="app-card skeleton-card">
                <div class="app-card-header" style="border-bottom:none; margin-bottom: 0px; padding-bottom: 0px;">
                    <div class="skeleton-line" style="width: 70%; height: 18px; margin-bottom: 8px;"></div>
                    <div class="skeleton-line" style="width: 40%; height: 12px;"></div>
                </div>
                <div class="app-card-body" style="gap: 12px; padding-top: 8px;">
                    <div class="skeleton-line" style="width: 90%; height: 12px;"></div>
                    <div class="skeleton-line" style="width: 60%; height: 12px;"></div>
                </div>
                <div class="app-card-footer" style="background: none; border-top: none;">
                    <div class="skeleton-line" style="width: 30%; height: 18px; border-radius: 6px;"></div>
                    <div class="skeleton-line" style="width: 25%; height: 12px;"></div>
                </div>
            </div>
        `).join('');
    }

    try {
        if (window.__PRELOADED_APPS__ && window.__PRELOADED_FILES__) {
            applications = window.__PRELOADED_APPS__;
            distFiles = window.__PRELOADED_FILES__;
            window.__PRELOADED_APPS__ = null;
            window.__PRELOADED_FILES__ = null;
        } else {
            [applications, distFiles] = await Promise.all([
                trackerApi.list(),
                fetch('/list-files').then(r => r.json()).catch(() => []),
            ]);
        }
        const countEl = document.getElementById('apps-count-badge');
        if (countEl) countEl.textContent = applications.length;
        renderGrid();
    } catch (e) {
        console.error('Error loading tracker:', e);
        if (grid) {
            grid.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted)"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">warning</span> Failed to load applications.</div>`;
        }
    }
}

// ── Grid View (Card-Based) ────────────────────────────────────────────────────
function fmtDeadline(iso) {
    if (!iso) return null;
    const now = new Date();
    const d = new Date(iso);
    const diff = Math.ceil((d - now) / 86400000);
    if (diff < 0) return { label: 'Overdue', cls: 'urgent' };
    if (diff === 0) return { label: 'Today', cls: 'urgent' };
    if (diff === 1) return { label: 'Tomorrow', cls: 'soon' };
    if (diff <= 7) return { label: `${diff}d left`, cls: 'soon' };
    return { label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), cls: 'normal' };
}

function renderGrid() {
    const grid = document.getElementById('apps-grid');
    if (!grid) return;

    let filtered = [...applications];
    
    // --- Render Stats (clickable per-status filters) ---
    const statsContainer = document.getElementById('apps-stats-container');
    if (statsContainer) {
        const statusCounts = {};
        STATUS_OPTIONS.forEach(s => { statusCounts[s] = 0; });
        applications.forEach(a => { if (statusCounts[a.status] !== undefined) statusCounts[a.status]++; });

        const stat = (label, count, color, statusKey) => {
            const active = filterStatus === statusKey;
            const style = active
                ? `border-color:${color};background:${color}11;box-shadow:inset 0 -2px 0 ${color}`
                : '';
            const valStyle = active ? `color:${color}` : (color ? `color:${color}` : '');
            return `<div class="apps-stat-card${active ? ' filter-active' : ''}" style="${style}" onclick="window.filterByStatus('${statusKey}')">
                <div class="apps-stat-label">${label}</div>
                <div class="apps-stat-value" style="${valStyle}">${count}</div>
            </div>`;
        };

        statsContainer.innerHTML =
            stat('Total', applications.length, '', '') +
            STATUS_OPTIONS.map(s => {
                const cfg = STATUS_CONFIG[s];
                return stat(s, statusCounts[s], cfg.color, s);
            }).join('');
    }

    if (filterSearch) {
        const q = filterSearch.toLowerCase();
        filtered = filtered.filter(a =>
            a.company?.toLowerCase().includes(q) ||
            a.role?.toLowerCase().includes(q) ||
            a.location?.toLowerCase().includes(q)
        );
    }

    // Status filter
    if (filterStatus) {
        filtered = filtered.filter(a => a.status === filterStatus);
    }

    // Sort
    const prioOrder = { high: 3, medium: 2, low: 1 };
    switch (sortBy) {
        case 'updated_asc':
            filtered.sort((a, b) => new Date(a.updated_at || 0) - new Date(b.updated_at || 0));
            break;
        case 'company_asc':
            filtered.sort((a, b) => (a.company || '').localeCompare(b.company || ''));
            break;
        case 'company_desc':
            filtered.sort((a, b) => (b.company || '').localeCompare(a.company || ''));
            break;
        case 'status_asc':
            filtered.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
            break;
        case 'priority_desc':
            filtered.sort((a, b) => (prioOrder[(a.priority || '').toLowerCase()] || 0) - (prioOrder[(b.priority || '').toLowerCase()] || 0));
            break;
        case 'priority_asc':
            filtered.sort((a, b) => (prioOrder[(b.priority || '').toLowerCase()] || 0) - (prioOrder[(a.priority || '').toLowerCase()] || 0));
            break;
        default:
            filtered.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
    }

    if (filtered.length === 0) {
        grid.className = 'apps-container empty';
        const activeFilters = [];
        if (filterSearch) activeFilters.push(`"${filterSearch}"`);
        if (filterStatus) activeFilters.push(`status: ${filterStatus}`);
        const filterMsg = activeFilters.length ? ` (filtered by ${activeFilters.join(', ')})` : '';
        grid.innerHTML = `
        <div class="apps-empty-state">
            <div class="apps-empty-icon">💼</div>
            <div class="apps-empty-title">${filterSearch || filterStatus ? 'No matching applications' : 'No applications yet'}</div>
            <div class="apps-empty-text">
                ${!filterSearch && !filterStatus ? 'Start tracking your job applications here' : `Try adjusting your filters${filterMsg}`}
            </div>
            ${!filterSearch && !filterStatus ? `<button class="btn btn-primary" style="margin-top:8px" onclick="window.openNewAppModal()">+ Create First Application</button>` : ''}
            ${filterStatus ? `<button class="btn btn-secondary" style="margin-top:8px" onclick="window.filterByStatus('')">Clear Status Filter</button>` : ''}
        </div>`;
        return;
    }

    grid.className = 'apps-container';
    grid.innerHTML = filtered.map(app => {
        const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG['Bookmarked'];
        const hasResume = !!app.assigned_pdf;
        const hasTemplate = app.resume_template && Object.keys(app.resume_template).length > 0;
        const prio = (app.priority || '').toLowerCase();
        const prioClass = prio === 'high' ? 'high' : prio === 'low' ? 'low' : 'medium';
        const deadline = fmtDeadline(app.deadline);
        
        return `
        <div class="app-card" onclick="window.openAppEditor('${app.id}')">
            <div class="app-card-priority-bar ${prioClass}"></div>
            <div class="app-card-header">
                <div class="app-card-emoji">${cfg.icon}</div>
                <div class="app-card-title-group">
                    <div class="app-card-company">${esc(app.company)}</div>
                    <div class="app-card-role">${esc(app.role)}</div>
                    <div class="app-card-status" style="color:${cfg.color};background:${cfg.bg}">
                        ${app.status}
                    </div>
                </div>
            </div>
            
            <div class="app-card-body">
                ${app.location ? `
                    <div class="app-card-location">
                        <span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">location_on</span> ${esc(app.location)}
                    </div>
                ` : ''}
                ${app.platform ? `
                    <div class="app-card-location" style="margin-top: 4px;">
                        <span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">business</span> ${esc(app.platform)}
                    </div>
                ` : ''}
                ${app.contact_email ? `
                    <div class="app-card-location" style="margin-top: 4px;">
                        <span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">mail</span> ${esc(app.contact_email)}
                    </div>
                ` : ''}
                ${app.job_url ? `
                    <div class="app-card-info-row">
                        <a href="${esc(app.job_url)}" target="_blank" onclick="event.stopPropagation()" style="color: #7c3aed; text-decoration: none; font-weight: 500;">View Job →</a>
                    </div>
                ` : ''}
                ${app.notes ? `
                    <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4; margin-top: 4px; padding-left: 2px; border-left: 2px solid var(--border); padding-left: 8px;">
                        ${esc(app.notes.substring(0, 80))}${app.notes.length > 80 ? '...' : ''}
                    </div>
                ` : ''}
            </div>
            
            <div class="app-card-footer">
                <div class="app-card-meta">
                    <span title="Last updated">${fmtRel(app.updated_at)}</span>
                    ${deadline ? `<span class="app-card-deadline ${deadline.cls}"><span class="material-symbols-outlined" style="font-size:1em;vertical-align:middle">calendar_month</span> ${deadline.label}</span>` : ''}
                </div>
                <div class="app-card-chips">
                    ${hasResume ? `<div class="app-card-chip" title="${esc(app.assigned_pdf)}"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">description</span> PDF</div>` : ''}
                    ${app.assigned_cover_letter ? `<div class="app-card-chip" title="${esc(app.assigned_cover_letter)}"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">draft</span> Cover</div>` : ''}
                    ${hasTemplate ? `<div class="app-card-chip" title="Has custom template"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">edit</span> Custom</div>` : ''}
                    ${hasTemplate ? `<div class="app-card-chip" style="cursor:pointer;background:rgba(124,58,237,0.12);border-color:rgba(124,58,237,0.3)" onclick="event.stopPropagation();window.bookmarkAppResume('${app.id}')" title="Save resume to Saved Resumes"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">bookmark</span> Save</div>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

// ── Modal System ──────────────────────────────────────────────────────────────
export function showModal(title, bodyHtml, onConfirm, confirmLabel = 'Confirm', options = {}) {
    let modal = document.getElementById('tracker-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'tracker-modal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    
    const hasTabs = options.tabs && options.tabs.length > 0;
    const tabsHtml = hasTabs ? `
        <div class="modal-tabs">
            ${options.tabs.map((tab, idx) => `
                <button class="modal-tab ${idx === 0 ? 'active' : ''}" 
                        data-tab-index="${idx}"
                        onclick="window.switchModalTab(${idx})">
                    ${tab.icon || ''} ${tab.label}
                </button>
            `).join('')}
        </div>
    ` : '';
    
    const bodyWithTabs = hasTabs ? `
        <div class="modal-tab-content">
            ${options.tabs.map((tab, idx) => `
                <div class="modal-tab-pane ${idx === 0 ? 'active' : ''}" data-pane="${idx}">
                    ${tab.content}
                </div>
            `).join('')}
        </div>
    ` : bodyHtml;
    
    modal.innerHTML = `
    <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-header">
            <span class="modal-title">${title}</span>
            <button class="modal-close" onclick="window.closeModal()"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">close</span></button>
        </div>
        ${options.headerHtml || ''}
        ${tabsHtml}
        <div class="modal-body">${bodyWithTabs}</div>
        <div class="modal-footer">
            <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="modal-confirm-btn">${confirmLabel}</button>
        </div>
    </div>`;
    modal.style.display = 'flex';
    modal.onclick = () => window.closeModal();
    document.getElementById('modal-confirm-btn').onclick = async () => {
        const result = await onConfirm();
        if (result !== false) window.closeModal();
    };
    
    window._currentModalOnConfirm = onConfirm;
    window._currentModalOnTabChange = options.onTabChange || null;
}

// ── Tab Switching ──────────────────────────────────────────────────────────────
window.switchModalTab = (index) => {
    const tabs = document.querySelectorAll('.modal-tab');
    const panes = document.querySelectorAll('.modal-tab-pane');
    
    let oldIndex = 0;
    tabs.forEach((tab, i) => {
        if (tab.classList.contains('active')) oldIndex = i;
        tab.classList.toggle('active', i === index);
    });
    panes.forEach((pane, i) => {
        pane.classList.toggle('active', i === index);
    });
    
    if (window._currentModalOnTabChange) {
        window._currentModalOnTabChange(index, oldIndex);
    }
    
    // When switching to PDF Config tab (index 1), refresh preview if a PDF is selected
    if (index === 1) {
        setTimeout(() => {
            const sel = document.getElementById('config-template-select');
            if (sel && sel.value) refreshConfigPdfPreview(sel.value);
        }, 50);
    }
    // When switching to Email tab, sync fields from JSON editor
    if (index === 2) {
        window.syncEmailTabFromJson();
    }
};

export function closeModal() {
    const modal = document.getElementById('tracker-modal');
    if (modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
    _loadedFromSystemTemplate = null;
}

// ── Unified Application Modal ──────────────────────────────────────────────────
export async function openAppStudio(appId = null) {
    let app = null;
    let initialJson = "";

    if (appId) {
        app = applications.find(a => a.id === appId);
        if (!app) return;
        initialJson = formatAppJsonWithComments(app);
    } else {
        initialJson = formatAppJsonWithComments(APPLICATION_SCHEMA);
    }

    // ── Tab 0: Application JSON + Live PDF Preview ──────────────────────────
    const jsonPaneHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;height:calc(90vh - 160px);min-height:460px;padding:16px 24px">
            <!-- Left: JSON Editor -->
            <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
                    <label style="font-weight:600;font-size:12px">Application JSON</label>
                    <div style="display:flex;gap:4px;flex-wrap:wrap">
                        <button class="btn btn-sm btn-secondary" onclick="window.copyForAI()" title="Copy prompt for AI" style="font-size:10px;padding:3px 8px;">Copy AI Prompt</button>
                    </div>
                </div>
                <div id="unified-json-error" style="display:none; color: #dc2626; font-size: 10px; padding: 4px 8px; background: rgba(239,68,68,0.08); border-radius: 4px;"></div>
                <textarea id="unified-json-editor" class="input-field textarea" spellcheck="false"
                    oninput="window.onUnifiedJsonInput(this.value)"
                    placeholder='Paste AI JSON output here...'
                    style="flex:1;border:1.5px solid var(--border);border-radius:6px;font-family:monospace;font-size:12px;white-space:pre;">${esc(initialJson)}</textarea>
            </div>
            <!-- Right: Live PDF Preview -->
            <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
                    <label style="font-weight:600;font-size:12px">Live Preview</label>
                    <div style="display:flex; gap: 4px; background: var(--bg-elevated); padding: 2px; border-radius: 6px; border: 1px solid var(--border);">
                        <button id="preview-type-resume" class="btn btn-ghost" style="font-size:10px; padding: 2px 8px; background: var(--accent); color: white;" onclick="window.setUnifiedPreviewType('resume')">Resume</button>
                        <button id="preview-type-cover" class="btn btn-ghost" style="font-size:10px; padding: 2px 8px;" onclick="window.setUnifiedPreviewType('cover_letter')">Cover Letter</button>
                    </div>
                </div>
                <div style="flex:1;border:1.5px solid var(--border);border-radius:6px;overflow:hidden;background:#fff;display:flex;flex-direction:column">
                    <div style="background:var(--bg-elevated);border-bottom:1px solid var(--border);padding:6px 10px;font-size:10px;color:var(--text-muted);display:flex;justify-content:space-between;align-items:center">
                        <span id="unified-preview-status"><span class="material-symbols-outlined" style="font-size:1.1em;vertical-align:middle;line-height:1">description</span> PDF Preview</span>
                        <div style="display:flex; gap: 12px; align-items: center;">
                            <a id="unified-preview-download" href="#" download style="color:var(--accent);font-size:9px;text-decoration:none;cursor:pointer;display:none">Download ↓</a>
                            <a id="unified-preview-open" href="#" target="_blank" style="color:var(--accent);font-size:9px;text-decoration:none;cursor:pointer;display:none">Open ↗</a>
                        </div>
                    </div>
                    <iframe id="unified-preview-iframe" src="" title="Live PDF Preview" style="flex:1;border:none;display:block"></iframe>
                </div>
                ${appId ? `
                <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:6px;">
                    <button class="btn btn-danger" onclick="window.deleteApp('${appId}'); window.closeModal();"><span class="material-symbols-outlined" style="font-size:1.1em;vertical-align:middle;line-height:1">delete</span> Delete App</button>
                    <button class="btn btn-secondary" onclick="window.exportToLocalFolder()" title="Export PDF to local folder"><span class="material-symbols-outlined" style="font-size:1.1em;vertical-align:middle;line-height:1">folder</span> Save to Folder</button>
                </div>` : ''}
            </div>
        </div>`;

    // ── Tab 1: Email ──────────────────────────────────────────────────────────
    // Fetch signature from MASTER_INSTRUCTION for preview
    const emailPaneHtml = `
        <div id="email-tab-pane" style="padding:16px 24px;height:calc(90vh - 160px);min-height:460px;display:flex;flex-direction:column;gap:12px;overflow-y:auto">

            <!-- Warning banner -->
            <div id="email-no-recipient-warning" style="display:none;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.4);border-radius:6px;padding:8px 12px;font-size:11px;color:#b45309;display:flex;align-items:center;gap:6px">
                <span class="material-symbols-outlined" style="font-size:1.1em">warning</span>
                Recipient email not found. Please enter an email address to enable Gmail.
            </div>

            <!-- Top toolbar: Edit | Preview toggle + action buttons -->
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                <div style="display:flex;gap:2px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:2px">
                    <button id="email-mode-edit" class="view-toggle-btn active" onclick="window.setEmailMode('edit')" style="font-size:11px;padding:4px 12px">
                        <span class="material-symbols-outlined" style="font-size:1em">edit</span> Edit
                    </button>
                    <button id="email-mode-preview" class="view-toggle-btn" onclick="window.setEmailMode('preview')" style="font-size:11px;padding:4px 12px">
                        <span class="material-symbols-outlined" style="font-size:1em">visibility</span> Preview
                    </button>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <button class="btn btn-sm btn-secondary" onclick="window.emailCopySubject()" title="Copy subject line">
                        <span class="material-symbols-outlined" style="font-size:1em;vertical-align:middle">content_copy</span> Subject
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="window.emailCopyBody()" title="Copy email body">
                        <span class="material-symbols-outlined" style="font-size:1em;vertical-align:middle">content_copy</span> Body
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="window.emailCopyAll()" title="Copy full email (with signature)">
                        <span class="material-symbols-outlined" style="font-size:1em;vertical-align:middle">content_copy</span> Copy Email
                    </button>
                    <button id="email-gmail-btn" class="btn btn-sm btn-primary" onclick="window.emailOpenGmail()" title="Open in Gmail Compose">
                        <span class="material-symbols-outlined" style="font-size:1em;vertical-align:middle">open_in_new</span> Open in Gmail
                    </button>
                </div>
            </div>

            <!-- EDIT MODE -->
            <div id="email-edit-mode" style="display:flex;flex-direction:column;gap:10px;flex:1">

                <!-- Recipient -->
                <div class="field-group">
                    <label>To <span style="color:var(--text-muted);font-weight:400">(Recipient)</span></label>
                    <input id="email-to" type="email" class="input-field"
                        placeholder="e.g. careers@company.com"
                        oninput="window.onEmailFieldChange()"
                        style="font-size:12px" />
                </div>

                <!-- CC -->
                <div class="field-group">
                    <label>CC <span style="color:var(--text-muted);font-weight:400">(Optional)</span></label>
                    <input id="email-cc" type="text" class="input-field"
                        placeholder="e.g. hr@company.com"
                        oninput="window.onEmailFieldChange()"
                        style="font-size:12px" />
                </div>

                <!-- Subject -->
                <div class="field-group">
                    <label>Subject</label>
                    <input id="email-subject" type="text" class="input-field"
                        placeholder="e.g. Application for Java Intern – Bibin Raju"
                        oninput="window.onEmailFieldChange()"
                        style="font-size:12px" />
                </div>

                <!-- Body -->
                <div class="field-group" style="flex:1;display:flex;flex-direction:column">
                    <label>Email Body</label>
                    <textarea id="email-body" class="input-field textarea"
                        placeholder="Write your email body here..."
                        oninput="window.onEmailFieldChange()"
                        style="flex:1;min-height:320px;font-size:12px;line-height:1.7;font-family:var(--font)"></textarea>
                </div>
            </div>

            <!-- PREVIEW MODE -->
            <div id="email-preview-mode" style="display:none;flex:1;overflow-y:auto">
                <div id="email-preview-box" style="background:#fff;border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--text-primary);font-family:var(--font);overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06)"></div>
            </div>

        </div>`;

    // ── Tab 1: Details (Form fields for app metadata) ─────────────────────────
    const detailsPaneHtml = `
        <div style="padding:16px 24px;height:calc(90vh - 160px);min-height:460px;display:flex;flex-direction:column;gap:12px;overflow-y:auto">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="field-group">
                    <label>Company <span style="color:var(--danger)">*</span></label>
                    <input id="dt-company" class="input-field" placeholder="e.g. Acme Corp" oninput="window.onDetailsFieldChange()" style="font-size:12px" />
                </div>
                <div class="field-group">
                    <label>Role <span style="color:var(--danger)">*</span></label>
                    <input id="dt-role" class="input-field" placeholder="e.g. Software Engineer" oninput="window.onDetailsFieldChange()" style="font-size:12px" />
                </div>
                <div class="field-group">
                    <label>Status</label>
                    <select id="dt-status" class="input-field" onchange="window.onDetailsFieldChange()" style="font-size:12px">
                        ${STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('')}
                    </select>
                </div>
                <div class="field-group">
                    <label>Priority</label>
                    <select id="dt-priority" class="input-field" onchange="window.onDetailsFieldChange()" style="font-size:12px">
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                    </select>
                </div>
                <div class="field-group">
                    <label>Location</label>
                    <input id="dt-location" class="input-field" placeholder="e.g. San Francisco, CA" oninput="window.onDetailsFieldChange()" style="font-size:12px" />
                </div>
                <div class="field-group">
                    <label>Platform</label>
                    <select id="dt-platform" class="input-field" onchange="window.onDetailsFieldChange()" style="font-size:12px">
                        <option value="">— Select —</option>
                        ${PLATFORMS.map(p => `<option value="${p}">${p}</option>`).join('')}
                    </select>
                </div>
                <div class="field-group">
                    <label>Job Type</label>
                    <input id="dt-job-type" class="input-field" placeholder="e.g. Full-time, Internship" oninput="window.onDetailsFieldChange()" style="font-size:12px" />
                </div>
                <div class="field-group">
                    <label>Source</label>
                    <input id="dt-source" class="input-field" placeholder="e.g. LinkedIn, Naukri" oninput="window.onDetailsFieldChange()" style="font-size:12px" />
                </div>
                <div class="field-group">
                    <label>Deadline</label>
                    <input id="dt-deadline" type="date" class="input-field" onchange="window.onDetailsFieldChange()" style="font-size:12px" />
                </div>
                <div class="field-group">
                    <label>Salary Range</label>
                    <input id="dt-salary" class="input-field" placeholder="e.g. ₹7,000/month" oninput="window.onDetailsFieldChange()" style="font-size:12px" />
                </div>
                <div class="field-group">
                    <label>Contact Name</label>
                    <input id="dt-contact-name" class="input-field" placeholder="Hiring manager name" oninput="window.onDetailsFieldChange()" style="font-size:12px" />
                </div>
                <div class="field-group">
                    <label>Contact Email</label>
                    <input id="dt-contact-email" type="email" class="input-field" placeholder="careers@company.com" oninput="window.onDetailsFieldChange()" style="font-size:12px" />
                </div>
                <div class="field-group">
                    <label>Job URL</label>
                    <input id="dt-job-url" class="input-field" placeholder="https://..." oninput="window.onDetailsFieldChange()" style="font-size:12px" />
                </div>
                <div class="field-group">
                    <label>Assigned PDF</label>
                    <input id="dt-assigned-pdf" class="input-field" placeholder="BIBIN_RAJU_SD.pdf" oninput="window.onDetailsFieldChange()" style="font-size:12px" />
                </div>
            </div>
            <div class="field-group" style="grid-column:1/-1">
                <label>Notes</label>
                <textarea id="dt-notes" class="input-field textarea" placeholder="Application notes..." oninput="window.onDetailsFieldChange()" style="min-height:60px;font-size:12px"></textarea>
            </div>
            <div class="field-group" style="grid-column:1/-1">
                <label>Job Description</label>
                <textarea id="dt-jd" class="input-field textarea" placeholder="Paste job description here..." oninput="window.onDetailsFieldChange()" style="min-height:80px;font-size:12px;font-family:var(--mono)"></textarea>
            </div>
        </div>`;

    window._currentEditingApp = app;

    // ── Scrape header (new apps only) ──────────────────────────────────────────
    let headerHtml = '';
    if (!appId) {
        headerHtml = `
        <div style="margin:0 16px;padding:10px 14px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span class="material-symbols-outlined" style="font-size:1.2em;color:var(--accent)">travel_explore</span>
            <input id="scrape-url-input" type="url" class="input-field" placeholder="Paste job posting URL..." style="flex:1;min-width:200px;font-size:12px" />
            <button id="scrape-btn" class="btn btn-sm btn-primary" onclick="window.scrapeJobUrlHandler()" style="font-size:11px;padding:5px 12px;white-space:nowrap">
                <span class="material-symbols-outlined" style="font-size:1em;vertical-align:middle">download</span> Scrape
            </button>
            <div id="scrape-status" style="font-size:11px;color:var(--text-muted);display:none"></div>
        </div>
        <div id="scrape-result" style="margin:0 16px;display:none;flex-direction:column;gap:8px;padding:10px 14px;background:var(--bg-card);border:1px solid var(--accent);border-radius:8px;max-height:200px;overflow-y:auto">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
                <span style="font-size:11px;font-weight:600;color:var(--accent)">Scraped & Prompt Ready</span>
                <button class="btn btn-sm btn-secondary" onclick="window.copyScrapedPrompt()" style="font-size:10px;padding:3px 8px;white-space:nowrap">
                    <span class="material-symbols-outlined" style="font-size:1em;vertical-align:middle">content_copy</span> Copy Prompt
                </button>
            </div>
            <textarea id="scrape-prompt-output" readonly style="width:100%;min-height:80px;font-size:11px;font-family:var(--mono);background:var(--bg-main);border:1px solid var(--border);border-radius:4px;padding:8px;color:var(--text-primary);resize:vertical"></textarea>
        </div>`;
    }

    showModal(
        appId ? 'Edit Application' : 'New Application',
        '',   // body handled via tabs
        async () => {
            try {
                const payload = parseCleanJson(document.getElementById('unified-json-editor').value);
                if (!payload.company || !payload.role) {
                    toast('Company and Role are required in JSON', 'error');
                    return false;
                }
                const confirmBtn = document.getElementById('modal-confirm-btn');
                if (confirmBtn) {
                    confirmBtn.disabled = true;
                    confirmBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1.1em;vertical-align:middle;line-height:1">hourglass_empty</span> Saving & Generating...';
                }
                setSaveIndicator('saving');
                if (appId) {
                    await trackerApi.update(appId, payload);
                    toast('Application updated and PDF built successfully.', 'success');
                } else {
                    await trackerApi.create(payload);
                    toast('Application created and PDF built successfully.', 'success');
                }
                setSaveIndicator('saved');
                await loadTracker();
                return true;
            } catch (e) {
                toast('Invalid JSON format or Save Error: ' + e.message, 'error');
                const confirmBtn = document.getElementById('modal-confirm-btn');
                if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Save Application'; }
                return false;
            }
        },
        'Save Application',
        {
            tabs: [
                { label: 'Application JSON', icon: '<span class="material-symbols-outlined" style="font-size:1em">description</span>', content: jsonPaneHtml },
                { label: 'Details',          icon: '<span class="material-symbols-outlined" style="font-size:1em">list_alt</span>',  content: detailsPaneHtml },
                { label: 'Email',            icon: '<span class="material-symbols-outlined" style="font-size:1em">mail</span>',        content: emailPaneHtml },
            ],
            onTabChange: (newIdx) => {
                if (newIdx === 1) window.syncDetailsTabFromJson();
                if (newIdx === 2) window.syncEmailTabFromJson();
            },
            headerHtml: headerHtml || undefined
        }
    );

    setTimeout(() => {
        window.onUnifiedJsonInput(document.getElementById('unified-json-editor').value);
    }, 100);
}

// ── Scrape Job URL Handler ──────────────────────────────────────────────────

window.scrapeJobUrlHandler = async function() {
    const input = document.getElementById('scrape-url-input');
    const status = document.getElementById('scrape-status');
    const result = document.getElementById('scrape-result');
    const output = document.getElementById('scrape-prompt-output');
    const btn = document.getElementById('scrape-btn');
    const url = input ? input.value.trim() : '';
    if (!url) { toast('Please enter a job URL.', 'error'); return; }
    if (btn) btn.disabled = true;
    if (status) { status.style.display = 'inline'; status.textContent = 'Scraping...'; }
    try {
        const data = await api.scrapeJobUrl(url);
        if (output) output.value = data.prompt;
        if (result) result.style.display = 'flex';
        if (status) { status.textContent = 'Done ✓'; status.style.color = 'var(--success)'; }
        toast('Page scraped successfully! Copy the prompt and use with AI.', 'success');
    } catch (e) {
        toast('Scrape failed: ' + e.message, 'error');
        if (status) { status.textContent = 'Failed'; status.style.color = 'var(--danger)'; }
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.copyScrapedPrompt = function() {
    const output = document.getElementById('scrape-prompt-output');
    if (!output || !output.value) { toast('Nothing to copy.', 'error'); return; }
    navigator.clipboard.writeText(output.value)
        .then(() => toast('Prompt copied! Paste it to your AI.', 'success'))
        .catch(() => toast('Failed to copy.', 'error'));
};

// ── Details Tab Helpers ───────────────────────────────────────────────────────

/** Pull data from JSON editor into the Details form fields */
window.syncDetailsTabFromJson = function() {
    const editor = document.getElementById('unified-json-editor');
    if (!editor) return;
    let payload;
    try { payload = parseCleanJson(editor.value); } catch { return; }
    const f = (id) => document.getElementById(id);
    const setVal = (id, val) => { const el = f(id); if (el) el.value = val ?? ''; };
    setVal('dt-company',      payload.company);
    setVal('dt-role',         payload.role);
    setVal('dt-status',       payload.status);
    setVal('dt-priority',     payload.priority);
    setVal('dt-location',     payload.location);
    setVal('dt-platform',     payload.platform);
    setVal('dt-job-type',     payload.job_type);
    setVal('dt-source',       payload.source);
    setVal('dt-deadline',     payload.deadline || payload.deadline_date || '');
    setVal('dt-salary',       payload.salary_range || payload.salary || '');
    setVal('dt-contact-name', payload.contact_name || (payload.contact && payload.contact.name) || '');
    setVal('dt-contact-email',payload.contact_email || (payload.contact && payload.contact.email) || '');
    setVal('dt-job-url',      payload.job_url || payload.url || '');
    setVal('dt-assigned-pdf', payload.assigned_pdf || payload.pdf || '');
    setVal('dt-notes',        payload.notes || '');
    setVal('dt-jd',           payload.job_description || payload.jd || '');
    // Set the deadline input as a date value (YYYY-MM-DD) if present
    const dl = f('dt-deadline');
    if (dl && payload.deadline) {
        try {
            const d = new Date(payload.deadline);
            if (!isNaN(d.getTime())) dl.value = d.toISOString().slice(0,10);
        } catch {}
    }
};

/** Push form field changes back into the JSON editor */
window.onDetailsFieldChange = function() {
    const editor = document.getElementById('unified-json-editor');
    if (!editor) return;
    let payload;
    try { payload = parseCleanJson(editor.value); } catch { payload = {}; }
    const g = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    payload.company       = g('dt-company');
    payload.role          = g('dt-role');
    payload.status        = g('dt-status');
    payload.priority      = g('dt-priority');
    payload.location      = g('dt-location');
    payload.platform      = g('dt-platform');
    payload.job_type      = g('dt-job-type');
    payload.source        = g('dt-source');
    payload.deadline      = g('dt-deadline');
    payload.salary_range  = g('dt-salary');
    payload.contact_name  = g('dt-contact-name');
    payload.contact_email = g('dt-contact-email');
    payload.job_url       = g('dt-job-url');
    payload.assigned_pdf  = g('dt-assigned-pdf');
    payload.notes         = g('dt-notes');
    payload.job_description = g('dt-jd');
    editor.value = JSON.stringify(payload, null, 2);
    window.onUnifiedJsonInput(editor.value);
};

// ── Email Tab Helpers ─────────────────────────────────────────────────────────

/** Extract recipient email from notes string or direct contact_email field */
function extractRecipientEmail(payload) {
    // Check notes string for an email pattern
    if (payload.notes && typeof payload.notes === 'string') {
        const m = payload.notes.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
        if (m) return m[0];
    }
    if (payload.contact_email) return payload.contact_email;
    return '';
}

/** Sync email tab fields from the current JSON editor content */
window.syncEmailTabFromJson = () => {
    const editorEl = document.getElementById('unified-json-editor');
    if (!editorEl) return;
    let payload;
    try { payload = parseCleanJson(editorEl.value); } catch { return; }

    const email = payload.email || {};
    const to    = email.to || extractRecipientEmail(payload);

    const toEl  = document.getElementById('email-to');
    const ccEl  = document.getElementById('email-cc');
    const subEl = document.getElementById('email-subject');
    const bodEl = document.getElementById('email-body');
    const warnEl= document.getElementById('email-no-recipient-warning');
    const gmailBtn = document.getElementById('email-gmail-btn');

    if (toEl)  toEl.value  = to;
    if (ccEl)  ccEl.value  = email.cc || '';
    if (subEl) subEl.value = email.subject || '';
    if (bodEl) bodEl.value = email.body    || '';

    const hasRecipient = to.trim().length > 0;
    if (warnEl)   warnEl.style.display   = hasRecipient ? 'none' : 'flex';
    if (gmailBtn) gmailBtn.disabled       = !hasRecipient;
};

/** Push email field edits back into JSON editor */
window.onEmailFieldChange = () => {
    const editorEl = document.getElementById('unified-json-editor');
    if (!editorEl) return;
    let payload;
    try { payload = parseCleanJson(editorEl.value); } catch { return; }

    const subEl = document.getElementById('email-subject');
    const bodEl = document.getElementById('email-body');
    const toEl  = document.getElementById('email-to');
    const ccEl  = document.getElementById('email-cc');

    if (!payload.email) payload.email = {};
    if (toEl)  payload.email.to      = toEl.value;
    if (ccEl)  payload.email.cc      = ccEl.value;
    if (subEl) payload.email.subject = subEl.value;
    if (bodEl) payload.email.body    = bodEl.value;
    if (toEl && toEl.value) payload.contact_email = toEl.value;

    editorEl.value = formatAppJsonWithComments(payload);
    window.onUnifiedJsonInput(editorEl.value);

    // Update Gmail button state
    const gmailBtn = document.getElementById('email-gmail-btn');
    const warnEl   = document.getElementById('email-no-recipient-warning');
    const hasEmail = toEl && toEl.value.trim().length > 0;
    if (gmailBtn) gmailBtn.disabled = !hasEmail;
    if (warnEl)   warnEl.style.display = hasEmail ? 'none' : 'flex';
};

/** Build a full email body with signature appended */
function buildFullEmailBody(body) {
    const sig = (MASTER_INSTRUCTION.master_instruction?.email_rules?.signature) || {};
    const name = sig.name || 'Bibin Raju';
    const phone = sig.phone || '+91 90740 85302';
    const email = sig.email || 'bibinraju541@gmail.com';
    const linkedin = sig.linkedin || 'linkedin.com/in/bibinraju';
    const bodyTrimmed = (body || '').trim();
    const sigBlock = `\n\n${name}\n${phone}\n${email}\n${linkedin}`;
    // Only append signature if not already present
    if (bodyTrimmed && bodyTrimmed.includes(name) && bodyTrimmed.includes(phone)) {
        return bodyTrimmed;
    }
    return bodyTrimmed + sigBlock;
}

/** Toggle edit / preview mode */
window.setEmailMode = (mode) => {
    const editDiv    = document.getElementById('email-edit-mode');
    const previewDiv = document.getElementById('email-preview-mode');
    const editBtn    = document.getElementById('email-mode-edit');
    const prevBtn    = document.getElementById('email-mode-preview');
    if (!editDiv || !previewDiv) return;

    if (mode === 'preview') {
        // Build preview content
        const to  = document.getElementById('email-to')?.value  || '';
        const cc  = document.getElementById('email-cc')?.value  || '';
        const sub = document.getElementById('email-subject')?.value || '';
        const bod = document.getElementById('email-body')?.value    || '';
        const box = document.getElementById('email-preview-box');
        if (box) {
            const sig = (MASTER_INSTRUCTION.master_instruction?.email_rules?.signature) || {};
            const senderName  = sig.name || 'Bibin Raju';
            const senderEmail = sig.email || 'bibinraju541@gmail.com';
            const fullBody = buildFullEmailBody(bod);
            const ccLine = cc ? `<div style="color:#6b7280;white-space:nowrap">CC:</div><div style="color:#111827">${esc(cc)}</div>` : '';
            box.innerHTML = `
                <div style="border-bottom:1px solid #e5e7eb;padding:16px 24px;background:#f9fafb">
                    <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:12px;line-height:1.7">
                        <div style="color:#6b7280;white-space:nowrap">From:</div>
                        <div style="color:#111827;font-weight:500">${esc(senderName)} &lt;${esc(senderEmail)}&gt;</div>
                        <div style="color:#6b7280;white-space:nowrap">To:</div>
                        <div style="color:#111827">${esc(to)}</div>
                        ${ccLine}
                        <div style="color:#6b7280;white-space:nowrap">Subject:</div>
                        <div style="color:#111827;font-weight:600">${esc(sub)}</div>
                    </div>
                </div>
                <div style="padding:20px 24px;white-space:pre-wrap;font-size:13px;line-height:1.9;color:#374151">${esc(fullBody)}</div>
            `;
        }
        editDiv.style.display    = 'none';
        previewDiv.style.display = 'flex';
        if (editBtn) editBtn.classList.remove('active');
        if (prevBtn) prevBtn.classList.add('active');
    } else {
        editDiv.style.display    = 'flex';
        previewDiv.style.display = 'none';
        if (editBtn) editBtn.classList.add('active');
        if (prevBtn) prevBtn.classList.remove('active');
    }
};

/** Open Gmail compose with pre-filled fields */
window.emailOpenGmail = () => {
    const to  = document.getElementById('email-to')?.value.trim()      || '';
    const cc  = document.getElementById('email-cc')?.value.trim()      || '';
    const sub = document.getElementById('email-subject')?.value.trim() || '';
    const bod = document.getElementById('email-body')?.value            || '';
    if (!to) { toast('Please enter a recipient email address first.', 'error'); return; }
    const fullBody = buildFullEmailBody(bod);
    let url = `https://mail.google.com/mail/?view=cm&fs=1`
            + `&to=${encodeURIComponent(to)}`
            + `&su=${encodeURIComponent(sub)}`
            + `&body=${encodeURIComponent(fullBody)}`;
    if (cc) url += `&cc=${encodeURIComponent(cc)}`;
    window.open(url, '_blank');
};

/** Copy just the subject line */
window.emailCopySubject = () => {
    const sub = document.getElementById('email-subject')?.value || '';
    if (!sub) { toast('Subject is empty.', 'error'); return; }
    navigator.clipboard.writeText(sub)
        .then(() => toast('Subject copied!', 'success'))
        .catch(() => toast('Failed to copy subject.', 'error'));
};

/** Copy just the body */
window.emailCopyBody = () => {
    const bod = document.getElementById('email-body')?.value || '';
    if (!bod) { toast('Email body is empty.', 'error'); return; }
    navigator.clipboard.writeText(bod)
        .then(() => toast('Email body copied!', 'success'))
        .catch(() => toast('Failed to copy body.', 'error'));
};

/** Copy the full email (subject + body with signature) */
window.emailCopyAll = () => {
    const sub = document.getElementById('email-subject')?.value || '';
    const bod = document.getElementById('email-body')?.value    || '';
    if (!sub && !bod) { toast('Email is empty.', 'error'); return; }
    const fullBody = buildFullEmailBody(bod);
    const full = `Subject: ${sub}\n\n${fullBody}`;
    navigator.clipboard.writeText(full)
        .then(() => toast('Full email copied!', 'success'))
        .catch(() => toast('Failed to copy email.', 'error'));
};

// ── Aliases for legacy HTML calls ─────────────────────────────────────────────
export function openNewAppModal() {
    openAppStudio(null);
}

export function openAppEditor(appId) {
    openAppStudio(appId);
}

// ── Delete Application ────────────────────────────────────────────────────────
export async function deleteApp(appId) {
    const app = applications.find(a => a.id === appId);
    if (!app || !confirm(`Delete application: ${app.company} - ${app.role}?\n\nThis cannot be undone.`)) return;
    
    setSaveIndicator('saving');
    await trackerApi.delete(appId);
    setSaveIndicator('saved');
    toast('Application deleted', 'success');
    applications = applications.filter(a => a.id !== appId);
    renderGrid();
}

// ── Live Preview & Helpers ────────────────────────────────────────────────────
window._previewType = 'resume';

window.setUnifiedPreviewType = (type) => {
    window._previewType = type;
    const resBtn = document.getElementById('preview-type-resume');
    const covBtn = document.getElementById('preview-type-cover');
    if (resBtn && covBtn) {
        if (type === 'resume') {
            resBtn.style.background = 'var(--accent)';
            resBtn.style.color = 'white';
            covBtn.style.background = 'transparent';
            covBtn.style.color = 'inherit';
        } else {
            covBtn.style.background = 'var(--accent)';
            covBtn.style.color = 'white';
            resBtn.style.background = 'transparent';
            resBtn.style.color = 'inherit';
        }
    }
    window.onUnifiedJsonInput(document.getElementById('unified-json-editor').value);
};

window.onUnifiedJsonInput = (val) => {
    const errorDiv = document.getElementById('unified-json-error');
    let payload = null;
    try {
        payload = parseCleanJson(val);
        if (errorDiv) errorDiv.style.display = 'none';
    } catch (e) {
        if (errorDiv) {
            errorDiv.textContent = `JSON Error: ${e.message}`;
            errorDiv.style.display = 'block';
        }
        return; // Don't generate preview if JSON is invalid
    }
    
    // Debounced preview
    clearTimeout(window._previewDebounceTimer);
    const statusEl = document.getElementById('unified-preview-status');
    if (statusEl) statusEl.innerHTML = '<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">hourglass_empty</span> Generating...';
    
    window._previewDebounceTimer = setTimeout(async () => {
        try {
            const config = payload.resume_template;
            
            if (!config || Object.keys(config).length === 0) {
                if (statusEl) statusEl.innerHTML = '<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">description</span> No resume template found in JSON';
                
                // If no template in json but app has an assigned_pdf already (legacy apps), we can preview that.
                if (payload.assigned_pdf) {
                     const blobUrl = `/pdf/${encodeURIComponent(payload.assigned_pdf)}`;
                     const iframe = document.getElementById('unified-preview-iframe');
                     if (iframe) iframe.src = blobUrl + '#toolbar=0&view=FitH';
                     
                     const openLink = document.getElementById('unified-preview-open');
                     if (openLink) { openLink.href = blobUrl; openLink.style.display = 'inline'; }
                     
                     const downloadLink = document.getElementById('unified-preview-download');
                     if (downloadLink) {
                         downloadLink.href = blobUrl; 
                         downloadLink.download = payload.assigned_pdf;
                         downloadLink.style.display = 'inline'; 
                     }
                     if (statusEl) statusEl.innerHTML = '<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">description</span> Existing PDF Preview';
                }
                return;
            }
            
            let pdfName = payload.assigned_pdf || 'preview.pdf';
            if (!pdfName.endsWith('.pdf')) pdfName += '.pdf';
            
            const appId = window._currentEditingApp ? window._currentEditingApp.id : "preview";
            
            const response = await fetch(`/api/preview-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_id: appId,
                    config: config,
                    pdf_name: pdfName,
                    type: window._previewType
                })
            });
            
            if (!response.ok) throw new Error('Preview generation failed');
            
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const iframe = document.getElementById('unified-preview-iframe');
            if (iframe) iframe.src = blobUrl + '#toolbar=0&view=FitH';
            
            const openLink = document.getElementById('unified-preview-open');
            if (openLink) { openLink.href = blobUrl; openLink.style.display = 'inline'; }
            
            const downloadLink = document.getElementById('unified-preview-download');
            if (downloadLink) {
                downloadLink.href = blobUrl;
                if (window._previewType === 'cover_letter') {
                    pdfName = pdfName.replace('.pdf', '_Cover_Letter.pdf');
                }
                downloadLink.download = pdfName;
                downloadLink.style.display = 'inline';
            }
            if (statusEl) statusEl.innerHTML = '<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">check_circle</span> PDF Preview';
        } catch (err) {
            console.error('Preview error:', err);
            if (statusEl) statusEl.innerHTML = '<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">warning</span> Preview failed';
        }
    }, 800);
};

window.copyForAI = () => {
    const prompt = `You are an Expert ATS Resume Optimizer, Career Assistant, and Application Manager.

=== MASTER INSTRUCTION ===
${JSON.stringify(MASTER_INSTRUCTION, null, 2)}

=== APPLICATION SCHEMA (fill this completely) ===
${JSON.stringify(APPLICATION_SCHEMA, null, 2)}`;

    navigator.clipboard.writeText(prompt).then(() => {
        toast('Copied AI Prompt to clipboard!', 'success');
    }).catch(err => {
        console.error('Could not copy', err);
        toast('Failed to copy', 'error');
    });
};

window.exportToLocalFolder = async function() {
    const payloadStr = document.getElementById('unified-json-editor')?.value;
    if (!payloadStr) return;
    
    let pdfName = "";
    try {
        const payload = parseCleanJson(payloadStr);
        pdfName = payload.assigned_pdf;
    } catch(e) {}
    
    if (!pdfName) {
        toast('No assigned PDF found in JSON.', 'error');
        return;
    }
    if (pdfName.endsWith('.pdf')) {
        pdfName = pdfName.slice(0, -4);
    }

    toast('Exporting PDF to local folder...', 'info');
    try {
        const res = await fetch('/api/export-pdf-local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdf_name: pdfName })
        });
        const data = await res.json();
        if (res.ok) {
            toast(`Saved to folder!`, 'success');
        } else {
            toast(`Export failed: ${data.detail || data.error}`, 'error');
        }
    } catch (e) {
        toast(`Error: ${e.message}`, 'error');
    }
};

export function setupSearch() {
    const searchEl = document.getElementById('app-search');
    if (searchEl) {
        searchEl.addEventListener('input', (e) => {
            filterSearch = e.target.value;
            renderGrid();
        });
    }

    const sortEl = document.getElementById('app-sort');
    if (sortEl) {
        sortEl.addEventListener('change', (e) => {
            sortBy = e.target.value;
            renderGrid();
        });
    }
}

window.filterByStatus = function(status) {
    filterStatus = filterStatus === status ? '' : status;
    renderGrid();
};

// ── Init ──────────────────────────────────────────────────────────────────────
export function initTracker(resumeState) {
    window._resumeState = resumeState;

    window.closeModal = closeModal;
    window.openNewAppModal = openNewAppModal;
    window.openAppEditor = openAppEditor;
    window.deleteApp = deleteApp;
    
    setupSearch();
}


