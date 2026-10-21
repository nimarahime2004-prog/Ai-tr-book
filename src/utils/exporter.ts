import { BookProject } from '../types.ts';
import { BOOK_THEMES } from '../constants/themes.ts';

export async function downloadDocx(project: BookProject): Promise<boolean> {
  try {
    const chapters = project.chunks
      .filter(c => c.translatedHtml && c.translatedHtml.trim().length > 0)
      .map(c => ({
        title: `${c.chapterTitle} (بخش ${c.chunkNumber})`,
        htmlContent: c.translatedHtml,
      }));

    if (chapters.length === 0) {
      alert('هیچ بخشی هنوز ترجمه نشده است.');
      return false;
    }

    const res = await fetch('/api/export/docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: project.title || project.originalTitle || 'کتاب ترجمه شده',
        author: project.author,
        translator: project.translator || 'سامانه هوشمند ترجمه کتاب',
        chapters,
        designConfig: project.designConfig,
      }),
    });

    if (!res.ok) {
      throw new Error(`خطا در ارتباط با سرور: ${res.statusText}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title || 'book-translated'}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err: any) {
    console.error('Docx download error, falling back to Word-HTML format:', err);
    downloadWordHtml(project);
    return true;
  }
}

export function downloadWordHtml(project: BookProject) {
  const design = project.designConfig || {
    themeId: 'spiritual',
    headerText: '',
    footerText: '',
    showHeader: false,
    showFooter: false,
    showPageNumbers: true,
    fontFamily: 'Vazirmatn Medium',
  };

  const theme = BOOK_THEMES[design.themeId] || BOOK_THEMES.spiritual;
  const bgColor = theme.pageBgColor || '#fbf6ea';
  const headingColor = theme.headingColor || '#1a365d';
  const accentColor = theme.accentColor || '#b45309';

  const chaptersHtml = project.chunks
    .filter(c => c.translatedHtml)
    .map(c => `
      <div style="page-break-before: always; margin-top: 30px;">
        ${design.showHeader && design.headerText ? `
        <div style="border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 24px; font-size: 9pt; color: #718096; display: flex; justify-content: space-between;">
          <span>${design.headerText}</span>
          <span dir="ltr">${project.originalTitle || ''}</span>
        </div>` : ''}
        <h2 style="color: ${headingColor}; font-size: 18pt; text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">${c.chapterTitle} - بخش ${c.chunkNumber}</h2>
        <div style="text-align: center; font-size: 11pt; color: ${accentColor}; margin: 8px 0 16px 0;">${theme.dividerSymbol || '❦ ✤ ❦'}</div>
        <div style="margin-top: 20px;">${c.translatedHtml}</div>
        ${design.showFooter && design.footerText ? `
        <div style="border-top: 1px solid #cbd5e1; padding-top: 6px; margin-top: 35px; font-size: 9pt; color: #718096; text-align: center;">
          ${design.footerText}
        </div>` : ''}
      </div>
    `)
    .join('\n');

  const fullWordHtml = `
  <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head>
    <meta charset="utf-8">
    <title>${project.title}</title>
    <!--[if gte mso 9]>
    <xml>
      <w:WordDocument>
        <w:View>Print</w:View>
        <w:Zoom>100</w:Zoom>
        <w:DoNotOptimizeForBrowser/>
      </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap');
      body {
        font-family: '${design.fontFamily || "Vazirmatn Medium"}', 'Vazirmatn', 'B Nazanin', 'Tahoma', sans-serif;
        direction: rtl;
        text-align: right;
        margin: 40px;
        background-color: ${bgColor};
        color: #2d3748;
      }
      h1 { color: ${headingColor}; font-size: 24pt; margin-bottom: 20px; text-align: center; font-family: '${design.fontFamily || "Vazirmatn Medium"}', sans-serif; }
      h2 { color: #2b6cb0; font-size: 18pt; margin-top: 25px; margin-bottom: 12px; }
      h3 { color: #2c5282; font-size: 14pt; margin-top: 15px; margin-bottom: 8px; }
      p { line-height: 1.9; font-size: 12pt; text-align: justify; margin-bottom: 14px; }
      blockquote { border-right: 4px solid #3182ce; padding: 10px 18px; margin: 15px 0; background: #f7fafc; color: #4a5568; font-style: italic; }
      span.highlight { color: #9b2c2c; font-weight: bold; }
      img, .book-embedded-image { max-width: 85%; height: auto; display: block; margin: 18px auto; border-radius: 8px; }
      .book-illustration-wrap { text-align: center; margin: 20px 0; }
    </style>
  </head>
  <body>
    <div style="text-align: center; margin-top: 80px; margin-bottom: 100px;">
      <h1>${project.title || project.originalTitle}</h1>
      <p style="font-size: 14pt; color: #4a5568;">نویسنده: ${project.author || 'نامشخص'}</p>
      <p style="font-size: 12pt; color: #718096; font-style: italic;">مترجم: ${project.translator || 'سامانه هوشمند ترجمه کتاب'}</p>
      ${design.showHeader && design.headerText ? `<p style="font-size: 11pt; color: #a0aec0; margin-top: 15px;">${design.headerText}</p>` : ''}
    </div>
    ${chaptersHtml}
  </body>
  </html>`;

  const blob = new Blob(['\ufeff', fullWordHtml], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.title || 'book-translated'}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadStyledHtml(project: BookProject) {
  const content = project.chunks
    .filter(c => c.translatedHtml)
    .map(c => `
      <section class="chapter-section" style="margin-bottom: 50px; border-bottom: 1px solid #e2e8f0; padding-bottom: 30px;">
        <div class="chapter-meta" style="color: #718096; font-size: 14px; margin-bottom: 10px;">${c.chapterTitle} | بخش ${c.chunkNumber}</div>
        ${c.translatedHtml}
      </section>
    `)
    .join('\n');

  const htmlDoc = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${project.title || project.originalTitle}</title>
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;600;700;800&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Vazirmatn', sans-serif;
      direction: rtl;
      text-align: right;
      background: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 40px 20px;
    }
    .book-container {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 60px 50px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    .book-header {
      text-align: center;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 40px;
      margin-bottom: 50px;
    }
    h1 { color: #1a365d; font-size: 26pt; margin-bottom: 15px; }
    h2 { color: #2b6cb0; font-size: 18pt; margin-top: 25px; margin-bottom: 12px; }
    h3 { color: #2c5282; font-size: 14pt; margin-top: 15px; margin-bottom: 8px; }
    p { line-height: 1.95; font-size: 12.5pt; text-align: justify; margin-bottom: 16px; color: #334155; }
    blockquote { border-right: 4px solid #3182ce; padding: 12px 20px; margin: 18px 0; background: #f0f7ff; color: #1e293b; font-style: italic; border-radius: 0 8px 8px 0; }
  </style>
</head>
<body>
  <div class="book-container">
    <div class="book-header">
      <h1>${project.title || project.originalTitle}</h1>
      <p style="font-size: 16px; color: #64748b; margin: 8px 0;">نویسنده: ${project.author || 'نامشخص'}</p>
      <p style="font-size: 14px; color: #94a3b8; font-style: italic; margin: 5px 0;">مترجم: ${project.translator || 'سامانه هوشمند ترجمه کتاب'}</p>
    </div>
    <div class="book-content">
      ${content}
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.title || 'book-translated'}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadPlainText(project: BookProject) {
  let plain = `# ${project.title || project.originalTitle}\n`;
  if (project.author) plain += `نویسنده: ${project.author}\n`;
  if (project.translator) plain += `مترجم: ${project.translator}\n`;
  plain += `\n=========================================\n\n`;

  project.chunks
    .filter(c => c.translatedHtml)
    .forEach(c => {
      plain += `### ${c.chapterTitle} (بخش ${c.chunkNumber})\n\n`;
      const textOnly = (c.translatedHtml || '')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<\/blockquote>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      plain += `${textOnly}\n\n-----------------------------------------\n\n`;
    });

  const blob = new Blob([plain], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.title || 'book-translated'}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportProjectJson(project: BookProject) {
  const jsonStr = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.title || 'project'}-backup.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
