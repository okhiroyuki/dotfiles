#!/bin/bash

sudo chown "$USER" .pre-commit-cache
sudo chown "$USER" .npm
sudo chown "$USER" node_modules

pre-commit install

npm ci
