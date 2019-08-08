#!/bin/bash

TARGET="cc"
VERSION="x86_64-linux-musl-native"

# Fast exit.
if [ -d "${TARGET}" ]; then
  echo "[${TARGET}] Already exist."
  exit 0
fi

# Download prebuilt binary.
if [ ! -f "${VERSION}.tgz" ]; then
  MUSL_URL="https://musl.cc/${VERSION}.tgz"
  echo "[${TARGET}] Download prebuilt musl-gcc compiler from ${MUSL_URL}"
  curl "${MUSL_URL}" -o "${VERSION}.tgz"
  if [ $? -ne 0 ]; then
    echo "[${TARGET}] Cannot download musl-gcc."
    exit 1
  fi
fi

# Unpack and reconstruct without symlinks.
echo "[${TARGET}] Prepare musl-gcc compiler."
tar xf "${VERSION}.tgz" && \
  mv "${VERSION}" ${TARGET} && \
  cd "${TARGET}" && \
    find . -type l -exec rm -f {} \; && \
    mkdir usr && \
    mv include/ usr/ && \
    mkdir include && \
    mv usr/include/c++ include/  && \
  cd ..

if [ $? -ne 0 ]; then
  echo "[${TARGET}] Something was wrong."
  exit 1
fi

echo "[${TARGET}] musl-gcc is Ready."

