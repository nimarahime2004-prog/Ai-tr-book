import React from 'react';
import { BookProject } from '../types.ts';

interface PrintDocumentProps {
  project: BookProject;
}

export const PrintDocument: React.FC<PrintDocumentProps> = ({ project }) => {
  return (
    <div className="print-only hidden font-['Vazirmatn'] text-black p-8 bg-white min-h-screen">
      
      {/* Title Page */}
      <div className="book-page text-center pt-48 pb-64 flex flex-col items-center justify-center min-h-[90vh]">
        <h1 className="text-4xl font-extrabold text-[#1a365d] mb-6">
          {project.title || project.originalTitle}
        </h1>
        {project.originalTitle && (
          <h2 className="text-xl font-normal text-slate-600 mb-8 font-serif" dir="ltr">
            {project.originalTitle}
          </h2>
        )}
        <div className="w-24 h-1 bg-[#1a365d] mb-12" />
        <p className="text-lg text-slate-800 font-medium mb-3">
          نویسنده: {project.author || 'نامشخص'}
        </p>
        <p className="text-base text-slate-600 italic">
          ترجمه و ویرایش: {project.translator || 'سامانه هوشمند ترجمه کتاب'}
        </p>
      </div>

      {/* Chapters & Content */}
      <div className="space-y-8">
        {project.chunks
          .filter(c => c.translatedHtml)
          .map((chunk, idx) => (
            <div key={chunk.id} className="book-chapter-break pt-8">
              <div
                className="book-render-content"
                dangerouslySetInnerHTML={{ __html: chunk.translatedHtml || '' }}
              />
            </div>
          ))}
      </div>

    </div>
  );
};
