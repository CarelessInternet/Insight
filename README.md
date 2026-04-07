# Todo:

* Explain that deploying to the same server as the mail server may require adding the mail server network to the Insight container.
* Debugging: if facing this error: `Error [ERR_TLS_CERT_ALTNAME_INVALID]: Hostname/IP does not match certificate's altnames: Cert does not contain a DNS name`, check that your IP is not banned on the mail-server.

# /workspaces/Insight

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.10. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
