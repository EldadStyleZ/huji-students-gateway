import { topics, campuses, registrationOptions } from '../public/routing.js';

const referenceMarker = '<!--gateway-ticket-reference-->';
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );

export function ticketEmail(input, replyEmail, config) {
  const he = input.lang === 'he';
  const lang = he ? 'he' : 'en';
  const dir = he ? 'rtl' : 'ltr';
  const align = he ? 'right' : 'left';
  const t = (hebrew, english) => (he ? hebrew : english);
  const title = topics.find((topic) => topic.id === input.topicId).name[lang];
  const heading = t('פנייה לשער הפניות לסטודנטים', 'Student support request');
  const fields = [
    [t('נושא', 'Topic'), title],
    [t('קמפוס', 'Campus'), campuses.find((campus) => campus.id === input.campus).name[lang]],
    [
      t('מצב הרישום שנבחר', 'Selected registration situation'),
      registrationOptions.find((option) => option.id === input.registrationIssue)?.name[lang] ||
        t('לא רלוונטי', 'Not applicable'),
    ],
    [t('שם', 'Name'), input.name || t('לא נמסר', 'Not provided')],
    [t('דוא״ל למענה', 'Reply to'), replyEmail, 'ltr'],
  ];
  const stagingNotice = t(
    'זוהי הודעת בדיקה בלבד, ללא מידע של סטודנטים.',
    'This is a test message only, containing no student data.',
  );
  const lineStyle = `direction: ${dir}; text-align: ${align};`;
  const valueHtml = (value, valueDir = dir) =>
    `<span dir="${valueDir}" style="display: inline-block; max-width: 100%; direction: ${valueDir}; unicode-bidi: isolate; overflow-wrap: anywhere; word-break: break-word">${escapeHtml(value)}</span>`;
  const paragraphs = input.description
    .split(/\r?\n/)
    .map(
      (line) =>
        `<p dir="${dir}" style="margin: 0 0 8px; ${lineStyle} overflow-wrap: anywhere; word-break: break-word">${escapeHtml(line) || '<br />'}</p>`,
    )
    .join('\n');
  return {
    subject: `${config.staging ? '[STAGING TEST] ' : ''}${t('[שער הפניות]', '[Student gateway]')} ${title}`,
    text: [
      heading,
      ...(config.staging ? [stagingNotice] : []),
      ...fields.map(
        ([label, value, valueDir]) =>
          `${label}: ${he && valueDir === 'ltr' ? `\u2066${value}\u2069` : value}`,
      ),
      '',
      input.description,
    ].join('\n'),
    // Direction and alignment live on body children: inboxes may strip html/body attributes.
    html: `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(heading)}</title></head>
<body lang="${lang}" dir="${dir}" style="margin: 0; padding: 24px; background: #ffffff; color: #172334; font-family: Arial, sans-serif; line-height: 1.6; ${lineStyle}">
<div lang="${lang}" dir="${dir}" style="max-width: 600px; margin: 0 auto; ${lineStyle}">
<h1 dir="${dir}" style="font-size: 22px; ${lineStyle}">${escapeHtml(heading)}</h1>
${config.staging ? `<p dir="${dir}" style="${lineStyle}">${escapeHtml(stagingNotice)}</p>` : ''}
${fields.map(([label, value, valueDir]) => `<p dir="${dir}" style="margin: 0 0 14px; ${lineStyle}"><strong>${escapeHtml(label)}:</strong><br />${valueHtml(value, valueDir)}</p>`).join('\n')}
<h2 dir="${dir}" style="font-size: 18px; ${lineStyle}">${t('תיאור הפנייה', 'Request description')}</h2>
${paragraphs}
<p dir="${dir}" style="margin-top: 28px; font-size: 13px; ${lineStyle}">${t('מספר הפנייה', 'Request reference')}:<br /><span dir="ltr" style="display: inline-block; max-width: 100%; direction: ltr; unicode-bidi: isolate; overflow-wrap: anywhere; word-break: break-word">${referenceMarker}</span></p>
</div>
</body>
</html>`,
  };
}

export function emailWithReference(payload, ticketId) {
  // The database assigns this ID and already adds it to the subject and text.
  // Fill only the trusted HTML marker; escaped student content cannot supply one.
  if (!payload.html?.includes(referenceMarker)) return payload;
  if (!/^[0-9a-f-]{36}$/i.test(ticketId || '')) throw new Error('invalid-email-reference');
  return { ...payload, html: payload.html.replace(referenceMarker, escapeHtml(ticketId)) };
}
