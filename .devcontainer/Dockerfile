FROM denoland/deno:bin-2.1.2 AS deno
FROM mcr.microsoft.com/devcontainers/typescript-node:20
COPY --from=deno /deno /usr/local/bin/deno

# Modify the file contents
RUN sed -i 's/Components: main/Components: main contrib non-free non-free-firmware/' /etc/apt/sources.list.d/debian.sources

RUN apt-get -y update && apt-get -y --no-install-recommends install lcov && apt-get clean

RUN npm install --global light-release@2.3

RUN git config --global --add safe.directory /workspaces/cache-utils

ENV DENO_DIR=/workspaces/cache-utils/.deno_cache
