r"""
预置资源初始化脚本 - 人工智能导论课程

用法:
  cd backend
  venv\Scripts\python scripts\init_preset_resources.py
"""
import asyncio
import sys
from pathlib import Path
import uuid

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, text
from app.core.database import async_session
from app.models.resource import Resource

SYSTEM_USER_ID = uuid.UUID("a0000000-0000-0000-0000-000000000001")

PRESET_RESOURCES = [
    {
        "title": "A* 搜索算法详解",
        "resource_type": "knowledge",
        "knowledge_point": "搜索算法",
        "difficulty": 50,
        "content": {
            "knowledge": "# A* 搜索算法详解\n\n## 算法概述\n\nA*（A-Star）算法是一种在图中寻找从起始节点到目标节点最短路径的启发式搜索算法。它结合了 Dijkstra 算法的最优性保证和贪心最佳优先搜索的效率。\n\n## 核心公式\n\nA* 使用评估函数 **f(n) = g(n) + h(n)** 来决定节点的探索优先级：\n\n- **g(n)**：从起点到节点 n 的实际代价\n- **h(n)**：从节点 n 到目标的启发式估计（启发函数）\n- **f(n)**：节点 n 的综合评估值\n\n## 启发函数设计\n\n常见的启发函数包括：\n\n1. **曼哈顿距离**：适用于四方向移动的网格\n   - h(n) = |x_n - x_goal| + |y_n - y_goal|\n\n2. **欧几里得距离**：适用于任意方向移动\n   - h(n) = √((x_n - x_goal)² + (y_n - y_goal)²)\n\n## 可采纳性与一致性\n\n### 可采纳性（Admissibility）\n当启发函数 h(n) 满足可采纳性，即对所有节点 n，h(n) 不超过从 n 到目标的实际最短距离时，A* 保证找到最优解。\n\n### 一致性（Consistency）\n更强的条件：对于任意节点 n 和其后继 n'，满足 h(n) ≤ c(n,n') + h(n')。\n\n## 时间复杂度\n\n- 最好情况：O(b^d)，b 是分支因子，d 是最优解深度\n- 空间复杂度：O(b^d)\n\n## 应用场景\n\n- 游戏中的路径规划\n- 机器人导航\n- 地图导航系统",
            "code": "# A* 算法 Python 实现\n\n```python\nimport heapq\n\ndef a_star(grid, start, end):\n    \"\"\"A* 搜索算法\"\"\"\n    rows, cols = len(grid), len(grid[0])\n    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]\n    \n    def heuristic(a, b):\n        return abs(a[0] - b[0]) + abs(a[1] - b[1])\n    \n    open_set = [(0, start)]\n    g_scores = {start: 0}\n    came_from = {}\n    closed_set = set()\n    \n    while open_set:\n        _, current = heapq.heappop(open_set)\n        \n        if current == end:\n            path = []\n            while current in came_from:\n                path.append(current)\n                current = came_from[current]\n            return path[::-1]\n        \n        if current in closed_set:\n            continue\n        closed_set.add(current)\n        \n        for dx, dy in directions:\n            neighbor = (current[0] + dx, current[1] + dy)\n            if (0 <= neighbor[0] < rows and\n                0 <= neighbor[1] < cols and\n                grid[neighbor[0]][neighbor[1]] == 0 and\n                neighbor not in closed_set):\n                \n                tentative_g = g_scores[current] + 1\n                if neighbor not in g_scores or tentative_g < g_scores[neighbor]:\n                    g_scores[neighbor] = tentative_g\n                    f_score = tentative_g + heuristic(neighbor, end)\n                    heapq.heappush(open_set, (f_score, neighbor))\n                    came_from[neighbor] = current\n    \n    return []\n```"
        }
    },
    {
        "title": "机器学习基础概念",
        "resource_type": "knowledge",
        "knowledge_point": "机器学习",
        "difficulty": 40,
        "content": {
            "knowledge": "# 机器学习基础概念\n\n## 什么是机器学习\n\n机器学习是人工智能的一个分支，它使计算机系统能够从数据中学习和改进，而无需显式编程。\n\n## 机器学习的三大类型\n\n### 1. 监督学习（Supervised Learning）\n\n从带有标签的训练数据中学习映射函数。\n\n**任务类型**：\n- **分类**：预测离散类别（如垃圾邮件检测、图像分类）\n- **回归**：预测连续数值（如房价预测）\n\n**常见算法**：\n- 线性回归、逻辑回归\n- 决策树、随机森林\n- 支持向量机（SVM）\n- 神经网络\n\n### 2. 无监督学习（Unsupervised Learning）\n\n从没有标签的数据中发现隐藏结构。\n\n**任务类型**：\n- **聚类**：将数据分成组（如客户分群）\n- **降维**：减少数据维度（如PCA）\n\n**常见算法**：\n- K-Means 聚类\n- 层次聚类\n- DBSCAN\n- 主成分分析（PCA）\n\n### 3. 强化学习（Reinforcement Learning）\n\n通过与环境交互，学习最优策略以获得最大累积奖励。\n\n**核心概念**：\n- **Agent（智能体）**：学习和决策的主体\n- **Environment（环境）**：智能体交互的外部世界\n- **State（状态）**：环境的当前情况\n- **Action（动作）**：智能体可以执行的操作\n- **Reward（奖励）**：环境对动作的反馈\n\n## 模型评估\n\n### 过拟合与欠拟合\n\n- **过拟合**：模型在训练集表现好，但在测试集表现差\n- **欠拟合**：模型在训练集和测试集表现都差"
        }
    },
    {
        "title": "神经网络与深度学习入门",
        "resource_type": "knowledge",
        "knowledge_point": "深度学习",
        "difficulty": 60,
        "content": {
            "knowledge": "# 神经网络与深度学习入门\n\n## 人工神经网络基础\n\n### 生物神经元 vs 人工神经元\n\n人工神经元模仿生物神经元的工作方式：\n\n```\n输入 → 加权求和 → 激活函数 → 输出\n```\n\n**数学表达**：\n- z = w₁x₁ + w₂x₂ + ... + wₙxₙ + b\n- a = σ(z)\n\n### 常用激活函数\n\n1. **Sigmoid**：σ(x) = 1/(1+e^(-x))\n   - 输出范围：(0, 1)\n   - 缺点：梯度消失\n\n2. **ReLU**：f(x) = max(0, x)\n   - 计算简单，收敛快\n   - 缺点：死亡ReLU问题\n\n3. **Tanh**：输出范围：(-1, 1)\n\n## 多层感知机（MLP）\n\n### 网络结构\n\n```\n输入层 → 隐藏层1 → 隐藏层2 → ... → 输出层\n```\n\n### 反向传播（Backpropagation）\n\n**核心思想**：利用链式法则计算损失函数对每个参数的梯度\n\n**参数更新公式**：\n- w = w - α × ∂L/∂w\n- b = b - α × ∂L/∂b\n\n## 卷积神经网络（CNN）\n\n### 核心组件\n\n1. **卷积层**：提取局部特征\n2. **池化层**：降维，减少参数\n3. **全连接层**：综合特征，输出结果\n\n### 经典CNN架构\n\n- **LeNet-5**（1998）：手写数字识别\n- **AlexNet**（2012）：ImageNet冠军\n- **VGGNet**（2014）：更深的网络\n- **ResNet**（2015）：残差连接"
        }
    },
    {
        "title": "知识表示方法总览",
        "resource_type": "mindmap",
        "knowledge_point": "知识工程",
        "difficulty": 45,
        "content": {
            "mermaid_code": "mindmap\n  root((知识表示))\n    逻辑表示\n      命题逻辑\n        布尔值\n        逻辑运算符\n      一阶谓词逻辑\n        量词\n        谓词\n        函数\n      描述逻辑\n        概念\n        角色\n    结构化表示\n      语义网络\n        节点=概念\n        边=关系\n      框架Frame\n        槽Slot\n        侧面Facet\n      脚本Script\n        场景\n        角色\n    规则表示\n      产生式规则\n        IF-THEN结构\n        冲突消解\n      专家系统\n        知识库\n        推理机\n    现代方法\n      知识图谱\n        实体\n        关系\n        属性\n      向量表示\n        Word2Vec\n        BERT\n        GNN\n      本体论\n        类层次\n        公理"
        }
    },
    {
        "title": "Python机器学习实战代码",
        "resource_type": "code",
        "knowledge_point": "机器学习",
        "difficulty": 55,
        "content": {
            "code": "# scikit-learn 机器学习实战代码\n\n## 1. 数据预处理\n\n```python\nimport numpy as np\nimport pandas as pd\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.preprocessing import StandardScaler\n\n# 加载数据\ndf = pd.read_csv(\"data.csv\")\n\n# 划分训练集和测试集\nX_train, X_test, y_train, y_test = train_test_split(\n    X, y, test_size=0.2, random_state=42\n)\n\n# 特征标准化\nscaler = StandardScaler()\nX_train = scaler.fit_transform(X_train)\nX_test = scaler.transform(X_test)\n```\n\n## 2. 分类任务\n\n```python\nfrom sklearn.linear_model import LogisticRegression\nfrom sklearn.ensemble import RandomForestClassifier\nfrom sklearn.metrics import accuracy_score\n\n# 逻辑回归\nlr = LogisticRegression(max_iter=1000)\nlr.fit(X_train, y_train)\ny_pred = lr.predict(X_test)\nprint(f\"逻辑回归准确率: {accuracy_score(y_test, y_pred):.4f}\")\n\n# 随机森林\nrf = RandomForestClassifier(n_estimators=100, random_state=42)\nrf.fit(X_train, y_train)\ny_pred = rf.predict(X_test)\nprint(f\"随机森林准确率: {accuracy_score(y_test, y_pred):.4f}\")\n```\n\n## 3. 模型评估与调优\n\n```python\nfrom sklearn.model_selection import cross_val_score, GridSearchCV\n\n# 交叉验证\nscores = cross_val_score(rf, X, y, cv=5, scoring=\"accuracy\")\nprint(f\"交叉验证准确率: {scores.mean():.4f}\")\n\n# 网格搜索调参\nparam_grid = {\n    \"n_estimators\": [50, 100, 200],\n    \"max_depth\": [3, 5, 10, None]\n}\n\ngrid_search = GridSearchCV(\n    RandomForestClassifier(random_state=42),\n    param_grid, cv=5, scoring=\"accuracy\"\n)\ngrid_search.fit(X_train, y_train)\nprint(f\"最佳参数: {grid_search.best_params_}\")\n```"
        }
    },
]


