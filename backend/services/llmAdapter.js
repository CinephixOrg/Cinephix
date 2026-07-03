/**
 * llmAdapter.js
 *
 * Pluggable adapter for calling LLM providers. Currently implements a
 * simple OpenAI (chat completions) adapter using global `fetch`.
 * - Default model: gpt-3.5-turbo (budget)
 * - In-memory cache with TTL
 * - Very small in-memory rate limiter (per-process)
 *
 * Note: This adapter does not persist keys or billing; calls will consume
 * provider credits when executed with valid API keys. Keep keys in env.
 */

import crypto from "crypto";

const DEFAULT_MODEL = process.env.LLM_DEFAULT_MODEL || "gpt-3.5-turbo";
const DEFAULT_OPENROUTER_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || "qwen-7b";
const DEFAULT_GROQ_MODEL = process.env.GROQ_DEFAULT_MODEL || "llama-3.1-8b-instant";
const CACHE_TTL_MS = 60 * 1000; // 60s
const RATE_LIMIT_PER_MIN = parseInt(process.env.LLM_RATE_LIMIT_PER_MIN || "60", 10);

const cache = new Map();
let rateCounter = 0;
let rateWindowStart = Date.now();

function hashKey(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  cache.set(key, { ts: Date.now(), value });
}

function checkRateLimit() {
  const now = Date.now();
  if (now - rateWindowStart > 60_000) {
    rateWindowStart = now;
    rateCounter = 0;
  }
  if (rateCounter >= RATE_LIMIT_PER_MIN) return false;
  rateCounter += 1;
  return true;
}

async function callOpenAI({ messages, model = DEFAULT_MODEL, max_tokens = 300, temperature = 0.7, top_p = 1.0 } = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const url = 'https://api.openai.com/v1/chat/completions';

  const body = JSON.stringify({ model, messages, max_tokens, temperature, top_p });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${text}`);
  }

  const json = await res.json();
  const content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  return { raw: json, content };
}

async function callOpenRouter({ messages, model = DEFAULT_OPENROUTER_MODEL, max_tokens = 300, temperature = 0.7, top_p = 1.0 } = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  const url = 'https://api.openrouter.ai/v1/chat/completions';

  const body = JSON.stringify({ model, messages, max_tokens, temperature, top_p });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter error: ${res.status} ${text}`);
  }

  const json = await res.json();
  const content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  return { raw: json, content };
}

