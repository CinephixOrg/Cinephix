import React from 'react';
import { createPortal } from 'react-dom';

export default function AnalyzeModal({ isOpen, onClose, data }) {
  if (!isOpen) return null;

  const parsed = data?.parsed || {};
  const analysis = parsed.analysis || 'No analysis available.';
  const strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];
  const weaknesses = Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [];
  const conversationStarters = Array.isArray(parsed.conversation_starters)
    ? parsed.conversation_starters
    : [];
  const graphAscii = Array.isArray(parsed.graph_ascii)
    ? parsed.graph_ascii.join('\n')
    : parsed.graph_ascii;

  return createPortal(
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl max-h-[85vh] overflow-y-auto p-0">
        <div className="p-6 border-b border-base-300/70">
          <h3 className="font-bold text-2xl leading-tight">Compatibility Analysis</h3>
          <p className="text-sm text-base-content/60 mt-1">A quick, friendly read on how well you match.</p>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-2xl bg-base-200/70 p-4 border border-base-300/60">
            <div className="text-xs uppercase tracking-wide text-base-content/50 mb-2">Analysis</div>
            <p className="text-base leading-7 text-base-content/90">{analysis}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-base-200/50 p-4 border border-base-300/60">
              <div className="text-xs uppercase tracking-wide text-success mb-3 font-semibold">Strengths</div>
              {strengths.length ? (
                <ul className="space-y-2 text-sm leading-6">
                  {strengths.map((item, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="text-success mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-base-content/60">No strengths found.</p>
              )}
            </div>

            <div className="rounded-2xl bg-base-200/50 p-4 border border-base-300/60">
              <div className="text-xs uppercase tracking-wide text-warning mb-3 font-semibold">Weaknesses</div>
              {weaknesses.length ? (
                <ul className="space-y-2 text-sm leading-6">
                  {weaknesses.map((item, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="text-warning mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-base-content/60">No weaknesses found.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-base-200/50 p-4 border border-base-300/60">
            <div className="text-xs uppercase tracking-wide text-primary mb-3 font-semibold">Conversation Starters</div>
            {conversationStarters.length ? (
              <ul className="space-y-2 text-sm leading-6">
                {conversationStarters.map((item, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-base-content/60">No conversation starters available.</p>
            )}
          </div>

          {graphAscii && (
            <div className="rounded-2xl bg-base-200/50 p-4 border border-base-300/60">
              <div className="text-xs uppercase tracking-wide text-base-content/50 mb-3 font-semibold">Score Breakdown</div>
              <pre className="text-xs leading-6 whitespace-pre-wrap break-words text-base-content/80">{graphAscii}</pre>
            </div>
          )}
        </div>

        <div className="modal-action px-6 pb-6 pt-0">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>,
    document.body
  );
}
