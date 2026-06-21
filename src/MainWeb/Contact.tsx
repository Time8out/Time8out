// Contact.tsx — Time8out
// Split-panel layout that feels like a native homepage section.
// No card border or radius — left dark panel bleeds full-height,
// right form sits on the page background. Centered via .container.

import { useState } from "react";

type FormState = {
  name: string;
  email: string;
  business: string;
  type: string;
  message: string;
};

type SubmitStatus = "idle" | "sending" | "success" | "error";

const BUSINESS_TYPES = [
  { value: "", label: "Select your business type…" },
  { value: "employee", label: "🏢 Small business / Office — Employee tracking" },
  { value: "gym", label: "🏋️ Gym or Fitness studio" },
  { value: "esl", label: "📚 ESL school or Tutoring center" },
  { value: "other", label: "🌐 Other" },
];

const CONTACT_CHANNELS = [
  {
    icon: "📧",
    label: "Email",
    value: "servicesjmseptember@gmail.com",
    href: "mailto:servicesjmseptember@gmail.com",
  },
  {
    icon: "📍",
    label: "Based in",
    value: "Baguio City, Philippines",
    href: null,
  },
  {
    icon: "⏱️",
    label: "Response time",
    value: "Usually within 24 hours",
    href: null,
  },
];

export default function Contact() {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    business: "",
    type: "",
    message: "",
  });
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errors, setErrors] = useState<Partial<FormState>>({});

  const validate = (): boolean => {
    const e: Partial<FormState> = {};
    if (!form.name.trim()) e.name = "Your name is required.";
    if (!form.email.trim()) {
      e.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = "Please enter a valid email address.";
    }
    if (!form.type) e.type = "Please select a business type.";
    if (!form.message.trim()) e.message = "A message is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormState]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setStatus("sending");
    await new Promise((res) => setTimeout(res, 1800));
    setStatus("success");
  };

  const handleReset = () => {
    setForm({ name: "", email: "", business: "", type: "", message: "" });
    setErrors({});
    setStatus("idle");
  };

  return (
    <>
      <style>{`
        /* ── Section shell — full-width dark bg so left panel bleeds edge-to-edge ── */
        .contact-section {
          background: var(--color-text);
          overflow: hidden;
          position: relative;
        }

        /* Subtle top border to separate from previous section */
        .contact-section::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(233,82,14,0.4) 30%,
            rgba(14,165,233,0.4) 70%,
            transparent 100%
          );
        }

        /* ── Inner grid — constrained by .container ── */
        .contact-grid {
          display: grid;
          grid-template-columns: 400px 1fr;
          gap: var(--space-16);
          padding-top: var(--space-20);
          padding-bottom: var(--space-20);
          align-items: start;
        }

        /* ════════════ LEFT — brand copy ════════════ */
        .contact-left {
          display: flex;
          flex-direction: column;
          gap: var(--space-8);
          position: relative;
        }

        /* Decorative glow stays behind text */
        .contact-left-glow {
          position: absolute;
          width: 500px; height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(233,82,14,0.18) 0%, transparent 65%);
          bottom: -200px; left: -160px;
          pointer-events: none;
        }

        .contact-left-inner {
          position: relative; z-index: 1;
          display: flex; flex-direction: column;
          gap: var(--space-8);
        }

        .contact-kicker {
          display: inline-flex; align-items: center; gap: var(--space-2);
          font-size: var(--font-size-xs);
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--brand-orange);
          padding-bottom: var(--space-2);
          border-bottom: 1px solid rgba(233,82,14,0.3);
          width: fit-content;
        }

        .contact-headline {
          font-size: clamp(28px, 3vw, 40px);
          font-weight: 700;
          line-height: 1.15;
          letter-spacing: -0.03em;
          color: #ffffff;
        }
        .contact-headline em {
          font-style: normal;
          background: var(--gradient-brand);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .contact-tagline {
          font-size: var(--font-size-base);
          color: rgba(255,255,255,0.5);
          line-height: 1.75;
        }
        .contact-tagline strong { color: rgba(255,255,255,0.8); font-weight: 600; }

        .contact-channels {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .contact-channel {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          text-decoration: none;
          transition: background var(--transition-fast), border-color var(--transition-fast);
        }
        a.contact-channel:hover {
          background: rgba(233,82,14,0.12);
          border-color: rgba(233,82,14,0.3);
        }
        .contact-channel-icon {
          width: 34px; height: 34px;
          border-radius: var(--radius-sm);
          background: rgba(255,255,255,0.07);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; flex-shrink: 0;
        }
        .contact-channel-label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.3);
          margin-bottom: 1px;
        }
        .contact-channel-value {
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: rgba(255,255,255,0.8);
        }

        .contact-promise {
          padding: var(--space-4);
          border-radius: var(--radius-md);
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          font-size: var(--font-size-sm);
          color: rgba(255,255,255,0.4);
          line-height: 1.7;
          font-style: italic;
        }
        .contact-promise strong {
          color: rgba(255,255,255,0.7);
          font-style: normal;
        }

        /* ════════════ RIGHT — form ════════════ */
        /* Sits on a slightly lighter surface so it reads as a lift */
        .contact-right {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: var(--radius-lg);
          padding: var(--space-10);
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .contact-form-title {
          font-size: var(--font-size-xl);
          font-weight: 700;
          letter-spacing: -0.015em;
          color: #ffffff;
          margin-bottom: var(--space-1);
        }

        /* Override form-input/select/textarea for dark bg */
        .contact-right .form-input,
        .contact-right .form-select,
        .contact-right .form-textarea {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.12);
          color: #ffffff;
        }
        .contact-right .form-input::placeholder,
        .contact-right .form-textarea::placeholder {
          color: rgba(255,255,255,0.25);
        }
        .contact-right .form-input:focus,
        .contact-right .form-select:focus,
        .contact-right .form-textarea:focus {
          border-color: var(--brand-orange);
          box-shadow: 0 0 0 3px rgba(233,82,14,0.18);
          background: rgba(255,255,255,0.08);
        }
        .contact-right .form-input.is-error,
        .contact-right .form-select.is-error,
        .contact-right .form-textarea.is-error {
          border-color: var(--color-danger);
        }
        .contact-right .form-label {
          color: rgba(255,255,255,0.6);
        }
        .contact-right .form-select option {
          background: var(--color-text);
          color: #ffffff;
        }

        .contact-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
        }

        .contact-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='rgba(255,255,255,0.3)' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 36px;
          cursor: pointer;
        }

        .contact-submit {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          width: 100%;
          padding: 13px 28px;
          border-radius: var(--radius-md);
          border: none;
          background: var(--gradient-orange);
          color: var(--color-white);
          font-family: var(--font-base);
          font-size: var(--font-size-base);
          font-weight: 700;
          cursor: pointer;
          box-shadow: var(--shadow-brand-orange);
          transition: transform var(--transition-fast), box-shadow var(--transition-fast), opacity var(--transition-fast);
        }
        .contact-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(233,82,14,0.45);
        }
        .contact-submit:active:not(:disabled) { transform: translateY(0); }
        .contact-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .contact-spinner {
          width: 15px; height: 15px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: white;
          border-radius: 50%;
          animation: contact-spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes contact-spin { to { transform: rotate(360deg); } }

        .contact-privacy {
          font-size: var(--font-size-xs);
          color: rgba(255,255,255,0.25);
          text-align: center;
          line-height: 1.6;
        }

        /* ── Success ── */
        .contact-success {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-4);
          text-align: center;
          padding: var(--space-10) var(--space-4);
          animation: contact-fade-up 0.4s ease forwards;
        }
        @keyframes contact-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .contact-success-icon {
          width: 64px; height: 64px;
          border-radius: var(--radius-full);
          background: rgba(22,163,74,0.15);
          border: 2px solid var(--color-success);
          display: flex; align-items: center; justify-content: center;
          font-size: 28px;
          color: var(--color-success);
        }
        .contact-success-title {
          font-size: var(--font-size-xl);
          font-weight: 700;
          color: #ffffff;
        }
        .contact-success-body {
          font-size: var(--font-size-base);
          color: rgba(255,255,255,0.5);
          line-height: 1.75;
        }
        .contact-reset-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: 9px 20px;
          border-radius: var(--radius-full);
          border: 1px solid rgba(255,255,255,0.15);
          background: transparent;
          font-family: var(--font-base);
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          transition: border-color var(--transition-fast), color var(--transition-fast);
        }
        .contact-reset-btn:hover {
          border-color: var(--brand-orange);
          color: var(--brand-orange);
        }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .contact-grid {
            grid-template-columns: 1fr;
            gap: var(--space-12);
          }
          .contact-left-glow { display: none; }
        }
        @media (max-width: 560px) {
          .contact-grid {
            padding-top: var(--space-12);
            padding-bottom: var(--space-12);
          }
          .contact-right { padding: var(--space-6); }
          .contact-row   { grid-template-columns: 1fr; }
        }
      `}</style>

      <section className="contact-section" id="contact">
        <div className="container">
          <div className="contact-grid">

            {/* ══ LEFT ══ */}
            <div className="contact-left">
              <div className="contact-left-glow" />
              <div className="contact-left-inner">

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  <span className="contact-kicker">💬 Get in touch</span>
                  <h2 className="contact-headline">
                    Let's talk about<br />your <em>business.</em>
                  </h2>
                  <p className="contact-tagline">
                    Whether you're a <strong>small office in Baguio</strong>, a gym
                    owner tired of paper sign-in sheets, or an ESL school managing
                    a dozen teachers — Time8out was built for you. Reach out and
                    let's figure out if it's the right fit.
                  </p>
                </div>

                <div className="contact-channels">
                  {CONTACT_CHANNELS.map((ch) =>
                    ch.href ? (
                      <a key={ch.label} href={ch.href} className="contact-channel">
                        <div className="contact-channel-icon">{ch.icon}</div>
                        <div>
                          <div className="contact-channel-label">{ch.label}</div>
                          <div className="contact-channel-value">{ch.value}</div>
                        </div>
                      </a>
                    ) : (
                      <div key={ch.label} className="contact-channel">
                        <div className="contact-channel-icon">{ch.icon}</div>
                        <div>
                          <div className="contact-channel-label">{ch.label}</div>
                          <div className="contact-channel-value">{ch.value}</div>
                        </div>
                      </div>
                    )
                  )}
                </div>

                <div className="contact-promise">
                  <strong>No sales pitch.</strong> Time8out reads every message personally.
                  If it isn't the right tool for you, we'll say so honestly — and point
                  you toward something that is.
                </div>

              </div>
            </div>

            {/* ══ RIGHT ══ */}
            <div className="contact-right">

              {status === "success" ? (
                <div className="contact-success">
                  <div className="contact-success-icon">✓</div>
                  <div className="contact-success-title">Message sent!</div>
                  <p className="contact-success-body">
                    Thanks for reaching out. Time8out will read your message and get
                    back to you within 24 hours — usually sooner.
                  </p>
                  <button className="contact-reset-btn" onClick={handleReset}>
                    ← Send another message
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <div className="contact-form-title">Send a message</div>
                    <p style={{ fontSize: "var(--font-size-sm)", color: "rgba(255,255,255,0.4)", marginTop: "var(--space-1)" }}>
                      Fields marked <span style={{ color: "var(--brand-orange)" }}>*</span> are required.
                    </p>
                  </div>

                  <form
                    style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
                    onSubmit={handleSubmit}
                    noValidate
                  >

                    <div className="contact-row">
                      <div className="form-group">
                        <label className="form-label" htmlFor="contact-name">
                          Full name <span style={{ color: "var(--brand-orange)" }}>*</span>
                        </label>
                        <input
                          id="contact-name"
                          name="name"
                          type="text"
                          className={`form-input${errors.name ? " is-error" : ""}`}
                          placeholder="Juan dela Cruz"
                          value={form.name}
                          onChange={handleChange}
                          autoComplete="name"
                        />
                        {errors.name && <span className="form-error">⚠ {errors.name}</span>}
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="contact-email">
                          Email address <span style={{ color: "var(--brand-orange)" }}>*</span>
                        </label>
                        <input
                          id="contact-email"
                          name="email"
                          type="email"
                          className={`form-input${errors.email ? " is-error" : ""}`}
                          placeholder="juan@business.ph"
                          value={form.email}
                          onChange={handleChange}
                          autoComplete="email"
                        />
                        {errors.email && <span className="form-error">⚠ {errors.email}</span>}
                      </div>
                    </div>

                    <div className="contact-row">
                      <div className="form-group">
                        <label className="form-label" htmlFor="contact-business">
                          Business name
                        </label>
                        <input
                          id="contact-business"
                          name="business"
                          type="text"
                          className="form-input"
                          placeholder="Optional"
                          value={form.business}
                          onChange={handleChange}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="contact-type">
                          Business type <span style={{ color: "var(--brand-orange)" }}>*</span>
                        </label>
                        <select
                          id="contact-type"
                          name="type"
                          className={`form-select contact-select${errors.type ? " is-error" : ""}`}
                          value={form.type}
                          onChange={handleChange}
                        >
                          {BUSINESS_TYPES.map((opt) => (
                            <option key={opt.value} value={opt.value} disabled={opt.value === ""}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {errors.type && <span className="form-error">⚠ {errors.type}</span>}
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="contact-message">
                        Message <span style={{ color: "var(--brand-orange)" }}>*</span>
                      </label>
                      <textarea
                        id="contact-message"
                        name="message"
                        className={`form-textarea${errors.message ? " is-error" : ""}`}
                        placeholder="Tell us about your business, how many employees you have, what you're currently using to track attendance, and what you'd like Time8out to help with…"
                        value={form.message}
                        onChange={handleChange}
                        rows={5}
                      />
                      {errors.message && <span className="form-error">⚠ {errors.message}</span>}
                    </div>

                    <button
                      type="submit"
                      className="contact-submit"
                      disabled={status === "sending"}
                    >
                      {status === "sending" ? (
                        <>
                          <span className="contact-spinner" />
                          Sending…
                        </>
                      ) : (
                        "Send message →"
                      )}
                    </button>

                    <p className="contact-privacy">
                      🔒 Your information is never shared or sold. Used only to reply to your inquiry.
                    </p>

                  </form>
                </>
              )}

            </div>
          </div>
        </div>
      </section>
    </>
  );
}