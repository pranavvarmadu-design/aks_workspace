// chrome.storage.local wrapper shared by the service worker and the side panel.

import { DEFAULT_PROFILE, DEFAULT_SOURCES } from '../../core/config.js';

export const DEFAULT_SETTINGS = {
  anthropicKey: '',
  model: 'claude-opus-5-5',
  adzunaAppId: '',
  adzunaAppKey: '',
  backendUrl: '',
  backendToken: '',
  profile: DEFAULT_PROFILE,
  sources: DEFAULT_SOURCES,
};

const DEFAULTS = {
  settings: DEFAULT_SETTINGS,
  resume: '',
  candidate: '', // her own skills and constraints notes
  jobs: [], // collected listings
  captured: [], // jobs she saved from pages she was viewing
  jobState: {}, // id -> 'saved' | 'applied' | 'hidden'
  tailored: {}, // id -> { resume, analysis, review, builtAt }
  details: {}, // id -> { text, at }: posting text read on request
  status: null, // { lastRun, report, mode }
  seenAt: null, // ISO time she last looked at the list
};

export async function load(...keys) {
  const got = await chrome.storage.local.get(keys.length ? keys : Object.keys(DEFAULTS));
  const out = {};
  for (const k of keys.length ? keys : Object.keys(DEFAULTS)) out[k] = got[k] ?? structuredClone(DEFAULTS[k]);
  if (out.settings) out.settings = { ...DEFAULT_SETTINGS, ...out.settings };
  return out;
}

export const save = (patch) => chrome.storage.local.set(patch);
