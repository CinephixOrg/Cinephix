import React from 'react';
import { createPortal } from 'react-dom';

export default function AnalyzeModal({ isOpen, onClose, data }) {
  if (!isOpen) return null;

  const parsed = data?.parsed || {};

  return createPortal(
    <div className="modal modal-open">
      <div className="modal-box max-w-xl max-h-[80vh] overflow-y-auto">
        <h3 className="font-bold text-lg">Compatibility Analysis</h3>
        <div className="mt-4">
          <p className="text-sm mb-3"><strong>Analysis:</strong> {parsed.analysis || parsed.text || 'No analysis.'}</p>

          {parsed.strengths && (
            <div className="mb-2">
              <strong>Strengths:</strong>
              <ul className="list-disc ml-6">
                {parsed.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {parsed.weaknesses && (
            <div className="mb-2">
              <strong>Weaknesses:</strong>
              <ul className="list-disc ml-6">
                {parsed.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {parsed.conversation_starters && (
            <div className="mb-2">
              <strong>Conversation Starters:</strong>
              <ul className="ml-4">
                {parsed.conversation_starters.map((s, i) => <li key={i}>• {s}</li>)}
              </ul>
            </div>
          )}

          {parsed.graph_ascii && (
            <pre className="bg-base-200 p-3 rounded mt-3 text-sm">{parsed.graph_ascii}</pre>
          )}
        </div>

        <div className="modal-action">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>,
    document.body
  );
}
