// The words of a push notification, in the device's app language.
//
// A push is written on the server, which doesn't know the reader's language,
// so each registered device reports the app's language and its pushes use it.
// These are the app's own translations of the same phrases
// (mobile/src/locales/index.ts), so a push and its row in the in-app feed say
// the same thing; pushCopy.test.js fails if the two drift apart.

export const PUSH_PHRASES = {
  en: {
    "started following you": "started following you",
    "sent you a message": "sent you a message",
    "sent you a recommendation": "sent you a recommendation",
    "shared an analysis with you": "shared an analysis with you",
    "shared a profile with you": "shared a profile with you",
    "liked your share": "liked your share",
    "{{count}} users liked your share": "{{count}} users liked your share",
  },
  tr: {
    "started following you": "sizi takip etmeye başladı",
    "sent you a message": "size mesaj gönderdi",
    "sent you a recommendation": "sana bir öneri gönderdi",
    "shared an analysis with you": "seninle bir analiz paylaştı",
    "shared a profile with you": "seninle bir profil paylaştı",
    "liked your share": "paylaşımını beğendi",
    "{{count}} users liked your share": "{{count}} kişi paylaşımını beğendi",
  },
  ru: {
    "started following you": "начал(а) подписываться на вас",
    "sent you a message": "отправил(а) вам сообщение",
    "sent you a recommendation": "отправил(а) вам рекомендацию",
    "shared an analysis with you": "поделился(ась) с вами анализом",
    "shared a profile with you": "поделился(ась) с вами профилем",
    "liked your share": "оценил(а) вашу публикацию",
    "{{count}} users liked your share": "{{count}} пользователей оценили вашу публикацию",
  },
  ja: {
    "started following you": "があなたをフォローし始めました",
    "sent you a message": "があなたにメッセージを送りました",
    "sent you a recommendation": "さんからおすすめが届きました",
    "shared an analysis with you": "さんが分析を共有しました",
    "shared a profile with you": "さんがプロフィールを共有しました",
    "liked your share": "さんがあなたの投稿にいいねしました",
    "{{count}} users liked your share": "{{count}}人があなたの投稿にいいねしました",
  },
  zh: {
    "started following you": "开始关注你",
    "sent you a message": "给你发了一条消息",
    "sent you a recommendation": "给你发送了一条推荐",
    "shared an analysis with you": "与你分享了一份分析",
    "shared a profile with you": "与你分享了一个个人资料",
    "liked your share": "赞了你的分享",
    "{{count}} users liked your share": "{{count}} 位用户赞了你的分享",
  },
  fr: {
    "started following you": "a commencé à vous suivre",
    "sent you a message": "vous a envoyé un message",
    "sent you a recommendation": "vous a envoyé une recommandation",
    "shared an analysis with you": "a partagé une analyse avec vous",
    "shared a profile with you": "a partagé un profil avec vous",
    "liked your share": "a aimé votre partage",
    "{{count}} users liked your share": "{{count}} utilisateurs ont aimé votre partage",
  },
  ko: {
    "started following you": "님이 팔로우하기 시작했습니다",
    "sent you a message": "님이 메시지를 보냈습니다",
    "sent you a recommendation": "님이 추천을 보냈습니다",
    "shared an analysis with you": "님이 분석을 공유했습니다",
    "shared a profile with you": "님이 프로필을 공유했습니다",
    "liked your share": "님이 회원님의 게시물을 좋아합니다",
    "{{count}} users liked your share": "{{count}}명이 회원님의 게시물을 좋아합니다",
  },
  ar: {
    "started following you": "بدأ بمتابعتك",
    "sent you a message": "أرسل لك رسالة",
    "sent you a recommendation": "أرسل إليك توصية",
    "shared an analysis with you": "شارك معك تحليلًا",
    "shared a profile with you": "شارك معك ملفًا شخصيًا",
    "liked your share": "أعجبه منشورك",
    "{{count}} users liked your share": "أعجب {{count}} مستخدمين بمنشورك",
  },
  it: {
    "started following you": "ha iniziato a seguirti",
    "sent you a message": "ti ha inviato un messaggio",
    "sent you a recommendation": "ti ha inviato un consiglio",
    "shared an analysis with you": "ha condiviso un'analisi con te",
    "shared a profile with you": "ha condiviso un profilo con te",
    "liked your share": "ha messo mi piace al tuo post",
    "{{count}} users liked your share": "A {{count}} utenti piace il tuo post",
  },
  es: {
    "started following you": "comenzó a seguirte",
    "sent you a message": "te envió un mensaje",
    "sent you a recommendation": "te envió una recomendación",
    "shared an analysis with you": "compartió un análisis contigo",
    "shared a profile with you": "compartió un perfil contigo",
    "liked your share": "indicó que le gusta tu publicación",
    "{{count}} users liked your share": "A {{count}} usuarios les gustó tu publicación",
  },
  de: {
    "started following you": "folgt dir jetzt",
    "sent you a message": "hat dir eine Nachricht gesendet",
    "sent you a recommendation": "hat dir eine Empfehlung geschickt",
    "shared an analysis with you": "hat eine Analyse mit dir geteilt",
    "shared a profile with you": "hat ein Profil mit dir geteilt",
    "liked your share": "mag deinen Beitrag",
    "{{count}} users liked your share": "{{count}} Nutzern gefällt dein Beitrag",
  },
  pt: {
    "started following you": "começou a seguir você",
    "sent you a message": "enviou uma mensagem para você",
    "sent you a recommendation": "enviou uma recomendação para você",
    "shared an analysis with you": "compartilhou uma análise com você",
    "shared a profile with you": "compartilhou um perfil com você",
    "liked your share": "curtiu sua publicação",
    "{{count}} users liked your share": "{{count}} usuários curtiram sua publicação",
  },
};

/** The supported language for a locale tag ("pt-BR" → "pt"), English when unsupported. */
export function pushLanguage(locale) {
  const base = String(locale ?? "").toLowerCase().split(/[-_]/)[0];
  return Object.hasOwn(PUSH_PHRASES, base) ? base : "en";
}

/** A phrase in the locale's language, with {{placeholders}} filled from `vars`. */
export function pushPhrase(locale, key, vars = {}) {
  const template = PUSH_PHRASES[pushLanguage(locale)][key] ?? PUSH_PHRASES.en[key] ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name) => (vars[name] === undefined ? match : String(vars[name])));
}
