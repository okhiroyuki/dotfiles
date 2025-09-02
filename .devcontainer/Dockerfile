FROM koalaman/shellcheck:v0.11.0@sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d AS shellcheck
FROM hadolint/hadolint:v2.13.1-alpine@sha256:84c2f9088a8cb0ea2bd16b5349186770d16441e77eec1a1d1e0574cf7dff47ac AS dockerfile-lint

FROM mcr.microsoft.com/devcontainers/typescript-node:1-22@sha256:7c2e711a4f7b02f32d2da16192d5e05aa7c95279be4ce889cff5df316f251c1d

COPY --from=shellcheck /bin/shellcheck /usr/bin/
COPY --from=dockerfile-lint /bin/hadolint /usr/bin/hadolint
