"use client";

import { useState } from "react";

import { CONTROL_CLASSES, Field } from "@/components/admin/Field";
import { Honeypot } from "@/components/forms/Honeypot";
import { useServerRenderedAt } from "@/lib/formTiming";
import { API_URL } from "@/lib/session";

/**
 * The club's contact form.
 *
 * Messages are stored for the club to read in the admin, not emailed onwards:
 * an endpoint that sends mail on an anonymous request is a way to harass
 * people through the club's own address.
 */
export function ContactForm() {
  const renderedAt = useServerRenderedAt();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch(`${API_URL}/api/v1/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        phone: phone.trim() || null,
        subject: subject.trim() || null,
        message,
        website,
        ...(renderedAt === null ? {} : { rendered_at: renderedAt }),
      }),
    }).catch(() => null);

    setBusy(false);

    if (!response) {
      setError("Your message could not be sent just now. Please try again shortly.");
      return;
    }

    if (response.status === 429) {
      setError("Too many messages have been sent from here. Please try again later.");
      return;
    }

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const details = (body as { error?: { details?: { message: string }[] } })?.error?.details;
      setError(
        details?.length
          ? details.map((d) => d.message).join("; ")
          : "Please check the form and try again.",
      );
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div role="status" className="border border-accent-ink bg-chalk px-6 py-8">
        <p className="font-display text-xl font-extrabold uppercase">Message sent</p>
        <p className="mt-3 text-muted">Thank you. Somebody from the club will get back to you.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="relative space-y-5">
      <Honeypot value={website} onChange={setWebsite} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name">
          <input
            id="name"
            required
            maxLength={160}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={CONTROL_CLASSES}
          />
        </Field>

        <Field label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={CONTROL_CLASSES}
          />
        </Field>

        <Field label="Phone" htmlFor="phone" hint="Optional.">
          <input
            id="phone"
            type="tel"
            maxLength={32}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className={CONTROL_CLASSES}
          />
        </Field>

        <Field label="Subject" htmlFor="subject" hint="Optional.">
          <input
            id="subject"
            maxLength={200}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className={CONTROL_CLASSES}
          />
        </Field>
      </div>

      <Field label="Message" htmlFor="message">
        <textarea
          id="message"
          required
          rows={6}
          minLength={10}
          maxLength={5000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className={CONTROL_CLASSES}
        />
      </Field>

      {error ? (
        <p role="alert" className="border border-line bg-chalk px-4 py-3 font-semibold">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-control bg-highlight px-6 py-3 font-semibold text-on-highlight disabled:opacity-60"
      >
        {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
