// Emails a digest of newly found jobs. Skipped unless SMTP_* and DIGEST_TO are set.

import { MARKETS, SECTORS } from '../core/config.js';
import { esc } from '../core/resume.js';

export function digestHtml(jobs) {
  const groups = new Map();
  for (const j of jobs) {
    const label = j.category === 'university'
      ? `Universities: ${MARKETS[j.market]?.label || j.market}`
      : `India industry: ${SECTORS[j.sector]?.label || j.sector}`;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(j);
  }
  let html = `<p>${jobs.length} new listing${jobs.length === 1 ? '' : 's'} since the last run.</p>`;
  for (const [label, list] of [...groups].sort()) {
    html += `<h3>${esc(label)} (${list.length})</h3><ul>`;
    for (const j of list.slice(0, 25))
      html += `<li><a href="${esc(j.url)}">${esc(j.title)}</a>, ${esc(j.company)}${j.location ? ` (${esc(j.location)})` : ''} · match ${j.score}</li>`;
    if (list.length > 25) html += `<li>and ${list.length - 25} more in the extension</li>`;
    html += '</ul>';
  }
  return html;
}

export async function sendDigest(jobs, env) {
  if (!env.SMTP_HOST || !env.DIGEST_TO) return false;
  const { default: nodemailer } = await import('nodemailer');
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: Number(env.SMTP_PORT) === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({
    from: env.DIGEST_FROM || env.SMTP_USER,
    to: env.DIGEST_TO,
    subject: `${jobs.length} new job listing${jobs.length === 1 ? '' : 's'}`,
    html: digestHtml(jobs),
  });
  return true;
}
