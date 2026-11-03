"use client";

/** Submit button that asks for confirmation. Place inside a <form action={...}>. */
export function DeleteButton({ label = "Delete", confirmText }: { label?: string; confirmText: string }) {
  return (
    <button
      type="submit"
      className="btn-danger"
      onClick={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {label}
    </button>
  );
}
