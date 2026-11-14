// The resume agents. Each is one Claude call with a JSON-schema response;
// buildTailoredResume chains analyst -> tailor -> reviewer.

import Anthropic from '@anthropic-ai/sdk';
import { AGENTS } from '../../core/prompts.js';

// Models with server-side refusal fallback.
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-2']);

function client(settings) {
  if (!settings.anthropicKey) throw new Error('Add your Anthropic API key in Settings first.');
  // The key is hers and stays in this browser; requests go straight to api.anthropic.com.
  return new Anthropic({ apiKey: settings.anthropicKey, dangerouslyAllowBrowser: true });
}

async function runAgent(settings, agent, userText, { effort = 'medium', maxTokens = 16000 } = {}) {
  const fallback = FALLBACK_MODELS.has(settings.model)
    ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }
    : {};
  let message;
  try {
    message = await client(settings).beta.messages
      .stream({
        model: settings.model,
        max_tokens: maxTokens,
        system: agent.system,
        messages: [{ role: 'user', content: userText }],
        output_config: { effort, format: { type: 'json_schema', schema: agent.schema } },
        ...fallback,
      })
      .finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('The Anthropic API key was rejected. Check it in Settings.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new Error('This API key cannot use the selected model. Pick another model in Settings.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('Rate limited by the Claude API. Wait a minute and try again.');
    if (e instanceof Anthropic.APIConnectionError) throw new Error('Could not reach the Claude API. Check the internet connection.');
    if (e instanceof Anthropic.APIError) throw new Error(`Claude API error ${e.status}: ${e.message}`);
    throw e;
  }
  if (message.stop_reason === 'refusal') throw new Error('Claude declined this request.');
  if (message.stop_reason === 'max_tokens') throw new Error('The response was cut off. Try a shorter resume or job description.');
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Claude returned a response that could not be read. Try again.');
  }
}

export const extractProfile = (settings, resume) =>
  runAgent(settings, AGENTS.profile, AGENTS.profile.user(resume), { effort: 'low', maxTokens: 4000 });

export async function buildTailoredResume(settings, resume, job, opts, onStep = () => {}) {
  if (!resume.trim()) throw new Error('Paste your resume in the Resume tab first.');
  onStep('analyst');
  const analysis = await runAgent(settings, AGENTS.analyst, AGENTS.analyst.user(job), { effort: 'low', maxTokens: 6000 });
  onStep('tailor');
  const tailored = await runAgent(settings, AGENTS.tailor, AGENTS.tailor.user(resume, job, analysis, opts), { effort: 'high', maxTokens: 32000 });
  onStep('reviewer');
  const review = await runAgent(settings, AGENTS.reviewer, AGENTS.reviewer.user(resume, tailored, analysis), { effort: 'medium', maxTokens: 8000 });
  return { analysis, resume: tailored, review, builtAt: new Date().toISOString() };
}
