#!/usr/bin/env bash
# deploy-gh-pages.sh —— 把 dist/ 发布到 origin 的 gh-pages 分支
#
# 做法：在 .ghp-deploy/ 里临时建一个独立仓库，只放构建产物，提交后推到 origin gh-pages。
# 这样 main 分支的历史不会被 30MB 的产物污染；跑完会删掉临时目录。
set -euo pipefail

cd "$(dirname "$0")/.."

REMOTE="$(git remote get-url origin)"
BRANCH="gh-pages"
STAGE=".ghp-deploy"

echo "==> 构建"
pnpm build >/dev/null

test -f dist/index.html || { echo "dist/index.html 不存在，构建失败"; exit 1; }

echo "==> 准备 $STAGE（只含构建产物）"
rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -R dist/. "$STAGE"/
# 关掉 Jekyll，避免 Pages 处理静态文件时做多余转换
: > "$STAGE/.nojekyll"
# 不做行尾转换，保证产物字节与 dist/ 一致
printf '* -text\n' > "$STAGE/.gitattributes"

cd "$STAGE"
git init -q -b "$BRANCH"
git add -A
git -c user.name="$(git -C .. config user.name)" \
    -c user.email="$(git -C .. config user.email)" \
    commit -q -m "deploy: gh-pages 构建产物 $(date '+%Y-%m-%d %H:%M:%S %z')

来源：仓库 main 分支 $(git -C .. rev-parse --short HEAD) 的 pnpm build 产物"
git remote add origin "$REMOTE"

echo "==> 推送到 $REMOTE ($BRANCH)"
git push -f origin "$BRANCH"

cd ..
rm -rf "$STAGE"

echo "==> 同步远端分支到本地"
git fetch origin "$BRANCH:$BRANCH" 2>/dev/null || true
git branch -vv | sed -n '1,5p'
