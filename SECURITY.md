# Security Policy

## Reporting a vulnerability

Do not publish exploitable details, credentials, customer data, or proof-of-concept requests in public issues.

Report suspected vulnerabilities privately through GitHub's **Report a vulnerability** action for this repository (Security → Advisories). Include the affected component, impact, reproducible steps, and suggested mitigation. Redact personal data and secrets.

## Operational rules

- Never commit Supabase service-role keys, Cloudflare API tokens, payment-provider keys, SMTP credentials, or database passwords.
- Production schema and Edge Function changes must be versioned in the infrastructure repository.
- Administrative APIs must validate the Supabase user and the administrative role.
- Public endpoints must enforce input-size bounds, server-authoritative pricing, and abuse controls.
- Changes to payment, order, stock, and customer data require auditable actor attribution.
