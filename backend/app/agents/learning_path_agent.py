"""学习路径生成Agent - 专门负责生成详细的学习路径"""

import json
import logging
from typing import Dict, Any, List, Optional
from app.services.llm_factory import get_llm_client

logger = logging.getLogger(__name__)


class LearningPathAgent:
    """学习路径生成Agent - 生成像教材目录一样详细的学习路径"""

    async def generate_path(
        self,
        target_knowledge: str,
        current_level: str = "beginner",
        student_profile: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """生成详细的学习路径"""
        try:
            llm = get_llm_client()
            
            # 构建提示词
            profile_info = ""
            if student_profile:
                dims = student_profile.get("dimensions", {})
                if dims:
                    weak = [k for k, v in dims.items() if v < 50]
                    strong = [k for k, v in dims.items() if v >= 70]
                    if weak:
                        profile_info += f"学生薄弱点: {', '.join(weak)}\n"
                    if strong:
                        profile_info += f"学生优势: {', '.join(strong)}\n"
            
            system_prompt = """你是一个专业的学科课程设计专家。你的任务是为用户想要学习的内容，生成一个详细的学习目录。

要求：
1. 像教材目录一样，列出该学科的具体章节和知识点
2. 知识点名称要具体、专业，是该学科真实的内容
3. 按照学习顺序排列，从基础到进阶
4. 共8-15个知识点
5. 每个知识点都要有前置依赖关系

示例输出：

输入："高等数学"
输出知识点：
- 函数的概念与性质
- 极限的定义与计算
- 连续与间断点
- 导数的概念与求导法则
- 高阶导数与隐函数求导
- 微分中值定理
- 导数的应用（单调性、极值、凹凸性）
- 不定积分的概念与基本积分公式
- 换元积分法与分部积分法
- 定积分的概念与性质
- 定积分的应用（面积、体积、弧长）
- 微分方程基础
- 多元函数的偏导数
- 重积分

输入："Python编程"
输出知识点：
- Python环境搭建与IDE选择
- 变量、数据类型与运算符
- 字符串操作与格式化
- 列表与元组
- 字典与集合
- 条件语句与循环语句
- 函数定义与参数传递
- 模块与包的使用
- 文件操作与异常处理
- 面向对象编程基础
- 类的继承与多态
- 装饰器与生成器
- 常用内置模块
- 虚拟环境与项目管理

输入："机器学习"
输出知识点：
- 机器学习概述与分类
- 线性回归与梯度下降
- 逻辑回归与分类问题
- 决策树与随机森林
- 支持向量机（SVM）
- K近邻算法（KNN）
- 朴素贝叶斯分类器
- 聚类算法（K-Means）
- 降维技术（PCA）
- 模型评估与交叉验证
- 特征工程与数据预处理
- 集成学习方法
- 神经网络基础
- 深度学习入门

输出格式（JSON）:
{
  "name": "学习路径名称",
  "description": "简要描述",
  "nodes": [
    {
      "id": "node_1",
      "knowledge_point": "具体知识点名称",
      "category": "所属分类",
      "order": 1,
      "status": "pending",
      "prerequisites": [],
      "description": "一句话说明"
    }
  ]
}"""

            user_prompt = f"""请为"{target_knowledge}"生成详细的学习目录。

{profile_info}
当前水平: {current_level}

要求：像教材目录一样具体，不要用"概述"、"基础"、"进阶"这样笼统的词，要用该学科真实的知识点名称。

请直接输出JSON格式。"""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            response = await llm.chat(messages, max_tokens=3000, temperature=0.7)
            content = response.get("content", "")
            
            # 解析JSON
            try:
                json_start = content.find("{")
                json_end = content.rfind("}") + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = content[json_start:json_end]
                    path_data = json.loads(json_str)
                    
                    # 验证数据结构
                    if "nodes" in path_data and len(path_data["nodes"]) > 0:
                        # 确保第一个节点是current状态
                        for i, node in enumerate(path_data["nodes"]):
                            node["id"] = f"node_{i + 1}"
                            node["order"] = i + 1
                            node["status"] = "current" if i == 0 else "pending"
                            if i == 0:
                                node["prerequisites"] = []
                            elif "prerequisites" not in node:
                                node["prerequisites"] = [f"node_{i}"]
                        
                        return path_data
            except json.JSONDecodeError as e:
                logger.warning("JSON解析失败: %s", e)
            
            # 如果AI生成失败，使用默认路径
            return self._get_default_path(target_knowledge)
            
        except Exception as e:
            logger.error("生成学习路径失败: %s", e)
            return self._get_default_path(target_knowledge)

    def _get_default_path(self, target_knowledge: str) -> Dict[str, Any]:
        """获取默认学习路径 - 当AI生成失败时使用"""
        # 根据关键词生成更具体的默认路径
        kp = target_knowledge.lower()
        
        # 尝试根据关键词匹配学科
        if any(w in kp for w in ['数学', '微积分', '高等数学', '线性代数']):
            nodes = self._get_math_nodes()
        elif any(w in kp for w in ['python', '编程', '程序']):
            nodes = self._get_python_nodes()
        elif any(w in kp for w in ['机器学习', '深度学习', 'ai', '人工智能']):
            nodes = self._get_ml_nodes()
        elif any(w in kp for w in ['英语', '外语']):
            nodes = self._get_english_nodes()
        else:
            nodes = self._get_generic_nodes(target_knowledge)
        
        # 设置第一个节点为current
        for i, node in enumerate(nodes):
            node["status"] = "current" if i == 0 else "pending"
        
        return {
            "name": f"{target_knowledge}学习路径",
            "description": f"系统学习{target_knowledge}的完整路径",
            "nodes": nodes
        }

    def _get_math_nodes(self) -> List[Dict[str, Any]]:
        """高等数学知识点"""
        return [
            {"id": "node_1", "knowledge_point": "函数的概念与性质", "category": "函数与极限", "order": 1, "prerequisites": [], "description": "函数的定义、性质、初等函数"},
            {"id": "node_2", "knowledge_point": "极限的定义与计算", "category": "函数与极限", "order": 2, "prerequisites": ["node_1"], "description": "数列极限、函数极限、极限运算法则"},
            {"id": "node_3", "knowledge_point": "连续与间断点", "category": "函数与极限", "order": 3, "prerequisites": ["node_2"], "description": "连续性定义、间断点分类、闭区间连续函数性质"},
            {"id": "node_4", "knowledge_point": "导数的概念与求导法则", "category": "导数与微分", "order": 4, "prerequisites": ["node_3"], "description": "导数定义、基本求导法则、复合函数求导"},
            {"id": "node_5", "knowledge_point": "高阶导数与隐函数求导", "category": "导数与微分", "order": 5, "prerequisites": ["node_4"], "description": "高阶导数、隐函数求导、参数方程求导"},
            {"id": "node_6", "knowledge_point": "微分中值定理", "category": "导数应用", "order": 6, "prerequisites": ["node_5"], "description": "罗尔定理、拉格朗日中值定理、柯西中值定理"},
            {"id": "node_7", "knowledge_point": "导数的应用", "category": "导数应用", "order": 7, "prerequisites": ["node_6"], "description": "单调性、极值、凹凸性、拐点、渐近线"},
            {"id": "node_8", "knowledge_point": "不定积分的概念与基本积分公式", "category": "积分学", "order": 8, "prerequisites": ["node_7"], "description": "原函数、不定积分、基本积分公式"},
            {"id": "node_9", "knowledge_point": "换元积分法与分部积分法", "category": "积分学", "order": 9, "prerequisites": ["node_8"], "description": "第一类换元、第二类换元、分部积分"},
            {"id": "node_10", "knowledge_point": "定积分的概念与性质", "category": "积分学", "order": 10, "prerequisites": ["node_9"], "description": "定积分定义、性质、牛顿-莱布尼茨公式"},
            {"id": "node_11", "knowledge_point": "定积分的应用", "category": "积分学", "order": 11, "prerequisites": ["node_10"], "description": "面积、体积、弧长、旋转体"},
            {"id": "node_12", "knowledge_point": "微分方程基础", "category": "微分方程", "order": 12, "prerequisites": ["node_11"], "description": "可分离变量、一阶线性、二阶常系数"},
            {"id": "node_13", "knowledge_point": "多元函数的偏导数", "category": "多元函数", "order": 13, "prerequisites": ["node_12"], "description": "偏导数、全微分、链式法则"},
            {"id": "node_14", "knowledge_point": "重积分", "category": "多元函数", "order": 14, "prerequisites": ["node_13"], "description": "二重积分、三重积分、应用"},
        ]

    def _get_python_nodes(self) -> List[Dict[str, Any]]:
        """Python编程知识点"""
        return [
            {"id": "node_1", "knowledge_point": "Python环境搭建与IDE选择", "category": "入门基础", "order": 1, "prerequisites": [], "description": "安装Python、选择IDE、第一个程序"},
            {"id": "node_2", "knowledge_point": "变量、数据类型与运算符", "category": "入门基础", "order": 2, "prerequisites": ["node_1"], "description": "变量命名、数字、字符串、布尔、运算符"},
            {"id": "node_3", "knowledge_point": "字符串操作与格式化", "category": "入门基础", "order": 3, "prerequisites": ["node_2"], "description": "字符串方法、切片、格式化输出"},
            {"id": "node_4", "knowledge_point": "列表与元组", "category": "数据结构", "order": 4, "prerequisites": ["node_3"], "description": "列表操作、元组特性、列表推导式"},
            {"id": "node_5", "knowledge_point": "字典与集合", "category": "数据结构", "order": 5, "prerequisites": ["node_4"], "description": "字典操作、集合运算、数据结构选择"},
            {"id": "node_6", "knowledge_point": "条件语句与循环语句", "category": "流程控制", "order": 6, "prerequisites": ["node_5"], "description": "if-else、for、while、break、continue"},
            {"id": "node_7", "knowledge_point": "函数定义与参数传递", "category": "函数", "order": 7, "prerequisites": ["node_6"], "description": "函数定义、参数类型、返回值、作用域"},
            {"id": "node_8", "knowledge_point": "模块与包的使用", "category": "模块", "order": 8, "prerequisites": ["node_7"], "description": "import、标准库、第三方包、pip"},
            {"id": "node_9", "knowledge_point": "文件操作与异常处理", "category": "IO与异常", "order": 9, "prerequisites": ["node_8"], "description": "文件读写、异常捕获、上下文管理器"},
            {"id": "node_10", "knowledge_point": "面向对象编程基础", "category": "面向对象", "order": 10, "prerequisites": ["node_9"], "description": "类、对象、属性、方法、__init__"},
            {"id": "node_11", "knowledge_point": "类的继承与多态", "category": "面向对象", "order": 11, "prerequisites": ["node_10"], "description": "继承、方法重写、多态、抽象类"},
            {"id": "node_12", "knowledge_point": "装饰器与生成器", "category": "高级特性", "order": 12, "prerequisites": ["node_11"], "description": "装饰器原理、生成器、迭代器"},
            {"id": "node_13", "knowledge_point": "常用内置模块", "category": "标准库", "order": 13, "prerequisites": ["node_12"], "description": "os、sys、datetime、json、re"},
            {"id": "node_14", "knowledge_point": "虚拟环境与项目管理", "category": "工程实践", "order": 14, "prerequisites": ["node_13"], "description": "venv、pipenv、requirements.txt"},
        ]

    def _get_ml_nodes(self) -> List[Dict[str, Any]]:
        """机器学习知识点"""
        return [
            {"id": "node_1", "knowledge_point": "机器学习概述与分类", "category": "基础概念", "order": 1, "prerequisites": [], "description": "监督学习、无监督学习、强化学习"},
            {"id": "node_2", "knowledge_point": "线性回归与梯度下降", "category": "回归算法", "order": 2, "prerequisites": ["node_1"], "description": "线性模型、损失函数、梯度下降优化"},
            {"id": "node_3", "knowledge_point": "逻辑回归与分类问题", "category": "分类算法", "order": 3, "prerequisites": ["node_2"], "description": "Sigmoid函数、二分类、多分类"},
            {"id": "node_4", "knowledge_point": "决策树与随机森林", "category": "树模型", "order": 4, "prerequisites": ["node_3"], "description": "信息增益、基尼指数、集成学习"},
            {"id": "node_5", "knowledge_point": "支持向量机（SVM）", "category": "分类算法", "order": 5, "prerequisites": ["node_4"], "description": "最大间隔、核函数、软间隔"},
            {"id": "node_6", "knowledge_point": "K近邻算法（KNN）", "category": "分类算法", "order": 6, "prerequisites": ["node_5"], "description": "距离度量、K值选择、KD树"},
            {"id": "node_7", "knowledge_point": "朴素贝叶斯分类器", "category": "概率模型", "order": 7, "prerequisites": ["node_6"], "description": "贝叶斯定理、条件独立假设"},
            {"id": "node_8", "knowledge_point": "聚类算法（K-Means）", "category": "无监督学习", "order": 8, "prerequisites": ["node_7"], "description": "K-Means原理、肘部法则、轮廓系数"},
            {"id": "node_9", "knowledge_point": "降维技术（PCA）", "category": "无监督学习", "order": 9, "prerequisites": ["node_8"], "description": "主成分分析、特征值分解、维度灾难"},
            {"id": "node_10", "knowledge_point": "模型评估与交叉验证", "category": "模型评估", "order": 10, "prerequisites": ["node_9"], "description": "准确率、精确率、召回率、F1、交叉验证"},
            {"id": "node_11", "knowledge_point": "特征工程与数据预处理", "category": "数据处理", "order": 11, "prerequisites": ["node_10"], "description": "缺失值处理、特征缩放、编码、特征选择"},
            {"id": "node_12", "knowledge_point": "集成学习方法", "category": "高级算法", "order": 12, "prerequisites": ["node_11"], "description": "Bagging、Boosting、AdaBoost、XGBoost"},
            {"id": "node_13", "knowledge_point": "神经网络基础", "category": "深度学习", "order": 13, "prerequisites": ["node_12"], "description": "感知机、反向传播、激活函数"},
            {"id": "node_14", "knowledge_point": "深度学习入门", "category": "深度学习", "order": 14, "prerequisites": ["node_13"], "description": "CNN、RNN、TensorFlow/PyTorch"},
        ]

    def _get_english_nodes(self) -> List[Dict[str, Any]]:
        """英语学习知识点"""
        return [
            {"id": "node_1", "knowledge_point": "音标与发音规则", "category": "语音基础", "order": 1, "prerequisites": [], "description": "48个音标、发音技巧、重音规则"},
            {"id": "node_2", "knowledge_point": "基础词汇（1000词）", "category": "词汇", "order": 2, "prerequisites": ["node_1"], "description": "日常词汇、高频词汇、记忆方法"},
            {"id": "node_3", "knowledge_point": "简单句型与基本语法", "category": "语法基础", "order": 3, "prerequisites": ["node_2"], "description": "主谓宾结构、be动词、一般现在时"},
            {"id": "node_4", "knowledge_point": "名词与冠词", "category": "词性", "order": 4, "prerequisites": ["node_3"], "description": "可数/不可数名词、a/an/the用法"},
            {"id": "node_5", "knowledge_point": "动词时态（一般时态）", "category": "时态", "order": 5, "prerequisites": ["node_4"], "description": "一般现在、一般过去、一般将来"},
            {"id": "node_6", "knowledge_point": "进行时态与完成时态", "category": "时态", "order": 6, "prerequisites": ["node_5"], "description": "现在进行、过去进行、现在完成"},
            {"id": "node_7", "knowledge_point": "被动语态", "category": "语态", "order": 7, "prerequisites": ["node_6"], "description": "被动语态构成、各时态被动"},
            {"id": "node_8", "knowledge_point": "定语从句", "category": "从句", "order": 8, "prerequisites": ["node_7"], "description": "关系代词、关系副词、限制性/非限制性"},
            {"id": "node_9", "knowledge_point": "名词性从句", "category": "从句", "order": 9, "prerequisites": ["node_8"], "description": "主语从句、宾语从句、表语从句"},
            {"id": "node_10", "knowledge_point": "虚拟语气", "category": "语气", "order": 10, "prerequisites": ["node_9"], "description": "条件句虚拟、wish/as if用法"},
            {"id": "node_11", "knowledge_point": "非谓语动词", "category": "高级语法", "order": 11, "prerequisites": ["node_10"], "description": "不定式、动名词、分词"},
            {"id": "node_12", "knowledge_point": "倒装与强调", "category": "高级语法", "order": 12, "prerequisites": ["node_11"], "description": "全部倒装、部分倒装、强调句型"},
            {"id": "node_13", "knowledge_point": "阅读理解技巧", "category": "阅读", "order": 13, "prerequisites": ["node_12"], "description": "略读、扫读、推断、主旨大意"},
            {"id": "node_14", "knowledge_point": "写作基础", "category": "写作", "order": 14, "prerequisites": ["node_13"], "description": "段落结构、连接词、常见文体"},
        ]

    def _get_generic_nodes(self, target_knowledge: str) -> List[Dict[str, Any]]:
        """通用知识点模板"""
        return [
            {"id": "node_1", "knowledge_point": f"{target_knowledge}的基本概念", "category": "基础入门", "order": 1, "prerequisites": [], "description": f"了解{target_knowledge}的定义、背景和应用领域"},
            {"id": "node_2", "knowledge_point": f"{target_knowledge}的核心原理", "category": "基础入门", "order": 2, "prerequisites": ["node_1"], "description": f"掌握{target_knowledge}的基本原理和理论基础"},
            {"id": "node_3", "knowledge_point": f"{target_knowledge}的基础知识体系", "category": "基础知识", "order": 3, "prerequisites": ["node_2"], "description": f"系统学习{target_knowledge}的基础知识框架"},
            {"id": "node_4", "knowledge_point": f"{target_knowledge}的基本技能", "category": "基础知识", "order": 4, "prerequisites": ["node_3"], "description": f"掌握{target_knowledge}的基本操作技能"},
            {"id": "node_5", "knowledge_point": f"{target_knowledge}的常用工具", "category": "工具实践", "order": 5, "prerequisites": ["node_4"], "description": f"熟悉{target_knowledge}相关的常用工具"},
            {"id": "node_6", "knowledge_point": f"{target_knowledge}的实践方法", "category": "工具实践", "order": 6, "prerequisites": ["node_5"], "description": f"学习{target_knowledge}的实际应用方法"},
            {"id": "node_7", "knowledge_point": f"{target_knowledge}的案例分析", "category": "进阶应用", "order": 7, "prerequisites": ["node_6"], "description": f"通过案例深入理解{target_knowledge}"},
            {"id": "node_8", "knowledge_point": f"{target_knowledge}的高级技巧", "category": "进阶应用", "order": 8, "prerequisites": ["node_7"], "description": f"掌握{target_knowledge}的高级应用技巧"},
            {"id": "node_9", "knowledge_point": f"{target_knowledge}的综合应用", "category": "综合提升", "order": 9, "prerequisites": ["node_8"], "description": f"综合运用{target_knowledge}解决复杂问题"},
            {"id": "node_10", "knowledge_point": f"{target_knowledge}的前沿发展", "category": "综合提升", "order": 10, "prerequisites": ["node_9"], "description": f"了解{target_knowledge}的最新发展和趋势"},
        ]


# 创建全局实例
learning_path_agent = LearningPathAgent()
