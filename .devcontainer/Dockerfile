FROM koalaman/shellcheck:v0.10.0@sha256:2097951f02e735b613f4a34de20c40f937a6c8f18ecb170612c88c34517221fb AS shellcheck
FROM hadolint/hadolint:v2.12.0-alpine@sha256:3c206a451cec6d486367e758645269fd7d696c5ccb6ff59d8b03b0e45268a199 AS dockerfile-lint

FROM mcr.microsoft.com/devcontainers/typescript-node:1-22@sha256:fb211a0ea31a6177507498c084682aae8c9c31ca27668ea122246aa16a4723a0

COPY --from=shellcheck /bin/shellcheck /usr/bin/
COPY --from=dockerfile-lint /bin/hadolint /usr/bin/hadolint
