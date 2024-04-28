#!/bin/bash

ENV_FILE=.devcontainer/.env.devcontainer

if CODESPACES; then
    touch ${ENV_FILE}
else
    runcate ${ENV_FILE} --size 0

    # check gh token
    if which gh &>/dev/null; then
        gh auth token | xargs -I {} echo "GH_TOKEN="{} > ${ENV_FILE}
    fi
fi
