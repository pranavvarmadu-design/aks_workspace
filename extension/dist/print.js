var e=(t="")=>String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");var l=`
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
`;function m(t,{standalone:r=!0}={}){let a=[`<h1>${e(t.name)}</h1>`,t.headline?`<div class="headline">${e(t.headline)}</div>`:"",t.contact?`<div class="contact">${e(t.contact)}</div>`:"",t.summary?`<h2>Summary</h2><p>${e(t.summary)}</p>`:"",...(t.sections||[]).map(i=>`<h2>${e(i.title)}</h2>`+(i.entries||[]).map(n=>{let s=[n.heading,n.subheading].filter(Boolean).map(e).join(", ");return`<div class="entry">${s||n.dates?`<div class="row"><span class="heading">${s}</span><span class="dates">${e(n.dates||"")}</span></div>`:""}`+((n.bullets||[]).length?`<ul>${n.bullets.map(d=>`<li>${e(d)}</li>`).join("")}</ul>`:"")+"</div>"}).join(""))].join(`
`);return r?`<!doctype html><html><head><meta charset="utf-8"><title>${e(t.name)} - Resume</title><style>${l}</style></head><body>${a}</body></html>`:a}var p=l;var{printDoc:o}=await chrome.storage.local.get("printDoc");o&&(document.title=`${o.name} - Resume`,document.getElementById("css").textContent=p,document.body.innerHTML=m(o,{standalone:!1}),print());
