import { Label } from "@/components/ui/label";

type FormFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
};

// Label + control + hint/error. Pair the control with fieldA11y() so it points at the message.
export function FormField({ id, label, required, error, hint, children }: FormFieldProps) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-red-600 dark:text-red-400">
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-message`} className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-message`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function fieldA11y(id: string, error?: string, hasHint = false) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error || hasHint ? `${id}-message` : undefined,
  };
}
