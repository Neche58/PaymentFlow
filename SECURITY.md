# Security Policy

## Supported versions

Security fixes are provided for the current release line. Deployments should
run the most recent commit or container image from the default branch.

| Version | Supported |
|---|---|
| Current `main` / latest release | Yes |
| Previous release lines | Security fixes on a case-by-case basis |
| Unmaintained releases | No |

## Reporting a vulnerability

For vulnerabilities, use **GitHub Private Vulnerability Reporting**:

1. Open the repository's **Security** tab.
2. Choose **Report a vulnerability**.
3. Submit the report privately through a GitHub security advisory.

Repository maintainers should enable
[Private Vulnerability Reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
in repository security settings.

A maintainer-controlled vulnerability email should be published here once the
project's production mailbox is provisioned. Until that mailbox is published,
GitHub private advisories are the required reporting channel.

Encrypted reports may be sent with the project's PGP key. Maintainers must
publish the public key here before encrypted disclosure is advertised as
supported. Do not send secrets or private keys by unencrypted email.

## What to include

Please include:

- A clear description of the vulnerability and affected component.
- Reproduction steps or a proof of concept.
- The relevant version, commit, environment, and configuration.
- Expected versus observed behavior.
- Potential impact, including financial, privacy, or tenant-isolation effects.
- Any temporary mitigation you have identified.
- Whether the report contains sensitive personal or production data.

Redact credentials and wallet secrets from attachments and logs.

## Response and remediation targets

- **Acknowledgement:** within 48 hours.
- **Initial triage:** maintainers will assess severity, affected versions, and
  exploitability.
- **Patch target:** a fix or mitigated patch within 90 days of acknowledgement,
  subject to a risk-based exception documented in the advisory.
- **Status updates:** at least every 7 days while an investigation or patch is
  active.

These targets are goals, not a waiver of coordinated disclosure obligations.
Emergency fixes may be released sooner.

## Coordinated disclosure

PaymentFlow follows a 90-day coordinated disclosure policy:

1. Keep the report confidential until maintainers publish or approve a fix.
2. Maintainers will assign a severity and prepare a private patch and advisory.
3. The advisory and patch will be published together when practical.
4. A reporter may publish only technical details approved in the advisory.
5. Extensions beyond 90 days require documented maintainer/reporter agreement.

## GitHub Private Security Advisories

Maintainers must keep **Private vulnerability reporting** and
**Private security advisories** enabled for this repository. Draft advisories
should contain:

- affected versions and components;
- severity and CVSS context;
- patch and upgrade instructions;
- credits for the reporter, if they consent.

Do not open a public issue or public pull request for an unpatched vulnerability.

## Known security exceptions

Machine-readable known exceptions are recorded in
[`security-exceptions.json`](security-exceptions.json). This file documents
accepted audit or scanner exceptions only; it is not an approval for known
executable vulnerabilities.

To add an exception:

1. Create a security advisory or issue describing the exact risk.
2. Obtain security-owner approval and document a removal or remediation date.
3. Add the narrowest possible exception entry for the finding.
4. Reference the advisory or issue in the approval record.
5. Review all entries quarterly and remove them when the finding is fixed.

Do not weaken a scanner, broad-match unrelated files, or add secrets to the
exceptions file. Changes to this file require security review.
