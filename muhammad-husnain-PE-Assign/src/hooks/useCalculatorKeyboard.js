import { useEffect, useRef, useState } from 'react';

const KEY_TO_TEXT = { '*': '×', x: '×', X: '×', '/': '÷' };

/** Maps a KeyboardEvent to a calculator action, or null if the key is not used. */
export function keyToAction(key) {
  if (/^[0-9.+\-^%!()]$/.test(key)) return { type: 'input', text: key };
  if (key in KEY_TO_TEXT) return { type: 'input', text: KEY_TO_TEXT[key] };
  if (key === 'Enter' || key === '=') return { type: 'evaluate' };
  if (key === 'Backspace') return { type: 'backspace' };
  if (key === 'Escape' || key === 'Delete') return { type: 'clear' };
  return null;
}

/** Id of the on-screen key that an action corresponds to (for the press flash). */
export function actionKeyId(action) {
  return action.type === 'input' ? `input:${action.text}` : action.type;
}

/**
 * Listens for calculator keys on the document while `enabled`.
 * Typing inside a text field is ignored, so the loan and bill forms are never
 * affected. Returns the id of the key to flash briefly on screen, so keyboard
 * users see the same feedback as people tapping the keys.
 */
export function useCalculatorKeyboard(enabled, dispatch) {
  const [flashKey, setFlashKey] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const action = keyToAction(event.key);
      if (!action) return;
      // Stops "/" opening Firefox quick find, and Enter re-clicking a focused key.
      event.preventDefault();
      dispatch(action);
      setFlashKey(actionKeyId(action));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlashKey(null), 140);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      clearTimeout(timer.current);
    };
  }, [enabled, dispatch]);

  return flashKey;
}
