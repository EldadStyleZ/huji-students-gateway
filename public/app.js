import {
  categories,
  topics,
  campuses,
  roles,
  suggest,
  resolveRoute,
  registrationOptions,
  topicFromUrl,
  shareUrl,
} from './routing.js';
const initialTopic = topicFromUrl(location.href);
const state = {
  lang: new URL(location.href).searchParams.get('lang') === 'en' ? 'en' : 'he',
  mode: 'guided',
  step: initialTopic ? 'context' : 'home',
  category: topics.find((x) => x.id === initialTopic)?.category || null,
  topic: initialTopic,
  campus: '',
  registrationIssue: '',
  description: '',
  email: '',
  name: '',
  department: '',
  suggestions: null,
  consent: false,
};
let settings = { live: false, aiEnabled: false, aiNotice: '' };
state.destination = null;
state.verifiedEmail = null;
state.otpRequested = false;
state.ticket = null;
state.requestKey = crypto.randomUUID();
state.busy = false;
state.suggestionMethod = 'keywords';
const root = document.querySelector('#app');
const t = (he, en) => (state.lang === 'he' ? he : en);
const label = (value) => value[state.lang];
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x],
  );
const iconPaths = {
  book: 'M4 5h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v14h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4z M12 6v14',
  wallet: 'M4 7h15v13H4z M4 7V4h13v3 M15 12h5v4h-5z',
  home: 'M3 11 12 3l9 8 M5 10v11h14V10 M9 21v-7h6v7',
  flag: 'M5 22V3 M5 4c5-5 9 5 15 0v10c-6 5-10-5-15 0',
  people:
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-2a7 7 0 0 1 14 0v2 M17 4a4 4 0 0 1 0 7 M19 15a6 6 0 0 1 3 5',
  chat: 'M4 4h16v13H9l-5 4z M8 9h8 M8 13h5',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  check: 'm5 12 4 4L19 6',
  link: 'M9 15 15 9 M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0 M16 8l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
  globe: 'M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0 M3 12h18 M12 3c5 5 5 13 0 18-5-5-5-13 0-18',
};
function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[name] || iconPaths.chat}"/></svg>`;
}
function button(action, text, cls = 'secondary', extra = '') {
  return `<button type="button" class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
}
function currentTopic() {
  return topics.find((x) => x.id === state.topic);
}
function route() {
  return resolveRoute({
    topicId: state.topic,
    campus: state.campus,
    registrationIssue: state.registrationIssue,
  });
}
function heading(text, sub = '') {
  return `<h1 tabindex="-1">${text}</h1>${sub ? `<p class="lead">${sub}</p>` : ''}`;
}
function header() {
  return `<header class="header"><button class="brand" data-action="home" aria-label="${t('לדף הבית', 'Home')}"><span class="brand-mark">${icon('arrow')}</span><span><strong>${t('כתובת אחת', 'One address')}</strong><small>${t('שער הפניות לסטודנטים', 'The student support gateway')}</small></span></button><nav aria-label="${t('ניווט ראשי', 'Main navigation')}"><a href="/research.html">${t('מחקר ותכנון', 'Research & design')}</a><button class="language" data-action="language">${icon('globe')} ${t('English', 'עברית')}</button></nav></header>`;
}
function footer() {
  return `<footer><span>${t('קונספט עבור אגודת הסטודנטים והסטודנטיות בעברית', 'A concept for the Hebrew University Student Union')}</span><span>${settings.live ? t('שירות פניות · הכוונה לפי ספר תפקידים מאושר', 'Student support · approved role directory') : t('אב טיפוס · מסלולי ההכוונה להמחשה בלבד', 'Prototype · illustrative routing only')}</span></footer>`;
}
function home() {
  return `<section class="hero"><span class="eyebrow">${t('קל יותר למצוא את מי שיעזור', 'A LITTLE LESS RUNAROUND')}</span>${heading(t('יש שאלה.<br>יש למי לפנות.', 'A question.<br>A clear way forward.'), t('לא צריך להכיר את כל בעלי התפקידים. נתחיל במה שצריך, ונמצא יחד את הכתובת המתאימה.', 'You don’t need to know every role or email address. Start with what you need, and find the right place to ask.'))}<div class="hero-note"><span class="dot"></span>${t('הכוונה ללא התחברות · אפשר לחזור ולשנות בכל שלב', 'Browse without signing in · change your answers at any time')}</div></section><section class="workspace"><div class="section-bar"><h2>${t('איך נוח לך להתחיל?', 'How would you like to start?')}</h2><div class="segmented" role="group" aria-label="${t('דרך ההכוונה', 'Routing method')}">${button('guided', t('בחירה לפי נושא', 'Choose a topic'), 'segment', `aria-pressed="${state.mode === 'guided'}"`)}${button('natural', `${icon('spark')}${t('במילים שלי', 'In my own words')}`, 'segment', `aria-pressed="${state.mode === 'natural'}"`)}</div></div>${state.mode === 'guided' ? `<div class="category-grid">${categories.map((c) => `<button class="category" data-category="${c.id}"><span class="category-icon">${icon(c.icon)}</span><span class="category-copy"><strong>${label(c.name)}</strong><small>${label(c.description)}</small></span>${icon('arrow', 'direction')}</button>`).join('')}</div>` : natural()}<div class="direct-links"><span>${t('קיצורי דרך', 'Quick starts')}</span>${button('quick-course', t('לא מצליחים להירשם לקורס?', 'Can’t register for a course?'), 'text-button')}${button('quick-reserves', t('חזרה ממילואים', 'Returning from reserve service'), 'text-button')}</div></section><section class="how"><div><span>01</span><h3>${t('מספרים מה קרה', 'Tell us what happened')}</h3><p>${t('בוחרים נושא או כותבים בקצרה.', 'Choose a topic or write a short description.')}</p></div><div><span>02</span><h3>${t('מוצאים את הכתובת', 'Find the right contact')}</h3><p>${t('רואים מי יכול לעזור, ולמה.', 'See who can help, and why they fit.')}</p></div><div><span>03</span><h3>${t('מחליטים איך להמשיך', 'Choose your next step')}</h3><p>${t('פונים לאוניברסיטה או מבקשים סיוע מהאגודה.', 'Contact the university or ask the union for support.')}</p></div></section>`;
}
function natural() {
  return `<form id="suggest-form" class="natural"><label for="issue-text">${t('במה אפשר לעזור?', 'What do you need help with?')}</label><textarea id="issue-text" name="description" rows="4" maxlength="3000" required aria-describedby="natural-help" placeholder="${t('למשל: אני מנסה להירשם לקורס, אבל המערכת לא נותנת לי להמשיך…', 'For example: I’m trying to register for a course, but the system won’t let me continue…')}">${esc(state.description)}</textarea><div class="form-bottom"><small id="natural-help">${settings.aiEnabled ? t('הטקסט יישלח למודל כדי להציע נושא. ', 'Your text will be sent to a model to suggest a topic. ') + esc(settings.aiNotice) : t('מספיק משפט או שניים. ההתאמה נעשית בדפדפן לפי מילות מפתח.', 'A sentence or two is enough. Keywords are matched in your browser.')}</small><button class="primary" type="submit">${t('מציאת כיוון', 'Suggest a topic')} ${icon('arrow', 'direction')}</button></div></form>${
    state.suggestions !== null
      ? `<section class="suggestions" aria-live="polite"><h3>${state.suggestions.length ? t('אלו נושאים שעשויים להתאים — מה הכי קרוב?', 'These topics may fit — which is closest?') : t('עדיין לא מצאנו התאמה ברורה', 'We haven’t found a clear match yet')}</h3>${
          state.suggestions.length
            ? state.suggestions
                .map((s) => {
                  const topic = topics.find((x) => x.id === s.topicId);
                  return `<button class="option" data-topic="${topic.id}"><span><strong>${label(topic.name)}</strong><small>${state.suggestionMethod === 'model' ? t('הצעת מודל — יש לאשר את הנושא', 'Model suggestion — confirm the topic') : t('מילים שזוהו: ', 'Matched words: ') + esc(s.matched.join(', '))}</small></span>${icon('arrow', 'direction')}</button>`;
                })
                .join('')
            : `<p>${t('אפשר לבחור נושא או להיעזר בצוות ההכוונה. אין צורך לנסח את הבעיה מחדש.', 'You can choose a topic or ask the triage team. You won’t need to rewrite your issue.')}</p>`
        }${button('quick-general', t('אף אחד מהם / עזרה בהכוונה', 'None of these / ask for routing help'), 'text-button')}</section>`
      : ''
  }`;
}
function progress() {
  const stage = ['topics', 'context'].includes(state.step) ? 0 : state.step === 'result' ? 1 : 2;
  return `<ol class="progress" aria-label="${t('התקדמות', 'Progress')}">${[t('הנושא שלך', 'Your issue'), t('הכתובת המתאימה', 'Your contact'), t('פרטי הפנייה', 'Your request')].map((s, i) => `<li ${i === stage ? 'aria-current="step"' : ''} class="${i <= stage ? 'active' : ''}"><span>${i < stage ? '✓' : i + 1}</span>${s}</li>`).join('')}</ol>`;
}
function flow() {
  return `<section class="flow">${progress()}<div class="flow-top">${button('back', t('→ חזרה', '← Back'), 'text-button')}<span>${state.category ? label(categories.find((c) => c.id === state.category).name) : ''}</span></div>${{ topics: topicChoices, context: context, result: result, compose: compose, review: review, done: done }[state.step]()}</section>`;
}
function topicChoices() {
  return `${heading(t('מה הנושא?', 'What’s the issue?'), t('אפשר לבחור את האפשרות הקרובה ביותר.', 'Choose the closest option.'))}<div class="options">${topics
    .filter((x) => x.category === state.category)
    .map(
      (x) =>
        `<button class="option" data-topic="${x.id}"><strong>${label(x.name)}</strong>${icon('arrow', 'direction')}</button>`,
    )
    .join(
      '',
    )}</div>${button('quick-general', t('לא בטוח / נושא אחר', 'Not sure / something else'), 'text-button')}`;
}
function context() {
  return `${heading(label(currentTopic().name), t('רק הפרטים שעוזרים לבחור למי לפנות.', 'Just the details that help identify the right contact.'))}<form id="context-form"><fieldset><legend>${t('באיזה קמפוס הלימודים שלך?', 'Which campus do you study at?')}</legend><div class="choice-grid">${campuses.map((c) => `<label class="radio-card"><input type="radio" name="campus" value="${c.id}" required ${state.campus === c.id ? 'checked' : ''}><span>${label(c.name)}</span></label>`).join('')}</div></fieldset>${state.topic === 'course-registration' ? `<fieldset><legend>${t('מה מופיע כשמנסים להירשם?', 'What happens when you try to register?')}</legend><div class="choice-stack">${registrationOptions.map((o) => `<label class="radio-card"><input type="radio" name="registrationIssue" value="${o.id}" required ${state.registrationIssue === o.id ? 'checked' : ''}><span>${label(o.name)}</span></label>`).join('')}</div></fieldset>` : ''}<button class="primary" type="submit">${t('לכתובת המתאימה', 'Find my contact')} ${icon('arrow', 'direction')}</button></form>`;
}
function result() {
  const r = route();
  return `${heading(t('מכאן אפשר להתקדם.', 'Here’s a way forward.'), t('לפי הנושא והפרטים שבחרת, אלו כיווני הפנייה האפשריים.', 'Based on your topic and answers, these are possible places to start.'))}<div class="notice">${settings.live ? t('הפנייה לאגודה תועבר לנמען המוצג. ההכוונה לאוניברסיטה היא הצעה לבדיקה מול היחידה הרלוונטית.', 'Union requests go to the displayed recipient. University guidance should be checked with the relevant office.') : t('הדגמה: חלוקת האחריות וכתובות הדוא״ל עדיין לא אומתו. אלו הצעות להמחשת המוצר, ולא הנחיות רשמיות.', 'Demo: responsibilities and email addresses are not verified. These suggestions illustrate the product and are not official guidance.')}</div>${r.university ? `<article class="destination university"><span class="tag">${t('גורם באוניברסיטה · כיוון אפשרי', 'University office · possible first contact')}</span><h2>${label(r.university.name)}</h2><p>${label(r.university.reason)}</p>${r.needsDepartment ? `<p class="muted">${t('במערכת המלאה, החוג או הפקולטה יצמצמו את ההפניה למזכירות המתאימה.', 'In the full service, your department or faculty will narrow this to the correct office.')}</p>` : ''}<a class="secondary" href="${r.university.url}" target="_blank" rel="noopener noreferrer">${t('לאתר האוניברסיטה', 'Open university website')} ↗</a><small>${t('זהו אתר מידע כללי, לא קישור ישיר למזכירות שלך. הפנייה לא תועבר אליו אוטומטית.', 'This is a general information page, not your department’s direct contact. Your request is not forwarded there.')}</small></article>` : ''}<article class="destination union"><span class="tag">${t('סיוע מטעם אגודת הסטודנטים', 'Student union support')}</span><h2>${label(state.destination?.name || roles[r.roleId])}</h2><p>${r.roleId === 'triage' ? t('לא צריך לדעת מי אחראי. צוות הכוונה יוכל לבדוק מי הגורם המתאים.', 'You don’t need to know who is responsible. A triage team can help find the right owner.') : t('אפשר לבקש עזרה בהכוונה, בהבנת התהליך או בייצוג מול הגורם המטפל.', 'Ask for help navigating the process, understanding the next step, or representing your concern.')}</p><div class="recipient"><span>${t('קמפוס', 'Campus')}</span><strong>${label(campuses.find((c) => c.id === state.campus).name)}</strong><span>${t('דוא״ל', 'Email')}</span><strong>${state.destination ? esc(state.destination.email) : t('יוגדר לאחר אישור ספר התפקידים', 'Pending approved role directory')}</strong></div>${button('compose', t('הכנת פנייה לאגודה', 'Prepare a union request'), 'primary')}</article><div class="result-actions">${button('share', `${icon('link')}${t('העתקת קישור לנושא', 'Copy topic link')}`, 'text-button')}${button('quick-general', t('הכיוון לא מתאים לי', 'This doesn’t fit my issue'), 'text-button')}</div><p id="share-status" role="status"></p>`;
}
function compose() {
  return `${heading(t('מה חשוב שנדע?', 'What should we know?'), t('תיאור קצר וכתובת לחזרה. אפשר להוסיף פרטים בהמשך.', 'A short description and a reply address. More details can come later.'))}<div class="compact-recipient">${icon('chat')}<span>${t('אל: ', 'To: ')}<strong>${label(state.destination?.name || roles[route().roleId])}</strong></span></div><form id="compose-form"><label for="description">${t('תיאור הפנייה (חובה)', 'Your issue (required)')}</label><textarea id="description" name="description" required maxlength="3000" rows="5" aria-describedby="description-help">${esc(state.description)}</textarea><small id="description-help">${t('מה קרה, ומה היית רוצה שיקרה? אין צורך לצרף מסמכים רפואיים, פרטי בנק או תעודת זהות.', 'What happened, and what outcome would help? Please leave out medical documents, bank details and ID numbers.')}</small><div class="field-pair"><div><label for="email">${t('דוא״ל למענה (חובה)', 'Reply email (required)')}</label><input id="email" name="email" type="email" required maxlength="254" autocomplete="email" dir="ltr" value="${esc(state.email)}" placeholder="name@example.com"></div><div><label for="name">${t('איך לפנות אליך? (לא חובה)', 'Your name (optional)')}</label><input id="name" name="name" maxlength="100" autocomplete="name" value="${esc(state.name)}"></div></div><label class="consent"><input type="checkbox" name="consent" required ${state.consent ? 'checked' : ''}><span>${settings.live ? t('אני מאשר/ת לשמור את הפנייה ולהעביר את התיאור וכתובת המענה לנמען המוצג באגודה לצורך טיפול.', 'I agree to store this request and share its description and my reply email with the displayed union recipient for handling.') : t('ברור לי שזהו דמו: אפשר להכין טיוטה, אבל אף פנייה או דוא״ל לא יישלחו.', 'I understand this is a demo: I can prepare a draft, but no request or email will be sent.')}</span></label><button class="primary" type="submit">${t('בדיקת הפנייה', 'Review request')} ${icon('arrow', 'direction')}</button></form>`;
}
function review() {
  return `${heading(t('רגע לפני הסיום', 'Review your request'), t('בדיקה קצרה של הנמען והתוכן.', 'Check the recipient and the message.'))}<article class="review"><dl><dt>${t('נמען', 'Recipient')}</dt><dd>${label(state.destination?.name || roles[route().roleId])}</dd><dt>${t('נושא', 'Topic')}</dt><dd>${label(currentTopic().name)}</dd><dt>${t('דוא״ל למענה', 'Reply email')}</dt><dd dir="ltr">${esc(state.email)}</dd>${state.name ? `<dt>${t('שם', 'Name')}</dt><dd>${esc(state.name)}</dd>` : ''}</dl><h2>${t('הפנייה שלך', 'Your message')}</h2><p class="message">${esc(state.description)}</p></article>${settings.live ? authPanel() : `<p class="muted">${t('לא מוגדרת כתובת דוא״ל לנמען. בדמו אפשר להפיק טיוטה בלבד.', 'No recipient email is configured. This demo can only prepare a draft.')}</p>`}<div class="form-bottom">${button('edit', t('עריכת הפרטים', 'Edit details'), 'secondary')}${settings.live ? button('send', t('שליחת הפנייה לאגודה', 'Send request to the union'), 'primary', state.verifiedEmail?.toLowerCase() === state.email.toLowerCase() ? '' : 'disabled') : button('finish', t('סיום והצגת הטיוטה', 'Finish and view draft'), 'primary')}</div>`;
}
function done() {
  if (state.ticket) return liveDone();
  return `<div class="done-icon">${icon('check')}</div>${heading(t('הטיוטה מוכנה.', 'Your draft is ready.'), t('לא נשלחה פנייה. אפשר להוריד את הטיוטה ולהשתמש בה לאחר אימות פרטי הנמען.', 'No request was sent. Download the draft and use it once the recipient details are verified.'))}<div class="notice">${t('הטקסט נשאר בזיכרון הדף בלבד ונמחק ברענון. אין מספר פנייה או מעקב אמיתי בדמו.', 'The text stays in this page’s memory and is cleared on reload. There is no real ticket number or tracking in this demo.')}</div><div class="form-bottom">${button('download', t('הורדת טיוטת הפנייה', 'Download request draft'), 'primary')}${button('home', t('בחזרה להתחלה', 'Back to start'), 'secondary')}</div>`;
}
function render(focus = true) {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'he' ? 'rtl' : 'ltr';
  root.innerHTML = `${header()}<main id="main">${state.step === 'home' ? home() : flow()}</main>${footer()}`;
  document.title = `${t('כתובת אחת', 'One address')} — ${state.step === 'home' ? t('שער הפניות לסטודנטים', 'Student support gateway') : t('הכוונה ופנייה', 'Routing and request')}`;
  if (focus) {
    document.querySelector('h1')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}
function pickTopic(id) {
  state.destination = null;
  state.ticket = null;
  state.requestKey = crypto.randomUUID();
  state.topic = id;
  state.category = currentTopic().category;
  state.registrationIssue = '';
  state.step = 'context';
  render();
}
function saveFields(form) {
  if (!form) return;
  for (const el of form.elements) {
    if (
      ['description', 'email', 'name', 'campus', 'registrationIssue', 'consent'].includes(el.name)
    ) {
      if (el.type === 'radio') {
        if (el.checked) state[el.name] = el.value;
      } else state[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    }
  }
}
root.addEventListener('input', (e) => {
  if (e.target.form) saveFields(e.target.form);
});
root.addEventListener('change', (e) => {
  if (e.target.form) saveFields(e.target.form);
});
root.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (state.busy) return;
  saveFields(e.target);
  const id = e.target.id;
  try {
    if (id === 'suggest-form') {
      if (settings.aiEnabled) {
        setBusy(true);
        const data = await api('/api/suggest', { text: state.description, allowModel: true });
        state.suggestions = data.suggestions;
        state.suggestionMethod = data.method;
      } else {
        state.suggestions = suggest(state.description);
        state.suggestionMethod = 'keywords';
      }
      render(false);
      document.querySelector('.suggestions')?.scrollIntoView({ block: 'nearest' });
    }
    if (id === 'context-form' && route().status === 'example') {
      if (settings.live) {
        setBusy(true);
        state.destination = (
          await api('/api/route', {
            topicId: state.topic,
            campus: state.campus,
            registrationIssue: state.registrationIssue,
          })
        ).destination;
      }
      state.step = 'result';
      render();
    }
    if (id === 'compose-form') {
      if (!state.description.trim()) {
        const field = document.querySelector('#description');
        field.setCustomValidity(t('נא לכתוב תיאור קצר.', 'Please enter a short description.'));
        field.reportValidity();
        return;
      }
      state.requestKey = crypto.randomUUID();
      state.step = 'review';
      render();
    }
    if (id === 'otp-form') {
      setBusy(true);
      const token = new FormData(e.target).get('token');
      const data = await api('/api/auth/verify-code', { email: state.email, token });
      state.verifiedEmail = data.email;
      render();
    }
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
});
root.addEventListener('input', (e) => {
  if (e.target.name === 'description') e.target.setCustomValidity('');
});
root.addEventListener('click', async (e) => {
  const el = e.target.closest('button');
  if (!el || state.busy) return;
  if (el.dataset.category) {
    state.category = el.dataset.category;
    state.step = 'topics';
    render();
    return;
  }
  if (el.dataset.topic) {
    pickTopic(el.dataset.topic);
    return;
  }
  switch (el.dataset.action) {
    case 'home':
      state.step = 'home';
      render();
      break;
    case 'language':
      state.lang = state.lang === 'he' ? 'en' : 'he';
      render(false);
      break;
    case 'guided':
      state.mode = 'guided';
      render(false);
      break;
    case 'natural':
      state.mode = 'natural';
      render(false);
      document.querySelector('#issue-text')?.focus();
      break;
    case 'quick-course':
      pickTopic('course-registration');
      break;
    case 'quick-reserves':
      pickTopic('reserve-support');
      break;
    case 'quick-general':
      pickTopic('general-help');
      break;
    case 'compose':
      state.step = 'compose';
      render();
      break;
    case 'edit':
      state.ticket = null;
      state.step = 'compose';
      render();
      break;
    case 'finish':
      state.step = 'done';
      render();
      break;
    case 'back':
      state.step =
        {
          topics: 'home',
          context: 'topics',
          result: 'context',
          compose: 'result',
          review: 'compose',
          done: 'review',
        }[state.step] || 'home';
      render();
      break;
    case 'share': {
      const url = shareUrl(location.href, state.topic, state.lang);
      const status = document.querySelector('#share-status');
      try {
        await navigator.clipboard.writeText(url);
        status.textContent = t(
          'קישור לנושא הועתק. פרטי הפנייה לא נכללו.',
          'Topic link copied. No request details were included.',
        );
      } catch {
        status.textContent = url;
      }
      break;
    }
    case 'request-code':
      await liveAction(async () => {
        await api('/api/auth/request-code', { email: state.email });
        state.otpRequested = true;
        render();
      });
      break;
    case 'send':
      await liveAction(async () => {
        state.ticket = await api(
          '/api/tickets',
          {
            topicId: state.topic,
            campus: state.campus,
            registrationIssue: state.registrationIssue,
            description: state.description,
            name: state.name,
            consent: state.consent,
            lang: state.lang,
            destinationId: state.destination.id,
            directoryVersion: state.destination.directoryVersion,
          },
          { 'Idempotency-Key': state.requestKey },
        );
        state.step = 'done';
        render();
      });
      break;
    case 'refresh-ticket':
      await liveAction(async () => {
        state.ticket = await api('/api/tickets/' + state.ticket.id);
        render();
      });
      break;
    case 'download': {
      const r = route();
      const content = [
        t('טיוטה בלבד — לא נשלחה פנייה', 'DRAFT ONLY — NO REQUEST SENT'),
        `${t('נמען (טרם אומת)', 'Recipient (unverified)')}: ${label(state.destination?.name || roles[r.roleId])}`,
        `${t('קמפוס', 'Campus')}: ${label(campuses.find((c) => c.id === state.campus).name)}`,
        `${t('נושא', 'Topic')}: ${label(currentTopic().name)}`,
        `${t('דוא״ל למענה', 'Reply email')}: ${state.email}`,
        `${t('שם', 'Name')}: ${state.name}`,
        ...(state.registrationIssue
          ? [
              `${t('מצב הרישום שנבחר', 'Selected registration situation')}: ${label(registrationOptions.find((o) => o.id === state.registrationIssue).name)}`,
            ]
          : []),
        '',
        state.description,
      ].join('\n');
      const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'student-request-draft.txt';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      break;
    }
  }
});
render(false);

async function api(path, data, headers = {}) {
  const response = await fetch(path, {
    method: data ? 'POST' : 'GET',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(25000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'request-failed');
  return result;
}
function setBusy(busy) {
  state.busy = busy;
  root.setAttribute('aria-busy', String(busy));
  for (const el of root.querySelectorAll('button')) {
    if (busy) {
      el.dataset.wasDisabled = String(el.disabled);
      el.disabled = true;
    } else if (el.dataset.wasDisabled !== undefined) {
      el.disabled = el.dataset.wasDisabled === 'true';
      delete el.dataset.wasDisabled;
    }
  }
}
function showError(error) {
  let box = document.querySelector('#api-error');
  if (!box) {
    box = document.createElement('p');
    box.id = 'api-error';
    box.className = 'notice';
    box.setAttribute('role', 'alert');
    document.querySelector('#main').prepend(box);
  }
  const codes = {
    'recipient-changed': t(
      'הנמען עודכן. יש לחזור למסך ההכוונה ולבדוק את הנמען לפני ניסיון נוסף.',
      'The recipient changed. Return to routing and review the recipient before retrying.',
    ),
    'too-many-requests': t(
      'יותר מדי ניסיונות. יש להמתין מעט ולנסות שוב.',
      'Too many attempts. Wait a little and retry.',
    ),
    'destination-unavailable': t(
      'אין כרגע נמען מאומת למסלול הזה. אפשר לנסות מסלול הכוונה כללי.',
      'No verified recipient is available for this route. Try general triage.',
    ),
    'session-expired': t(
      'האימות פג. יש לאמת שוב את הדוא״ל.',
      'Your session expired. Verify your email again.',
    ),
    'sign-in-required': t('יש לאמת את הדוא״ל לפני השליחה.', 'Verify your email before sending.'),
  };
  box.textContent =
    codes[error.message] ||
    t(
      'הפעולה לא הושלמה. הפרטים נשמרו בדף; אפשר לנסות שוב.',
      'The action did not complete. Your details are still on this page; you can retry.',
    );
  if (['session-expired', 'sign-in-required'].includes(error.message)) {
    state.verifiedEmail = null;
    state.otpRequested = false;
    state.step = 'review';
    render();
    showError(new Error('retry-auth'));
  }
  box.scrollIntoView({ block: 'start' });
}
async function liveAction(action) {
  try {
    setBusy(true);
    await action();
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}
function authPanel() {
  if (state.verifiedEmail?.toLowerCase() === state.email.toLowerCase())
    return `<p class="notice">${t('כתובת המענה אומתה: ', 'Reply address verified: ')}<bdi>${esc(state.email)}</bdi></p>`;
  return `<section class="review"><h2>${t('אימות כתובת המענה', 'Verify your reply address')}</h2><p>${t('נשלח קוד חד־פעמי כדי לוודא שהמענה יגיע אליך.', 'We’ll send a one-time code to make sure replies reach you.')}</p>${state.otpRequested ? `<form id="otp-form"><label for="token">${t('הקוד שנשלח בדוא״ל', 'Code from your email')}</label><input id="token" name="token" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" required><button class="primary" type="submit">${t('אימות הקוד', 'Verify code')}</button></form>${button('request-code', t('שליחת קוד נוסף', 'Send another code'), 'text-button')}` : button('request-code', t('שליחת קוד אימות', 'Send verification code'), 'secondary')}</section>`;
}
function liveDone() {
  return `${heading(t('הפנייה התקבלה.', 'Your request was received.'), t('הפנייה נשמרה במערכת. העברה בדוא״ל מתבצעת ברקע.', 'Your request is saved. Email forwarding runs in the background.'))}<article class="review"><h2>${t('מספר הפנייה', 'Request reference')}</h2><p dir="ltr">${esc(state.ticket.id)}</p><p>${{ queued: t('הדוא״ל ממתין להעברה.', 'Email is queued.'), provider_accepted: t('ספק הדוא״ל קיבל את ההודעה. זה אינו אישור שהנמען קרא אותה.', 'The email provider accepted the message. This does not confirm the recipient read it.'), failed: t('העברה בדוא״ל נכשלה ונדרש טיפול של מנהל המערכת. הפנייה עצמה נשמרה.', 'Email forwarding failed and needs operator attention. Your request is saved.') }[state.ticket.emailStatus] || ''}</p>${button('refresh-ticket', t('עדכון מצב', 'Refresh status'), 'secondary')}</article>`;
}
try {
  settings = await api('/api/config');
  render(false);
} catch {
  /* Keep a local, non-submitting demo if the API is unavailable. */
}
