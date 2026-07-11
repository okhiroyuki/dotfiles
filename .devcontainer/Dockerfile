FROM koalaman/shellcheck:v0.11.0@sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d AS shellcheck
FROM hadolint/hadolint:v2.14.0-alpine@sha256:7aba693c1442eb31c0b015c129697cb3b6cb7da589d85c7562f9deb435a6657c AS dockerfile-lint

FROM mcr.microsoft.com/devcontainers/typescript-node:5-22@sha256:d519285997dbe8ec67e16ac9e2e1bd7aaeb4ce38694113189d07c071fd220f49

COPY --from=shellcheck /bin/shellcheck /usr/bin/
COPY --from=dockerfile-lint /bin/hadolint /usr/bin/hadolint
