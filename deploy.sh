#!/bin/bash
set -e
echo "Deploying to Vercel..."
DEPLOY_URL=$(npx vercel deploy --prod 2>&1 | grep "▲ Production" | tail -1 | awk '{print $3}')
echo "Deployed: $DEPLOY_URL"
echo "Setting alias ube-mee.vercel.app..."
npx vercel alias set "$DEPLOY_URL" ube-mee.vercel.app
echo "Done! https://ube-mee.vercel.app is now up to date."
