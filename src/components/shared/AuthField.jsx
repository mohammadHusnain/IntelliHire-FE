import { forwardRef, useId, useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

/**
 * Labelled input for auth/onboarding forms: optional leading icon, inline error,
 * password visibility toggle and a Caps Lock hint for password fields.
 */
const AuthField = forwardRef(function AuthField(
  { label, icon: Icon, error, hint, type = "text", trailing, className = "", onKeyUp, onBlur, ...props },
  ref,
) {
  const id = useId();
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const isPassword = type === "password";
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      {(label || trailing) && (
        <div className="mb-1.5 flex items-center justify-between gap-3">
          {label && (
            <label htmlFor={id} className="text-[13px] font-medium text-stone-700">
              {label}
            </label>
          )}
          {trailing}
        </div>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            size={17}
            aria-hidden
            className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
              error ? "text-red-500" : "text-stone-400"
            }`}
          />
        )}
        <input
          ref={ref}
          id={id}
          type={isPassword && show ? "text" : type}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          onKeyUp={(e) => {
            if (isPassword) setCaps(e.getModifierState?.("CapsLock") ?? false);
            onKeyUp?.(e);
          }}
          onBlur={(e) => {
            setCaps(false);
            onBlur?.(e);
          }}
          className={`field ${Icon ? "field-icon" : ""} ${isPassword ? "pr-12" : ""}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            className="icon-btn absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-ink"
          >
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-red-600 animate-fade-in">
          <AlertCircle size={13} className="shrink-0" /> {error}
        </p>
      ) : caps ? (
        <p className="mt-1.5 text-[12.5px] font-medium text-amber-600 animate-fade-in">Caps Lock is on</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12.5px] text-stone-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export default AuthField;
