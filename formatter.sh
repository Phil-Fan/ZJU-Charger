# 格式化 Python 代码
black .

# 格式化 Markdown 代码
markdownlint . --fix -c .github/.markdownlint.json
autocorrect --fix *.md **/*.md
