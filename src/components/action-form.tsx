"use client";

import { startTransition, useActionState, useRef } from "react";
import type { FormState } from "@/app/actions";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/** A form bound to a server action that shows errors and resets itself on success. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, dispatch, pending] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await action(prev, formData);
    if (!result?.error) ref.current?.reset();
    return result;
  }, undefined);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => dispatch(formData));
      }}
    >
      {state?.error && <p className="alert-error md:col-span-full">{state.error}</p>}
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
