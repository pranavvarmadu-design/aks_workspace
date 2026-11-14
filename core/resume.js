// Renders a tailored resume (the JSON the Tailor agent returns) to HTML,
// Markdown and a Word-openable .doc.

export const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function resumeToMarkdown(r) {
  const out = [`# ${r.name}`, [r.headline, r.contact].filter(Boolean).join('  \n'), ''];
  if (r.summary) out.push('## Summary', r.summary, '');
  for (const s of r.sections || []) {
    out.push(`## ${s.title}`);
    for (const e of s.entries || []) {
      const head = [e.heading, e.subheading].filter(Boolean).join(', ');
      if (head) out.push(`**${head}**${e.dates ? ` (${e.dates})` : ''}`);
      for (const b of e.bullets || []) out.push(`- ${b}`);
      out.push('');
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

const CSS = `
  body{font-family:Georgia,'Times New Roman',serif;color:#111;max-width:780px;margin:24px auto;padding:0 24px;font-size:11pt;line-height:1.35}
  h1{font-size:20pt;margin:0 0 2px}
  .headline{font-size:11pt;color:#333}
  .contact{font-size:9.5pt;color:#444;margin-bottom:10px}
  h2{font-size:11pt;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #999;margin:14px 0 6px;padding-bottom:2px}
  .entry{margin-bottom:8px;page-break-inside:avoid}
  .row{display:flex;justify-content:space-between;gap:12px}
  .heading{font-weight:bold}
  .dates{white-space:nowrap;color:#333}
  ul{margin:3px 0 0 18px;padding:0}
  li{margin-bottom:2px}
  @media print{body{margin:0;max-width:none;padding:0}@page{margin:16mm}}
`;

export function resumeToHtml(r, { standalone = true } = {}) {
  const body = [
    `<h1>${esc(r.name)}</h1>`,
    r.headline ? `<div class="headline">${esc(r.headline)}</div>` : '',
    r.contact ? `<div class="contact">${esc(r.contact)}</div>` : '',
    r.summary ? `<h2>Summary</h2><p>${esc(r.summary)}</p>` : '',
    ...(r.sections || []).map((s) =>
      `<h2>${esc(s.title)}</h2>` +
      (s.entries || []).map((e) => {
        const head = [e.heading, e.subheading].filter(Boolean).map(esc).join(', ');
        return `<div class="entry">${head || e.dates ? `<div class="row"><span class="heading">${head}</span><span class="dates">${esc(e.dates || '')}</span></div>` : ''}` +
          ((e.bullets || []).length ? `<ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '') + '</div>';
      }).join('')),
  ].join('\n');
  if (!standalone) return body;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.name)} - Resume</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

export const RESUME_CSS = CSS;
