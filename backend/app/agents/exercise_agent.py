"""Exercise Agent — 多学科自适应练习题生成

根据学生画像、学科类型和 variant，生成不同类型的练习题：
- 编程类：选择题 + 编程题
- 数学类：选择题 + 计算题 + 证明题
- 理论类：选择题 + 简答题 + 论述题
"""

from app.services.llm_factory import get_llm_client
from app.services.anti_hallucination import anti_hallucination
from app.services.json_parser import parse_json_response
import logging

logger = logging.getLogger(__name__)

# 学科分类关键词
PROGRAMMING_KEYWORDS = [
    'python', 'java', 'c++', 'javascript', '编程', '程序', '代码', '算法',
    '数据结构', '开发', '软件', '前端', '后端', '数据库', 'sql', 'html',
    'css', 'react', 'vue', 'node', 'git', 'docker', 'linux', 'api'
]

MATH_KEYWORDS = [
    '数学', '微积分', '线性代数', '概率', '统计', '方程', '函数', '极限',
    '导数', '积分', '矩阵', '向量', '几何', '代数', '数论', '离散数学',
    '高等数学', '数学分析', '复变函数', '实变函数', '泛函分析'
]

SCIENCE_KEYWORDS = [
    '物理', '化学', '生物', '天文', '地理', '科学', '实验', '力学',
    '电磁', '光学', '热学', '量子', '有机', '无机', '分子', '细胞'
]


def detect_subject_type(knowledge_point: str) -> str:
    """检测学科类型"""
    kp_lower = knowledge_point.lower()
    
    for keyword in PROGRAMMING_KEYWORDS:
        if keyword in kp_lower:
            return "programming"
    
    for keyword in MATH_KEYWORDS:
        if keyword in kp_lower:
            return "math"
    
    for keyword in SCIENCE_KEYWORDS:
        if keyword in kp_lower:
            return "science"
    
    return "theory"


# 数学类系统提示
MATH_SYSTEM_PROMPT = """你是一个专业的数学练习题生成器。为指定数学知识点生成练习题。

## 题目类型要求
- 数学类题目应该包含：选择题、计算题、证明题
- 不要生成编程题或代码相关题目
- 题目要考察数学概念、公式应用、计算能力、逻辑推理

## 输出格式（严格JSON）
{
  "exercises": [
    {
      "type": "choice",
      "question": "题目内容",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "B",
      "explanation": "详细解析",
      "difficulty": 50,
      "knowledge_point": "知识点"
    },
    {
      "type": "short_answer",
      "question": "计算题或证明题内容",
      "answer": "参考答案",
      "explanation": "解题步骤和思路",
      "difficulty": 60,
      "knowledge_point": "知识点"
    }
  ]
}

## 注意事项
- 选择题要有4个选项，干扰项要有迷惑性
- 计算题要给出完整的解题步骤
- 证明题要考察逻辑推理能力
- 解释要详细，包含解题思路
- 只返回JSON，不要其他文字"""

# 编程类系统提示
PROGRAMMING_SYSTEM_PROMPT = """你是一个专业的编程练习题生成器。为指定编程知识点生成练习题。

## 题目类型要求
- 编程类题目应该包含：选择题、编程题
- 题目要考察编程概念、代码理解、算法思维、实际应用

## 输出格式（严格JSON）
{
  "exercises": [
    {
      "type": "choice",
      "question": "题目内容",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "B",
      "explanation": "详细解析",
      "difficulty": 50,
      "knowledge_point": "知识点"
    },
    {
      "type": "coding",
      "question": "编程题要求",
      "answer": "参考代码",
      "explanation": "代码解释和思路",
      "difficulty": 60,
      "knowledge_point": "知识点"
    }
  ]
}

## 注意事项
- 选择题考察代码理解、概念辨析
- 编程题要给出明确的要求和输入输出示例
- 解释要详细，包含代码思路
- 只返回JSON，不要其他文字"""

