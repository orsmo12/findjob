'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Page } from '@/components/layout/Sidebar'

type RunStep = 'idle' | 'manager_open' | 'profile' | 'search' | 'market_scout' | 'mentor' | 'manager_close' | 'done' | 'error'

interface Job {
  id: string; title: string; company: string; location: string; salary?: string
  description: string; url: string; linkedin_url?: string; company_url?: string
  source: string; ats_score: number; match_reasons: string[]; posted_date?: string
}
interface SkillGap { skill: string; priority: 'high'|'medium'|'low'; reason: string; learning_resource?: string; estimated_time?: string }
interface CompanySignal { company: string; job_title: string; job_url: string; ats_score: number; apply_priority: 'high'|'medium'|'low'; priority_reason: string; tech_stack_match: string; culture_signals: string[] }
interface PipelineResult { filtered_jobs: Job[]; skill_gaps: SkillGap[]; company_signals: CompanySignal[]; cover_letters: Record<string,string>; daily_summary: string; career_insight?: string; cv_profile?: Record<string,any>; interview_prep?: Record<string,any>; messages?: string[] }

const STEPS = [
  { id:'manager_open' as RunStep, icon:'🎯', label:'מנהל — אסטרטגיה',  agentName:'מנהל',      color:'#6366f1' },
  { id:'profile'      as RunStep, icon:'👤', label:'פרופיל — ניתוח CV', agentName:'פרופיל',    color:'#ec4899' },
  { id:'search'       as RunStep, icon:'🔍', label:'מחפש — משרות',      agentName:'מחפש',      color:'#06b6d4' },
  { id:'market_scout' as RunStep, icon:'🕵️', label:'חוקר שוק — חברות', agentName:'חוקר שוק',  color:'#8b5cf6' },
  { id:'mentor'       as RunStep, icon:'🧭', label:'מנטור — ייעוץ',     agentName:'מנטור',     color:'#10b981' },
]

// CSS matching Life Building artifact design system
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  --bg: #EEF0F8;
  --surf: #FFFFFF;
  --surf2: #E8EBF5;
  --fg: #1A1A2E;
  --fg2: #5A5A7A;
  --fg3: #9999BB;
  --accent: #5B6CF9;
  --accent-lt: #EEF0FE;
  --brd: #DDE0EE;
  --r: 18px;
  --r-sm: 12px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
.career-root {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--fg);
  min-height: 100dvh;
  max-width: 430px;
  margin: 0 auto;
  position: relative;
  direction: rtl;
  overflow-x: hidden;
}

