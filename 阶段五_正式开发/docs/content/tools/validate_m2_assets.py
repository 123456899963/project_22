# -*- coding: utf-8 -*-
"""M2 图片入库校验：检查文件、规格、必拍缺失与授权字段完整性。"""
import csv
import os
import sys

from openpyxl import load_workbook
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
XLSX = os.path.join(ROOT, "docs", "content", "M2_图片采集与授权台账.xlsx")
IMGDIR = os.path.join(ROOT, "prototype", "assets", "img", "tea")
REPORT = os.path.join(ROOT, "docs", "content", "M2_入库校验结果.csv")
MAX_BYTES = 5 * 1024 * 1024
AUTH_FIELDS = [11, 12, 13, 14, 15, 20, 21]  # 来源/权利人/范围/期限/凭证编号/核验人/核验日期

wb = load_workbook(XLSX, data_only=True)
ws = wb["采集台账"]
rows = []
for r in range(3, ws.max_row + 1):
    tid = ws.cell(r, 2).value
    if not tid:
        continue
    rows.append({
        "row": r, "seq": ws.cell(r, 1).value, "tea": tid, "name": ws.cell(r, 3).value,
        "no": ws.cell(r, 6).value, "type": ws.cell(r, 7).value,
        "must": str(ws.cell(r, 8).value or "").strip(),
        "file": ws.cell(r, 9).value, "status": str(ws.cell(r, 22).value or "").strip(),
        "auth": [ws.cell(r, c).value for c in AUTH_FIELDS],
    })

issues = []
warnings = []
present = 0
for item in rows:
    path = os.path.join(IMGDIR, item["tea"], item["file"] or "")
    row_issues = []
    if not item["file"]:
        row_issues.append("台账缺少文件名")
    elif not os.path.isfile(path):
        row_issues.append("文件缺失")
    else:
        present += 1
        size = os.path.getsize(path)
        if size > MAX_BYTES:
            row_issues.append("超过 5MB（%.1fMB）" % (size / 1024 / 1024))
        try:
            with Image.open(path) as im:
                w, h = im.size
                fmt = im.format
        except Exception as exc:
            row_issues.append("无法读取图片：%s" % exc)
            w = h = 0
            fmt = ""
        if w and h:
            ratio = w / h
            if abs(ratio - 4 / 3) > 0.02:
                row_issues.append("比例非 4:3（%dx%d）" % (w, h))
            if max(w, h) < 1200:
                row_issues.append("长边不足 1200px（%dx%d）" % (w, h))
            elif max(w, h) < 1600:
                warnings.append("%s 长边 %dpx，低于建议值 1600px" % (item["file"], max(w, h)))
            if fmt not in ("JPEG", "PNG", "WEBP"):
                row_issues.append("格式不支持：%s" % fmt)
    if item["status"] in ("已授权", "已入库"):
        missing = [n for n, v in zip(["来源类型", "权利人", "授权范围", "授权期限", "凭证编号", "核验人", "核验日期"], item["auth"]) if not str(v or "").strip()]
        if missing:
            row_issues.append("授权字段缺失：" + "、".join(missing))
    if row_issues:
        issues.append({"item": item, "problems": row_issues, "path": path})

must_missing = {}
for item in rows:
    if item["must"] == "是" and not os.path.isfile(os.path.join(IMGDIR, item["tea"], item["file"] or "")):
        must_missing[item["tea"]] = must_missing.get(item["tea"], 0) + 1

with open(REPORT, "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f)
    w.writerow(["序号", "茶品ID", "茶品", "图序", "图类型", "是否必拍", "文件名", "文件存在", "台账状态", "问题"])
    for item in rows:
        probs = next((x["problems"] for x in issues if x["item"]["row"] == item["row"]), [])
        w.writerow([item["seq"], item["tea"], item["name"], item["no"], item["type"], item["must"],
                    item["file"], "是" if os.path.isfile(os.path.join(IMGDIR, item["tea"], item["file"] or "")) else "否",
                    item["status"] or "（空）", "；".join(probs)])

print("M2 图片入库校验")
print("台账行数：%d" % len(rows))
print("已就位：%d，缺失：%d" % (present, len(rows) - present))
print("问题合计：%d（涉及 %d 张），提示：%d" % (sum(len(x["problems"]) for x in issues), len(issues), len(warnings)))
for tid, n in sorted(must_missing.items()):
    print("  必拍缺失 %-16s %d 张" % (tid, n))
if issues:
    print("\n问题明细：")
    for x in issues[:20]:
        print("  %s %s：%s" % (x["item"]["tea"], x["item"]["file"], "、".join(x["problems"])))
    if len(issues) > 20:
        print("  ... 其余 %d 条见报告" % (len(issues) - 20))
if warnings:
    print("\n提示：")
    for msg in warnings[:20]:
        print("  " + msg)
print("\n报告：%s" % REPORT)
sys.exit(0 if not issues else 1)
