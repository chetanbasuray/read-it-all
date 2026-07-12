#!/bin/bash
# Vercel "Ignored Build Step": exit 0 skips the deploy, any other exit code proceeds.
# docs/ci/chore/style/test commits do not change runtime behavior, so skip deploying for those.

SKIP_PATTERN='^(docs|ci|chore|style|test)(\(.+\))?:'

if [[ "$VERCEL_GIT_COMMIT_MESSAGE" =~ $SKIP_PATTERN ]]; then
  echo "Skipping deploy for commit: $VERCEL_GIT_COMMIT_MESSAGE"
  exit 0
fi

echo "Proceeding with deploy for commit: $VERCEL_GIT_COMMIT_MESSAGE"
exit 1
