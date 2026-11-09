"""性能冒烟：对运行中的后端发起 100 并发只读请求，输出 P95（TEST_PLAN §9）。

用法（先启动 uvicorn 8080，再执行）：
    backend/.venv/Scripts/python.exe -m tests.perf_smoke
"""

import os
import statistics
import time
from concurrent.futures import ThreadPoolExecutor

import httpx

BASE_URL = os.environ.get("MM_PERF_BASE", "http://127.0.0.1:8080")
PATH = "/api/v1/teas?size=12"
CONCURRENCY = 100
TIMEOUT_SECONDS = float(os.environ.get("MM_PERF_TIMEOUT", "30"))


def _one(client: httpx.Client) -> float:
    started = time.perf_counter()
    response = client.get(f"{BASE_URL}{PATH}")
    response.raise_for_status()
    return (time.perf_counter() - started) * 1000


def main() -> None:
    # 复用连接：浏览器与压测工具均会保持 keep-alive，逐请求新建 TCP 连接
    # 会把 Windows 回环建连开销混入耗时，测不到服务端真实延迟。
    limits = httpx.Limits(max_connections=CONCURRENCY, max_keepalive_connections=CONCURRENCY)
    with httpx.Client(timeout=TIMEOUT_SECONDS, limits=limits) as client:
        client.get(f"{BASE_URL}/health")
        for _ in range(5):
            _one(client)
        with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
            durations = list(pool.map(lambda _: _one(client), range(CONCURRENCY)))
    durations.sort()
    p95 = durations[int(len(durations) * 0.95) - 1]
    print(f"requests={len(durations)} concurrency={CONCURRENCY}")
    print(f"p50={statistics.median(durations):.1f}ms p95={p95:.1f}ms max={durations[-1]:.1f}ms")
    print("threshold_p95=300ms", "PASS" if p95 <= 300 else "FAIL")


if __name__ == "__main__":
    main()
