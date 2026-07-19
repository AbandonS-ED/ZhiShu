"""Agent 调用指标采集器（内存计数器，重启清零）"""
import threading
import time
from collections import defaultdict


class AgentMetrics:
    """采集 Agent 调用次数、成功/失败、平均耗时"""

    _AGENT_META = {
        "initial_assessment": {"name": "InitialAssessmentAgent", "role": "画像构建"},
        "document": {"name": "DocumentAgent", "role": "知识讲解"},
        "exercise": {"name": "ExerciseAgent", "role": "练习生成"},
        "tutor": {"name": "TutorAgent", "role": "智能问答"},
        "mindmap": {"name": "MindMapAgent", "role": "思维导图"},
        "audio": {"name": "AudioAgent", "role": "音频脚本"},
        "master": {"name": "MasterAgent", "role": "调度中心"},
        "learning_path": {"name": "LearningPathAgent", "role": "路径规划"},
        "learning_guide": {"name": "LearningGuideAgent", "role": "学习指引"},
        "behavior_analysis": {"name": "BehaviorAnalysisAgent", "role": "行为分析"},
        "coordinator": {"name": "CoordinatorAgent", "role": "任务协调"},
        "review": {"name": "ReviewAgent", "role": "质量审核"},
        "resource_creator": {"name": "ResourceCreatorAgent", "role": "资源创建"},
        "wrong_question": {"name": "WrongQuestionAgent", "role": "错题分析"},
        "scoring": {"name": "ScoringAgent", "role": "AI评分"},
    }

    def __init__(self):
        self._data: dict[str, dict] = defaultdict(
            lambda: {"calls": 0, "errors": 0, "total_ms": 0.0}
        )
        self._lock = threading.Lock()

    def record(self, agent_name: str, success: bool, duration_ms: float):
        with self._lock:
            d = self._data[agent_name]
            d["calls"] += 1
            if not success:
                d["errors"] += 1
            d["total_ms"] += duration_ms

    def get_all(self) -> list[dict]:
        with self._lock:
            result = []
            for key, meta in self._AGENT_META.items():
                d = self._data.get(key)
                calls = d["calls"] if d else 0
                errors = d["errors"] if d else 0
                total_ms = d["total_ms"] if d else 0.0
                result.append({
                    "name": meta["name"],
                    "role": meta["role"],
                    "calls": calls,
                    "errors": errors,
                    "error_rate": round(errors / calls * 100, 1) if calls else 0.0,
                    "avg_ms": round(total_ms / calls, 1) if calls else 0.0,
                })
            return result

    def get_summary(self) -> dict:
        with self._lock:
            total_calls = sum(d["calls"] for d in self._data.values())
            total_errors = sum(d["errors"] for d in self._data.values())
            return {
                "total_agents": len(self._AGENT_META),
                "total_calls": total_calls,
                "total_errors": total_errors,
                "error_rate": round(total_errors / total_calls * 100, 1) if total_calls else 0.0,
            }


agent_metrics = AgentMetrics()
