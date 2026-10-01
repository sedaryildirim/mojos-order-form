// A validation message tied to its field: pass the same id to the input's aria-describedby.
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert">
      {message}
    </p>
  );
}