async function callGroq({ messages, model = DEFAULT_GROQ_MODEL, max_tokens = 300, temperature = 0.7, top_p = 1.0 } = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const body = JSON.stringify({ model, messages, max_tokens, temperature, top_p });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq error: ${res.status} ${text}`);
  }

  const json = await res.json();
  const content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  return { raw: json, content };
}

/**
 * callLLM: generic entry. provider currently supports 'openai', 'openrouter', 'groq'.
 * options:
 *  - provider: 'openai' | 'openrouter' | 'groq' | 'mock'
 *  - promptTemplate: { instruction, required_output_keys }
 */
export async function callLLM(payload = {}, options = {}) {
  const { provider = 'openai', promptTemplate = {}, cacheKey = null } = options;

  // simple rate-limiter
  if (!checkRateLimit()) {
    throw new Error('LLM rate limit exceeded');
  }

  const key = cacheKey || hashKey({ provider, payload, promptTemplate });
  const cached = getCached(key);
  if (cached) return { cached: true, ...cached };

  if (provider === 'openai') {
    const system = promptTemplate.system || 'You are an assistant that analyzes user compatibility based on JSON input.';
    const instruction = promptTemplate.instruction || '';

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: instruction + "\n\n" + JSON.stringify(payload) },
    ];

    const resp = await callOpenAI({ messages, model: options.model });

    const out = { provider: 'openai', raw: resp.raw, text: resp.content };
    setCached(key, out);
    return out;
  }

  if (provider === 'openrouter') {
    const system = promptTemplate.system || 'You are an assistant that analyzes user compatibility based on JSON input.';
    const instruction = promptTemplate.instruction || '';

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: instruction + "\n\n" + JSON.stringify(payload) },
    ];

    const resp = await callOpenRouter({ messages, model: options.model });

    const out = { provider: 'openrouter', raw: resp.raw, text: resp.content };
    setCached(key, out);
    return out;
  }

  if (provider === 'groq') {
    const system = promptTemplate.system || 'You are an assistant that analyzes user compatibility based on JSON input.';
    const instruction = promptTemplate.instruction || '';

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: instruction + "\n\n" + JSON.stringify(payload) },
    ];

    const resp = await callGroq({ messages, model: options.model });

    const out = { provider: 'groq', raw: resp.raw, text: resp.content };
    setCached(key, out);
    return out;
  }

  if (provider === 'mock') {
    // deterministic mock response for safe testing
    const finalScore = payload.match && payload.match.final_score;
    const topGenre = payload.shared_genres && payload.shared_genres.top_shared_genre;
    const favoriteOverlap = payload.favorites_overlap && payload.favorites_overlap.intersection_count;
    const mutualFollowing = payload.social_overlap && payload.social_overlap.mutual_following;
    const mutualFollowers = payload.social_overlap && payload.social_overlap.mutual_followers;
    const socialOverlapRate = Math.max(payload.social_overlap?.following_overlap_rate || 0, payload.social_overlap?.followers_overlap_rate || 0);

    const analysisParts = [];
    if (topGenre) {
      analysisParts.push(`Ortak en güçlü ilgi alanınız ${topGenre.genre} türü gibi görünüyor.`);
    }
    if (favoriteOverlap) {
      analysisParts.push(`${favoriteOverlap} ortak favori içeriğiniz var ve bu sohbeti başlatmak için güçlü bir nokta.`);
    }
    if (mutualFollowing || mutualFollowers) {
      analysisParts.push(`Sosyal ağda da bir kesişim var; bu da iletişimi daha doğal hale getirebilir.`);
    }
    if (!analysisParts.length) {
      analysisParts.push('Benzerlik sinyalleri sınırlı olsa da, aranızda keşfedilebilecek ortak noktalar bulunuyor.');
    }

    const strengths = [];
    if (topGenre) strengths.push(`${topGenre.genre} türünde güçlü ortak zevk`);
    if (favoriteOverlap) strengths.push('Ortak favori içerik benzerliği');
    if (socialOverlapRate > 0.2) strengths.push('Sosyal çevrede kesişim');
    if (!strengths.length) strengths.push('Genel izleme eğilimlerinde uyum');

    const weaknesses = [];
    if (!favoriteOverlap) weaknesses.push('Ortak favori içerik sayısı düşük');
    if (socialOverlapRate < 0.2) weaknesses.push('Sosyal ağ kesişimi sınırlı');
    if (!weaknesses.length) weaknesses.push('Bazı tür tercihlerinde farklılıklar var');

    const conversationStarters = [];
    if (favoriteOverlap) conversationStarters.push('Ortak favori içeriğiniz hakkında ne düşündüğünü sor');
    if (topGenre) conversationStarters.push(`${topGenre.genre} türünde en sevdiği yapımı sor`);
    if (mutualFollowing || mutualFollowers) conversationStarters.push('Ortak bağlantılardan sohbeti aç');
    if (!conversationStarters.length) conversationStarters.push('Bu aralar hangi tür yapımları izlediğini sor');

    const vals = (payload.match && payload.match.graphData && payload.match.graphData.values) || [0,0,0,0,0];
    const labels = ["Collab","Content","Social","Diversity","Bonus"];
    const graph_ascii = labels.map((L,i)=> `${L}: ${'█'.repeat(Math.round((vals[i]||0)/10))} (${vals[i]||0})`).join(' | ');

    const parsed = {
      analysis: `${analysisParts.join(' ')} Genel olarak aranızda umut veren bir uyum görünüyor (%${finalScore || 0}).`,
      strengths: strengths.slice(0,3),
      weaknesses: weaknesses.slice(0,3),
      conversation_starters: conversationStarters.slice(0,4),
      graph_ascii,
    };
    return { provider: 'mock', raw: payload, parsed, text: JSON.stringify(parsed) };
  }

  throw new Error(`Provider ${provider} not implemented`);
}

export default { callLLM };
