const bi = (he, en) => ({ he, en });
export const categories = [
  {
    id: 'academic',
    icon: 'book',
    name: bi('לימודים ואקדמיה', 'Studies & academics'),
    description: bi('רישום לקורסים, בחינות וזכויות', 'Course registration, exams and rights'),
  },
  {
    id: 'money',
    icon: 'wallet',
    name: bi('שכר לימוד ומלגות', 'Tuition & scholarships'),
    description: bi('תשלומים, חיובים וסיוע כלכלי', 'Payments, charges and financial support'),
  },
  {
    id: 'welfare',
    icon: 'home',
    name: bi('רווחה וחיי הקמפוס', 'Wellbeing & campus life'),
    description: bi('מעונות, נגישות ושירותים בקמפוס', 'Housing, accessibility and campus services'),
  },
  {
    id: 'reserves',
    icon: 'flag',
    name: bi('מילואים', 'Reserve service'),
    description: bi('התאמות, השלמות וסיוע', 'Accommodations, catch-up and support'),
  },
  {
    id: 'community',
    icon: 'people',
    name: bi('תרבות וקהילה', 'Culture & community'),
    description: bi('אירועים, מועדונים ויוזמות', 'Events, clubs and student initiatives'),
  },
  {
    id: 'other',
    icon: 'chat',
    name: bi('משהו אחר / לא בטוח', 'Something else / not sure'),
    description: bi('נעזור למצוא את הכתובת המתאימה', 'Get help finding the right contact'),
  },
];
export const topics = [
  {
    id: 'course-registration',
    category: 'academic',
    name: bi('קושי ברישום לקורס', 'Trouble registering for a course'),
    role: 'academic',
    terms: [
      'register',
      'registration',
      'enroll',
      'enrol',
      'course',
      'courses',
      'רישום',
      'להירשם',
      'להרשם',
      'הרשמה',
      'קורס',
      'קורסים',
    ],
  },
  {
    id: 'exam-appeal',
    category: 'academic',
    name: bi('בחינות, ציונים וערעורים', 'Exams, grades and appeals'),
    role: 'academic',
    terms: [
      'exam',
      'exams',
      'grade',
      'appeal',
      'מבחן',
      'בחינה',
      'בחינות',
      'מבחנים',
      'ציון',
      'ציונים',
      'ערעור',
    ],
  },
  {
    id: 'academic-support',
    category: 'academic',
    name: bi('סיוע בלימודים', 'Help with studying'),
    role: 'academic',
    terms: ['tutor', 'tutoring', 'mentor', 'study help', 'חונכות', 'מנטור', 'תגבור', 'מרתון'],
  },
  {
    id: 'tuition-payment',
    category: 'money',
    name: bi('תשלום או חיוב שכר לימוד', 'Tuition payment or charge'),
    role: 'welfare',
    terms: [
      'tuition',
      'payment',
      'debt',
      'charge',
      'שכר לימוד',
      'שכ״ל',
      'שכל',
      'תשלום',
      'חוב',
      'חיוב',
    ],
  },
  {
    id: 'scholarship',
    category: 'money',
    name: bi('מלגה או סיוע כלכלי', 'Scholarship or financial support'),
    role: 'welfare',
    terms: ['scholarship', 'financial aid', 'מלגה', 'מלגות', 'סיוע כלכלי'],
  },
  {
    id: 'housing',
    category: 'welfare',
    name: bi('מעונות ודיור', 'Dormitories and housing'),
    role: 'welfare',
    terms: ['dorm', 'dorms', 'housing', 'rent', 'מעונות', 'דיור', 'שכירות'],
  },
  {
    id: 'accessibility',
    category: 'welfare',
    name: bi('נגישות והתאמות', 'Accessibility and accommodations'),
    role: 'welfare',
    terms: ['accessibility', 'disability', 'accommodation', 'נגישות', 'מוגבלות', 'התאמות', 'התאמה'],
  },
  {
    id: 'campus-services',
    category: 'welfare',
    name: bi('שירותים בקמפוס', 'Campus services'),
    role: 'welfare',
    terms: ['parking', 'cafeteria', 'campus service', 'חניה', 'קפטריה', 'שירותי קמפוס'],
  },
  {
    id: 'reserve-support',
    category: 'reserves',
    name: bi('סיוע בעקבות שירות מילואים', 'Support following reserve service'),
    role: 'reserves',
    terms: ['reserve', 'reservist', 'military', 'מילואים', 'מילואימניק', 'צו 8'],
  },
  {
    id: 'events',
    category: 'community',
    name: bi('אירועים וכרטיסים', 'Events and tickets'),
    role: 'culture',
    terms: ['event', 'concert', 'festival', 'אירוע', 'אירועים', 'כרטיס', 'כרטיסים', 'הופעה'],
  },
  {
    id: 'initiatives',
    category: 'community',
    name: bi('מועדון או יוזמה סטודנטיאלית', 'Student club or initiative'),
    role: 'culture',
    terms: ['club', 'initiative', 'volunteer', 'מועדון', 'יוזמה', 'התנדבות'],
  },
  {
    id: 'general-help',
    category: 'other',
    name: bi('עזרה במציאת גורם מתאים', 'Help finding the right contact'),
    role: 'triage',
    terms: [],
  },
];
export const campuses = [
  { id: 'mount-scopus', name: bi('הר הצופים', 'Mount Scopus') },
  { id: 'givat-ram', name: bi('אדמונד י׳ ספרא (גבעת רם)', 'Edmond J. Safra (Givat Ram)') },
  { id: 'ein-kerem', name: bi('עין כרם', 'Ein Kerem') },
  { id: 'rehovot', name: bi('רחובות', 'Rehovot') },
  { id: 'unknown', name: bi('לא בטוח / קמפוס אחר', 'Not sure / another campus') },
];
export const roles = {
  academic: bi('צוות האקדמיה באגודה', 'Union academic support team'),
  welfare: bi('צוות הרווחה באגודה', 'Union welfare team'),
  reserves: bi('צוות המילואים באגודה', 'Union reserve-service team'),
  culture: bi('צוות התרבות והקהילה באגודה', 'Union culture and community team'),
  triage: bi('צוות הכוונה באגודה', 'Union general triage team'),
};
export function normalize(text) {
  return String(text)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u0591-\u05c7]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
