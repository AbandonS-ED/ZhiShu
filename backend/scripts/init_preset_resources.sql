-- 预置资源初始化脚本 - 人工智能导论课程
-- 执行方式: psql -U postgres -d zhishu -f backend/scripts/init_preset_resources.sql
-- 注意：需要先创建一个系统用户或使用 existing student_id

-- 创建系统预置资源（student_id 为系统管理员ID）
-- 这些资源对所有用户可见（通过 is_preset 字段标记）

-- 1. 添加 is_preset 字段到 resources 表
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'resources' AND column_name = 'is_preset'
    ) THEN
        ALTER TABLE resources ADD COLUMN is_preset BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✅ 已添加 resources.is_preset 字段';
    ELSE
        RAISE NOTICE '⏭️  resources.is_preset 字段已存在，跳过';
    END IF;
END $$;

-- 2. 插入预置资源
-- 使用系统管理员ID作为预置资源的拥有者
DO $$
DECLARE
    system_user_id UUID := 'a0000000-0000-0000-0000-000000000001';
BEGIN
    -- 检查是否已有预置资源
    IF NOT EXISTS (SELECT 1 FROM resources WHERE is_preset = TRUE LIMIT 1) THEN
        -- 资源1: A*搜索算法详解
        INSERT INTO resources (id, student_id, title, resource_type, content, knowledge_point, difficulty, is_preset, is_favorited)
        VALUES (
            gen_random_uuid(),
            system_user_id,
            'A* 搜索算法详解',
            'knowledge',
            '{"knowledge": "# A* 搜索算法详解\n\n## 算法概述\n\nA*（A-Star）算法是一种在图中寻找从起始节点到目标节点最短路径的启发式搜索算法。它结合了 Dijkstra 算法的最优性保证和贪心最佳优先搜索的效率。\n\n## 核心公式\n\nA* 使用评估函数 **f(n) = g(n) + h(n)** 来决定节点的探索优先级：\n\n- **g(n)**：从起点到节点 n 的实际代价\n- **h(n)**：从节点 n 到目标的启发式估计（启发函数）\n- **f(n)**：节点 n 的综合评估值\n\n## 启发函数设计\n\n常见的启发函数包括：\n\n1. **曼哈顿距离**：适用于四方向移动的网格\n   - h(n) = |x_n - x_goal| + |y_n - y_goal|\n\n2. **欧几里得距离**：适用于任意方向移动\n   - h(n) = √((x_n - x_goal)² + (y_n - y_goal)²)\n\n3. **切比雪夫距离**：适用于八方向移动\n   - h(n) = max(|x_n - x_goal|, |y_n - y_goal|)\n\n## 可采纳性与一致性\n\n### 可采纳性（Admissibility）\n当启发函数 h(n) 满足**可采纳性**，即对所有节点 n，h(n) 不超过从 n 到目标的实际最短距离时，A* 保证找到最优解。\n\n### 一致性（Consistency）\n更强的条件：对于任意节点 n 和其后继 n'，满足 h(n) ≤ c(n,n') + h(n')。\n\n## 与 Dijkstra 的关系\n\nDijkstra 算法可以看作 A* 的特例，即 h(n) = 0 时的 A*。此时算法退化为均匀扩展的盲目搜索。\n\n## 时间复杂度\n\n- 最好情况：O(b^d)，b 是分支因子，d 是最优解深度\n- 最坏情况：O(b^d)（当启发函数效果好时）\n- 空间复杂度：O(b^d)\n\n## 应用场景\n\n- 游戏中的路径规划\n- 机器人导航\n- 地图导航系统\n- 网络路由算法", "code": "# A* 算法 Python 实现\n\n```python\nimport heapq\nfrom typing import List, Tuple, Dict, Set\n\ndef a_star(\n    grid: List[List[int]],\n    start: Tuple[int, int],\n    end: Tuple[int, int],\n    heuristic: str = 'manhattan'\n) -> List[Tuple[int, int]]:\n    \"\"\"\n    A* 搜索算法实现\n    \n    Args:\n        grid: 二维网格，0表示可通行，1表示障碍物\n        start: 起点坐标 (row, col)\n        end: 终点坐标 (row, col)\n        heuristic: 启发函数类型 ('manhattan' 或 'euclidean')\n    \n    Returns:\n        最短路径坐标列表\n    \"\"\"\n    rows, cols = len(grid), len(grid[0])\n    \n    # 方向：上、下、左、右\n    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]\n    \n    def get_heuristic(node: Tuple[int, int]) -> float:\n        \"\"\"计算启发函数值\"\"\"\n        if heuristic == 'manhattan':\n            return abs(node[0] - end[0]) + abs(node[1] - end[1])\n        else:  # euclidean\n            return ((node[0] - end[0])**2 + (node[1] - end[1])**2) ** 0.5\n    \n    # 优先队列：(f值, 坐标)\n    open_set = [(0, start)]\n    # 记录已访问节点的g值\n    g_scores = {start: 0}\n    # 记录路径\n    came_from = {}\n    # 已访问集合\n    closed_set: Set[Tuple[int, int]] = set()\n    \n    while open_set:\n        # 取出f值最小的节点\n        current_f, current = heapq.heappop(open_set)\n        \n        if current == end:\n            # 重建路径\n            path = []\n            while current in came_from:\n                path.append(current)\n                current = came_from[current]\n            path.append(start)\n            return path[::-1]\n        \n        if current in closed_set:\n            continue\n        closed_set.add(current)\n        \n        # 探索邻居\n        for dx, dy in directions:\n            neighbor = (current[0] + dx, current[1] + dy)\n            \n            # 检查边界和障碍物\n            if (0 <= neighbor[0] < rows and\n                0 <= neighbor[1] < cols and\n                grid[neighbor[0]][neighbor[1]] == 0 and\n                neighbor not in closed_set):\n                \n                tentative_g = g_scores[current] + 1\n                \n                if neighbor not in g_scores or tentative_g < g_scores[neighbor]:\n                    g_scores[neighbor] = tentative_g\n                    f_score = tentative_g + get_heuristic(neighbor)\n                    heapq.heappush(open_set, (f_score, neighbor))\n                    came_from[neighbor] = current\n    \n    return []  # 无法到达\n\n\n# 示例使用\nif __name__ == '__main__':\n    # 0表示可通行，1表示障碍物\n    grid = [\n        [0, 0, 0, 0, 0],\n        [0, 1, 1, 1, 0],\n        [0, 0, 0, 1, 0],\n        [0, 1, 0, 0, 0],\n        [0, 0, 0, 0, 0]\n    ]\n    \n    start = (0, 0)\n    end = (4, 4)\n    \n    path = a_star(grid, start, end)\n    print(f\"最短路径: {path}\")\n    print(f\"路径长度: {len(path) - 1}\")\n```\n\n## 代码说明\n\n1. **数据结构**：使用优先队列（最小堆）存储待探索节点\n2. **启发函数**：支持曼哈顿距离和欧几里得距离\n3. **路径重建**：通过 `came_from` 字典记录每个节点的父节点\n4. **时间复杂度**：O(b^d)，空间复杂度：O(b^d)", "audio_script": "同学们好，今天我们来学习A*搜索算法。\n\nA*算法是一种非常经典的路径搜索算法，它在人工智能、游戏开发、机器人导航等领域都有广泛应用。\n\n那A*算法的核心思想是什么呢？简单来说，它结合了两种搜索策略的优点：\n\n第一种是Dijkstra算法，它保证能找到最短路径，但搜索效率比较低，因为它会向所有方向均匀扩展。\n\n第二种是贪心最佳优先搜索，它搜索效率高，但不保证找到最优解。\n\nA*算法通过一个评估函数f(n) = g(n) + h(n)来平衡这两者。\n\n其中g(n)是从起点到当前节点的实际代价，h(n)是从当前节点到目标的估计代价，也叫启发函数。\n\n启发函数的设计很关键。常用的启发函数有曼哈顿距离、欧几里得距离等。\n\n一个好的启发函数能让搜索更加高效。如果启发函数满足可采纳性条件，也就是它估计的代价不超过实际代价，那么A*算法就能保证找到最优解。\n\n同学们可以想想，为什么Dijkstra算法相当于h(n)=0的A*算法呢？因为当h(n)=0时，f(n)=g(n)，算法就退化为只考虑实际代价的搜索了。\n\n好的，关于A*算法就讲到这里，同学们可以结合代码实践加深理解。"}',
            '搜索算法',
            50,
            TRUE,
            FALSE
        );

        -- 资源2: 机器学习基础概念
        INSERT INTO resources (id, student_id, title, resource_type, content, knowledge_point, difficulty, is_preset, is_favorited)
        VALUES (
            gen_random_uuid(),
            system_user_id,
            '机器学习基础概念',
            'knowledge',
            '{"knowledge": "# 机器学习基础概念\n\n## 什么是机器学习\n\n机器学习是人工智能的一个分支，它使计算机系统能够从数据中学习和改进，而无需显式编程。\n\nTom Mitchell 的定义：\"对于某类任务 T 和性能度量 P，如果一个计算机程序在 T 上以 P 衡量的性能随着经验 E 而自我完善，那么我们称这个程序从经验 E 中学习。\"\n\n## 机器学习的三大类型\n\n### 1. 监督学习（Supervised Learning）\n\n**定义**：从带有标签的训练数据中学习映射函数\n\n**任务类型**：\n- **分类**：预测离散类别（如垃圾邮件检测、图像分类）\n- **回归**：预测连续数值（如房价预测、温度预测）\n\n**常见算法**：\n- 线性回归、逻辑回归\n- 决策树、随机森林\n- 支持向量机（SVM）\n- 神经网络\n\n### 2. 无监督学习（Unsupervised Learning）\n\n**定义**：从没有标签的数据中发现隐藏结构\n\n**任务类型**：\n- **聚类**：将数据分成组（如客户分群、图像分割）\n- **降维**：减少数据维度（如PCA、t-SNE）\n- **关联规则**：发现数据项之间的关系\n\n**常见算法**：\n- K-Means 聚类\n- 层次聚类\n- DBSCAN\n- 主成分分析（PCA）\n\n### 3. 强化学习（Reinforcement Learning）\n\n**定义**：通过与环境交互，学习最优策略以获得最大累积奖励\n\n**核心概念**：\n- **Agent（智能体）**：学习和决策的主体\n- **Environment（环境）**：智能体交互的外部世界\n- **State（状态）**：环境的当前情况\n- **Action（动作）**：智能体可以执行的操作\n- **Reward（奖励）**：环境对动作的反馈\n\n**常见算法**：\n- Q-Learning\n- Deep Q-Network（DQN）\n- 策略梯度（Policy Gradient）\n- Actor-Critic\n\n## 模型评估\n\n### 过拟合与欠拟合\n\n- **过拟合**：模型在训练集表现好，但在测试集表现差\n- **欠拟合**：模型在训练集和测试集表现都差\n\n### 评估指标\n\n**分类任务**：\n- 准确率（Accuracy）\n- 精确率（Precision）\n- 召回率（Recall）\n- F1分数\n- AUC-ROC\n\n**回归任务**：\n- 均方误差（MSE）\n- 均方根误差（RMSE）\n- 平均绝对误差（MAE）\n- R²分数\n\n## 特征工程\n\n特征工程是机器学习中非常重要的一步：\n\n1. **特征选择**：选择最相关的特征\n2. **特征提取**：从原始数据中提取特征\n3. **特征变换**：标准化、归一化、编码\n4. **特征构造**：组合现有特征创建新特征"}',
            '机器学习',
            40,
            TRUE,
            FALSE
        );

        -- 资源3: 神经网络与深度学习
        INSERT INTO resources (id, student_id, title, resource_type, content, knowledge_point, difficulty, is_preset, is_favorited)
        VALUES (
            gen_random_uuid(),
            system_user_id,
            '神经网络与深度学习入门',
            'knowledge',
            '{"knowledge": "# 神经网络与深度学习入门\n\n## 人工神经网络基础\n\n### 生物神经元 vs 人工神经元\n\n人工神经元模仿生物神经元的工作方式：\n\n```\n输入 → 加权求和 → 激活函数 → 输出\n```\n\n**数学表达**：\n- z = w₁x₁ + w₂x₂ + ... + wₙxₙ + b = Σwᵢxᵢ + b\n- a = σ(z)\n\n其中：\n- xᵢ：输入\n- wᵢ：权重\n- b：偏置\n- σ：激活函数\n- a：输出\n\n### 常用激活函数\n\n1. **Sigmoid**：σ(x) = 1/(1+e^(-x))\n   - 输出范围：(0, 1)\n   - 缺点：梯度消失\n\n2. **ReLU**：f(x) = max(0, x)\n   - 计算简单，收敛快\n   - 缺点：死亡ReLU问题\n\n3. **Tanh**：tanh(x) = (e^x - e^(-x))/(e^x + e^(-x))\n   - 输出范围：(-1, 1)\n\n4. **Leaky ReLU**：f(x) = max(0.01x, x)\n   - 解决死亡ReLU问题\n\n## 多层感知机（MLP）\n\n### 网络结构\n\n```\n输入层 → 隐藏层1 → 隐藏层2 → ... → 输出层\n```\n\n- **输入层**：接收原始特征\n- **隐藏层**：提取高阶特征\n- **输出层**：产生预测结果\n\n### 前向传播\n\n1. 计算每层的加权和\n2. 应用激活函数\n3. 逐层传递直到输出层\n\n### 反向传播（Backpropagation）\n\n**核心思想**：利用链式法则计算损失函数对每个参数的梯度\n\n**步骤**：\n1. 前向传播计算输出\n2. 计算损失函数\n3. 反向传播计算梯度\n4. 更新参数（梯度下降）\n\n**参数更新公式**：\n- w = w - α × ∂L/∂w\n- b = b - α × ∂L/∂b\n\n其中 α 是学习率\n\n## 卷积神经网络（CNN）\n\n### 核心组件\n\n1. **卷积层**：提取局部特征\n   - 卷积核在输入上滑动\n   - 每个位置计算内积\n\n2. **池化层**：降维，减少参数\n   - 最大池化：取窗口内最大值\n   - 平均池化：取窗口内平均值\n\n3. **全连接层**：综合特征，输出结果\n\n### 经典CNN架构\n\n- **LeNet-5**（1998）：手写数字识别\n- **AlexNet**（2012）：ImageNet冠军\n- **VGGNet**（2014）：更深的网络\n- **ResNet**（2015）：残差连接\n- **Inception**（2014）：多尺度特征\n\n## 循环神经网络（RNN）\n\n### 基本结构\n\n```\n        ┌───────┐\n        │       ↓\n输入 → 隐藏状态 → 输出\n```\n\n**公式**：\n- hₜ = σ(Wₕₕ · hₜ₋₁ + Wₓₕ · xₜ + b)\n- yₜ = Wᵧₕ · hₜ + c\n\n### LSTM（长短期记忆网络）\n\n解决RNN的梯度消失问题：\n\n1. **遗忘门**：决定丢弃什么信息\n2. **输入门**：决定存储什么新信息\n3. **输出门**：决定输出什么信息\n4. **细胞状态**：长期记忆通道\n\n## 深度学习实践技巧\n\n1. **数据预处理**：标准化、数据增强\n2. **权重初始化**：Xavier、He初始化\n3. **优化器**：Adam、SGD with momentum\n4. **正则化**：Dropout、L2正则化\n5. **学习率调度**：warmup、cosine annealing"}',
            '深度学习',
            60,
            TRUE,
            FALSE
        );

        -- 资源4: 知识表示方法
        INSERT INTO resources (id, student_id, title, resource_type, content, knowledge_point, difficulty, is_preset, is_favorited)
        VALUES (
            gen_random_uuid(),
            system_user_id,
            '知识表示方法总览',
            'mindmap',
            '{"mermaid_code": "mindmap\n  root((知识表示))\n    逻辑表示\n      命题逻辑\n        布尔值\n        逻辑运算符\n      一阶谓词逻辑\n        量词\n        谓词\n        函数\n      描述逻辑\n        概念\n        角色\n    结构化表示\n      语义网络\n        节点=概念\n        边=关系\n      框架Frame\n        槽Slot\n        侧面Facet\n      脚本Script\n        场景\n        角色\n    规则表示\n      产生式规则\n        IF-THEN结构\n        冲突消解\n      专家系统\n        知识库\n        推理机\n    现代方法\n      知识图谱\n        实体\n        关系\n        属性\n      向量表示\n        Word2Vec\n        BERT\n        GNN\n      本体论\n        类层次\n        公理"}',
            '知识工程',
            45,
            TRUE,
            FALSE
        );

        -- 资源5: Python机器学习代码示例
        INSERT INTO resources (id, student_id, title, resource_type, content, knowledge_point, difficulty, is_preset, is_favorited)
        VALUES (
            gen_random_uuid(),
            system_user_id,
            'Python机器学习实战代码',
            'code',
            '{"code": "# scikit-learn 机器学习实战代码\n\n## 1. 数据预处理\n\n```python\nimport numpy as np\nimport pandas as pd\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.preprocessing import StandardScaler, LabelEncoder\n\n# 加载数据\ndf = pd.read_csv(\"data.csv\")\n\n# 处理缺失值\ndf.fillna(df.mean(), inplace=True)\n\n# 特征和标签分离\nX = df.drop(\"target\", axis=1)\ny = df[\"target\"]\n\n# 编码分类变量\nle = LabelEncoder()\ny = le.fit_transform(y)\n\n# 划分训练集和测试集\nX_train, X_test, y_train, y_test = train_test_split(\n    X, y, test_size=0.2, random_state=42\n)\n\n# 特征标准化\nscaler = StandardScaler()\nX_train = scaler.fit_transform(X_train)\nX_test = scaler.transform(X_test)\n```\n\n## 2. 分类任务\n\n```python\nfrom sklearn.linear_model import LogisticRegression\nfrom sklearn.ensemble import RandomForestClassifier\nfrom sklearn.svm import SVC\nfrom sklearn.metrics import accuracy_score, classification_report\n\n# 逻辑回归\nlr = LogisticRegression(max_iter=1000)\nlr.fit(X_train, y_train)\ny_pred = lr.predict(X_test)\nprint(f\"逻辑回归准确率: {accuracy_score(y_test, y_pred):.4f}\")\n\n# 随机森林\nrf = RandomForestClassifier(n_estimators=100, random_state=42)\nrf.fit(X_train, y_train)\ny_pred = rf.predict(X_test)\nprint(f\"随机森林准确率: {accuracy_score(y_test, y_pred):.4f}\")\n\n# 支持向量机\nsvm = SVC(kernel=\"rbf\")\nsvm.fit(X_train, y_train)\ny_pred = svm.predict(X_test)\nprint(f\"SVM准确率: {accuracy_score(y_test, y_pred):.4f}\")\n\n# 详细分类报告\nprint(\"\\n分类报告:\")\nprint(classification_report(y_test, y_pred))\n```\n\n## 3. 回归任务\n\n```python\nfrom sklearn.linear_model import LinearRegression\nfrom sklearn.ensemble import GradientBoostingRegressor\nfrom sklearn.metrics import mean_squared_error, r2_score\n\n# 线性回归\nlr = LinearRegression()\nlr.fit(X_train, y_train)\ny_pred = lr.predict(X_test)\nprint(f\"线性回归 MSE: {mean_squared_error(y_test, y_pred):.4f}\")\nprint(f\"线性回归 R²: {r2_score(y_test, y_pred):.4f}\")\n\n# 梯度提升\ngbr = GradientBoostingRegressor(n_estimators=100, random_state=42)\ngbr.fit(X_train, y_train)\ny_pred = gbr.predict(X_test)\nprint(f\"梯度提升 MSE: {mean_squared_error(y_test, y_pred):.4f}\")\nprint(f\"梯度提升 R²: {r2_score(y_test, y_pred):.4f}\")\n```\n\n## 4. 模型评估与调优\n\n```python\nfrom sklearn.model_selection import cross_val_score, GridSearchCV\n\n# 交叉验证\nscores = cross_val_score(rf, X, y, cv=5, scoring=\"accuracy\")\nprint(f\"交叉验证准确率: {scores.mean():.4f} (+/- {scores.std() * 2:.4f})\")\n\n# 网格搜索调参\nparam_grid = {\n    \"n_estimators\": [50, 100, 200],\n    \"max_depth\": [3, 5, 10, None],\n    \"min_samples_split\": [2, 5, 10]\n}\n\ngrid_search = GridSearchCV(\n    RandomForestClassifier(random_state=42),\n    param_grid, cv=5, scoring=\"accuracy\", n_jobs=-1\n)\ngrid_search.fit(X_train, y_train)\n\nprint(f\"最佳参数: {grid_search.best_params_}\")\nprint(f\"最佳得分: {grid_search.best_score_:.4f}\")\n```\n\n## 5. 模型保存与加载\n\n```python\nimport joblib\n\n# 保存模型\njoblib.dump(rf, \"model.pkl\")\n\n# 加载模型\nloaded_model = joblib.load(\"model.pkl\")\ny_pred = loaded_model.predict(X_test)\n```"}',
            '机器学习',
            55,
            TRUE,
            FALSE
        );

        RAISE NOTICE '✅ 已插入5个预置资源';
    ELSE
        RAISE NOTICE '⏭️  预置资源已存在，跳过插入';
    END IF;
END $$;

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_resources_is_preset ON resources(is_preset);

\echo '✅ 预置资源初始化完成'
\echo '   - A* 搜索算法详解'
\echo '   - 机器学习基础概念'
\echo '   - 神经网络与深度学习入门'
\echo '   - 知识表示方法总览（思维导图）'
\echo '   - Python机器学习实战代码'
