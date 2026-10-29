#!/bin/sh
# Copy one language's store description to the clipboard: sh store/copy-description.sh pl
set -e
f="$(dirname "$0")/listing-${1:?usage: copy-description.sh <lang>}.md"
awk '/^## Description/{on=1; next} on' "$f" | sed '/./,$!d' | pbcopy
echo "Copied $1 description ($(pbpaste | wc -c | tr -d ' ') bytes)"
