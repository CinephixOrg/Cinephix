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
// "latest" alias rather than a pinned version (e.g. gemini-2.5-flash) —
// verified live against this project's key that a pinned 2.5-flash/
// 2.5-flash-lite already 404s with "no longer available to new users" as of
// this writing, while gemini-1.5-flash (used elsewhere for Profile
// Analysis) is an even older generation. The alias tracks whatever Google
// currently serves as its free-tier flash model instead of going stale.
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_DEFAULT_MODEL || "gemini-flash-latest";
const CACHE_TTL_MS = 60 * 1000; // 60s
const RATE_LIMIT_PER_MIN = parseInt(process.env.LLM_RATE_LIMIT_PER_MIN || "60", 10);
// None of the three provider calls below had any timeout at all — a hung
// (not erroring, just never responding) provider would leave the request
// waiting indefinitely, and worse, analyzeMatchWithUser's own provider
// fallback loop (matchController.js) tries each candidate in sequence on a
// plain try/catch — a hang here never throws, so it never falls through to
// the next provider (or the guaranteed-to-succeed mock) either. Every
// callX() below now races its fetch against this via fetchWithTimeout.
const LLM_REQUEST_TIMEOUT_MS = parseInt(process.env.LLM_REQUEST_TIMEOUT_MS || "15000", 10);

