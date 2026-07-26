import fs from 'fs';
import path from 'path';

const currentLocalesFile = fs.readFileSync(path.join(process.cwd(), 'src/locales/index.js'), 'utf8');
const jsonStr = currentLocalesFile.replace('export const resources = ', '').trim().slice(0, -1);
const parsed = eval('(' + jsonStr + ')');

const newKeys = {
  // Share Profile Analysis
  "Share Profile Analysis": { en: "Share Profile Analysis", tr: "Profil Analizini Paylaş" },
  "Search users...": { en: "Search users...", tr: "Kullanıcıları ara..." },
  "Searching...": { en: "Searching...", tr: "Aranıyor..." },
  "No users found.": { en: "No users found.", tr: "Kullanıcı bulunamadı." },
  "No connections found.": { en: "No connections found.", tr: "Bağlantı bulunamadı." },
  "Profile Analysis": { en: "Profile Analysis", tr: "Profil Analizi" },
  "AI Cinematic Persona": { en: "AI Cinematic Persona", tr: "Yapay Zeka Sinematik Persona" },
  "Persona": { en: "Persona", tr: "Kişilik" },
  "You shared your profile analysis.": { en: "You shared your profile analysis.", tr: "Profil analizini paylaştın." },
  "{{user}} is sharing their profile analysis with you.": { en: "{{user}} is sharing their profile analysis with you.", tr: "{{user}} profil analizini seninle paylaşıyor." }
};

for (const [key, transObj] of Object.entries(newKeys)) {
  for (const [lang, val] of Object.entries(transObj)) {
    if (!parsed[lang]) parsed[lang] = { translation: {} };
    parsed[lang].translation[key] = val;
  }
}

const content = 'export const resources = ' + JSON.stringify(parsed, null, 2) + ';\n';
fs.writeFileSync(path.join(process.cwd(), 'src/locales/index.js'), content);
console.log('Locales updated for profile analysis share!');
