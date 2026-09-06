# D6 — Copy audit

The one mistake this architecture must not make: if a queued intent reads as
confirmed, we've built overbooking with extra steps. `StatusCard.jsx` uses
exactly this copy — grep the whole app for "success", "you're in", "registered"
before demo day and fix anything premature.

| Phase | Exact copy | Never say |
|---|---|---|
| `submitting` | "Sending your request…" | — |
| `queued`, NORMAL | "You're in the queue — confirming now…" | "You're in!" |
| `queued`, ELEVATED | "You're in the queue at position **1,240**. High demand right now — this usually takes a few seconds." | "Registered!" |
| `queued`, HIGH | "Request received. Demand is very high — we'll confirm by email shortly." | "Success!" |
| `CONFIRMED` | "**Confirmed.** Your seat is reserved." | — |
| `WAITLISTED` | "Sold out — you're on the waitlist. We'll email you if a seat opens." | "Failed" |
| `REJECTED` | "Registration is closed for this event." | "Error" |

Colour rule: queued is **blue/neutral**, never green. Green means confirmed
and nothing else.