async function fetchWithTimeout(url, options, timeoutMs = LLM_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

const cache = new Map();
let rateCounter = 0;
let rateWindowStart = Date.now();

// Deterministic mock copy per language. Only 'en'/'tr' are hand-written (tr
// is the original hardcoded language); any other requested language falls
// back to English rather than guessing at an unreviewed machine translation.
const MOCK_STRINGS = {
  en: {
    topGenre: (g) => `Your strongest shared interest seems to be ${g}.`,
    favoriteOverlap: (n) => `You have ${n} favorite titles in common, which is a great conversation starter.`,
    socialOverlap: "There's overlap in your social circles too, which can make things feel more natural.",
    limitedSignal: "Similarity signals are limited, but there are still common points worth exploring.",
    strengthGenre: (g) => `Strong shared taste in ${g}`,
    strengthFavorites: "Similar favorite content",
    strengthSocial: "Overlap in social circle",
    strengthGeneral: "General alignment in viewing habits",
    weaknessFavorites: "Low number of shared favorites",
    weaknessSocial: "Limited social circle overlap",
    weaknessGeneral: "Some differences in genre preferences",
    starterFavorite: "Ask what they thought of a shared favorite",
    starterGenre: (g) => `Ask about their favorite ${g} pick`,
    starterSocial: "Break the ice through mutual connections",
    starterGeneral: "Ask what they've been watching lately",
    // Deliberately no percentage here — the score is already shown
    // separately (MatchTierRow's ring), repeating it in the narrative read
    // as redundant.
    summary: () => `Overall, there's promising compatibility between you.`,
  },
  tr: {
    topGenre: (g) => `Ortak en güçlü ilgi alanınız ${g} türü gibi görünüyor.`,
    favoriteOverlap: (n) => `${n} ortak favori içeriğiniz var ve bu sohbeti başlatmak için güçlü bir nokta.`,
    socialOverlap: "Sosyal ağda da bir kesişim var; bu da iletişimi daha doğal hale getirebilir.",
    limitedSignal: "Benzerlik sinyalleri sınırlı olsa da, aranızda keşfedilebilecek ortak noktalar bulunuyor.",
    strengthGenre: (g) => `${g} türünde güçlü ortak zevk`,
    strengthFavorites: "Ortak favori içerik benzerliği",
    strengthSocial: "Sosyal çevrede kesişim",
    strengthGeneral: "Genel izleme eğilimlerinde uyum",
    weaknessFavorites: "Ortak favori içerik sayısı düşük",
    weaknessSocial: "Sosyal ağ kesişimi sınırlı",
    weaknessGeneral: "Bazı tür tercihlerinde farklılıklar var",
    starterFavorite: "Ortak favori içeriğiniz hakkında ne düşündüğünü sor",
    starterGenre: (g) => `${g} türünde en sevdiği yapımı sor`,
    starterSocial: "Ortak bağlantılardan sohbeti aç",
    starterGeneral: "Bu aralar hangi tür yapımları izlediğini sor",
    summary: () => `Genel olarak aranızda umut veren bir uyum görünüyor.`,
  },
};

const getMockStrings = (language) => MOCK_STRINGS[language] || MOCK_STRINGS.en;

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

  const res = await fetchWithTimeout(url, {
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

  const res = await fetchWithTimeout(url, {
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

async function callGemini({ messages, model = DEFAULT_GEMINI_MODEL } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  // Gemini has no single "messages" array like the OpenAI-shaped providers
  // above — it splits system instructions from the user turn instead, so
  // the shared { role, content } messages this module builds get folded
  // into that shape here rather than changing every caller.
  const systemMessage = messages.find((m) => m.role === 'system');
  const userMessage = messages.find((m) => m.role === 'user');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: userMessage?.content || '' }] }],
    ...(systemMessage && { systemInstruction: { parts: [{ text: systemMessage.content }] } }),
    generationConfig: { responseMimeType: 'application/json' },
  });

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini error: ${res.status} ${text}`);
  }

  const json = await res.json();
  const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
  return { raw: json, content };
}

/**
 * callLLM: generic entry. provider currently supports 'openai', 'openrouter', 'gemini'.
 * options:
 *  - provider: 'openai' | 'openrouter' | 'gemini' | 'mock'
 *  - promptTemplate: { instruction, required_output_keys }
 */
export async function callLLM(payload = {}, options = {}) {
  const { provider = 'openai', promptTemplate = {}, cacheKey = null, language = 'en' } = options;

  // simple rate-limiter
  if (!checkRateLimit()) {
    throw new Error('LLM rate limit exceeded');
  }

  const key = cacheKey || hashKey({ provider, payload, promptTemplate, language });
  const cached = getCached(key);
  if (cached) return { cached: true, ...cached };

  if (provider === 'gemini') {
    const system = promptTemplate.system || 'You are an assistant that analyzes user compatibility based on JSON input.';
    const instruction = promptTemplate.instruction || '';

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: instruction + "\n\n" + JSON.stringify(payload) },
    ];

    const resp = await callGemini({ messages, model: options.model });

    const out = { provider: 'gemini', raw: resp.raw, text: resp.content };
    setCached(key, out);
    return out;
  }

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

  if (provider === 'mock') {
    // deterministic mock response for safe testing
    const strings = getMockStrings(language);
    const finalScore = payload.match && payload.match.final_score;
    const topGenre = payload.shared_genres && payload.shared_genres.top_shared_genre;
    const favoriteOverlap = payload.favorites_overlap && payload.favorites_overlap.intersection_count;
    const mutualFollowing = payload.social_overlap && payload.social_overlap.mutual_following;
    const mutualFollowers = payload.social_overlap && payload.social_overlap.mutual_followers;
    const socialOverlapRate = Math.max(payload.social_overlap?.following_overlap_rate || 0, payload.social_overlap?.followers_overlap_rate || 0);

    const analysisParts = [];
    if (topGenre) {
      analysisParts.push(strings.topGenre(topGenre.genre));
    }
    if (favoriteOverlap) {
      analysisParts.push(strings.favoriteOverlap(favoriteOverlap));
    }
    if (mutualFollowing || mutualFollowers) {
      analysisParts.push(strings.socialOverlap);
    }
    if (!analysisParts.length) {
      analysisParts.push(strings.limitedSignal);
    }

    const strengths = [];
    if (topGenre) strengths.push(strings.strengthGenre(topGenre.genre));
    if (favoriteOverlap) strengths.push(strings.strengthFavorites);
    if (socialOverlapRate > 0.2) strengths.push(strings.strengthSocial);
    if (!strengths.length) strengths.push(strings.strengthGeneral);

    const weaknesses = [];
    if (!favoriteOverlap) weaknesses.push(strings.weaknessFavorites);
    if (socialOverlapRate < 0.2) weaknesses.push(strings.weaknessSocial);
    if (!weaknesses.length) weaknesses.push(strings.weaknessGeneral);

    const conversationStarters = [];
    if (favoriteOverlap) conversationStarters.push(strings.starterFavorite);
    if (topGenre) conversationStarters.push(strings.starterGenre(topGenre.genre));
    if (mutualFollowing || mutualFollowers) conversationStarters.push(strings.starterSocial);
    if (!conversationStarters.length) conversationStarters.push(strings.starterGeneral);

    const vals = (payload.match && payload.match.graphData && payload.match.graphData.values) || [0,0,0,0,0];
    const labels = ["Collab","Content","Social","Diversity","Bonus"];
    const graph_ascii = labels.map((L,i)=> `${L}: ${'█'.repeat(Math.round((vals[i]||0)/10))} (${vals[i]||0})`).join(' | ');

    const parsed = {
      analysis: `${analysisParts.join(' ')} ${strings.summary(finalScore || 0)}`,
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
