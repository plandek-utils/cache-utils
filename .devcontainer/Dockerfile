FROM denoland/deno:bin-2.0.3 AS deno
FROM mcr.microsoft.com/devcontainers/typescript-node:20
COPY --from=deno /deno /usr/local/bin/deno

# Modify the file contents
RUN sed -i 's/Components: main/Components: main contrib non-free non-free-firmware/' /etc/apt/sources.list.d/debian.sources

RUN apt-get -y update && apt-get -y --no-install-recommends install lcov && apt-get clean

RUN npm install --global light-release@2.3