/* ── TOP BAR ── */
.career-topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  background: var(--surf);
  border-bottom: 1px solid var(--brd);
  padding: 12px 16px 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.career-topbar-av {
  width: 32px; height: 32px;
  border-radius: 10px;
  background: var(--accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; flex-shrink: 0;
}
.career-topbar-title { font-size: 16px; font-weight: 700; color: var(--fg); flex: 1; }
.career-topbar-badge {
  background: var(--accent); color: #fff;
  border-radius: 8px; padding: 3px 8px;
  font-size: 11px; font-weight: 600;
}

/* ── FLOATING BOTTOM NAV ── */
.career-fnav {
  position: fixed;
  bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 430px;
  background: var(--surf);
  border-top: 1px solid var(--brd);
  padding: 8px 12px 16px;
  z-index: 40;
  display: flex;
  gap: 4px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.career-fnav::-webkit-scrollbar { display: none; }
.career-fnav-chip {
  display: flex; align-items: center; gap: 5px;
  padding: 7px 12px;
  border-radius: 20px;
  border: none; background: transparent;
  font-family: inherit; font-size: 12px; font-weight: 500;
  color: var(--fg2); cursor: pointer; white-space: nowrap;
  transition: all 0.18s ease;
  flex-shrink: 0;
}
.career-fnav-chip.sel {
  background: var(--accent-lt);
  color: var(--accent);
  font-weight: 600;
}
.career-fnav-icon { font-size: 14px; }

/* ── BRIEF BANNER ── */
.brief-banner {
  margin: 12px 12px 0;
  padding: 16px;
  border-radius: var(--r);
  background: linear-gradient(135deg, #5B6CF9 0%, #4a5ce8cc 100%);
  color: #fff;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.brief-banner::after {
  content: ''; position: absolute;
  top: -20px; right: -20px;
  width: 80px; height: 80px;
  border-radius: 50%;
  background: rgba(255,255,255,0.07);
}
.brief-banner-top {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 6px;
}
.brief-banner-lbl {
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.75;
}
.brief-banner-time { font-size: 10px; opacity: 0.6; }
.brief-banner-title { font-size: 14px; font-weight: 700; margin-bottom: 3px; line-height: 1.4; }
.brief-banner-sub { font-size: 11px; opacity: 0.75; margin-bottom: 10px; }
.brief-banner-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.brief-chip {
  font-size: 10px; font-weight: 600;
  padding: 3px 9px; border-radius: 10px;
}
.brief-chip.ok { background: rgba(52,199,89,0.2); color: #34C759; }
.brief-chip.warn { background: rgba(255,159,10,0.2); color: #FF9F0A; }
.brief-chip.info { background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9); }

/* ── TODO LIST ── */
.todo-section {
  margin: 12px 12px 0;
  background: var(--surf);
  border-radius: var(--r);
  overflow: hidden;
}
.todo-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 13px 14px 10px;
}
.todo-header-lbl { font-size: 13px; font-weight: 700; color: var(--fg); }
.todo-count { font-size: 11px; color: var(--fg3); font-weight: 500; }
.todo-list {
  max-height: 176px; min-height: 44px;
  overflow-y: auto; scrollbar-width: none;
  padding: 0 14px 6px;
  transition: max-height 0.2s;
}
.todo-list::-webkit-scrollbar { display: none; }
.todo-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid var(--brd);
  cursor: grab;
}
.todo-item:last-child { border-bottom: none; }
.todo-item.dragging { opacity: 0.4; }
.todo-item.drag-over { background: var(--surf2); border-radius: 8px; }
.todo-check {
  width: 18px; height: 18px; flex-shrink: 0;
  border: 2px solid var(--fg3);
  border-radius: 5px; cursor: pointer;
  margin-top: 1px;
  transition: all 0.15s;
}
.todo-check.done {
  background: #34C759; border-color: #34C759;
  position: relative;
}
.todo-check.done::after {
  content: '✓';
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; color: #fff; font-weight: 700;
}
.todo-text { font-size: 12px; color: var(--fg2); line-height: 1.5; flex: 1; }
.todo-text.done { text-decoration: line-through; color: var(--fg3); }
.todo-drag-handle { color: var(--fg3); font-size: 14px; cursor: grab; margin-top: 2px; }
.todo-resize {
  height: 20px;
  display: flex; align-items: center; justify-content: center;
  cursor: ns-resize;
  border-top: 1px solid var(--brd);
}
.todo-resize-dot { width: 32px; height: 3px; background: var(--fg3); border-radius: 2px; opacity: 0.4; }

/* ── RUN SECTION ── */
.run-section {
  margin: 12px 12px 0;
  background: var(--surf);
  border-radius: var(--r);
  padding: 14px;
}
.run-row {
  display: flex; gap: 8px; margin-bottom: 10px;
}
.run-btn {
  flex: 1; padding: 13px 8px;
  border-radius: var(--r-sm);
  border: none; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 700;
  background: var(--accent); color: #fff;
  transition: opacity 0.15s, transform 0.1s;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.run-btn:active { transform: scale(0.97); }
.run-btn:disabled { opacity: 0.45; cursor: default; transform: none; }
.run-btn.secondary {
  background: var(--surf2); color: var(--fg);
  font-weight: 600;
}

/* ── PIPELINE STEPS ── */
.pipeline-steps {
  display: flex; flex-direction: column; gap: 6px;
  margin-top: 8px;
}
.pipeline-step {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  border-radius: var(--r-sm);
  background: var(--bg);
  border: 1px solid var(--brd);
  transition: all 0.25s ease;
}
.pipeline-step.active {
  background: var(--accent-lt);
  border-color: var(--accent);
}
.pipeline-step.done {
  border-color: rgba(52,199,89,0.3);
}
.step-icon { font-size: 16px; }
.step-info { flex: 1; }
.step-label { font-size: 12px; font-weight: 600; color: var(--fg); }
.step-sub { font-size: 10px; color: var(--fg3); margin-top: 2px; }
.step-status { font-size: 13px; }
.step-spinner {
  display: inline-block;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── AGENT NOTIF CARDS (horizontal scroll) ── */
.agent-msgs-section { margin: 12px 12px 0; }
.agent-msgs-lbl { font-size: 12px; font-weight: 700; color: var(--fg2); margin-bottom: 8px; }
.agent-msgs-row {
  display: flex; gap: 10px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 4px;
}
.agent-msgs-row::-webkit-scrollbar { display: none; }
.agent-notif-card {
  flex: 0 0 200px;
  background: var(--surf);
  border: 1px solid var(--brd);
  border-radius: var(--r);
  padding: 12px;
  cursor: pointer;
  transition: transform 0.15s;
}
.agent-notif-card:active { transform: scale(0.97); }
.agent-notif-av {
  width: 36px; height: 36px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; margin-bottom: 8px;
}
.agent-notif-name { font-size: 12px; font-weight: 700; color: var(--fg); }
.agent-notif-role { font-size: 10px; color: var(--fg3); margin-bottom: 6px; }
.agent-notif-body { font-size: 11px; color: var(--fg2); line-height: 1.5; }
.agent-notif-time { font-size: 10px; color: var(--fg3); margin-top: 6px; text-align: left; }

/* ── JOB CARDS (swipe stack) ── */
.swipe-section {
  margin: 12px 12px 0;
  position: relative;
}
.swipe-meta { font-size: 11px; color: var(--fg3); margin-bottom: 10px; text-align: center; }
.swipe-stack { position: relative; height: 340px; }
.job-card {
  position: absolute; inset: 0;
  background: var(--surf);
  border-radius: var(--r);
  border: 1px solid var(--brd);
  padding: 16px;
  box-shadow: 0 4px 24px rgba(26,26,46,0.1);
  transition: transform 0.25s ease, opacity 0.25s ease;
  touch-action: pan-y;
  user-select: none;
  cursor: grab;
}
.job-card.back { transform: scale(0.96) translateY(8px); z-index: 1; }
.job-card.back2 { transform: scale(0.92) translateY(16px); z-index: 0; }
.job-card-top { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 10px; }
.job-logo {
  width: 42px; height: 42px; border-radius: 10px;
  background: var(--surf2);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; flex-shrink: 0;
}
.job-title { font-size: 15px; font-weight: 700; color: var(--fg); line-height: 1.3; }
.job-co { font-size: 12px; color: var(--fg2); margin-top: 3px; }
.job-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
.job-tag {
  font-size: 10px; padding: 3px 8px;
  border-radius: 8px;
  background: var(--surf2); color: var(--fg2);
  font-weight: 500;
}
.job-desc {
  font-size: 11px; color: var(--fg2); line-height: 1.6;
  display: -webkit-box; -webkit-line-clamp: 3;
  -webkit-box-orient: vertical; overflow: hidden;
  margin-bottom: 12px;
}
.job-match { display: flex; align-items: center; gap: 10px; }
.job-match-bar-wrap {
  flex: 1; height: 5px; background: var(--surf2);
  border-radius: 3px; overflow: hidden;
}
.job-match-bar { height: 100%; background: var(--accent); border-radius: 3px; transition: width 0.4s; }
.job-match-pct { font-size: 12px; font-weight: 700; color: var(--accent); min-width: 32px; text-align: left; }
.job-link-row { display: flex; gap: 6px; margin-top: 10px; }
.job-link-btn {
  flex: 1; padding: 8px 6px;
  border-radius: var(--r-sm);
  border: 1px solid var(--brd);
  background: var(--surf2);
  font-family: inherit; font-size: 11px; font-weight: 600; color: var(--fg);
  cursor: pointer; text-align: center; text-decoration: none;
  display: flex; align-items: center; justify-content: center; gap: 4px;
}
.job-overlay {
  position: absolute; top: 20px;
  padding: 6px 14px;
  border-radius: 8px; font-size: 13px; font-weight: 800;
  opacity: 0; pointer-events: none; border: 2px solid;
}
.job-overlay.like { left: 16px; color: #22C55E; border-color: #22C55E; transform: rotate(-15deg); }
.job-overlay.nope { right: 16px; color: #EF4444; border-color: #EF4444; transform: rotate(15deg); }
.swipe-actions { display: flex; gap: 10px; margin-top: 10px; }
.swipe-btn {
  flex: 1; padding: 11px;
  border-radius: var(--r-sm);
  border: none; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 700;
  transition: transform 0.1s;
}
.swipe-btn:active { transform: scale(0.96); }
.swipe-btn.skip { background: #FEF2F2; color: #EF4444; }
.swipe-btn.save { background: #F0FDF4; color: #22C55E; }

/* ── APPLICATIONS TAB ── */
.app-card {
  background: var(--surf);
  border-radius: var(--r);
  padding: 14px;
  margin-bottom: 10px;
}
.app-card-top { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
.app-card-logo {
  width: 38px; height: 38px; border-radius: 10px;
  background: var(--surf2);
  display: flex; align-items: center; justify-content: center; font-size: 18px;
}
.app-card-title { font-size: 13px; font-weight: 700; color: var(--fg); }
.app-card-co { font-size: 11px; color: var(--fg3); margin-top: 2px; }
.app-msg-lbl { font-size: 11px; color: var(--fg3); font-weight: 600; margin-bottom: 6px; }
.app-msg-edit {
  width: 100%; min-height: 100px;
  background: var(--bg); border: 1px solid var(--brd);
  border-radius: var(--r-sm); padding: 10px;
  font-family: inherit; font-size: 12px; color: var(--fg);
  resize: vertical; line-height: 1.6; direction: rtl;
}
.app-send-btn {
  width: 100%; margin-top: 10px;
  padding: 11px;
  border-radius: var(--r-sm); border: none;
  background: var(--accent); color: #fff;
  font-family: inherit; font-size: 13px; font-weight: 700;
  cursor: pointer;
}

/* ── ANALYSIS TAB ── */
.analysis-section { padding: 12px 0; }
.analysis-card {
  background: var(--surf);
  border-radius: var(--r);
  padding: 14px;
  margin-bottom: 10px;
}
.analysis-card-title {
  font-size: 12px; font-weight: 700; color: var(--fg2);
  margin-bottom: 10px; display: flex; align-items: center; gap: 6px;
}
.skill-gap-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 0; border-bottom: 1px solid var(--brd);
  font-size: 12px;
}
.skill-gap-item:last-child { border-bottom: none; }
.skill-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.company-item {
  padding: 10px 0; border-bottom: 1px solid var(--brd);
}
.company-item:last-child { border-bottom: none; }
.company-name { font-size: 13px; font-weight: 600; color: var(--fg); }
.company-role { font-size: 11px; color: var(--fg2); margin-top: 2px; }

/* ── DAILY LOG TAB ── */
.log-section { padding: 12px 0; }
.log-card {
  background: var(--surf); border-radius: var(--r); padding: 14px; margin-bottom: 10px;
}
.log-text { font-size: 12px; color: var(--fg2); line-height: 1.7; }

/* ── JOB URL INPUT ── */
.job-url-section {
  background: var(--surf); border-radius: var(--r);
  padding: 14px; margin-top: 10px;
}
.job-url-lbl { font-size: 12px; font-weight: 600; color: var(--fg2); margin-bottom: 8px; }
.job-url-row { display: flex; gap: 8px; }
.job-url-input {
  flex: 1; padding: 10px 12px;
  border-radius: var(--r-sm); border: 1px solid var(--brd);
  background: var(--bg);
  font-family: inherit; font-size: 12px; color: var(--fg);
  direction: ltr;
}
.job-url-btn {
  padding: 10px 14px;
  border-radius: var(--r-sm); border: none;
  background: var(--accent); color: #fff;
  font-family: inherit; font-size: 12px; font-weight: 700;
  cursor: pointer; white-space: nowrap;
}
.job-analysis-result {
  margin-top: 10px; padding: 10px 12px;
  border-radius: var(--r-sm);
  background: var(--surf2);
  font-size: 12px; color: var(--fg2); line-height: 1.6;
}

/* ── RESUME UPLOAD ── */
.resume-upload-zone {
  border: 2px dashed var(--brd);
  border-radius: var(--r-sm);
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
  background: var(--bg);
  margin-bottom: 12px;
}
.resume-upload-zone:hover { border-color: var(--accent); }
.resume-upload-icon { font-size: 28px; margin-bottom: 6px; }
.resume-upload-lbl { font-size: 13px; font-weight: 600; color: var(--fg2); }
.resume-upload-sub { font-size: 11px; color: var(--fg3); margin-top: 3px; }
.resume-file-name { font-size: 11px; color: var(--accent); margin-top: 6px; font-weight: 600; }

/* ── SCROLLABLE CONTENT ── */
.career-scroll {
  padding-bottom: 80px;
}

/* ── BRIEF POPUP ── */
.brief-popup-overlay {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(26,26,46,0.45);
  display: flex; align-items: flex-end;
  opacity: 0; pointer-events: none;
  transition: opacity 0.2s;
}
.brief-popup-overlay.open { opacity: 1; pointer-events: all; }
.brief-popup {
  width: 100%; max-width: 430px; margin: 0 auto;
  background: var(--surf);
  border-radius: var(--r) var(--r) 0 0;
  padding: 20px 16px 32px;
  transform: translateY(100%);
  transition: transform 0.25s ease;
}
.brief-popup-overlay.open .brief-popup { transform: translateY(0); }
.brief-popup-handle {
  width: 36px; height: 4px; background: var(--brd);
  border-radius: 2px; margin: 0 auto 16px;
}
.brief-popup-title { font-size: 15px; font-weight: 700; color: var(--fg); margin-bottom: 4px; }
.brief-popup-sub { font-size: 11px; color: var(--fg3); margin-bottom: 14px; }
.brief-bullet {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px; border-radius: var(--r-sm);
  margin-bottom: 8px;
}
.brief-bullet-dot {
  width: 8px; height: 8px; border-radius: 50%;
  flex-shrink: 0; margin-top: 4px;
}
.brief-bullet-text { flex: 1; font-size: 12px; color: var(--fg2); line-height: 1.5; }
.brief-bullet-tag {
  font-size: 10px; font-weight: 700;
  padding: 2px 8px; border-radius: 8px; white-space: nowrap;
}

/* ── TABS (sub) ── */
.sub-tabs {
  display: flex; gap: 4px;
  padding: 10px 12px 0;
  overflow-x: auto; scrollbar-width: none;
}
.sub-tabs::-webkit-scrollbar { display: none; }
.sub-tab {
  padding: 6px 14px; border-radius: 20px;
  border: none; background: transparent;
  font-family: inherit; font-size: 12px; font-weight: 500;
  color: var(--fg2); cursor: pointer; white-space: nowrap;
  transition: all 0.15s;
}
.sub-tab.active {
  background: var(--accent); color: #fff; font-weight: 600;
}

.pad { padding: 0 12px; }
.todo-add-row { display: flex; gap: 6px; padding: 0 14px 8px; }
.todo-add-input {
  flex: 1; padding: 7px 10px;
  border-radius: 8px; border: 1px solid var(--brd);
  background: var(--bg);
  font-family: inherit; font-size: 12px; color: var(--fg);
  direction: rtl;
}
.todo-add-btn {
  padding: 7px 12px;
  border-radius: 8px; border: none;
  background: var(--accent); color: #fff;
  font-family: inherit; font-size: 12px; font-weight: 600;
  cursor: pointer;
}

.mt10 { margin-top: 10px; }

/* ── EMPTY STATE ── */
.empty-state {
  text-align: center; padding: 48px 24px;
  color: var(--fg3); font-size: 13px;
}
.empty-state-icon { font-size: 36px; margin-bottom: 10px; }
.empty-state-title { font-weight: 600; color: var(--fg2); margin-bottom: 4px; }
`

// Life Building pixel-art avatar draw function (canvas)
function drawFace(canvas: HTMLCanvasElement, charIdx: number, state: string) {
  const CHARS = [
    {skin:'#f1c27d',hair:'#3b2209',shirt:'#ddeaff',tie:'#6f83a8',suit:'#2e3448'},
    {skin:'#f5d5a8',hair:'#9b7a4a',shirt:'#f0c040',tie:'#7a5c30',glasses:true},
    {skin:'#ffdbac',hair:'#7a5030',shirt:'#b8d8f0',tie:'#1a1a1a',rolled:true},
    {skin:'#f6cfa6',hair:'#d4896a',shirt:'#f5f5f5',cardigan:'#dba8c8',woman:true},
    {skin:'#e8b88a',hair:'#2a1a0e',shirt:'#f8f8f8',tie:'#8a6a4a',suit:'#6a6258',balding:true},
  ] as any[]
  canvas.width = 96; canvas.height = 96
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const S = 3; ctx.setTransform(S,0,0,S,0,0); ctx.imageSmoothingEnabled = false
  const W=32, H=32, cx=16, cy=20
  const p = CHARS[charIdx % CHARS.length]
  const R = (x:number,y:number,w:number,h:number,c:string) => { ctx.fillStyle=c; ctx.fillRect(Math.round(x),Math.round(y),w,h) }
  // bg
  R(0,0,W,H,'#E8EBF5')
  // body
  const topC = p.cardigan||p.shirt
  R(cx-6,cy+5,12,10,topC)
  if(p.suit){R(cx*6,cy+5,3,10,p.suit);R(cx+3,cy+5,3,10,p.suit)}
  if(p.cardigan){R(cx-2,cy+5,4,3,p.shirt)}
  if(p.tie){R(cx-1,cy+5,2,8,p.tie)}
  // neck
  R(cx-2,cy+3,4,4,p.skin)
  // head
  R(cx-5,cy-8,10,10,p.skin)
  // ears
  R(cx*6,cy-5,1,3,p.skin); R(cx+5,cy-5,1,3, p.skin)
  // hair
  ctx.fillStyle = p.hair
  if(p.woman){ R(cx-6,cy-9,12,4,p.hair);R(cx-6,cy-9,2,12,p.hair);R(cx*4,cy-9,2,12,p.hair) }
  else if(p.balding){ R(cx-5,cy-9,4,3,p.hair);R(cx+1,cy-9,4,3,p.hair) }
  else if(p.glasses){ R(cx-5,cy-9,4,3,p.hair);R(cx+1,cy-9,4,3,p.hair);R(cx-5,cy-9,2,6,p.hair);R(cx+3,cy-9,2,6,p.hair) }
  else if(p.rolled){ R(cx*5,cy-9,10,4,p.hair);R(cx-6,cy-8,2,7,p.hair);R(cx+4,cy-8,2,6,p.hair) }
  else { R(cx*5,cy-9,10,2,p.hair);R(cx-5,cy-9,2,5,p.hair) }
  // eyes
  const t = performance.now()/1000
  const blink = ((t+(charIdx*.31))%4)<.14
  R(cx-3,cy-4,1,blink?1:2,'#111'); R(cx+2,cy-4,1,blink?1:2,'#111')
  if(state==='sleeping'){R(cx-3,cy-4,2,1,'#555');R(cx+2,cy-4,2,1,'#555')}
  if(p.glasses){ ctx.strokeStyle='#8a7a60';ctx.lineWidth=0.5;ctx.strokeRect(cx-4,cy-5,3,3);ctx.strokeRect(cx+1,cy-5,3,3) }
  // mouth
  if(state==='working'){R(cx-2,cy-1,4,1,'#8a4a3a')}
  else {R(cx-1,cy-1,2,1,'#8a4a3a')}
  // state dot
  const stC:any={working:'#34C759',idle:'#FF9F0A',sleeping:'#AEB1BB'}
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(W-5,H-5,3,0,Math.PI*2);ctx.fill()
  ctx.fillStyle=stC[state]||'#ccc';ctx.beginPath();ctx.arc(W-5,H-5,2,0,Math.PI*2);ctx.fill()
}

function AgentAvatar({ charIdx, state, size=44 }:{ charIdx: number; state: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if(ref.current) drawFace(ref.current, charIdx, state) }, [charIdx, state])
  return <canvas ref={ref} style={{width:size,height:size,borderRadius:'10px',imageRendering:'pixelated',display:'block'}} />
}

// Job data interface for swipe cards
interface SwipeJob extends Job {
  logo: string
  tags: string[]
}

export default function CareerPage({ onNavigate }: { onNavigate?: (p: Page) => void }) {
  const [activeNav, setActiveNav] = useState<'home'|'jobs'|'analysis'|'log'>('home')
  const [subTab, setSubTab] = useState<'jobs'|'applications'>('jobs')
  const [running, setRunning] = useState(false)
  const [currentStep, setCur