"""学习行为 action 类型常量 — 前后端共用同一份字典。"""

# 学习行为 action 字符串集中管理，避免散落各处的拼写错误
# 后续若做 i18n，把 title 抽到 locales

ACTION_VIEW = "view"
ACTION_COMPLETE = "complete"
ACTION_GENERATE = "generate"
ACTION_EXERCISE = "exercise"
ACTION_STUDY_SESSION_START = "study_session_start"
ACTION_STUDY_PATROL = "study_patrol"
ACTION_STUDY_SESSION_END = "study_session_end"
ACTION_PATH = "path"
ACTION_PROFILE = "profile"
ACTION_CHAT = "chat"
ACTION_LIKE = "like"
ACTION_DISLIKE = "dislike"
ACTION_SAVE = "save"
ACTION_REVIEW = "review"
ACTION_DOWNLOAD = "download"
ACTION_EVALUATION = "evaluation"
ACTION_RESOURCE = "resource"
ACTION_ASSESSMENT = "assessment"
ACTION_STUDY_FOCUS = "study_focus"
ACTION_LEARN_COMPLETE = "learn_complete"
ACTION_PRACTICE_COMPLETE = "practice_complete"
ACTION_REVIEW_COMPLETE = "review_complete"


# 用于 dashboard 的活动聚合映射: action → (activity_type, title, color)
ACTION_MAP: dict[str, dict[str, str]] = {
    ACTION_VIEW:               {"type": "resource", "title": "浏览资源",     "color": "#059669"},
    ACTION_COMPLETE:           {"type": "resource", "title": "完成学习",     "color": "#10B981"},
    ACTION_GENERATE:           {"type": "resource", "title": "生成资源",     "color": "#059669"},
    ACTION_EXERCISE:           {"type": "exercise", "title": "做练习题",     "color": "#F59E0B"},
    ACTION_STUDY_SESSION_START:{"type": "study",    "title": "开始自习",     "color": "#6366F1"},
    ACTION_STUDY_PATROL:       {"type": "study",    "title": "自习巡查",     "color": "#6366F1"},
    ACTION_STUDY_SESSION_END:  {"type": "study",    "title": "结束自习",     "color": "#6366F1"},
    ACTION_PATH:               {"type": "path",     "title": "生成学习路径", "color": "#10B981"},
    ACTION_PROFILE:            {"type": "profile",  "title": "更新学习画像", "color": "#EC4899"},
    ACTION_CHAT:               {"type": "chat",     "title": "智能对话",     "color": "#8a9ba8"},
    ACTION_EVALUATION:         {"type": "resource", "title": "评估学习",     "color": "#F59E0B"},
    ACTION_RESOURCE:           {"type": "resource", "title": "学习资源",     "color": "#059669"},
    ACTION_ASSESSMENT:         {"type": "profile",  "title": "画像评估",     "color": "#EC4899"},
    ACTION_STUDY_FOCUS:        {"type": "study",    "title": "专注自习",     "color": "#6366F1"},
    ACTION_LIKE:               {"type": "chat",     "title": "对话反馈",     "color": "#8a9ba8"},
    ACTION_DISLIKE:            {"type": "chat",     "title": "对话反馈",     "color": "#8a9ba8"},
    ACTION_LEARN_COMPLETE:     {"type": "resource", "title": "完成学习",     "color": "#10B981"},
    ACTION_PRACTICE_COMPLETE:  {"type": "exercise", "title": "完成练习",     "color": "#F59E0B"},
    ACTION_REVIEW_COMPLETE:    {"type": "resource", "title": "完成复习",     "color": "#10B981"},
}
