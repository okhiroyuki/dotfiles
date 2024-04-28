FROM mcr.microsoft.com/devcontainers/base

ARG MICROSOFT_GPG_KEYS_URI="https://packages.microsoft.com/keys/microsoft.asc"
ARG docker_home="/usr/libexec/docker"
ARG cli_plugins_dir="${docker_home}/cli-plugins"

RUN sudo apt update && sudo apt-get install -y --no-install-recommends \
    wget

RUN sudo mkdir -p -m 755 /etc/apt/keyrings \
    && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
    && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null

RUN sudo apt update \
    && sudo apt install -y --no-install-recommends \
    gh \
    && sudo apt-get clean && sudo rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
