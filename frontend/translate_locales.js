import fs from 'fs';
import path from 'path';
import { translate } from '@vitalets/google-translate-api';

const run = async () => {
  const currentLocalesFile = fs.readFileSync(path.join(process.cwd(), 'src/locales/index.js'), 'utf8');
  const jsonStr = currentLocalesFile.replace('export const resources = ', '').trim().slice(0, -1);
  const parsed = eval('(' + jsonStr + ')');

  const englishKeys = Object.keys(parsed.en.translation);
  const langs = ['ru', 'ja', 'zh-CN', 'fr', 'ko', 'ar', 'it', 'es', 'de', 'pt'];
  
  for (const l of ['zh', ...langs]) {
    if (!parsed[l]) parsed[l] = { translation: {} };
  }

  const batchSize = 50;
  
  for (const lang of langs) {
    console.log(`Translating to ${lang}...`);
    for (let i = 0; i < englishKeys.length; i += batchSize) {
      const batch = englishKeys.slice(i, i + batchSize);
      const targetLang = lang === 'zh-CN' ? 'zh' : lang;
      const toTranslate = batch.filter(k => !parsed[targetLang].translation[k]);
      
      if (toTranslate.length === 0) continue;

      const text = toTranslate.join(' \n\n===DELIM===\n\n ');
      try {
        const res = await translate(text, { to: lang });
        const translatedArr = res.text.split(/===DELIM===/i).map(s => s.trim());
        
        for (let j = 0; j < toTranslate.length; j++) {
          let val = translatedArr[j];
          if (!val) val = toTranslate[j];
          parsed[targetLang].translation[toTranslate[j]] = val;
        }
      } catch (e) {
        console.error(`Error translating batch in ${lang}: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const content = 'export const resources = ' + JSON.stringify(parsed, null, 2) + ';\n';
  fs.writeFileSync(path.join(process.cwd(), 'src/locales/index.js'), content);
  console.log('Done!');
};

run();
