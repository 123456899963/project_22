"""错误码字典，与 docs/api/API_CONTRACT.md §1.2/§1.4 一一对应。

新增错误码必须先登记 API_CONTRACT，再在此处追加（AGENTS.md §7）。
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ErrorSpec:
    code: str
    status: int
    message: str


class ErrorCode:
    OK = ErrorSpec("OK", 200, "success")

    AUTH_001 = ErrorSpec("MM-AUTH-001", 401, "请先登录")
    AUTH_002 = ErrorSpec("MM-AUTH-002", 401, "登录已过期，请刷新令牌")
    AUTH_003 = ErrorSpec("MM-AUTH-003", 403, "无权访问该资源")
    AUTH_004 = ErrorSpec("MM-AUTH-004", 403, "账号状态受限")
    AUTH_005 = ErrorSpec("MM-AUTH-005", 400, "登录 state 已失效，请刷新二维码")
    AUTH_006 = ErrorSpec("MM-AUTH-006", 401, "微信授权失败")

    CATALOG_001 = ErrorSpec("MM-CATALOG-001", 404, "茶品不存在或已下架")
    CATALOG_002 = ErrorSpec("MM-CATALOG-002", 409, "当前状态不允许该操作")
    CATALOG_003 = ErrorSpec("MM-CATALOG-003", 409, "上架条件不满足")

    MEDIA_001 = ErrorSpec("MM-MEDIA-001", 400, "图片格式不支持")
    MEDIA_002 = ErrorSpec("MM-MEDIA-002", 413, "图片超过 5MB")
    MEDIA_003 = ErrorSpec("MM-MEDIA-003", 400, "授权凭证缺失")
    MEDIA_004 = ErrorSpec("MM-MEDIA-004", 409, "图序冲突")

    SUB_001 = ErrorSpec("MM-SUB-001", 403, "今日投稿额度已满")
    SUB_002 = ErrorSpec("MM-SUB-002", 409, "疑似重复投稿")
    SUB_003 = ErrorSpec("MM-SUB-003", 409, "重提次数已达上限")
    SUB_004 = ErrorSpec("MM-SUB-004", 409, "投稿状态不允许该操作")
    SUB_005 = ErrorSpec("MM-SUB-005", 409, "同茶同字段已有待审核纠错")

    GOV_001 = ErrorSpec("MM-GOV-001", 409, "重复举报")
    GOV_002 = ErrorSpec("MM-GOV-002", 409, "已申诉，仅可申诉 1 次")
    GOV_003 = ErrorSpec("MM-GOV-003", 403, "不可处置自己")
    GOV_004 = ErrorSpec("MM-GOV-004", 409, "必须保留至少 1 名超管")

    SYS_001 = ErrorSpec("MM-SYS-001", 400, "参数校验失败")
    SYS_002 = ErrorSpec("MM-SYS-002", 429, "请求过于频繁")
    SYS_003 = ErrorSpec("MM-SYS-003", 500, "服务异常")
    SYS_004 = ErrorSpec("MM-SYS-004", 403, "配置项只读")


@dataclass
class BizException(Exception):
    """业务异常：由全局异常处理器统一转换为 HTTP 状态 + 错误体。"""

    spec: ErrorSpec
    message: str = ""
    details: list[dict] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.message:
            self.message = self.spec.message
        Exception.__init__(self, self.message)
