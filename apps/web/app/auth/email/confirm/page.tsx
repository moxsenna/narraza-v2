/**
 * Confirm login via native form POST to /auth/email/consume.
 * Separate path from page avoids App Router page+route conflicts (405 on GET).
 */
export default function ConfirmPage() {
  return (
    <div style={{ maxWidth: 400, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Confirm login</h1>
      <p>Click the button below to complete your login.</p>
      <form id="confirm-form" method="POST" action="/auth/email/consume">
        <button type="submit" style={{ padding: '10px 20px', fontSize: 16 }}>
          Confirm login
        </button>
      </form>
    </div>
  );
}
