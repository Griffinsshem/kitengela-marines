"use client";

import { useState } from "react";

import { CONTROL_CLASSES, Field } from "@/components/admin/Field";
import { Honeypot } from "@/components/forms/Honeypot";
import { useServerRenderedAt } from "@/lib/formTiming";
import { API_URL } from "@/lib/session";

const INTERESTS = [
  "Shirt sponsorship",
  "Match sponsorship",
  "Training kit",
  "Equipment",
  "Transport",
  "Community partnership",
  "Something else",
];

export function PartnershipForm() {
  const renderedAt = useServerRenderedAt();
  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [interest, setInterest] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch(`${API_URL}/api/v1/partnership-enquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        organisation,
        email,
        phone: phone.trim() || null,
        interest: interest || null,
        message,
        website,
        ...(renderedAt === null ? {} : { rendered_at: renderedAt }),
      }),
    }).catch(() => null);

    setBusy(false);

    if (!response) {
      setError("Your enquiry could not be sent just now. Please try again shortly.");
      return;
    }

    if (response.status === 429) {
      setError("Too many enquiries have been sent from here. Please try again later.");
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
        <p className="font-display text-xl font-extrabold uppercase">Enquiry sent</p>
        <p className="mt-3 text-muted">
          Thank you for your interest in supporting the club. Somebody will be in touch.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="relative space-y-5">
      <Honeypot value={website} onChange={setWebsite} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="p_name">
          <input
            id="p_name"
            required
            maxLength={160}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={CONTROL_CLASSES}
          />
        </Field>

        <Field label="Organisation" htmlFor="organisation">
          <input
            id="organisation"
            required
            maxLength={160}
            value={organisation}
            onChange={(event) => setOrganisation(event.target.value)}
            className={CONTROL_CLASSES}
          />
        </Field>

        <Field label="Email" htmlFor="p_email">
          <input
            id="p_email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={CONTROL_CLASSES}
          />
        </Field>

        <Field label="Phone" htmlFor="p_phone" hint="Optional.">
          <input
            id="p_phone"
            type="tel"
            maxLength={32}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className={CONTROL_CLASSES}
          />
        </Field>

        <Field label="Interested in" htmlFor="interest" hint="Optional." className="sm:col-span-2">
          <select
            id="interest"
            value={interest}
            onChange={(event) => setInterest(event.target.value)}
            className={CONTROL_CLASSES}
          >
            <option value="">Not sure yet</option>
            {INTERESTS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Message" htmlFor="p_message">
        <textarea
          id="p_message"
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
        {busy ? "Sending…" : "Send enquiry"}
      </button>
    </form>
  );
}
