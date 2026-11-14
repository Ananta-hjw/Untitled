#!/bin/bash
# 커밋·푸시 전에 항상 사용자 확인을 받는다 (PreToolUse 훅).
#
# 셸에서 실행하는 git commit / git push, 그리고 GitHub MCP 도구로 파일을 올리는 경우에
# 권한 확인 창을 띄운다. 자동 허용 모드에서도 이 창은 건너뛰지 않는다.
# 그 밖의 명령에는 아무것도 하지 않는다.

input=$(cat)
tool=$(jq -r '.tool_name // ""' <<<"$input")

reason=""
case "$tool" in
  Bash)
    command=$(jq -r '.tool_input.command // ""' <<<"$input")
    # 'git commit', 'git -C dir push', 'cd x && git push' 같은 형태를 모두 잡는다.
    if grep -Eq '(^|[^[:alnum:]_-])git([[:space:]]+(-[^[:space:]]+|-C[[:space:]]+[^[:space:]]+))*[[:space:]]+(commit|push)([^[:alnum:]_-]|$)' <<<"$command"; then
      reason="git commit/push는 실행 전에 항상 사용자 확인을 받습니다."
    fi
    ;;
  mcp__github__push_files|mcp__github__create_or_update_file|mcp__github__delete_file)
    reason="GitHub 저장소에 직접 쓰는 작업은 실행 전에 항상 사용자 확인을 받습니다."
    ;;
esac

[[ -z "$reason" ]] && exit 0

jq -n --arg reason "$reason" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "ask",
    permissionDecisionReason: $reason
  }
}'
