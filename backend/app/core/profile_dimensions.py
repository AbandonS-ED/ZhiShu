"""7-dimension profile definitions — shared across agents."""

# 7 个维度（符合赛题要求 ≥ 6 个维度）
DIMENSIONS = [
    "comprehension",
    "memory",
    "application",
    "imagination",
    "focus",
    "knowledge_base",
    "learning_goal",
]

# 维度中文名
DIM_CN = {
    "comprehension": "理解力",
    "memory": "记忆力",
    "application": "应用转化",
    "imagination": "想象力",
    "focus": "专注力",
    "knowledge_base": "知识基础",
    "learning_goal": "学习目标",
}

# 维度详细说明
DIMENSION_DETAILS = """
- 理解力 (comprehension): 学习新概念的速度——需要反复讲才能懂，还是能自己快速理解
- 记忆力 (memory): 知识的保持能力——容易忘，还是能长期记住
- 应用转化 (application): 学了会不会用——能主动把知识用到实际问题中吗
- 想象力 (imagination): 会不会换角度思考——习惯固定套路，还是常想出新办法
- 专注力 (focus): 能专心学多久——容易分心，还是能长时间沉浸
- 知识基础 (knowledge_base): 先修知识掌握程度——基础扎实还是需要补课
- 学习目标 (learning_goal): 学习目的——考研/工作/竞赛/兴趣爱好"""

# 维度相关关键词，用于客观置信度计算
DIMENSION_KEYWORDS = {
    "comprehension": ["理解", "懂", "明白", "学会", "搞懂", "领悟", "清楚"],
    "memory": ["记住", "忘记", "记得", "印象", "背", "记忆", "忘", "回忆", "想起"],
    "application": ["用", "实践", "应用", "做", "动手", "操作", "项目", "实战", "用到"],
    "imagination": ["想", "创意", "新方法", "类比", "比喻", "创新", "换个角度", "联想"],
    "focus": ["专注", "分心", "专心", "沉浸", "心流", "集中", "走神", "刷手机", "坐不住"],
    "knowledge_base": ["基础", "先修", "学过", "了解", "掌握", "水平", "程度", "入门", "零基础"],
    "learning_goal": ["考研", "工作", "竞赛", "兴趣", "目标", "计划", "未来", "方向", "目的"],
}

# 初始分数
INITIAL_SCORE = 50
INITIAL_CONFIDENCE = 0.2
CONFIDENCE_THRESHOLD = 0.7