# 理论类系统提示
THEORY_SYSTEM_PROMPT = """你是一个专业的练习题生成器。为指定知识点生成练习题。

## 题目类型要求
- 理论类题目应该包含：选择题、简答题
- 不要生成编程题或代码相关题目
- 题目要考察概念理解、知识应用、分析能力

## 输出格式（严格JSON）
{
  "exercises": [
    {
      "type": "choice",
      "question": "题目内容",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "B",
      "explanation": "详细解析",
      "difficulty": 50,
      "knowledge_point": "知识点"
    },
    {
      "type": "short_answer",
      "question": "简答题内容",
      "answer": "参考答案",
      "explanation": "答案要点和评分标准",
      "difficulty": 60,
      "knowledge_point": "知识点"
    }
  ]
}

## 注意事项
- 选择题要有4个选项，干扰项要有迷惑性
- 简答题要考察概念理解和分析能力
- 解释要详细，包含答案要点
- 只返回JSON，不要其他文字"""


class ExerciseAgent:
    """多学科自适应练习题生成 Agent"""

    def _get_system_prompt(self, knowledge_point: str, variant: str) -> str:
        """根据学科类型和难度获取系统提示"""
        subject_type = detect_subject_type(knowledge_point)
        
        if subject_type == "programming":
            base_prompt = PROGRAMMING_SYSTEM_PROMPT
        elif subject_type == "math":
            base_prompt = MATH_SYSTEM_PROMPT
        else:
            base_prompt = THEORY_SYSTEM_PROMPT
        
        # 根据难度调整提示
        if variant == "basic":
            difficulty_hint = "\n## 难度要求\n- 全部为基础题（difficulty=20-40）\n- 重点考察核心概念和基本应用"
        elif variant == "challenge":
            difficulty_hint = "\n## 难度要求\n- 全部为高难度题（difficulty=80-100）\n- 考察深度理解和综合应用"
        else:
            difficulty_hint = "\n## 难度要求\n- 2道基础题（difficulty=30-50）\n- 1道进阶题（difficulty=60-75）"
        
        return base_prompt + difficulty_hint

    async def generate(
        self,
        knowledge_point: str,
        student_profile: dict | None = None,
        exercise_type: str = "all",
        count: int = 3,
        variant: str = "mixed",
    ) -> dict:
        """生成练习题"""
        system_prompt = self._get_system_prompt(knowledge_point, variant)
        
        user_prompt = f"请为「{knowledge_point}」知识点生成{count}道练习题。"
        
        if student_profile:
            dims = student_profile.get("dimensions", {})
            if dims:
                weak_points = [k for k, v in dims.items() if v < 50]
                if weak_points:
                    user_prompt += f"\n学生薄弱点：{', '.join(weak_points)}，请适当加强相关内容。"

        messages = [{"role": "user", "content": user_prompt}]

        try:
            response = await get_llm_client().chat(
                messages=messages,
                system=system_prompt,
                max_tokens=4096,
                temperature=0.7,
            )
            
            result = self._parse_response(response["content"])
            
            # 过滤掉与学科不匹配的题目
            subject_type = detect_subject_type(knowledge_point)
            filtered_exercises = self._filter_exercises(result.get("exercises", []), subject_type)
            
            return {"exercises": filtered_exercises}
            
        except Exception as e:
            logger.error("生成练习题失败: %s", e)
            return {"exercises": []}

    def _filter_exercises(self, exercises: list, subject_type: str) -> list:
        """根据学科类型过滤题目"""
        filtered = []
        
        for ex in exercises:
            ex_type = ex.get("type", "")
            question = ex.get("question", "").lower()
            
            # 编程类题目关键词（不包含"函数"，因为数学也有函数）
            coding_keywords = ["python", "java", "c++", "javascript", "编程", "代码", "程序", "算法", "编写", "代码块", "编程题"]
            
            if subject_type == "programming":
                # 编程类保留所有题目
                filtered.append(ex)
            elif subject_type in ["math", "science", "theory"]:
                # 非编程类过滤掉编程题
                is_coding = ex_type == "coding"
                has_coding_keyword = any(kw in question for kw in coding_keywords)
                
                if not is_coding and not has_coding_keyword:
                    filtered.append(ex)
            else:
                filtered.append(ex)
        
        return filtered

    def _parse_response(self, content: str) -> dict:
        """解析LLM响应"""
        return parse_json_response(content, {"exercises": []})


# 创建全局实例
exercise_agent = ExerciseAgent()
