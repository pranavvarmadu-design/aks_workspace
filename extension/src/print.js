import { resumeToHtml, RESUME_CSS } from '../../core/resume.js';

const { printDoc } = await chrome.storage.local.get('printDoc');
if (printDoc) {
  document.title = `${printDoc.name} - Resume`;
  document.getElementById('css').textContent = RESUME_CSS;
  document.body.innerHTML = resumeToHtml(printDoc, { standalone: false });
  print();
}