async def main():
    async with async_session() as session:
        # 1. 添加缺失字段
        for col in ["is_favorited", "is_preset"]:
            try:
                await session.execute(text(
                    f"ALTER TABLE resources ADD COLUMN IF NOT EXISTS {col} BOOLEAN DEFAULT FALSE"
                ))
            except Exception:
                pass
        await session.commit()
        print("[OK] 字段已就绪")

        # 2. 检查是否已有预置资源
        result = await session.execute(
            select(Resource).where(Resource.is_preset == True).limit(1)
        )
        if result.scalar_one_or_none():
            print("[SKIP] 预置资源已存在，跳过")
            return

        # 3. 插入预置资源
        for data in PRESET_RESOURCES:
            resource = Resource(
                id=uuid.uuid4(),
                student_id=SYSTEM_USER_ID,
                title=data["title"],
                resource_type=data["resource_type"],
                content=data["content"],
                knowledge_point=data["knowledge_point"],
                difficulty=data["difficulty"],
                is_preset=True,
                is_favorited=False,
            )
            session.add(resource)
            print(f"  [OK] {data['title']}")

        await session.commit()
        print(f"\n[DONE] 成功插入 {len(PRESET_RESOURCES)} 个预置资源")


if __name__ == "__main__":
    asyncio.run(main())
