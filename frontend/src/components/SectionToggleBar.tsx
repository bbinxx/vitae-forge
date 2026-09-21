import React from 'react';

interface SectionToggleBarProps {
  sections?: Record<string, boolean>;
  onToggleSection: (key: string) => void;
}

const DEFAULT_SECTIONS = [
  { key: 'role_title', label: 'Role Title' },
  { key: 'summary', label: 'Summary' },
  { key: 'skills', label: 'Skills' },
  { key: 'experience', label: 'Experience' },
  { key: 'projects', label: 'Projects' },
  { key: 'education', label: 'Education' },
  { key: 'certifications', label: 'Certifications' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'areas_of_interest', label: 'Areas of Interest' },
  { key: 'languages', label: 'Languages' },
  { key: 'additional_info', label: 'Additional Info' },
  { key: 'cover_letter', label: 'Cover Letter' }
];

export default function SectionToggleBar({ sections = {}, onToggleSection }: SectionToggleBarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', padding: '6px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px' }}>
      <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginRight: '2px' }}>PDF Sections:</span>
      {DEFAULT_SECTIONS.map(({ key, label }) => {
        const isEnabled = sections[key] !== false;
        return (
          <button
            key={key}
            type="button"
            className={`sec-toggle-btn ${isEnabled ? 'active' : 'disabled'}`}
            title={isEnabled ? `Click to disable ${label} section` : `Click to enable ${label} section`}
            onClick={() => onToggleSection(key)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
