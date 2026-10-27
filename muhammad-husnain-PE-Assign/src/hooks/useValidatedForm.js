import { useCallback, useMemo, useState } from 'react';

/**
 * Form state with live validation that does not nag.
 * A field's error is shown once the user has left that field with something
 * typed in it, or after they press Enter to check the whole form. Empty fields
 * the user has not tried to submit stay quiet; the results panel tells them
 * what is still missing instead.
 *
 * @param {Record<string, string>} initialValues
 * @param {Record<string, (raw: string) => {ok: boolean, value?: number, message?: string}>} validators
 *   Called in key order; order also decides which invalid field gets focus.
 */
export function useValidatedForm(initialValues, validators) {
  const [values, setValues] = useState(initialValues);
  const [visited, setVisited] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const keys = Object.keys(validators);

  const results = useMemo(
    () => Object.fromEntries(keys.map((key) => [key, validators[key](values[key])])),
    // Validators are module-level functions, so values are the only input.
    [values],
  );

  const fields = Object.fromEntries(
    keys.map((key) => {
      const result = results[key];
      const isEmpty = values[key].trim() === '';
      const showError = !result.ok && (submitted || (visited[key] && !isEmpty));
      return [key, { value: values[key], result, isEmpty, error: showError ? result.message : '' }];
    }),
  );

  const allValid = keys.every((key) => results[key].ok);
  const hasVisibleError = keys.some((key) => fields[key].error);
  const pending = keys.filter((key) => !results[key].ok);

  const setValue = useCallback((key, value) => setValues((prev) => ({ ...prev, [key]: value })), []);
  const visit = useCallback((key) => setVisited((prev) => (prev[key] ? prev : { ...prev, [key]: true })), []);

  /** Reveals every error and returns the first invalid field key, or null. */
  const submit = useCallback(() => {
    setSubmitted(true);
    return keys.find((key) => !results[key].ok) ?? null;
  }, [results]);

  return { values, fields, allValid, hasVisibleError, pending, setValue, visit, submit };
}
