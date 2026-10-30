// Mixed typing and speech: finalized phrases are appended once.
// Later results must not replay text the player has already edited.

export function joinSpeech(base, addition) {
  const extra = String(addition || '').replace(/\s+/g, ' ').trim();
  if (!extra) return base || '';
  if (!base) return extra;
  return /\s$/.test(base) ? base + extra : base + ' ' + extra;
}

export function createDictationSession(committed = '') {
  return { committed, nextIndex: 0, droppedInterim: -1, interimIndex: -1 };
}

export function noteDictationEdit(session, value) {
  session.committed = value;
  if (session.interimIndex >= 0) session.droppedInterim = session.interimIndex;
  return value;
}

export function mergeDictationResult(session, results) {
  if (results.length < session.nextIndex) session.nextIndex = 0;
  const fresh = [];
  let interim = '';
  let interimIndex = -1;
  let lastFinalIndex = -1;
  for (let i = 0; i < results.length; i++) {
    const text = String(results[i].transcript || '').replace(/\s+/g, ' ').trim();
    if (!results[i].isFinal) {
      interim = text;
      interimIndex = i;
      continue;
    }
    lastFinalIndex = i;
    if (i < session.nextIndex || i === session.droppedInterim || !text) continue;
    fresh.push(text);
  }
  if (lastFinalIndex >= session.nextIndex) session.nextIndex = lastFinalIndex + 1;
  if (session.droppedInterim !== -1 && session.droppedInterim < session.nextIndex) session.droppedInterim = -1;
  if (fresh.length) session.committed = joinSpeech(session.committed, fresh.join(' ')).slice(0, 8000);
  session.interimIndex = interimIndex;
  const showInterim = interim && interimIndex !== session.droppedInterim;
  return (showInterim ? joinSpeech(session.committed, interim) : session.committed).slice(0, 8000);
}