// Deliberately modest baseline: explainable keyword matches, not probabilities.
// Hebrew prefixes are enumerated; arbitrary substring matches are avoided.
export function suggest(text) {
  const cleaned = normalize(text);
  if (!cleaned) return [];
  const tokens = cleaned.split(' ');
  return topics
    .map((topic) => {
      const matched = topic.terms.filter((term) => {
        const key = normalize(term);
        if (key.includes(' ')) return ` ${cleaned} `.includes(` ${key} `);
        const hebrew = /[א-ת]/.test(key);
        return tokens.some(
          (token) =>
            token === key ||
            (hebrew &&
              ['ב', 'ל', 'ה', 'ו', 'מ', 'ש', 'וב', 'ול', 'וה', 'מה', 'לה'].some(
                (prefix) => token === prefix + key,
              )),
        );
      });
      return { topicId: topic.id, matched, score: matched.length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
export const registrationOptions = [
  { id: 'payment', name: bi('מופיעה חסימה בגלל תשלום', 'The system shows a payment block') },
  { id: 'inactive', name: bi('הרישום שלי ללימודים לא פעיל', 'My study registration is inactive') },
  {
    id: 'course',
    name: bi('בעיה בקורס מסוים או באישור אקדמי', 'A specific course or academic approval issue'),
  },
  { id: 'technical', name: bi('תקלה טכנית או בעיית כניסה', 'A technical error or login problem') },
  { id: 'unknown', name: bi('לא ברור לי מה הסיבה', 'I am not sure what is causing it') },
];
const university = {
  payment: {
    name: bi('מדור שכר לימוד', 'Tuition office'),
    reason: bi(
      'לפי התשובה שלך, כדאי להתחיל בבירור חסימת התשלום. אין צורך לצרף פרטי בנק או היסטוריית תשלומים.',
      'Based on your answer, start by asking about the payment block. Bank details and payment history are unnecessary for routing.',
    ),
    url: 'https://studentsadmin.huji.ac.il/',
  },
  inactive: {
    name: bi('מזכירות החוג / הפקולטה', 'Department / faculty administration'),
    reason: bi(
      'כדאי לברר את מצב הרישום ללימודים עם המזכירות. הגורם המדויק תלוי בחוג ובשלב הלימודים.',
      'Ask administration to check your study-registration status. The exact office depends on your department and stage of study.',
    ),
    url: 'https://info.huji.ac.il/registration-process/steps',
  },
  course: {
    name: bi('מזכירות החוג / הפקולטה', 'Department / faculty administration'),
    reason: bi(
      'בקשה הקשורה לקורס מסוים עשויה לדרוש טיפול של המזכירות או אישור אקדמי. המזכירות יכולה לכוון לגורם המאשר.',
      'A specific course issue may need administrative action or academic approval. Administration can identify the appropriate approver.',
    ),
    url: 'https://studentsadmin.huji.ac.il/',
  },
  technical: {
    name: bi('תמיכת המערכת דרך אתר האוניברסיטה', 'System support via the university website'),
    reason: bi(
      'לפי התשובה שלך, כדאי להתחיל בתמיכה של המערכת שבה מופיעה התקלה. אפשר לבקש מהאגודה עזרה בהכוונה.',
      'Based on your answer, start with support for the affected system. The union can also help you find the right team.',
    ),
    url: 'https://www.huji.ac.il/',
  },
};
// Illustrative policy. No verified campus-to-mailbox directory has been supplied.
export function resolveRoute({ topicId, campus, registrationIssue }) {
  const topic = topics.find((x) => x.id === topicId);
  if (!topic) return { status: 'invalid', roleId: 'triage', university: null };
  if (!campuses.some((x) => x.id === campus))
    return { status: 'needs-campus', roleId: 'triage', university: null };
  if (
    topicId === 'course-registration' &&
    !registrationOptions.some((x) => x.id === registrationIssue)
  ) {
    return { status: 'needs-question', roleId: 'academic', university: null };
  }
  const universityRoute =
    topicId === 'course-registration'
      ? university[registrationIssue] || null
      : topicId === 'tuition-payment'
        ? university.payment
        : null;
  return {
    status: 'example',
    roleId: campus === 'unknown' ? 'triage' : topic.role,
    university: universityRoute,
    needsDepartment:
      universityRoute === university.course || universityRoute === university.inactive,
  };
}
export function topicFromUrl(url) {
  const id = new URL(url).searchParams.get('topic');
  return topics.some((x) => x.id === id) ? id : null;
}
export function shareUrl(base, topicId, lang) {
  const url = new URL('/', base);
  if (topics.some((x) => x.id === topicId)) url.searchParams.set('topic', topicId);
  url.searchParams.set('lang', lang === 'en' ? 'en' : 'he');
  return url.href;
}
