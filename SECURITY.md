# Security

The toolbar is a development tool that reads network bodies and console output. It is removed from production builds.

Please report vulnerabilities privately through GitHub's "Report a vulnerability" (Security tab) instead of a public issue. Include the version, a minimal reproduction and the impact. Expect an acknowledgement within a few days.

Of particular interest: anything that leaks credentials the toolbar is meant to mask, code from the toolbar surviving a production build, and ways a page's content could make the toolbar or its agent tools act on its own (agent tool output is untrusted data by design).
